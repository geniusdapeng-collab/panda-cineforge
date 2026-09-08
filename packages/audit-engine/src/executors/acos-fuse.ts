/**
 * executors/acos-fuse.ts —— acos-fuse★ 执行体：广告利润保险丝
 *
 * SKILL.md 口径机器化：ACoS 连续越过盈亏平衡点 → 自动降预算 30% 并请示（R3/R4 审批瀑布）。
 * 盈亏平衡 ACoS = 毛利率（回款净额 − 非广告成本）/ 回款净额；实际 ACoS = 广告成本 / 回款净额。
 * 数据源 = shop_profit_waterfall 视图（0027 ⑨b）；数字全部 SQL 出，LLM 只做解释。
 */
import { round2, type ExecutorResult, type Queryable } from "./types.js";

export interface AcosFuseRow {
  shopId: string;
  period: string;
  currency: string;
  payoutNet: number;
  adsCost: number;
  actualAcosPct: number;      // ads / payoutNet × 100
  breakevenAcosPct: number;   // (payoutNet − nonAdsCost) / payoutNet × 100
  overPct: number;            // actual − breakeven（>0 = 烧穿）
  fuseAction: "cut-30" | "watch" | "ok";
  estSavedMonthly: number;    // 降预算 30% 的月止损估算 = adsCost × 30% × (over/breakeven 超出比例封顶1)
}

export async function execAcosFuse(
  q: Queryable, workspaceId: string, opts: { period?: string } = {},
): Promise<ExecutorResult<{ rows: AcosFuseRow[]; fused: string[] }>> {
  const period = opts.period ?? new Date().toISOString().slice(0, 7);
  const r = await q.query<{
    shop_id: string; period: string; currency: string; payout_net: string;
    cost_ads: string; cost_total: string;
  }>(
    `SELECT shop_id, to_char(period, 'YYYY-MM') AS period, currency,
            payout_net, cost_ads, cost_total
       FROM shop_profit_waterfall
      WHERE workspace_id = $1 AND to_char(period, 'YYYY-MM') = $2 AND payout_net > 0
      ORDER BY cost_ads DESC`,
    [workspaceId, period],
  );

  const rows: AcosFuseRow[] = r.rows.map((x) => {
    const payoutNet = Number(x.payout_net);
    const ads = Number(x.cost_ads);
    const nonAds = Number(x.cost_total) - ads;
    const actual = round2((ads / payoutNet) * 100);
    const breakeven = round2(Math.max(0, ((payoutNet - nonAds) / payoutNet) * 100));
    const over = round2(actual - breakeven);
    const fuseAction: AcosFuseRow["fuseAction"] = over > 0 ? "cut-30" : over > -3 ? "watch" : "ok";
    const estSaved = fuseAction === "cut-30"
      ? round2(ads * 0.3 * Math.min(1, breakeven > 0 ? over / breakeven : 1))
      : 0;
    return {
      shopId: x.shop_id, period: x.period, currency: x.currency,
      payoutNet, adsCost: ads, actualAcosPct: actual, breakevenAcosPct: breakeven,
      overPct: over, fuseAction, estSavedMonthly: estSaved,
    };
  });

  const fused = rows.filter((x) => x.fuseAction === "cut-30").map((x) => x.shopId);
  const totalSaved = round2(rows.reduce((s, x) => s + x.estSavedMonthly, 0));
  return {
    skill: "acos-fuse",
    generatedAt: new Date().toISOString(),
    headline: { label: `${period} 保险丝月止损估算`, value: totalSaved, unit: "CNY" },
    detail: { rows, fused },
    traces: [{
      formula: "盈亏平衡ACoS = (回款净额 − 非广告成本)/回款净额；实际ACoS = 广告/回款净额；烧穿→降预算30%",
      inputs: { period, shops: rows.length },
      result: `熔断 ${fused.length} 店；月止损估算 ¥${totalSaved.toLocaleString()}`,
    }],
    narrativeHints: [
      fused.length > 0
        ? `烧穿店铺：${fused.join("、")}——ACoS 已越过盈亏平衡点，继续烧的是净利润`
        : "本期无店铺烧穿盈亏平衡 ACoS",
      "watch 档店铺距平衡点不足 3pp，列入夜班盯盘清单",
    ],
    actions: [
      { label: "烧穿店铺降预算 30%（请示）", fenceRule: "R3", level: "review" },
      { label: "日预算上调 >30% 拦截", fenceRule: "R4", level: "block" },
    ],
  };
}
