/**
 * real.ts —— 真实连接器装配入口（P1）
 *
 * 纪律：
 *  - 有凭据 → registerConnector 覆盖同平台 mock 位（registry 既有入口）；
 *  - 无凭据 → 保持 mock 并在状态清单中显式标注 "mock"——禁止静默回退（数据源接入中心按此展示）；
 *  - 状态清单是数据源接入中心"已连接 18 个数据源"卡片的口径源。
 */
import { amazonConnectorFromEnv } from "./amazon/sp-api.js";
import { douyinConnectorFromEnv } from "./cn/douyin-open.js";
import { registerConnector } from "./registry.js";
import type { PlatformId } from "./types.js";

export interface RealConnectorStatus {
  platformId: PlatformId;
  mode: "real" | "mock";
  reason?: string; // mock 时必带（缺哪些凭据）
}

/** 装配真实连接器（环境变量驱动）；返回各平台真实/mock 状态清单 */
export function registerRealConnectors(env: NodeJS.ProcessEnv = process.env): RealConnectorStatus[] {
  const status: RealConnectorStatus[] = [];

  const amazon = amazonConnectorFromEnv(env);
  if (amazon) {
    registerConnector("amazon", amazon);
    status.push({ platformId: "amazon", mode: "real" });
  } else {
    status.push({
      platformId: "amazon", mode: "mock",
      reason: "缺 AMZ_LWA_CLIENT_ID/AMZ_LWA_CLIENT_SECRET/AMZ_LWA_REFRESH_TOKEN/AMZ_AWS_ACCESS_KEY_ID/AMZ_AWS_SECRET_ACCESS_KEY/AMZ_MARKETPLACE_ID",
    });
  }

  const douyin = douyinConnectorFromEnv(env);
  if (douyin) {
    registerConnector("douyin", douyin);
    status.push({ platformId: "douyin", mode: "real" });
  } else {
    status.push({
      platformId: "douyin", mode: "mock",
      reason: "缺 DOUYIN_APP_KEY/DOUYIN_APP_SECRET/DOUYIN_SHOP_ACCESS_TOKEN",
    });
  }

  return status;
}

/** 只读查询当前状态（不重复装配；供数据源接入中心卡片渲染） */
export function realConnectorStatus(env: NodeJS.ProcessEnv = process.env): RealConnectorStatus[] {
  const status: RealConnectorStatus[] = [];
  status.push(amazonConnectorFromEnv(env)
    ? { platformId: "amazon", mode: "real" }
    : { platformId: "amazon", mode: "mock", reason: "凭据未配置" });
  status.push(douyinConnectorFromEnv(env)
    ? { platformId: "douyin", mode: "real" }
    : { platformId: "douyin", mode: "mock", reason: "凭据未配置" });
  return status;
}
