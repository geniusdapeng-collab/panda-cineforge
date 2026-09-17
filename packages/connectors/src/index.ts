/**
 * @workloom/connectors —— 电商平台连接器层出口
 * 类型（types）+ 接口契约（interface）+ 注册表（registry）+ mock 适配器（mock）
 */
export * from "./types.js";
export type { PlatformConnector, Receipt } from "./interface.js";
export {
  getConnector,
  listRegisteredPlatforms,
  registerConnector,
  registerMockConnector,
} from "./registry.js";
export { createMockConnector, PLATFORM_PROFILES } from "./mock/index.js";
export type { PlatformProfile } from "./mock/index.js";
