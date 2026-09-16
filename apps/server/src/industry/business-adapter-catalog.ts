import type { BusinessAdapterRegistration } from "../service/adapters/business.js";

/** 电商服务前台暂未登记行业数据适配器；通用对话与工单保持可用并失败关闭。 */
export const BUNDLED_BUSINESS_ADAPTERS: readonly BusinessAdapterRegistration[] = Object.freeze([]);
