/**
 * executors · ★ 技能执行体统一出口（P2/P3）
 * 每个执行体 = 一个 ★ 门道固化技能的可执行管线（数字层 SQL/规则 + 叙事素材 + 动作建议）。
 */
export * from "./types.js";
export { execSkuProfitLedger, MARGIN_VETO_PCT, type SkuProfitRow } from "./sku-profit-ledger.js";
export { execAcosFuse, type AcosFuseRow } from "./acos-fuse.js";
export { execMultiPlatformReconciler, DIFF_RATE_REDLINE, type ReconRow } from "./multi-platform-reconciler.js";
export {
  execStockoutGuard, guardFromSnapshot, ageingStructure,
  STOCKOUT_DAYS_REDLINE, AGEING_CASHLINE_BUCKET,
  type StockoutRisk, type AgeingStructure,
} from "./stockout-guard.js";
export {
  execReplenishmentModel, planReplenishment, avgLeadTimeDays,
  type ReplenishInput, type ReplenishPlan,
} from "./replenishment-model.js";
export {
  execFxReprice, planFxReprice, FX_MOVE_THRESHOLD,
  MARGIN_FLOOR_RATIO as FX_MARGIN_FLOOR_RATIO,
  type FxRepriceInput, type FxRepricePlan,
} from "./fx-reprice.js";
export {
  execDataQualityWatch, LAG_WARN_SEC, LAG_CRIT_SEC, STALE_HOURS,
  type DataSourceHealth,
} from "./data-quality-watch.js";
export {
  execVideoStoryboard, buildStoryboard,
  type StoryboardInput, type StoryboardShot,
} from "./video-storyboard.js";
