import type { InspectionAdapterRegistration } from "../service/inspection-adapter.js";

/** 电商行业尚未启用巡检适配器，Bundle 投影必须显式保持关闭。 */
export const BUNDLED_INSPECTION_ADAPTERS: readonly InspectionAdapterRegistration[] = Object.freeze([]);
