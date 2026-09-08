/**
 * decision-cards/calculators.ts —— 金额计算器（SQL 唯一口径）
 *
 * 每个计算器 = 一段参数化 SQL + 阈值规则 → 0..n 张决策卡片。
 * 数字全部来自 0027 财务/供应链表（payouts/platform_penalties/cost_items/data_sources），
 * 并附带 calculation 留痕（公式+入参+结果）——LLM 叙事层只读这些卡片做解释，永不改数。
 *
 * 阈值默认与围栏/体检同源：回款率健康线 0.70（cost-ledger.yml payout_rate.healthy_floor）；
 * 罚款环比 spike 2 倍；广告连续上调天数 7（大卖实战案例口径）。
 */
import type pg from "pg";
import { makeCardId, type DecisionCard } from "./model.js";

type Q = Pick<pg.Pool | pg.PoolClient, "query">;

export interface CalculatorThresholds {
  payoutRateFloor: number;      // 回款率健康线（默认 0.70）
  penaltySpikeRatio: number;    // 罚款环比倍数红线（默认 2.0）
  adsOverspendDays: number;     // 广告预算连续上调天数（默认 7）
  minImpactCny: number;         // 低于此金额不出卡（噪音闸门，默认 500）
}

export const DEFAULT_THRESHOLDS: CalculatorThresholds = {
  payoutRateFloor: 0.70,
  penaltySpikeRatio: 2.0,
  adsOverspendDays: 7,
  minImpactCny: 500,
};

const sev = (absAmount: number): DecisionCard["severity"] =>
  absAmount >= 50_000 ? "high" : absAmount >= 5_000 ? "mid" : "low";

/** ① 回款率跌破健康线（真实回款 vs 账期销售额；大卖实战核心仪表） */
export async function calcPayoutRateDrop(
  q: Q, workspaceId: string, th: CalculatorThresholds = DEFAULT_THRESHOLDS,
): Promise<DecisionCard[]> {
  const r = await q.query<{
    shop_id: string; currency: string; period: string;
    gross: string; payout_net: string; rate: number; gap_amount: string;
  }>(
    `SELECT shop_id, currency, to_char(period, 'YYYY-MM') AS period,
            gross, payout_net,
            ROUND(payout_net / NULLIF(gross, 0), 4) AS rate,
            ROUND(gross * $2::numeric - payout_net, 2) AS gap_amount
       FROM (SELECT shop_id, currency, date_trunc('month', period_start) AS period,
                    SUM(gross_amount) AS gross, SUM(net_amount) AS payout_net
               FROM payouts WHERE workspace_id = $1
              GROUP BY shop_id, currency, date_trunc('month', period_start)) t
      WHERE gross > 0 AND payout_net / gross < $2
      ORDER BY period DESC, gap_amount DESC`,
    [workspaceId, th.payoutRateFloor],
  );
  return r.rows
    .filter((x) => Number(x.gap_amount) >= th.minImpactCny)
    .map((x) => ({
      id: makeCardId("payout-rate-drop", x.shop_id, x.period, x.currency),
      kind: "payout-rate-drop",
      title: `${x.shop_id} ${x.period} 回款率 ${(x.rate * 100).toFixed(1)}%，跌破健康线 ${(th.payoutRateFloor * 100).toFixed(0)}%`,
      severity: sev(Number(x.gap_amount)),
      shop_id: x.shop_id,
      currency: x.currency,
      amount_impact: -Number(x.gap_amount),
      attribution: [
        { step: "数据变化", text: `账期销售 ¥${Number(x.gross).toLocaleString()}，实际回款 ¥${Number(x.payout_net).toLocaleString()}，回款率 ${(x.rate * 100).toFixed(1)}%` },
        { step: "归因分析", text: "回款缺口 = 销售额 × 健康线 − 实际回款；缺口通常来自平台扣费上浮、退款冲抵或结算在途，需逐笔勾稽账单" },
        { step: "建议动作", text: "对账师逐笔勾稽该账期账单差异项；催收在途结算；核查平台费率是否被单方调整" },
      ],
      suggested_action: "发起该账期逐笔对账并输出差异清单",
      assignee: "reconciliation-officer",
      calculation: {
        formula: "缺口 = gross × healthy_floor − payout_net；rate = payout_net / gross",
        inputs: { gross: Number(x.gross), payout_net: Number(x.payout_net), healthy_floor: th.payoutRateFloor },
        result: `-¥${Number(x.gap_amount).toLocaleString()}`,
        source: "sql" as const,
      },
      evidence_ids: [],
      period: x.period,
    }));
}

/** ② 平台罚款环比 spike（本月罚款 > 上月 × 倍数红线） */
export async function calcPenaltySpike(
  q: Q, workspaceId: string, th: CalculatorThresholds = DEFAULT_THRESHOLDS,
): Promise<DecisionCard[]> {
  const r = await q.query<{
    shop_id: string; currency: string; period: string; cur: string; prev: string; top_kind: string;
  }>(
    `WITH monthly AS (
       SELECT shop_id, currency, to_char(occurred_at, 'YYYY-MM') AS period, SUM(amount) AS amt
         FROM platform_penalties WHERE workspace_id = $1 AND status <> 'waived'
        GROUP BY shop_id, currency, to_char(occurred_at, 'YYYY-MM')
     ), ranked AS (
       SELECT shop_id, currency, period, amt,
              LAG(amt) OVER (PARTITION BY shop_id, currency ORDER BY period) AS prev_amt
         FROM monthly
     ), top_kind AS (
       SELECT DISTINCT ON (shop_id, to_char(occurred_at, 'YYYY-MM')) shop_id,
              to_char(occurred_at, 'YYYY-MM') AS period, kind
         FROM platform_penalties WHERE workspace_id = $1 AND status <> 'waived'
        ORDER BY shop_id, to_char(occurred_at, 'YYYY-MM'), SUM(amount) OVER (PARTITION BY shop_id, to_char(occurred_at, 'YYYY-MM'), kind) DESC
     )
     SELECT r.shop_id, r.currency, r.period, r.amt AS cur, r.prev_amt AS prev, t.kind AS top_kind
       FROM ranked r JOIN top_kind t ON t.shop_id = r.shop_id AND t.period = r.period
      WHERE r.prev_amt > 0 AND r.amt > r.prev_amt * $2
      ORDER BY r.period DESC, r.amt DESC`,
    [workspaceId, th.penaltySpikeRatio],
  );
  return r.rows
    .filter((x) => Number(x.cur) - Number(x.prev) >= th.minImpactCny)
    .map((x) => ({
      id: makeCardId("penalty-spike", x.shop_id, x.period, x.top_kind),
      kind: "penalty-spike",
      title: `${x.shop_id} ${x.period} 罚款 ¥${Number(x.cur).toLocaleString()}，环比放大 ${(Number(x.cur) / Number(x.prev)).toFixed(1)} 倍（主因：${x.top_kind}）`,
      severity: sev(Number(x.cur) - Number(x.prev)),
      shop_id: x.shop_id,
      currency: x.currency,
      amount_impact: -(Number(x.cur) - Number(x.prev)),
      attribution: [
        { step: "数据变化", text: `罚款由 ¥${Number(x.prev).toLocaleString()} 升至 ¥${Number(x.cur).toLocaleString()}，环比 ×${(Number(x.cur) / Number(x.prev)).toFixed(1)}` },
        { step: "归因分析", text: `主因类目 ${x.top_kind}；罚款属利润直接扣减且多伴随账号健康分下降（R29 ODR 联动）` },
        { step: "建议动作", text: "合规风控官出整改方案；可申诉罚单 48h 内发起申诉（appeal-kit★）" },
      ],
      suggested_action: "生成罚款整改与申诉方案",
      assignee: "compliance-officer",
      calculation: {
        formula: "增量 = 本月罚款 − 上月罚款；spike = 本月 / 上月 > 倍数红线",
        inputs: { cur: Number(x.cur), prev: Number(x.prev), ratio_redline: th.penaltySpikeRatio },
        result: `-¥${(Number(x.cur) - Number(x.prev)).toLocaleString()}`,
        source: "sql" as const,
      },
      evidence_ids: [],
      period: x.period,
    }));
}

/** ③ 在途头程资金占用（exception/lost 批次货值 = 冻结现金，库存现金线同源） */
export async function calcShipmentCapitalFrozen(
  q: Q, workspaceId: string, th: CalculatorThresholds = DEFAULT_THRESHOLDS,
): Promise<DecisionCard[]> {
  const r = await q.query<{
    shop_id: string; tracking_no: string; units: number; status: string; days_stuck: number; est_value: string;
  }>(
    `SELECT s.shop_id, s.tracking_no, s.units, s.status,
            EXTRACT(DAY FROM now() - s.updated_at)::int AS days_stuck,
            COALESCE((SELECT SUM((it->>'qty')::numeric * COALESCE((it->>'unit_cost')::numeric, 0))
                        FROM jsonb_array_elements(s.items) it), 0) AS est_value
       FROM shipments s
      WHERE s.workspace_id = $1 AND s.status IN ('exception','lost')
      ORDER BY est_value DESC`,
    [workspaceId],
  );
  const period = new Date().toISOString().slice(0, 7);
  return r.rows
    .filter((x) => Number(x.est_value) >= th.minImpactCny)
    .map((x) => ({
      id: makeCardId("shipment-frozen", x.shop_id, period, x.tracking_no),
      kind: "shipment-frozen",
      title: `运单 ${x.tracking_no} 状态 ${x.status}，已滞留 ${x.days_stuck} 天，冻结货值 ¥${Number(x.est_value).toLocaleString()}`,
      severity: sev(Number(x.est_value)),
      shop_id: x.shop_id,
      currency: "CNY",
      amount_impact: -Number(x.est_value),
      attribution: [
        { step: "数据变化", text: `${x.tracking_no} 共 ${x.units} 件，节点停滞 ${x.days_stuck} 天（状态 ${x.status}）` },
        { step: "归因分析", text: "在途异常直接冻结现金流并抬高断货风险（R7 联动）；每滞留一天，上架销售窗口就缩短一天" },
        { step: "建议动作", text: "立即联系物流商核实节点；超 7 天无进展启动理赔与补货评估" },
      ],
      suggested_action: "联系物流商并启动滞留处置",
      assignee: "supply-chain-officer",
      calculation: {
        formula: "冻结货值 = Σ(批次明细 qty × unit_cost)；状态 ∈ {exception, lost}",
        inputs: { tracking_no: x.tracking_no, units: x.units, days_stuck: x.days_stuck },
        result: `-¥${Number(x.est_value).toLocaleString()}`,
        source: "sql" as const,
      },
      evidence_ids: [x.tracking_no],
      period,
    }));
}

/** 全部计算器汇总（决策中心列表数据源；按金额绝对值降序） */
export async function computeDecisionCards(
  q: Q, workspaceId: string, th: CalculatorThresholds = DEFAULT_THRESHOLDS,
): Promise<DecisionCard[]> {
  const groups = await Promise.all([
    calcPayoutRateDrop(q, workspaceId, th),
    calcPenaltySpike(q, workspaceId, th),
    calcShipmentCapitalFrozen(q, workspaceId, th),
  ]);
  return groups.flat().sort((a, b) => Math.abs(b.amount_impact) - Math.abs(a.amount_impact));
}
