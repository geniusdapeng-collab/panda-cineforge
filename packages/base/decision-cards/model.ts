/**
 * decision-cards/model.ts —— 金额化决策卡片（P2 核心资产）
 *
 * 来源：升级方案——对标大卖实战系统「AI 决策」板块：每条建议 = 问题 + 归因链 +
 *      量化金额影响 + 建议动作 + 一键转任务。老板只按金额排序处理。
 *
 * 铁律（金额可信的生命线）：
 *  ① 金额只能来自 SQL/规则引擎（calculators.ts），LLM 只生成归因叙事——
 *     卡片上任何 ±¥ 数字都必须带 calculation（公式+入参+结果）可下钻复核；
 *  ② 金额正为收益（增利/止损）、负为损失（利润侵蚀），币种不混算；
 *  ③ 卡片 ID 确定性（kind+shop+period+subject）——同因不重发，状态流走五元事件投影；
 *  ④ 决策→任务闭环必须留痕：decision.card.issued / decision.card.decided /
 *     decision.task.created 三个动作全部五元事件入账（哈希链可验）。
 */
import { z } from "zod";

/** 卡片严重度（与巡检 P0/P1/P2 分级同源） */
export const DECISION_SEVERITY = ["high", "mid", "low"] as const;
export type DecisionSeverity = (typeof DECISION_SEVERITY)[number];

/** 卡片状态（事件投影：issued→pending；decided→accepted/dismissed；转任务→tasked） */
export const DECISION_STATUS = ["pending", "accepted", "dismissed", "tasked"] as const;
export type DecisionStatus = (typeof DECISION_STATUS)[number];

/** 归因链节点（数据变化 → 归因分析 → 建议动作 的可视化数据源） */
export const attributionNode = z.object({
  step: z.string().min(1),          // 例：数据变化 / 归因分析 / 建议动作
  text: z.string().min(1),          // 例：美国站广告日耗连续 7 天环比 +12%
});
export type AttributionNode = z.infer<typeof attributionNode>;

/** 金额计算留痕（可下钻复核：公式 + 入参 + 结果；缺此结构不得上卡） */
export const calculationTrace = z.object({
  formula: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()),
  result: z.string().min(1),
  source: z.literal("sql"),         // 金额来源封印：永远 sql，LLM 叙事不得写入
});
export type CalculationTrace = z.infer<typeof calculationTrace>;

/** 金额化决策卡片 */
export const decisionCard = z.object({
  id: z.string().regex(/^dc-[a-z0-9-]+$/),   // dc-<kind>-<shop>-<period>-<subject>，确定性
  kind: z.string().min(1),                    // ads-overspend / conversion-drop / growth-window / deposit-diff / payout-rate-drop / penalty-spike
  title: z.string().min(1),
  severity: z.enum(DECISION_SEVERITY),
  shop_id: z.string().min(1),
  currency: z.string().length(3),
  /** 金额影响：正=收益、负=损失（排序键；老板按此处理） */
  amount_impact: z.number(),
  attribution: z.array(attributionNode).min(2),  // 至少「数据变化→归因」两环
  suggested_action: z.string().min(1),
  /** 建议执行者（数字员工 preset key；转任务时落 assignee） */
  assignee: z.string().min(1),
  calculation: calculationTrace,
  /** 证据事件/单据链接（五元事件 ID 或表主键） */
  evidence_ids: z.array(z.string()).default([]),
  period: z.string().min(1),                  // 归属期间（如 2026-09）
});
export type DecisionCard = z.infer<typeof decisionCard>;

/** 卡片 + 状态投影（列表页用） */
export interface DecisionCardView extends DecisionCard {
  status: DecisionStatus;
  decided_by?: string;
  decided_at?: string;
  task_event_id?: string;
}

/** 决策→任务载荷（decision.task.created 事件 decision.after） */
export interface DecisionTaskPayload {
  card_id: string;
  title: string;
  assignee: string;                 // 数字员工 preset key 或 member_no
  due_at: string;                   // ISO 8601
  expected_benefit: number;         // 预期收益（= 卡片 amount_impact 止损/增利口径）
  currency: string;
}

/** 生成确定性卡片 ID（同因不重发的去重键） */
export function makeCardId(kind: string, shopId: string, period: string, subject: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `dc-${clean(kind)}-${clean(shopId)}-${clean(period)}-${clean(subject)}`.slice(0, 96);
}
