/** 口碑健康线单测：未回复差评 / 低分 SKU / 差评聚集 */
import { describe, expect, it } from "vitest";
import { analyzeReputation } from "../src/analyzers/reputation.js";
import { CTX, daysAgo, hoursAgo, makeSnapshot, NOW } from "./helpers.js";

describe("reputation · 未回复差评", () => {
  it("1 星差评 72h 未回 → 命中 P1（>48h 且未超 72h 严格大于）", () => {
    const s = makeSnapshot({
      reviews: [{ shopId: "shop-a", reviewId: "RV-1", sku: "SKU-1", rating: 1, createdAt: hoursAgo(72), content: "差" }],
    });
    const fs = analyzeReputation(s, CTX).filter((f) => f.title.includes("未回复"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1"); // 恰好 72h 不触发 >72h 升级
  });

  it("2 星差评 73h 未回 → 升 P0", () => {
    const s = makeSnapshot({
      reviews: [{ shopId: "shop-a", reviewId: "RV-1", rating: 2, createdAt: hoursAgo(73) }],
    });
    const fs = analyzeReputation(s, CTX).filter((f) => f.title.includes("未回复"));
    expect(fs[0]!.severity).toBe("P0");
  });

  it("47h 未回 → 不命中（边界）；已回复 → 不命中；4 星不算差评", () => {
    const s = makeSnapshot({
      reviews: [
        { shopId: "shop-a", reviewId: "RV-1", rating: 1, createdAt: hoursAgo(47) },
        { shopId: "shop-a", reviewId: "RV-2", rating: 1, createdAt: hoursAgo(90), repliedAt: hoursAgo(10) },
        { shopId: "shop-a", reviewId: "RV-3", rating: 4, createdAt: hoursAgo(90) },
      ],
    });
    expect(analyzeReputation(s, CTX).filter((f) => f.title.includes("未回复"))).toHaveLength(0);
  });
});

describe("reputation · 低分 SKU", () => {
  it("20 条评论均分 3.9 < 4.0 → 命中 P1", () => {
    const reviews = Array.from({ length: 20 }, (_, i) => ({
      shopId: "shop-a",
      reviewId: `RV-${i}`,
      sku: "SKU-1",
      rating: i < 2 ? 1 : 4, // 均分 (2×1 + 18×4)/20 = 3.7
      createdAt: daysAgo(10),
      repliedAt: daysAgo(9),
    }));
    const s = makeSnapshot({ reviews });
    const fs = analyzeReputation(s, CTX).filter((f) => f.title.includes("低于 4.0"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
  });

  it("19 条评论 → 样本不足不命中；均分 4.2 → 不命中", () => {
    const few = Array.from({ length: 19 }, (_, i) => ({ shopId: "shop-a", reviewId: `A-${i}`, sku: "SKU-1", rating: 2, createdAt: daysAgo(10), repliedAt: daysAgo(9) }));
    expect(analyzeReputation(makeSnapshot({ reviews: few }), CTX).filter((f) => f.title.includes("低于 4.0"))).toHaveLength(0);
    const good = Array.from({ length: 25 }, (_, i) => ({ shopId: "shop-a", reviewId: `B-${i}`, sku: "SKU-1", rating: 4.2, createdAt: daysAgo(10), repliedAt: daysAgo(9) }));
    expect(analyzeReputation(makeSnapshot({ reviews: good }), CTX).filter((f) => f.title.includes("低于 4.0"))).toHaveLength(0);
  });
});

describe("reputation · 差评聚集", () => {
  it("7 天内 3 条差评同 SKU → 命中 P0", () => {
    const s = makeSnapshot({
      reviews: [0, 1, 2].map((i) => ({ shopId: "shop-a", reviewId: `RV-${i}`, sku: "SKU-1", rating: 1, createdAt: daysAgo(i + 1), repliedAt: daysAgo(i) })),
    });
    const fs = analyzeReputation(s, CTX).filter((f) => f.title.includes("聚集"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P0");
  });

  it("2 条 → 不命中；8 天前的差评不计入窗口", () => {
    const s = makeSnapshot({
      reviews: [
        { shopId: "shop-a", reviewId: "RV-1", sku: "SKU-1", rating: 1, createdAt: daysAgo(1), repliedAt: NOW.toISOString() },
        { shopId: "shop-a", reviewId: "RV-2", sku: "SKU-1", rating: 1, createdAt: daysAgo(8), repliedAt: NOW.toISOString() },
        { shopId: "shop-a", reviewId: "RV-3", sku: "SKU-1", rating: 1, createdAt: daysAgo(9), repliedAt: NOW.toISOString() },
      ],
    });
    expect(analyzeReputation(s, CTX).filter((f) => f.title.includes("聚集"))).toHaveLength(0);
  });
});
