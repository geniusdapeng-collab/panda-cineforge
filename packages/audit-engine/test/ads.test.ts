/** 广告健康线单测：盈亏平衡 ACoS / 连续越线 / 烧钱词 / 预算节奏 */
import { describe, expect, it } from "vitest";
import { analyzeAds, breakevenAcos } from "../src/analyzers/ads.js";
import { CTX, dateDaysAgo, makeSnapshot } from "./helpers.js";

/** 店铺成本率 0.4（成本40/售价100）→ 盈亏线 = 1−0.4−0.05−0.08−0.03 = 0.44 */
const listingsForCostRate = [
  { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" as const },
];

function campaign(daily: { date: string; spend: number; gmv: number }[], extra: Record<string, unknown> = {}) {
  return {
    shopId: "shop-a",
    campaignId: "C-1",
    name: "爆款拉新计划",
    status: "running" as const,
    dailyBudget: 500,
    currency: "CNY",
    spendToday: 100,
    ...extra,
    daily,
  };
}

describe("ads · 盈亏平衡 ACoS 公式", () => {
  it("breakevenAcos = 1 − 成本率 − 佣金率 − 物流费率 − 退货损耗率", () => {
    expect(breakevenAcos(0.4, 0.05, 0.08, 0.03)).toBe(0.44);
  });
});

describe("ads · 连续越线", () => {
  it("连续 3 天 ACoS 0.5 > 0.44 → 命中 P1，金额口径 = 窗口超支 × 30/天数", () => {
    const daily = [
      { date: dateDaysAgo(5), spend: 200, gmv: 1000 }, // ACoS 0.2 正常
      { date: dateDaysAgo(4), spend: 500, gmv: 1000 }, // 0.5 越线
      { date: dateDaysAgo(3), spend: 500, gmv: 1000 }, // 0.5 越线
      { date: dateDaysAgo(2), spend: 500, gmv: 1000 }, // 0.5 越线
    ];
    const s = makeSnapshot({ listings: listingsForCostRate, adsCampaigns: [campaign(daily)] });
    const fs = analyzeAds(s, CTX).filter((f) => f.title.includes("越"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
    // 每日超支 = 500 − 1000×0.44 = 60；3 天 = 180；月度 = 180/3×30 = 1800
    expect(fs[0]!.estimatedImpact?.amount).toBe(1800);
    expect(fs[0]!.estimatedImpact?.confidence).toBe("baseline");
  });

  it("仅连续 2 天越线 → 不命中", () => {
    const daily = [
      { date: dateDaysAgo(3), spend: 500, gmv: 1000 },
      { date: dateDaysAgo(2), spend: 500, gmv: 1000 },
      { date: dateDaysAgo(1), spend: 100, gmv: 1000 },
    ];
    const s = makeSnapshot({ listings: listingsForCostRate, adsCampaigns: [campaign(daily)] });
    expect(analyzeAds(s, CTX).filter((f) => f.title.includes("越"))).toHaveLength(0);
  });

  it("连续 7 天越线 → 升 P0", () => {
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: dateDaysAgo(7 - i), spend: 500, gmv: 1000 }));
    const s = makeSnapshot({ listings: listingsForCostRate, adsCampaigns: [campaign(daily)] });
    const fs = analyzeAds(s, CTX).filter((f) => f.title.includes("越"));
    expect(fs[0]!.severity).toBe("P0");
  });
});

describe("ads · 烧钱词", () => {
  it("花费 600 > 500 且 0 转化 → 命中 P2，金额=花费（exact）", () => {
    const s = makeSnapshot({
      adKeywords: [{ shopId: "shop-a", campaignId: "C-1", keyword: "熊猫杯", spend: 600, conversions: 0, currency: "CNY" }],
    });
    const fs = analyzeAds(s, CTX);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P2");
    expect(fs[0]!.estimatedImpact?.amount).toBe(600);
    expect(fs[0]!.estimatedImpact?.confidence).toBe("exact");
  });

  it("花费恰好 500 → 不命中（边界 >500）；有转化 → 不命中", () => {
    const s = makeSnapshot({
      adKeywords: [
        { shopId: "shop-a", campaignId: "C-1", keyword: "a", spend: 500, conversions: 0, currency: "CNY" },
        { shopId: "shop-a", campaignId: "C-1", keyword: "b", spend: 999, conversions: 2, currency: "CNY" },
      ],
    });
    expect(analyzeAds(s, CTX)).toHaveLength(0);
  });

  it("花费 >5×阈值 → 升 P1", () => {
    const s = makeSnapshot({
      adKeywords: [{ shopId: "shop-a", campaignId: "C-1", keyword: "贵词", spend: 2600, conversions: 0, currency: "CNY" }],
    });
    expect(analyzeAds(s, CTX)[0]!.severity).toBe("P1");
  });
});

describe("ads · 预算节奏", () => {
  it("13:00 前耗尽 95% → 命中 P2", () => {
    const s = makeSnapshot({
      adsCampaigns: [campaign([{ date: dateDaysAgo(1), spend: 500, gmv: 2000 }], { spendToday: 475, budgetExhaustedAtHour: 13 })],
    });
    const fs = analyzeAds(s, CTX).filter((f) => f.title.includes("节奏异常"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P2");
  });

  it("15:00 耗尽 → 不命中（14:00 口径）", () => {
    const s = makeSnapshot({
      adsCampaigns: [campaign([{ date: dateDaysAgo(1), spend: 500, gmv: 2000 }], { spendToday: 475, budgetExhaustedAtHour: 15 })],
    });
    expect(analyzeAds(s, CTX).filter((f) => f.title.includes("节奏异常"))).toHaveLength(0);
  });

  it("近 7 天消耗 300 < 500×7×10%=350 → 闲置命中", () => {
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: dateDaysAgo(7 - i), spend: i === 6 ? 300 : 0, gmv: 0 }));
    // 300 < 350 → 闲置（spend=300 一天，其余 0）
    const s = makeSnapshot({ adsCampaigns: [campaign(daily)] });
    const fs = analyzeAds(s, CTX).filter((f) => f.title.includes("闲置"));
    expect(fs).toHaveLength(1);
  });

  it("近 7 天消耗 400 ≥ 350 → 不命中", () => {
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: dateDaysAgo(7 - i), spend: i === 6 ? 400 : 0, gmv: 0 }));
    const s = makeSnapshot({ adsCampaigns: [campaign(daily)] });
    expect(analyzeAds(s, CTX).filter((f) => f.title.includes("闲置"))).toHaveLength(0);
  });
});
