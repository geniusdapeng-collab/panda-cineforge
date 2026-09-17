/**
 * 库存健康线（fast-scan SKILL.md 步骤 3）
 * 四个子项：
 *  1) 周转天数 >60 天积压（占用资金 = 库存量 × 成本）
 *  2) 可售天数 <7 天且在途 = 0 → 断货风险（>7 天预期断货窗口按动销估损失）
 *  3) 海外仓库龄 >90 天
 *  4) 仓间失衡：同 SKU 一仓断货一仓积压
 * 降级纪律：无 SKU 成本 → 占用资金降级为件数口径；无 avgDailySales → 周转/断货子项跳过。
 */
import type { AuditSnapshot, Finding, Severity } from "../types.js";
import { makeFinding, round2, type AnalyzerContext } from "./util.js";

/** 积压阈值：周转天数 >60（SKILL.md） */
export const OVERSTOCK_TURNOVER_DAYS = 60;
/** 断货阈值：可售天数 <7 且在途为 0（SKILL.md / R7 同源） */
export const STOCKOUT_DAYS = 7;
/** 海外仓库龄红线：>90 天（SKILL.md） */
export const OVERSEAS_AGE_DAYS = 90;

/** 单仓可售天数（动销为 0 视为正无穷——永动不了销，积压侧处理） */
function sellableDays(available: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return Number.POSITIVE_INFINITY;
  return available / avgDailySales;
}

export function analyzeInventory(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  void ctx; // 库存线为存量口径，不依赖时间窗
  const findings: Finding[] = [];
  const costBySku = new Map(snapshot.skuCosts.map((c) => [c.sku, c]));

  /* ---------- 子项 1：周转天数 >60 天积压 ---------- */
  for (const inv of snapshot.inventory) {
    if (inv.avgDailySales <= 0 && inv.available <= 0) continue;
    const turnover = inv.avgDailySales > 0 ? inv.available / inv.avgDailySales : Number.POSITIVE_INFINITY;
    if (turnover > OVERSTOCK_TURNOVER_DAYS) {
      const cost = costBySku.get(inv.sku);
      const tiedUp = cost && cost.currency === inv.currency ? round2(inv.available * cost.cost) : undefined;
      const severity: Severity = turnover > 120 || turnover === Number.POSITIVE_INFINITY ? "P1" : "P2";
      findings.push(
        makeFinding({
          line: "inventory",
          severity,
          // 库存记录不直接挂店铺（多店共仓），挂到快照首店口径由 engine 按 SKU 归属拆分；
          // 这里用仓维度记录，shopId 以仓库归属标注（演示数据一仓一店群）
          shopId: inv.warehouseId,
          title: `SKU ${inv.sku} 在 ${inv.warehouseName} 周转 ${turnover === Number.POSITIVE_INFINITY ? "∞" : round2(turnover)} 天，严重积压`,
          description: `库存 ${inv.available} 件，日均动销 ${inv.avgDailySales} 件，周转天数 ${turnover === Number.POSITIVE_INFINITY ? "∞（零动销）" : round2(turnover)} > 60 天红线。`,
          suggestion: "建议清仓促销/站外放量/调拨至动销仓；零动销 SKU 评估下架止损。",
          evidence: [{ kind: "inventory", id: `${inv.sku}@${inv.warehouseId}`, fields: { available: inv.available, avgDailySales: inv.avgDailySales } }],
          calculation: {
            formula: "周转天数 = 可用库存 / 日均动销；占用资金 = 库存量 × 成本",
            inputs: { sku: inv.sku, warehouse: inv.warehouseId, available: inv.available, avgDailySales: inv.avgDailySales, cost: cost?.cost ?? "缺失" },
            result: `${turnover === Number.POSITIVE_INFINITY ? "∞" : round2(turnover)} 天`,
          },
          ...(tiedUp !== undefined
            ? {
                estimatedImpact: {
                  amount: tiedUp,
                  currency: inv.currency,
                  period: "one-off" as const,
                  confidence: "exact" as const,
                  basis: `占用资金 = ${inv.available} 件 × 成本 ${cost!.cost}`,
                },
              }
            : {}),
        }),
      );
    }
  }

  /* ---------- 子项 2：可售天数 <7 且在途 = 0 → 断货风险 ---------- */
  for (const inv of snapshot.inventory) {
    const days = sellableDays(inv.available, inv.avgDailySales);
    if (days < STOCKOUT_DAYS && inv.inTransit === 0) {
      // 断货预期损失：按动销 × 单价 × 预计断货窗口（补货周期按 7 天经验口径）
      const listing = snapshot.listings.find((l) => l.sku === inv.sku && l.status === "on-sale" && l.currency === inv.currency);
      const gapDays = round2(STOCKOUT_DAYS - days);
      const lost = listing ? round2(inv.avgDailySales * listing.price * gapDays) : undefined;
      findings.push(
        makeFinding({
          line: "inventory",
          severity: days <= 3 ? "P0" : "P1",
          shopId: inv.warehouseId,
          title: `SKU ${inv.sku} 在 ${inv.warehouseName} 仅剩 ${round2(days)} 天可售，断货风险`,
          description: `可售 ${round2(days)} 天 < 7 天预警线，且补货在途为 0。`,
          suggestion: "建议立即发起紧急采购/调拨；同步广告侧降量避免空烧。",
          evidence: [{ kind: "inventory", id: `${inv.sku}@${inv.warehouseId}`, fields: { available: inv.available, inTransit: inv.inTransit, avgDailySales: inv.avgDailySales } }],
          calculation: {
            formula: "可售天数 = 可用库存 / 日均动销；命中条件：可售 <7 且 在途=0",
            inputs: { sku: inv.sku, warehouse: inv.warehouseId, available: inv.available, inTransit: inv.inTransit, avgDailySales: inv.avgDailySales },
            result: `${round2(days)} 天`,
          },
          ...(lost !== undefined
            ? {
                estimatedImpact: {
                  amount: lost,
                  currency: inv.currency,
                  period: "one-off" as const,
                  confidence: "estimate" as const,
                  basis: `日均 ${inv.avgDailySales} 件 × 售价 ${listing!.price} × 预计断货 ${gapDays} 天（补货周期按 7 天经验口径）`,
                },
              }
            : {}),
        }),
      );
    }
  }

  /* ---------- 子项 3：海外仓库龄 >90 天 ---------- */
  for (const inv of snapshot.inventory) {
    if (inv.warehouseType !== "overseas" || inv.ageDays === undefined) continue;
    if (inv.ageDays > OVERSEAS_AGE_DAYS && inv.available > 0) {
      const cost = costBySku.get(inv.sku);
      const tiedUp = cost && cost.currency === inv.currency ? round2(inv.available * cost.cost) : undefined;
      findings.push(
        makeFinding({
          line: "inventory",
          severity: inv.ageDays > 180 ? "P0" : "P1",
          shopId: inv.warehouseId,
          title: `SKU ${inv.sku} 在 ${inv.warehouseName} 库龄 ${inv.ageDays} 天，超 90 天红线`,
          description: `海外仓长期库存产生高额仓储费并有弃置风险；在库 ${inv.available} 件。`,
          suggestion: "建议站外清仓/移仓回国/弃置评估三选一，本月内决策。",
          evidence: [{ kind: "inventory", id: `${inv.sku}@${inv.warehouseId}`, fields: { ageDays: inv.ageDays, available: inv.available } }],
          calculation: {
            formula: "海外仓 库龄 > 90 天",
            inputs: { sku: inv.sku, warehouse: inv.warehouseId, ageDays: inv.ageDays, available: inv.available },
            result: `${inv.ageDays} > 90`,
          },
          ...(tiedUp !== undefined
            ? {
                estimatedImpact: {
                  amount: tiedUp,
                  currency: inv.currency,
                  period: "one-off" as const,
                  confidence: "exact" as const,
                  basis: `占用资金 = ${inv.available} 件 × 成本 ${cost!.cost}`,
                },
              }
            : {}),
        }),
      );
    }
  }

  /* ---------- 子项 4：仓间失衡（同 SKU 一仓断货一仓积压） ---------- */
  const bySku = new Map<string, typeof snapshot.inventory>();
  for (const inv of snapshot.inventory) {
    const arr = bySku.get(inv.sku) ?? [];
    arr.push(inv);
    bySku.set(inv.sku, arr);
  }
  for (const [sku, rows] of bySku) {
    if (rows.length < 2) continue;
    const starving = rows.filter((r) => sellableDays(r.available, r.avgDailySales) < STOCKOUT_DAYS && r.inTransit === 0);
    const bloated = rows.filter((r) => r.avgDailySales >= 0 && r.available / Math.max(r.avgDailySales, 0.0001) > OVERSTOCK_TURNOVER_DAYS && r.available > 0);
    for (const s of starving) {
      for (const b of bloated) {
        if (s.warehouseId === b.warehouseId) continue;
        findings.push(
          makeFinding({
            line: "inventory",
            severity: "P1",
            shopId: s.warehouseId,
            title: `SKU ${sku} 仓间失衡：${s.warehouseName} 断货边缘 / ${b.warehouseName} 积压`,
            description: `${s.warehouseName} 可售 ${round2(sellableDays(s.available, s.avgDailySales))} 天且在途 0；同 SKU 在 ${b.warehouseName} 积压 ${b.available} 件。`,
            suggestion: `建议从 ${b.warehouseName} 向 ${s.warehouseName} 发起调拨，一单解双患。`,
            evidence: [
              { kind: "inventory", id: `${sku}@${s.warehouseId}`, fields: { available: s.available } },
              { kind: "inventory", id: `${sku}@${b.warehouseId}`, fields: { available: b.available } },
            ],
            calculation: {
              formula: "同 SKU：仓A 可售<7 且 在途=0，仓B 周转>60 天",
              inputs: { sku, starvingWarehouse: s.warehouseId, bloatedWarehouse: b.warehouseId },
              result: "失衡",
            },
          }),
        );
      }
    }
  }

  return findings;
}
