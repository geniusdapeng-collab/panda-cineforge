/**
 * 测试辅助：确定性快照工厂 + 分析器上下文。
 * 所有测试锚定固定钟 NOW，保证纯函数断言可复现。
 */
import type { AnalyzerContext } from "../src/analyzers/util.js";
import type { AuditSnapshot } from "../src/types.js";

/** 固定锚定时间（差评时长/近 30 天窗口以此为界） */
export const NOW = new Date("2026-08-27T12:00:00+08:00");

export const CTX: AnalyzerContext = { now: NOW, keywordSpendThreshold: 500 };

/** 近 N 天/小时前的 ISO 时间（相对固定钟） */
export function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}
export function daysAgo(d: number): string {
  return hoursAgo(d * 24);
}
export function dateDaysAgo(d: number): string {
  return daysAgo(d).slice(0, 10);
}

/** 最小可用快照：两店（同币种）+ 成本主数据；各测试按需覆盖字段 */
export function makeSnapshot(overrides: Partial<AuditSnapshot> = {}): AuditSnapshot {
  return {
    snapshotId: "SNAP-TEST",
    generatedAt: NOW.toISOString(),
    shops: [
      {
        shopId: "shop-a",
        platformId: "tmall",
        shopName: "熊猫优选旗舰店",
        currency: "CNY",
        timezone: "Asia/Shanghai",
        commissionRate: 0.05,
        logisticsRate: 0.08,
        returnLossRate: 0.03,
        logisticsFeePerOrder: 8,
      },
      {
        shopId: "shop-b",
        platformId: "jd",
        shopName: "熊猫优选京东自营店",
        currency: "CNY",
        timezone: "Asia/Shanghai",
        commissionRate: 0.05,
        logisticsRate: 0.08,
        returnLossRate: 0.03,
        logisticsFeePerOrder: 8,
      },
    ],
    skuCosts: [
      { sku: "SKU-1", cost: 40, currency: "CNY" },
      { sku: "SKU-2", cost: 100, currency: "CNY" },
    ],
    listings: [],
    orders: [],
    adsCampaigns: [],
    adKeywords: [],
    inventory: [],
    reviews: [],
    statements: [],
    forbiddenWords: [],
    ...overrides,
  };
}
