/**
 * executors/stockout-guard.ts —— stockout-guard★ 执行体：断货守护与库龄结构
 *
 * SKILL.md 口径机器化：断货 <7 天紧急采购请示（R7）；库龄 90+ 天压现金（R6 清仓请示联动）。
 * 数据源 = inventory_ageing（0027 ⑧ 库龄分桶快照）+ shipments 在途（②⑥⑦）。
 * 纯函数层（guardFromSnapshot）与 DB 装载层分离，单测不依赖数据库。
 */
import { round2, type ExecutorResult, type Queryable } from "./types.js";

export const STOCKOUT_DAYS_REDLINE = 7;   // R7 同源
export const AGEING_CASHLINE_BUCKET = "90+"; // inventory-cashline★ 现金线

export interface StockoutRisk {
  sku: string;
  shopId: string;
  qtyOnHand: number;
  dailySales: number;
  daysCover: number;          // qtyOnHand / dailySales
  inTransitUnits: number;     // 在途件数（未到 signed 节点）
  breached: boolean;          // daysCover < 7
}

export interface AgeingStructure {
  bucket: string;
  qty: number;
  valueAmount: number;
  pctOfValue: number;
}

/** 纯函数：断货风险判定（库存覆盖天数 <7 触发 R7） */
export function guardFromSnapshot(
  stocks: Array<{ sku: string; shopId: string; qtyOnHand: number; dailySales: number }>,
  inTransit: Array<{ sku: string; units: number }>,
): StockoutRisk[] {
  const transitBySku = new Map<string, number>();
  for (const t of inTransit) transitBySku.set(t.sku, (transitBySku.get(t.sku) ?? 0) + t.units);
  return stocks
    .map((s) => {
      const daysCover = s.dailySales > 0 ? round2(s.qtyOnHand / s.dailySales) : Number.POSITIVE_INFINITY;
      return {
        sku: s.sku, shopId: s.shopId, qtyOnHand: s.qtyOnHand, dailySales: s.dailySales,
        daysCover, inTransitUnits: transitBySku.get(s.sku) ?? 0,
        breached: daysCover < STOCKOUT_DAYS_REDLINE,
      };
    })
    .sort((a, b) => a.daysCover - b.daysCover);
}

/** 纯函数：库龄结构（90+ 天货值占比 = 库存现金线健康度） */
export function ageingStructure(
  rows: Array<{ bucket: string; qty: number; valueAmount: number }>,
): AgeingStructure[] {
  const totalValue = rows.reduce((s, x) => s + x.valueAmount, 0);
  return ["0-30", "31-60", "61-90", "90+"].map((bucket) => {
    const hit = rows.filter((x) => x.bucket === bucket);
    const qty = hit.reduce((s, x) => s + x.qty, 0);
    const valueAmount = round2(hit.reduce((s, x) => s + x.valueAmount, 0));
    return { bucket, qty, valueAmount, pctOfValue: totalValue > 0 ? round2((valueAmount / totalValue) * 100) : 0 };
  });
}

export async function execStockoutGuard(
  q: Queryable, workspaceId: string,
): Promise<ExecutorResult<{ risks: StockoutRisk[]; ageing: AgeingStructure[] }>> {
  // 库龄最新快照（每店每 SKU 取最近 snapshot_date）
  const ageingRows = await q.query<{ bucket: string; qty: string; value_amount: string }>(
    `SELECT bucket, SUM(qty)::text AS qty, SUM(value_amount)::text AS value_amount
       FROM inventory_ageing
      WHERE workspace_id = $1
        AND snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_ageing WHERE workspace_id = $1)
      GROUP BY bucket`,
    [workspaceId],
  );
  // 在途（未签收）按 SKU 聚合
  const transitRows = await q.query<{ sku: string; units: string }>(
    `SELECT it->>'sku' AS sku, SUM((it->>'qty')::int)::text AS units
       FROM shipments s, jsonb_array_elements(s.items) it
      WHERE s.workspace_id = $1 AND s.status NOT IN ('signed','shelved','lost','canceled')
      GROUP BY it->>'sku'`,
    [workspaceId],
  );
  // 现库存（90 天内桶视为可售库存；日销暂无交易表，走库龄 0-30 天流入近似——口径见 narrativeHints）
  const stockRows = await q.query<{ sku: string; shop_id: string; qty: string; inflow30: string }>(
    `SELECT sku, shop_id,
            SUM(qty) FILTER (WHERE bucket <> '90+')::text AS qty,
            SUM(qty) FILTER (WHERE bucket = '0-30')::text AS inflow30
       FROM inventory_ageing
      WHERE workspace_id = $1
        AND snapshot_date = (SELECT MAX(snapshot_date) FROM inventory_ageing WHERE workspace_id = $1)
      GROUP BY sku, shop_id`,
    [workspaceId],
  );

  const risks = guardFromSnapshot(
    stockRows.rows.map((x) => ({
      sku: x.sku, shopId: x.shop_id,
      qtyOnHand: Number(x.qty),
      dailySales: round2(Number(x.inflow30) / 30), // 近似日销：30 天流入/30（保守口径）
    })),
    transitRows.rows.map((x) => ({ sku: x.sku, units: Number(x.units) })),
  );
  const ageing = ageingStructure(
    ageingRows.rows.map((x) => ({ bucket: x.bucket, qty: Number(x.qty), valueAmount: Number(x.value_amount) })),
  );

  const breached = risks.filter((x) => x.breached);
  const ageing90 = ageing.find((x) => x.bucket === AGEING_CASHLINE_BUCKET);
  const cashlineValue = ageing90?.valueAmount ?? 0;
  return {
    skill: "stockout-guard",
    generatedAt: new Date().toISOString(),
    headline: { label: "断货风险 SKU 数", value: breached.length, unit: "count" },
    detail: { risks, ageing },
    traces: [
      {
        formula: "覆盖天数 = 可售库存 / 近似日销（30天流入/30）；<7 天触发 R7",
        inputs: { skus: risks.length },
        result: `断货风险 ${breached.length} 个 SKU`,
      },
      {
        formula: "库龄结构 = 最新快照按桶聚合货值占比",
        inputs: {},
        result: `90+ 天货值 ¥${cashlineValue.toLocaleString()}（${ageing90?.pctOfValue ?? 0}%）`,
      },
    ],
    narrativeHints: [
      breached.length > 0
        ? `断货 <7 天：${breached.slice(0, 5).map((x) => x.sku).join("、")}${breached.length > 5 ? " 等" : ""}——爆款断货 7 天，排名和流量权重跌回解放前`
        : "暂无 7 天内断货风险",
      cashlineValue > 0 ? `90+ 天库龄压现金 ¥${cashlineValue.toLocaleString()}，建议清仓评估（R6）` : "库龄结构健康",
      "日销为 30 天流入近似口径；接入真实订单连接器后切换为实际日销（P1）",
    ],
    actions: [
      { label: "断货风险 SKU 发起紧急采购请示", fenceRule: "R7", level: "review" },
      { label: "90+ 天库龄发起清仓请示", fenceRule: "R6", level: "review" },
    ],
  };
}
