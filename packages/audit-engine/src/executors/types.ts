/**
 * executors/types.ts —— ★ 技能执行体公共类型（P2：技能从 SKILL.md 提示词升级为可执行管线）
 *
 * 执行体三层契约（与 fast-scan 分析器同哲学）：
 *  ① 数字层：纯函数/SQL 出数，带 calculation 留痕（公式+入参+结果）——金额与阈值永不交给 LLM；
 *  ② 叙事层：ExecutorResult.narrativeHints 给 LLM 的"只读素材"——模型只能解释，不能改数；
 *  ③ 动作层：建议动作 + 关联围栏规则（review/block 走既有审批瀑布，执行体自身只读）。
 */

/** 计算留痕（与 decision-cards calculationTrace 同构；本包独立定义避免跨包耦合） */
export interface ExecTrace {
  formula: string;
  inputs: Record<string, unknown>;
  result: string;
}

/** 执行体输出（T = 各领域结构化明细） */
export interface ExecutorResult<T> {
  skill: string;                 // 技能 key（如 sku-profit-ledger）
  generatedAt: string;           // ISO 8601
  /** 核心数字（金额/比率/天数；卡片与报告的排序键） */
  headline: { label: string; value: number; unit: "CNY" | "pct" | "days" | "count" | "ratio" };
  detail: T;
  traces: ExecTrace[];
  /** 给 LLM 叙事层的只读素材（要点列表；模型组织语言但不得改数） */
  narrativeHints: string[];
  /** 建议动作（带关联围栏规则 ID，审批瀑布对接位） */
  actions: Array<{ label: string; fenceRule?: string; level: "auto" | "review" | "block" }>;
}

/** 通用取数接口（pg Pool/Client 子集；测试可桩） */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
