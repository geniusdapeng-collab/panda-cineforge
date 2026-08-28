/**
 * @workloom/audit-engine —— 质检模式「快速体检」确定性检测引擎
 * 出口：类型 + 六个分析器 + runFastScan 主入口 + 阈值常量（测试/调参用）。
 */
export * from "./types.js";
export { runFastScan } from "./engine.js";
export { analyzePrice, PARITY_GAP_THRESHOLD, PARITY_GAP_P0, MARGIN_FLOOR_RATIO } from "./analyzers/price.js";
export { analyzeInventory, OVERSTOCK_TURNOVER_DAYS, STOCKOUT_DAYS, OVERSEAS_AGE_DAYS } from "./analyzers/inventory.js";
export {
  analyzeAds,
  breakevenAcos,
  ACOS_CONSECUTIVE_DAYS,
  BUDGET_EXHAUST_HOUR,
  BUDGET_EXHAUST_RATIO,
  IDLE_DAYS,
  IDLE_RATIO,
} from "./analyzers/ads.js";
export {
  analyzeReputation,
  BAD_RATING_MAX,
  UNREPLIED_HOURS,
  UNREPLIED_HOURS_P0,
  LOW_RATING,
  LOW_RATING_MIN_REVIEWS,
  CLUSTER_DAYS,
  CLUSTER_MIN_BAD,
} from "./analyzers/reputation.js";
export {
  analyzeCompliance,
  BUILTIN_FORBIDDEN_WORDS,
  ODR_REDLINE,
  LATE_SHIPMENT_REDLINE,
  IPI_REDLINE,
} from "./analyzers/compliance.js";
export {
  analyzeRecon,
  COMMISSION_TOLERANCE_PP,
  REL_DIFF_TOLERANCE,
  TOTAL_DIFF_RATE_REDLINE,
} from "./analyzers/recon.js";
export type { AnalyzerContext } from "./analyzers/util.js";
