/**
 * executors/fx-reprice.ts —— fx-reprice★ 执行体：汇率波动重定价（纯函数）
 *
 * SKILL.md 口径机器化：汇率波动 >2% 触发重定价评估（R14 同源）；
 * 新价 = 成本 × (1 + 目标毛利率) × 新汇率，且必须过毛利红线 R2（售价 ≥ 成本×1.15，币种折算后）。
 * 纯函数无 DB 依赖；汇率快照由 fx_rate 对象事件或卖家表格导入提供。
 */
import { round2, type ExecutorResult } from "./types.js";

export const FX_MOVE_THRESHOLD = 0.02;      // R14：波动 >2% 触发
export const MARGIN_FLOOR_RATIO = 1.15;     // R2：售价 ≥ 成本 ×1.15（物理熔断同源）

export interface FxRepriceInput {
  sku: string;
  shopId: string;
  costCny: number;            // 人民币成本（单件）
  currentPrice: number;       // 现售价（站点币种）
  siteCurrency: string;       // 站点币种（USD/EUR/GBP…）
  fxAtPricing: number;        // 定价时汇率（1 站点币 = fxAtPricing 元 CNY）
  fxNow: number;              // 当前汇率
  targetMarginPct: number;    // 目标毛利率（%，如 25）
}

export interface FxRepricePlan {
  sku: string;
  shopId: string;
  siteCurrency: string;
  fxMovePct: number;          // (fxNow − fxAtPricing) / fxAtPricing × 100（正=本币贬值=利好利润）
  currentPrice: number;
  suggestedPrice: number;     // 建议新价（站点币种）
  marginPctNow: number;       // 现毛利（按 fxNow 折算）
  marginPctAfter: number;
  breached: boolean;          // |fxMovePct| > 2%
  fenceR2Pass: boolean;       // 新价过 R2 毛利红线
}

export function planFxReprice(inputs: FxRepriceInput[]): FxRepricePlan[] {
  return inputs
    .map((x) => {
      const movePct = round2(((x.fxNow - x.fxAtPricing) / x.fxAtPricing) * 100);
      const marginNow = x.currentPrice > 0
        ? round2(((x.currentPrice * x.fxNow - x.costCny) / (x.currentPrice * x.fxNow)) * 100)
        : -100;
      // 目标价：成本 × (1+目标毛利率) / 当前汇率（保持目标毛利不变，把汇率波动还给价格）
      const raw = (x.costCny * (1 + x.targetMarginPct / 100)) / x.fxNow;
      // R2 红线：售价折算后必须 ≥ 成本 ×1.15（物理熔断同源，执行层预检）
      const floor = (x.costCny * MARGIN_FLOOR_RATIO) / x.fxNow;
      const suggested = round2(Math.max(raw, floor) * 100) / 100;
      const marginAfter = suggested > 0
        ? round2(((suggested * x.fxNow - x.costCny) / (suggested * x.fxNow)) * 100)
        : -100;
      return {
        sku: x.sku, shopId: x.shopId, siteCurrency: x.siteCurrency,
        fxMovePct: movePct, currentPrice: x.currentPrice, suggestedPrice: suggested,
        marginPctNow: marginNow, marginPctAfter: marginAfter,
        breached: Math.abs(movePct) / 100 > FX_MOVE_THRESHOLD,
        fenceR2Pass: suggested * x.fxNow >= x.costCny * MARGIN_FLOOR_RATIO,
      };
    })
    .filter((p) => p.breached)
    .sort((a, b) => Math.abs(b.fxMovePct) - Math.abs(a.fxMovePct));
}

export function execFxReprice(inputs: FxRepriceInput[]): ExecutorResult<{ plans: FxRepricePlan[] }> {
  const plans = planFxReprice(inputs);
  const r2Blocked = plans.filter((p) => !p.fenceR2Pass);
  return {
    skill: "fx-reprice",
    generatedAt: new Date().toISOString(),
    headline: { label: "待重定价 SKU 数", value: plans.length, unit: "count" },
    detail: { plans },
    traces: [{
      formula: "波动 = (现汇率 − 定价汇率)/定价汇率 >2% 触发；新价 = 成本×(1+目标毛利率)/现汇率，且 ≥ 成本×1.15/现汇率（R2）",
      inputs: { skus: inputs.length, triggered: plans.length },
      result: `触发 ${plans.length} 个；R2 预检拦截 ${r2Blocked.length} 个`,
    }],
    narrativeHints: [
      plans.length > 0
        ? `汇率波动越线：${plans.slice(0, 3).map((p) => `${p.sku}（${p.fxMovePct > 0 ? "+" : ""}${p.fxMovePct}%）`).join("、")}——一波波动吃掉一个点的净利`
        : "汇率波动在 ±2% 安全带内",
      r2Blocked.length > 0 ? `${r2Blocked.length} 个 SKU 重定价撞 R2 毛利红线，转人工评审（物理熔断不豁免）` : "全部建议价通过 R2 预检",
    ],
    actions: [
      { label: "重定价评估单走 R14 流程", fenceRule: "R14", level: "review" },
      { label: "撞 R2 红线的报价物理熔断", fenceRule: "R2", level: "block" },
    ],
  };
}
