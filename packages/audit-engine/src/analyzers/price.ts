/**
 * 价格健康线（fast-scan SKILL.md 步骤 2）
 * 三个子项：
 *  1) 同 SKU 跨平台价差 >15% 倒挂（>20% 升 P0）
 *  2) 售价 < 货品成本 ×1.15 毛利破防（<成本 ×1.0 升 P0）
 *  3) 售价低于近 30 天最低成交价（价保风险）
 * 降级纪律：无 SKU 成本主数据 → 子项 2 跳过；无订单 → 子项 3 跳过（engine 据此标 partial）。
 */
import type { AuditSnapshot, Finding } from "../types.js";
import { daysSince, makeFinding, round2, windowStart, type AnalyzerContext } from "./util.js";

/** 倒挂告警阈值（SKILL.md：价差 >15%） */
export const PARITY_GAP_THRESHOLD = 0.15;
/** 倒挂升 P0 阈值 */
export const PARITY_GAP_P0 = 0.2;
/** 毛利红线倍数（SKILL.md：成本 ×1.15） */
export const MARGIN_FLOOR_RATIO = 1.15;

export function analyzePrice(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  const findings: Finding[] = [];
  const costBySku = new Map(snapshot.skuCosts.map((c) => [c.sku, c]));
  const shopById = new Map(snapshot.shops.map((s) => [s.shopId, s]));
  const onSale = snapshot.listings.filter((l) => l.status === "on-sale");

  /* ---------- 子项 1：同 SKU 跨店（跨平台）价差 >15% 倒挂 ---------- */
  const bySku = new Map<string, typeof onSale>();
  for (const l of onSale) {
    const arr = bySku.get(l.sku) ?? [];
    arr.push(l);
    bySku.set(l.sku, arr);
  }
  for (const [sku, rows] of bySku) {
    // 倒挂只对跨店铺/跨平台有意义：同店多链接不比价
    const shopIds = new Set(rows.map((r) => r.shopId));
    if (shopIds.size < 2) continue;
    // 跨币种不比价（报告层才做汇率折算，引擎保持同币种确定性）
    const currencies = new Set(rows.map((r) => r.currency));
    if (currencies.size > 1) continue;
    let minRow = rows[0]!;
    let maxRow = rows[0]!;
    for (const r of rows) {
      if (r.price < minRow.price) minRow = r;
      if (r.price > maxRow.price) maxRow = r;
    }
    const gap = (maxRow.price - minRow.price) / maxRow.price;
    if (gap > PARITY_GAP_THRESHOLD) {
      const shop = shopById.get(minRow.shopId);
      // 近 30 天该 SKU 在低价店的销量 × 价差 = 可挽回毛利（baseline：按动销口径估算）
      const recentQty = snapshot.orders
        .filter(
          (o) =>
            o.shopId === minRow.shopId &&
            o.sku === sku &&
            o.status !== "pending-payment" &&
            o.status !== "closed" &&
            Date.parse(o.createdAt) >= windowStart(ctx.now, 30),
        )
        .reduce((s, o) => s + o.qty, 0);
      const perUnit = round2(maxRow.price - minRow.price);
      findings.push(
        makeFinding({
          line: "price",
          severity: gap > PARITY_GAP_P0 ? "P0" : "P1",
          shopId: minRow.shopId,
          title: `SKU ${sku} 跨平台价格倒挂 ${(gap * 100).toFixed(1)}%`,
          description: `${shop?.shopName ?? minRow.shopId} 售价 ${minRow.price} ${minRow.currency}，全网最高 ${
            shopById.get(maxRow.shopId)?.shopName ?? maxRow.shopId
          } ${maxRow.price}，价差 ${(gap * 100).toFixed(1)}% > 15% 告警线。低价店正在补贴高价店流量。`,
          suggestion: `建议低价店提价至 ${round2(maxRow.price * (1 - PARITY_GAP_THRESHOLD))} 以上，或排查是否被跟卖/促销忘恢复。`,
          evidence: [
            { kind: "listing", id: minRow.listingId, fields: { shopId: minRow.shopId, price: minRow.price } },
            { kind: "listing", id: maxRow.listingId, fields: { shopId: maxRow.shopId, price: maxRow.price } },
          ],
          calculation: {
            formula: "gap = (最高价 - 最低价) / 最高价",
            inputs: { sku, minPrice: minRow.price, maxPrice: maxRow.price, minShop: minRow.shopId, maxShop: maxRow.shopId },
            result: round2(gap * 100) + "%",
          },
          ...(recentQty > 0
            ? {
                estimatedImpact: {
                  amount: round2(perUnit * recentQty),
                  currency: minRow.currency,
                  period: "monthly" as const,
                  confidence: "baseline" as const,
                  basis: `近30天低价店销量 ${recentQty} 件 × 单位价差 ${perUnit}`,
                },
              }
            : {}),
        }),
      );
    }
  }

  /* ---------- 子项 2：售价 < 成本 ×1.15 毛利破防 ---------- */
  for (const l of onSale) {
    const cost = costBySku.get(l.sku);
    if (!cost || cost.currency !== l.currency) continue;
    const floor = cost.cost * MARGIN_FLOOR_RATIO;
    if (l.price < floor) {
      const recentQty = snapshot.orders
        .filter(
          (o) =>
            o.shopId === l.shopId &&
            o.sku === l.sku &&
            o.status !== "pending-payment" &&
            o.status !== "closed" &&
            Date.parse(o.createdAt) >= windowStart(ctx.now, 30),
        )
        .reduce((s, o) => s + o.qty, 0);
      findings.push(
        makeFinding({
          line: "price",
          severity: l.price < cost.cost ? "P0" : "P1",
          shopId: l.shopId,
          title: `SKU ${l.sku} 售价击穿毛利红线（${shopById.get(l.shopId)?.shopName ?? l.shopId}）`,
          description: `售价 ${l.price} < 成本 ${cost.cost} ×1.15 = ${round2(floor)}，毛利不足以覆盖佣金与物流。${
            l.price < cost.cost ? "售价已低于货品成本，卖一件亏一件。" : ""
          }`,
          suggestion: `建议提价至 ${round2(floor)} 以上；若为引流款，需在店铺档案标注豁免并限量。`,
          evidence: [
            { kind: "listing", id: l.listingId, fields: { price: l.price, sku: l.sku } },
            { kind: "sku-cost", id: l.sku, fields: { cost: cost.cost } },
          ],
          calculation: {
            formula: "售价 < 成本 × 1.15",
            inputs: { sku: l.sku, price: l.price, cost: cost.cost, floor: round2(floor) },
            result: `${l.price} < ${round2(floor)}`,
          },
          ...(recentQty > 0
            ? {
                estimatedImpact: {
                  amount: round2((floor - l.price) * recentQty),
                  currency: l.currency,
                  period: "monthly" as const,
                  confidence: "baseline" as const,
                  basis: `近30天销量 ${recentQty} 件 × 单位差额 ${round2(floor - l.price)}`,
                },
              }
            : {}),
        }),
      );
    }
  }

  /* ---------- 子项 3：售价低于近 30 天最低成交价（价保风险） ---------- */
  for (const l of onSale) {
    const deals = snapshot.orders.filter(
      (o) =>
        o.shopId === l.shopId &&
        o.sku === l.sku &&
        o.qty > 0 &&
        o.status !== "pending-payment" &&
        o.status !== "closed" &&
        daysSince(ctx.now, o.createdAt) <= 30,
    );
    if (deals.length === 0) continue;
    const minDeal = Math.min(...deals.map((o) => o.amount / o.qty));
    if (l.price < minDeal) {
      findings.push(
        makeFinding({
          line: "price",
          severity: "P2",
          shopId: l.shopId,
          title: `SKU ${l.sku} 现价低于近30天最低成交价（价保风险）`,
          description: `当前售价 ${l.price} 低于近 30 天最低成交价 ${round2(minDeal)}，价保期内订单可能触发补差。`,
          suggestion: "核对是否为促销忘恢复；若在价保期，预估补差敞口并同步客服话术。",
          evidence: [{ kind: "listing", id: l.listingId, fields: { price: l.price, minDealPrice: round2(minDeal) } }],
          calculation: {
            formula: "当前售价 < min(近30天订单 amount/qty)",
            inputs: { sku: l.sku, price: l.price, minDealPrice: round2(minDeal), orderCount: deals.length },
            result: `${l.price} < ${round2(minDeal)}`,
          },
        }),
      );
    }
  }

  return findings;
}
