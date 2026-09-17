/** 价格健康线单测：倒挂 / 毛利破防 / 价保，正反例 + 边界 + 降级 */
import { describe, expect, it } from "vitest";
import { analyzePrice } from "../src/analyzers/price.js";
import { CTX, daysAgo, makeSnapshot } from "./helpers.js";

const baseListings = [
  { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" as const },
  { shopId: "shop-b", listingId: "L-B-1", sku: "SKU-1", title: "t", price: 118, currency: "CNY", status: "on-sale" as const },
];

describe("price · 跨平台倒挂", () => {
  it("价差 18% > 15% → 命中 P1", () => {
    // 最高 118、最低 100：gap = 18/118 ≈ 15.25%… 用 82/100 构造 18% 精确倒挂
    const s = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 82, currency: "CNY", status: "on-sale" },
        { shopId: "shop-b", listingId: "L-B-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" },
      ],
    });
    const fs = analyzePrice(s, CTX).filter((f) => f.title.includes("倒挂"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
    expect(fs[0]!.shopId).toBe("shop-a"); // 挂在低价店
  });

  it("价差 25% > 20% → 升 P0", () => {
    const s = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 75, currency: "CNY", status: "on-sale" },
        { shopId: "shop-b", listingId: "L-B-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" },
      ],
    });
    const fs = analyzePrice(s, CTX).filter((f) => f.title.includes("倒挂"));
    expect(fs[0]!.severity).toBe("P0");
  });

  it("价差 14% ≤ 15% → 不命中（边界）", () => {
    const s = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 86, currency: "CNY", status: "on-sale" },
        { shopId: "shop-b", listingId: "L-B-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" },
      ],
    });
    expect(analyzePrice(s, CTX).filter((f) => f.title.includes("倒挂"))).toHaveLength(0);
  });

  it("同店多链接不比价；跨币种不比价", () => {
    const s = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 50, currency: "CNY", status: "on-sale" },
        { shopId: "shop-a", listingId: "L-A-2", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" },
      ],
    });
    expect(analyzePrice(s, CTX).filter((f) => f.title.includes("倒挂"))).toHaveLength(0);
    const s2 = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 50, currency: "CNY", status: "on-sale" },
        { shopId: "shop-b", listingId: "L-B-1", sku: "SKU-1", title: "t", price: 100, currency: "USD", status: "on-sale" },
      ],
    });
    expect(analyzePrice(s2, CTX).filter((f) => f.title.includes("倒挂"))).toHaveLength(0);
  });
});

describe("price · 毛利破防", () => {
  it("售价 45 < 成本40×1.15=46 → 命中 P1，含估算金额", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 45, currency: "CNY", status: "on-sale" }],
      orders: [{ shopId: "shop-a", orderId: "O-1", sku: "SKU-1", amount: 900, currency: "CNY", qty: 20, status: "completed", createdAt: daysAgo(5) }],
    });
    const fs = analyzePrice(s, CTX).filter((f) => f.title.includes("毛利红线"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
    // (46 − 45) × 20 件 = 20
    expect(fs[0]!.impact?.amount).toBe(20);
    expect(fs[0]!.impact?.confidence).toBe("baseline");
  });

  it("售价 38 < 成本 40 → 升 P0（卖一件亏一件）", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 38, currency: "CNY", status: "on-sale" }],
    });
    const fs = analyzePrice(s, CTX).filter((f) => f.title.includes("毛利红线"));
    expect(fs[0]!.severity).toBe("P0");
  });

  it("售价 50 ≥ 46 → 不命中", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 50, currency: "CNY", status: "on-sale" }],
    });
    expect(analyzePrice(s, CTX).filter((f) => f.title.includes("毛利红线"))).toHaveLength(0);
  });

  it("缺成本主数据 → 毛利子项跳过（降级不报错）", () => {
    const s = makeSnapshot({
      skuCosts: [],
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 10, currency: "CNY", status: "on-sale" }],
    });
    expect(() => analyzePrice(s, CTX)).not.toThrow();
    expect(analyzePrice(s, CTX).filter((f) => f.title.includes("毛利红线"))).toHaveLength(0);
  });
});

describe("price · 价保风险", () => {
  it("现价 90 < 近30天最低成交价 95 → 命中 P2", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 90, currency: "CNY", status: "on-sale" }],
      orders: [
        { shopId: "shop-a", orderId: "O-1", sku: "SKU-1", amount: 190, currency: "CNY", qty: 2, status: "completed", createdAt: daysAgo(10) },
        { shopId: "shop-a", orderId: "O-2", sku: "SKU-1", amount: 100, currency: "CNY", qty: 1, status: "completed", createdAt: daysAgo(3) },
      ],
    });
    const fs = analyzePrice(s, CTX).filter((f) => f.title.includes("价保"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P2");
    expect(fs[0]!.calculation).toContain("minDealPrice=95");
  });

  it("31 天前的成交不计入窗口 → 不命中", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-A-1", sku: "SKU-1", title: "t", price: 90, currency: "CNY", status: "on-sale" }],
      orders: [{ shopId: "shop-a", orderId: "O-1", sku: "SKU-1", amount: 95, currency: "CNY", qty: 1, status: "completed", createdAt: daysAgo(31) }],
    });
    expect(analyzePrice(s, CTX).filter((f) => f.title.includes("价保"))).toHaveLength(0);
  });
});
