/**
 * executors/multi-platform-reconciler.ts —— multi-platform-reconciler★ 执行体：多平台账单勾稽
 *
 * SKILL.md 口径机器化（DB 版）：payouts 平台扣费（fee_amount）与 cost_items.platform_fee
 * 逐店逐期对平；差异率 >0.3% 升级（与夜班对账红线同源，recon.ts TOTAL_DIFF_RATE_REDLINE）。
 * 对账这个动作的终态是"消失"——账单发生瞬间即与订单勾稽，月底只看差异项。
 */
import { round2, type ExecutorResult, type Queryable } from "./types.js";

export const DIFF_RATE_REDLINE = 0.003; // 0.3%（夜班对账红线同源）

export interface ReconRow {
  shopId: string;
  period: string;
  currency: string;
  payoutFee: number;      // 平台结算单扣费（事实源）
  bookedFee: number;      // 财务入账平台费（cost_items）
  diff: number;           // bookedFee − payoutFee（正=多记，负=漏记）
  diffRatePct: number;    // |diff| / payoutFee × 100
  breached: boolean;      // 差异率 >0.3%
}

export async function execMultiPlatformReconciler(
  q: Queryable, workspaceId: string, opts: { period?: string } = {},
): Promise<ExecutorResult<{ rows: ReconRow[]; breachedShops: string[] }>> {
  const period = opts.period ?? new Date().toISOString().slice(0, 7);
  const r = await q.query<{
    shop_id: string; period: string; currency: string;
    payout_fee: string; booked_fee: string;
  }>(
    `WITH p AS (
       SELECT workspace_id, shop_id, to_char(period_start, 'YYYY-MM') AS period, currency,
              SUM(fee_amount) AS payout_fee
         FROM payouts WHERE workspace_id = $1
        GROUP BY workspace_id, shop_id, to_char(period_start, 'YYYY-MM'), currency
     ), c AS (
       SELECT workspace_id, shop_id, to_char(period, 'YYYY-MM') AS period, currency,
              SUM(amount) AS booked_fee
         FROM cost_items WHERE workspace_id = $1 AND category = 'platform_fee'
        GROUP BY workspace_id, shop_id, to_char(period, 'YYYY-MM'), currency
     )
     SELECT COALESCE(p.shop_id, c.shop_id) AS shop_id,
            COALESCE(p.period, c.period)   AS period,
            COALESCE(p.currency, c.currency) AS currency,
            COALESCE(p.payout_fee, 0) AS payout_fee,
            COALESCE(c.booked_fee, 0) AS booked_fee
       FROM p FULL OUTER JOIN c
         ON c.workspace_id = p.workspace_id AND c.shop_id = p.shop_id
        AND c.period = p.period AND c.currency = p.currency
      WHERE COALESCE(p.period, c.period) = $2
      ORDER BY ABS(COALESCE(c.booked_fee, 0) - COALESCE(p.payout_fee, 0)) DESC`,
    [workspaceId, period],
  );

  const rows: ReconRow[] = r.rows.map((x) => {
    const payoutFee = Number(x.payout_fee);
    const bookedFee = Number(x.booked_fee);
    const diff = round2(bookedFee - payoutFee);
    const rate = payoutFee > 0 ? round2((Math.abs(diff) / payoutFee) * 100) : (Math.abs(diff) > 0 ? 100 : 0);
    return {
      shopId: x.shop_id, period: x.period, currency: x.currency,
      payoutFee, bookedFee, diff, diffRatePct: rate,
      breached: payoutFee > 0 && Math.abs(diff) / payoutFee > DIFF_RATE_REDLINE,
    };
  });

  const breachedShops = rows.filter((x) => x.breached).map((x) => x.shopId);
  const totalAbsDiff = round2(rows.reduce((s, x) => s + Math.abs(x.diff), 0));
  return {
    skill: "multi-platform-reconciler",
    generatedAt: new Date().toISOString(),
    headline: { label: `${period} 勾稽绝对差异合计`, value: totalAbsDiff, unit: "CNY" },
    detail: { rows, breachedShops },
    traces: [{
      formula: "diff = 财务入账平台费 − 平台结算扣费；差异率 = |diff| / 平台结算扣费 > 0.3% 越线",
      inputs: { period, redline: DIFF_RATE_REDLINE },
      result: `越线 ${breachedShops.length} 店；绝对差异 ¥${totalAbsDiff.toLocaleString()}`,
    }],
    narrativeHints: [
      breachedShops.length > 0
        ? `越线店铺：${breachedShops.join("、")}——差异逐笔派单给对账师，0.3% 的差异一年就是几十万`
        : "本期全部店铺对平（差异率 ≤0.3%）",
      "差异方向：正=财务多记（查重复入账），负=漏记（查平台新费目）",
    ],
    actions: [
      { label: "差异逐笔派单对账师", level: "auto" },
      { label: "差异率 >1% 升级财务负责人", fenceRule: "R30", level: "review" },
    ],
  };
}
