/**
 * 分析器公共工具：与内核（@workloom/audit-core）重复的函数直接 re-export，
 * 只保留电商特有辅助（ISO 串时间窗 / pp 修约 / 分析器上下文 / Finding 构造适配）。
 * 所有分析器为纯函数：同一份快照 + 同一个 now 必得同一份发现（确定性纪律，可复算）。
 */
import type { AnalyzerContext as CoreAnalyzerContext, Finding, ImpactConfidence, ImpactPeriod } from "../../../base/audit-core/index.js";

// 与内核重复的工具：re-export 内核实现，不再本包重复定义
export { round2 } from "../../../base/audit-core/index.js";

/** 分析器上下文：锚定时间与可调阈值（由 engine 注入，分析器不读系统时钟） */
export interface AnalyzerContext extends Omit<CoreAnalyzerContext, "line"> {
  /** 烧钱词花费阈值（默认 500，同币种口径） */
  keywordSpendThreshold: number;
}

/** 百分比修约（pp 判定展示用） */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 两个 ISO 时间的小时差（now - at） */
export function hoursSince(now: Date, at: string): number {
  return (now.getTime() - Date.parse(at)) / 3_600_000;
}

/** 两个 ISO 时间的天数差（now - at） */
export function daysSince(now: Date, at: string): number {
  return hoursSince(now, at) / 24;
}

/** 近 N 天窗口起点（含边界） */
export function windowStart(now: Date, days: number): number {
  return now.getTime() - days * 86_400_000;
}

/* ---------- Finding 构造适配层 ----------
 * 分析器沿用电商业态书写习惯（description / evidence.fields / calculation 结构化 / estimatedImpact.currency），
 * 在此统一映射为内核 Finding 形状（detail / evidence.note / calculation 串 / impact.unit），
 * 六个分析器文件因此无需改动。 */

interface EcomEvidenceInput {
  kind: string;
  id: string;
  /** 关键字段快照（审计留痕，序列化进内核 EvidenceRef.note） */
  fields?: Record<string, string | number>;
}

interface EcomCalculationInput {
  formula: string;
  inputs: Record<string, number | string>;
  result: number | string;
}

interface EcomImpactInput {
  amount: number;
  /** 币种（映射为内核 impact.unit） */
  currency: string;
  period: ImpactPeriod;
  confidence: ImpactConfidence;
  basis: string;
}

type EcomFindingInput = Omit<Finding, "id" | "detail" | "evidence" | "calculation" | "impact"> & {
  description: string;
  evidence: EcomEvidenceInput[];
  calculation: EcomCalculationInput;
  estimatedImpact?: EcomImpactInput;
};

/** 键值对序列化：{a:1,b:"x"} → "a=1, b=x"（证据留痕与计算过程快照共用口径） */
function fmtFields(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/** 构造发现时统一收口：行业输入 → 内核 Finding，占位 id（由 engine 统一编号 FND-<line>-<n>） */
export function makeFinding(f: EcomFindingInput): Finding {
  const { description, evidence, calculation, estimatedImpact, ...rest } = f;
  return {
    ...rest,
    id: "",
    detail: description,
    evidence: evidence.map((e) => ({ kind: e.kind, id: e.id, ...(e.fields ? { note: fmtFields(e.fields) } : {}) })),
    calculation: `${calculation.formula}；输入：${fmtFields(calculation.inputs)}；结果：${calculation.result}`,
    ...(estimatedImpact
      ? {
          impact: {
            amount: estimatedImpact.amount,
            unit: estimatedImpact.currency,
            period: estimatedImpact.period,
            confidence: estimatedImpact.confidence,
            basis: estimatedImpact.basis,
          },
        }
      : {}),
  };
}
