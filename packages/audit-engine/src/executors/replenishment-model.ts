/**
 * executors/replenishment-model.ts —— replenishment-model★ 执行体：补货模型（纯函数）
 *
 * SKILL.md 口径机器化：补货点 = 日销 × (头程天数 + 安全天数)；补货量 = 目标覆盖天数 × 日销 − 在库 − 在途。
 * 头程天数直接取 shipments 八节点实际均值（真实化后自动变准）——"表格里的真实口径"。
 * 纯函数无 DB 依赖（单测友好）；DB 装载层在 stockout-guard / 决策卡片处复用。
 */
import { round2, type ExecutorResult } from "./types.js";

export interface ReplenishInput {
  sku: string;
  shopId: string;
  dailySales: number;       // 日销（件/天）
  qtyOnHand: number;        // 在库可售
  inTransitUnits: number;   // 在途件数
  leadTimeDays: number;     // 头程天数（shipments 节点均值或卖家表格口径）
  safetyDays: number;       // 安全天数（默认 7，与 R7 断货红线同源）
  targetCoverDays: number;  // 目标覆盖天数（默认 45，与大卖库存周转目标同源）
}

export interface ReplenishPlan {
  sku: string;
  shopId: string;
  reorderPoint: number;     // 补货点（件）
  suggestQty: number;       // 建议补货量（件；0=暂不补）
  daysCoverNow: number;     // 当前覆盖天数
  urgency: "critical" | "soon" | "ok"; // critical=已破补货点；soon=7 天内破点
}

export function planReplenishment(inputs: ReplenishInput[]): ReplenishPlan[] {
  return inputs
    .map((x) => {
      const reorderPoint = Math.ceil(x.dailySales * (x.leadTimeDays + x.safetyDays));
      const daysCoverNow = x.dailySales > 0 ? round2(x.qtyOnHand / x.dailySales) : Number.POSITIVE_INFINITY;
      const rawQty = Math.ceil(x.dailySales * x.targetCoverDays) - x.qtyOnHand - x.inTransitUnits;
      const suggestQty = Math.max(0, rawQty);
      const breakInDays = x.dailySales > 0 ? (x.qtyOnHand - reorderPoint) / x.dailySales : Number.POSITIVE_INFINITY;
      const urgency: ReplenishPlan["urgency"] =
        x.qtyOnHand <= reorderPoint ? "critical" : breakInDays <= 7 ? "soon" : "ok";
      return { sku: x.sku, shopId: x.shopId, reorderPoint, suggestQty, daysCoverNow, urgency };
    })
    .sort((a, b) => {
      const rank = (u: ReplenishPlan["urgency"]) => (u === "critical" ? 0 : u === "soon" ? 1 : 2);
      return rank(a.urgency) - rank(b.urgency) || b.suggestQty - a.suggestQty;
    });
}

/** 头程天数实测：shipments 八节点（departed→signed）实际天数均值（无实测时回落 defaultDays） */
export function avgLeadTimeDays(
  shipments: Array<{ departedAt: string; signedAt?: string }>,
  defaultDays = 35,
): number {
  const done = shipments
    .filter((s) => s.signedAt)
    .map((s) => (new Date(s.signedAt!).getTime() - new Date(s.departedAt).getTime()) / 86_400_000)
    .filter((d) => d > 0 && d < 180);
  if (done.length === 0) return defaultDays;
  return round2(done.reduce((s, x) => s + x, 0) / done.length);
}

export function execReplenishmentModel(inputs: ReplenishInput[]): ExecutorResult<{ plans: ReplenishPlan[] }> {
  const plans = planReplenishment(inputs);
  const critical = plans.filter((p) => p.urgency === "critical");
  const totalQty = plans.reduce((s, p) => s + p.suggestQty, 0);
  return {
    skill: "replenishment-model",
    generatedAt: new Date().toISOString(),
    headline: { label: "建议补货总量", value: totalQty, unit: "count" },
    detail: { plans },
    traces: [{
      formula: "补货点 = 日销 × (头程天数 + 安全天数)；补货量 = 日销 × 目标覆盖 − 在库 − 在途",
      inputs: { skus: inputs.length, critical: critical.length },
      result: `破点 ${critical.length} 个 SKU；建议补货 ${totalQty} 件`,
    }],
    narrativeHints: [
      critical.length > 0
        ? `已破补货点：${critical.slice(0, 5).map((p) => p.sku).join("、")}${critical.length > 5 ? " 等" : ""}——今日不下单，断货倒计时开始`
        : "全部 SKU 在补货点之上",
      "头程天数取 shipments 八节点实测均值；批次不足时回落 35 天默认口径",
    ],
    actions: [
      { label: "破点 SKU 生成紧急采购单（≥¥5万必审）", fenceRule: "R20", level: "review" },
      { label: "补货计划加入夜班批量执行", fenceRule: "R16", level: "auto" },
    ],
  };
}
