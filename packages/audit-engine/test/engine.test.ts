/** 引擎编排单测：覆盖度降级 / Top10 / 店铺归集 / 编号唯一性 */
import { describe, expect, it } from "vitest";
import { runFastScan } from "../src/engine.js";
import { makeSnapshot, NOW } from "./helpers.js";

describe("engine · 覆盖度与降级", () => {
  it("全数据源齐备 → 六线全 covered，报告正常产出", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "正常标题", price: 100, currency: "CNY", status: "on-sale" }],
      orders: [{ shopId: "shop-a", orderId: "O-1", sku: "SKU-1", amount: 100, currency: "CNY", qty: 1, status: "completed", createdAt: NOW.toISOString() }],
      adsCampaigns: [{ shopId: "shop-a", campaignId: "C-1", name: "p", status: "running", dailyBudget: 100, currency: "CNY", spendToday: 10, daily: [{ date: "2026-08-26", spend: 10, gmv: 100 }] }],
      adKeywords: [{ shopId: "shop-a", campaignId: "C-1", keyword: "k", spend: 10, conversions: 1, currency: "CNY" }],
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "w", warehouseType: "domestic", available: 10, inTransit: 5, ageDays: 10, avgDailySales: 1, currency: "CNY" }],
      reviews: [{ shopId: "shop-a", reviewId: "RV-1", sku: "SKU-1", rating: 5, createdAt: NOW.toISOString() }],
      statements: [{ shopId: "shop-a", statementId: "S-1", period: "2026-08", lines: [] }],
    });
    const r = runFastScan(s, { now: NOW });
    for (const line of ["price", "inventory", "ads", "reputation", "compliance", "recon"] as const) {
      expect(r.coverage[line], line).toBe("covered");
    }
    expect(r.overview.shopCount).toBe(2);
    expect(r.reportId).toBe("RPT-SNAP-TEST");
  });

  it("账单缺失 → recon 标 not-covered，其余线不受影响", () => {
    const r = runFastScan(makeSnapshot({ listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" }] }), { now: NOW });
    expect(r.coverage.recon).toBe("not-covered");
    expect(r.coverageNotes.some((n) => n.includes("账单"))).toBe(true);
  });

  it("订单缺失 → price 标 partial（价保子项降级），报告仍产出", () => {
    const r = runFastScan(makeSnapshot({ listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "t", price: 100, currency: "CNY", status: "on-sale" }] }), { now: NOW });
    expect(r.coverage.price).toBe("partial");
    expect(r.coverageNotes.some((n) => n.includes("价保"))).toBe(true);
  });

  it("评价缺失 → reputation not-covered", () => {
    const r = runFastScan(makeSnapshot(), { now: NOW });
    expect(r.coverage.reputation).toBe("not-covered");
  });

  it("时间预算为 0 → 全部线超时 not-covered，出空报告不报错", () => {
    const r = runFastScan(makeSnapshot(), { now: NOW, timeBudgetMinutes: 0 });
    expect(Object.values(r.coverage).every((c) => c === "not-covered")).toBe(true);
    expect(r.overview.findingCount).toBe(0);
  });
});

describe("engine · 汇总", () => {
  it("Top10 按挽回金额降序", () => {
    const s = makeSnapshot({
      adKeywords: [
        { shopId: "shop-a", campaignId: "C-1", keyword: "小词", spend: 600, conversions: 0, currency: "CNY" },
        { shopId: "shop-a", campaignId: "C-1", keyword: "大词", spend: 3000, conversions: 0, currency: "CNY" },
      ],
    });
    const r = runFastScan(s, { now: NOW });
    expect(r.top10.length).toBe(2);
    expect(r.top10[0]!.impact!.amount).toBeGreaterThanOrEqual(r.top10[1]!.impact!.amount);
  });

  it("店铺归集：发现挂到对应店，totalRecoverable 同店求和；finding id 全局唯一", () => {
    const s = makeSnapshot({
      adKeywords: [
        { shopId: "shop-a", campaignId: "C-1", keyword: "a", spend: 600, conversions: 0, currency: "CNY" },
        { shopId: "shop-b", campaignId: "C-2", keyword: "b", spend: 700, conversions: 0, currency: "CNY" },
      ],
    });
    const r = runFastScan(s, { now: NOW });
    const shopA = r.shops.find((x) => x.shopId === "shop-a")!;
    const shopB = r.shops.find((x) => x.shopId === "shop-b")!;
    expect(shopA.totalRecoverable).toBe(600);
    expect(shopB.totalRecoverable).toBe(700);
    const ids = r.shops.flatMap((x) => x.findings.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^FND-[A-Z]+-\d{3}$/.test(id))).toBe(true);
  });

  it("集团总览：按币种分桶合计 + 严重度计数", () => {
    const s = makeSnapshot({
      adKeywords: [{ shopId: "shop-a", campaignId: "C-1", keyword: "a", spend: 600, conversions: 0, currency: "CNY" }],
    });
    const r = runFastScan(s, { now: NOW });
    expect(r.overview.totalRecoverableByCurrency["CNY"]).toBe(600);
    expect(r.overview.counts.P2).toBeGreaterThanOrEqual(1);
  });
});
