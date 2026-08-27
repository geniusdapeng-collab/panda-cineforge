/**
 * registry · 连接器注册表
 * 默认以 PLATFORM_PROFILES 批量注册 mock 连接器；
 * 生产适配器就绪后经 registerConnector 覆盖同平台位。
 * 未注册平台一律抛错，禁止静默回退（对齐底座"显式失败"纪律）。
 */
import type { PlatformConnector } from "./interface.js";
import { createMockConnector, PLATFORM_PROFILES, type PlatformProfile } from "./mock/index.js";
import type { PlatformId } from "./types.js";

const registry = new Map<PlatformId, PlatformConnector>();

for (const profile of PLATFORM_PROFILES) {
  registry.set(profile.platformId, createMockConnector(profile));
}

/** 取连接器；未注册抛错 */
export function getConnector(platformId: PlatformId): PlatformConnector {
  const connector = registry.get(platformId);
  if (!connector) {
    throw new Error(`未注册的平台连接器: ${platformId}（已注册: ${[...registry.keys()].join(", ")}）`);
  }
  return connector;
}

/** 覆盖/新增某平台连接器（生产适配器接入入口） */
export function registerConnector(platformId: PlatformId, connector: PlatformConnector): void {
  if (connector.platformId !== platformId) {
    throw new Error(`连接器 platformId(${connector.platformId}) 与注册键(${platformId}) 不一致`);
  }
  registry.set(platformId, connector);
}

/** 按自定义 profile 追加注册 mock（演示/测试用） */
export function registerMockConnector(profile: PlatformProfile): void {
  registry.set(profile.platformId, createMockConnector(profile));
}

/** 已注册平台清单 */
export function listRegisteredPlatforms(): PlatformId[] {
  return [...registry.keys()];
}
