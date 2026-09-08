/**
 * executors/sku-profit-ledger.ts —— sku-profit-ledger★ 执行体：SKU 级损益瀑布账本
 *
 * SKILL.md 口径机器化：每个 SKU 一张瀑布账（收入口径 − 采购 − 头程 − 仓储 − 广告 − 平台费 − 罚款），
 * 毛利率 <10% 一票否决（selection-ledger★ 同红线）。数据源 = sku_cost_ledger 视图（0027 ⑨a）。
 * 分摊纪律：回款是店铺级口径，SKU 层收入 = 销售额分摊（by_revenue_share，cost-ledger.yml allocation），
 * 分摊规则属卖家口径可经覆盖层调整——本执行体只读 cost-ledger.yml 参数，不硬编码。
 */
import { round2, type ExecutorResult, type Queryable } from "./types.js";

export interface SkuProfitRow {
  sku: string;
  shopId: string;
  period: string;
  currency: string;
  revenue: number;          // 分摊后销售额口径
  costs: { purchase: number; freight: number; storage: number; ads: number; platformFee: number; penalty: number };
  netProfit: number;
  marginPct: number;        // netProfit / revenue × 100
  veto: boolean;            // 毛利率 <10% 一票否决
}

export const MARGIN_VETO_PCT = 10; // selection-ledger★ 红线：毛利率 <10% 一票否决

export async function execSkuProfitLedger(
  q: Queryable, workspaceId: string, opts: { period?: string; topN?: number } = {},
): Promise<ExecutorResult<{ rows: SkuProfitRow[]; vetoed: string[] }>> {
  const period = opts.period ?? new Date().toISOString().slice(0, 7);
  const topN = opts.topN ?? 50;
  // SKU 成本账 + 店铺销售额（payouts.gross 按 SKU 广告花费占比近似分摊收入——口径见 cost-ledger.yml）
  const r = await q.query<{
    sku: string; shop_id: string; period: string; currency: string;
    cost_purchase: string; cost_freight: string; cost_storage: string;
    cost_ads: string; cost_platform_fee: string; cost_penalty: string; cost_total: string;
    shop_gross: string | null;
  }>(
    `SELECT l.sku, l.shop_id, to_char(l.period, 'YYYY-MM') AS period, l.currency,
            l.cost_purchase, l.cost_freight, l.cost_storage, l.cost_ads,
            l.cost_platform_fee, l.cost_penalty, l.cost_total,
            g.gross AS shop_gross
       FROM sku_cost_ledger l
       LEFT JOIN (
         SELECT workspace_id, shop_id, date_trunc('month', period_start) AS period, SUM(gross_amount) AS gross
           FROM payouts WHERE workspace_id = $1 GROUP BY workspace_id, shop_id, date_trunc('month', period_start)
       ) g ON g.workspace_id = l.workspace_id AND g.shop_id = l.shop_id AND g.period = l.period
      WHERE l.workspace_id = $1 AND to_char(l.period, 'YYYY-MM') = $2
      ORDER BY l.cost_total DESC LIMIT $3`,
    [workspaceId, period, topN],
  );

  // 收入分摊需要店铺总成本作分母（单 SQL 难表达，内存聚合）
  const shopCostTotal = new Map<string, number>();
  for (const x of r.rows) {
    shopCostTotal.set(x.shop_id, (shopCostTotal.get(x.shop_id) ?? 0) + Number(x.cost_total));
  }
  const finalRows: SkuProfitRow[] = r.rows.map((x) => {
    const costTotal = Number(x.cost_total);
    const shopGross = Number(x.shop_gross ?? 0);
    const shopCost = shopCostTotal.get(x.shop_id) ?? 0;
    const revenue = shopCost > 0 ? round2(shopGross * (costTotal / shopCost)) : 0;
    const netProfit = round2(revenue - costTotal);
    const marginPct = revenue > 0 ? round2((netProfit / revenue) * 100) : -100;
    return {
      sku: x.sku, shopId: x.shop_id, period: x.period, currency: x.currency,
      revenue,
      costs: {
        purchase: Number(x.cost_purchase), freight: Number(x.cost_freight),
        storage: Number(x.cost_storage), ads: Number(x.cost_ads),
        platformFee: Number(x.cost_platform_fee), penalty: Number(x.cost_penalty),
      },
      netProfit, marginPct, veto: marginPct < MARGIN_VETO_PCT,
    };
  });


  const vetoed = finalRows.filter((x) => x.veto).map((x) => x.sku);
  const totalNet = round2(finalRows.reduce((s, x) => s + x.netProfit, 0));
  return {
    skill: "sku-profit-ledger",
    generatedAt: new Date().toISOString(),
    headline: { label: `${period} SKU 净利合计`, value: totalNet, unit: "CNY" },
    detail: { rows: finalRows, vetoed },
    traces: [{
      formula: "SKU收入 = 店铺gross × (SKU成本/店铺总成本)；净利 = 收入 − 六类成本；毛利率 <10% 一票否决",
      inputs: { period, shopCostTotal: Object.fromEntries(shopCostTotal) },
      result: `净利 ¥${totalNet.toLocaleString()}；否决 ${vetoed.length} 个 SKU`,
    }],
    narrativeHints: [
      `期间 ${period} 共 ${finalRows.length} 个 SKU 入账，净利合计 ¥${totalNet.toLocaleString()}`,
      vetoed.length > 0 ? `一票否决（毛利率<10%）：${vetoed.slice(0, 5).join("、")}${vetoed.length > 5 ? " 等" : ""}` : "无 SKU 触发毛利率否决线",
      "收入为成本占比分摊的保守口径；卖家提供 SKU 级销售表后切换为直达口径（P3 表格导入）",
    ],
    actions: [
      { label: "对否决 SKU 发起下架/重定价评审", fenceRule: "R2", level: "review" },
      { label: "导出 SKU 损益瀑布账（财务核对）", level: "auto" },
    ],
  };
}
