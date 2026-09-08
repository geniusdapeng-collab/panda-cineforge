/**
 * ★ 技能执行体单元测试（P2/P3）
 * 纯函数层全覆盖（断货守护/库龄结构/补货模型/汇率重定价/分镜脚本）；
 * DB 层用桩 Queryable 验证行→结果映射（acos-fuse / reconciler / data-quality-watch）。
 */
import { describe, expect, it } from "vitest";
import {
  ageingStructure, avgLeadTimeDays, buildStoryboard, execAcosFuse,
  execDataQualityWatch, execFxReprice, execMultiPlatformReconciler,
  execReplenishmentModel, execVideoStoryboard, guardFromSnapshot,
  planReplenishment, type Queryable,
} from "./index.js";

describe("guardFromSnapshot（断货守护纯函数）", () => {
  it("覆盖天数 <7 触发 R7；在途件数按 SKU 聚合", () => {
    const risks = guardFromSnapshot(
      [{ sku: "A", shopId: "s1", qtyOnHand: 35, dailySales: 6 }, { sku: "B", shopId: "s1", qtyOnHand: 300, dailySales: 5 }],
      [{ sku: "A", units: 100 }, { sku: "A", units: 50 }],
    );
    expect(risks[0]!.sku).toBe("A");
    expect(risks[0]!.breached).toBe(true);
    expect(risks[0]!.inTransitUnits).toBe(150);
    expect(risks.find((r) => r.sku === "B")?.breached).toBe(false);
  });
});

describe("ageingStructure（库龄四桶）", () => {
  it("货值占比计算正确，缺桶补零", () => {
    const s = ageingStructure([
      { bucket: "0-30", qty: 10, valueAmount: 3000 },
      { bucket: "90+", qty: 5, valueAmount: 1000 },
    ]);
    expect(s).toHaveLength(4);
    expect(s.find((x) => x.bucket === "0-30")?.pctOfValue).toBe(75);
    expect(s.find((x) => x.bucket === "31-60")?.valueAmount).toBe(0);
  });
});

describe("planReplenishment（补货模型）", () => {
  it("破补货点判 critical；建议量 = 目标 − 在库 − 在途", () => {
    const plans = planReplenishment([{
      sku: "A", shopId: "s1", dailySales: 10, qtyOnHand: 100, inTransitUnits: 50,
      leadTimeDays: 30, safetyDays: 7, targetCoverDays: 45,
    }]);
    // 补货点 = 10 × 37 = 370 > 在库 100 → critical
    expect(plans[0]!.urgency).toBe("critical");
    // 建议量 = 10×45 − 100 − 50 = 300
    expect(plans[0]!.suggestQty).toBe(300);
  });
  it("avgLeadTimeDays 实测均值与回落", () => {
    expect(avgLeadTimeDays([], 35)).toBe(35);
    const d = avgLeadTimeDays([
      { departedAt: "2026-01-01", signedAt: "2026-02-01" },
      { departedAt: "2026-02-01", signedAt: "2026-03-05" },
    ]);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(40);
  });
});

describe("execFxReprice（汇率重定价）", () => {
  it("波动 >2% 触发；本币升值 → 建议降价保毛利；R2 预检", () => {
    const r = execFxReprice([{
      sku: "A", shopId: "s1", costCny: 50, currentPrice: 10, siteCurrency: "USD",
      fxAtPricing: 7.2, fxNow: 7.0, targetMarginPct: 30,
    }]);
    const p = r.detail.plans[0]!;
    // 波动 = (7.0−7.2)/7.2 ≈ −2.78% → 触发
    expect(p.breached).toBe(true);
    // 建议价 = 50×1.3/7.0 ≈ 9.29（低于现价 10，把升值让利出去保份额）
    expect(p.suggestedPrice).toBeCloseTo(9.29, 2);
    expect(p.fenceR2Pass).toBe(true);
  });
  it("波动 ±2% 内不出卡", () => {
    const r = execFxReprice([{
      sku: "A", shopId: "s1", costCny: 50, currentPrice: 10, siteCurrency: "USD",
      fxAtPricing: 7.2, fxNow: 7.25, targetMarginPct: 30,
    }]);
    expect(r.detail.plans).toHaveLength(0);
  });
});

describe("execAcosFuse（广告保险丝，桩 Queryable）", () => {
  it("烧穿盈亏平衡点 → cut-30 + 止损估算", async () => {
    const stub = {
      query: async () => ({
        rows: [{
          shop_id: "s1", period: "2026-09", currency: "CNY",
          payout_net: "100000", cost_ads: "45000", cost_total: "110000",
        }],
      }),
    };
    const r = await execAcosFuse(stub as unknown as Queryable, "ws-1", { period: "2026-09" });
    const row = r.detail.rows[0]!;
    // 实际 ACoS = 45%；盈亏平衡 = (100000−65000)/100000 = 35% → 烧穿 10pp
    expect(row.actualAcosPct).toBe(45);
    expect(row.breakevenAcosPct).toBe(35);
    expect(row.fuseAction).toBe("cut-30");
    expect(row.estSavedMonthly).toBeGreaterThan(0);
    expect(r.actions.some((a) => a.fenceRule === "R3")).toBe(true);
  });
});

describe("execMultiPlatformReconciler（账单勾稽，桩 Queryable）", () => {
  it("差异率 >0.3% 判越线", async () => {
    const stub = {
      query: async () => ({
        rows: [
          { shop_id: "s1", period: "2026-09", currency: "CNY", payout_fee: "10000", booked_fee: "10050" },
          { shop_id: "s2", period: "2026-09", currency: "CNY", payout_fee: "8000", booked_fee: "8001" },
        ],
      }),
    };
    const r = await execMultiPlatformReconciler(stub as unknown as Queryable, "ws-1", { period: "2026-09" });
    expect(r.detail.rows[0]!.breached).toBe(true);   // 50/10000 = 0.5% > 0.3%
    expect(r.detail.rows[1]!.breached).toBe(false);  // 1/8000 ≈ 0.01%
    expect(r.detail.breachedShops).toEqual(["s1"]);
  });
});

describe("execDataQualityWatch（数据源健康）", () => {
  it("failed/stale/lag 分级正确", async () => {
    const now = new Date();
    const stub = {
      query: async () => ({
        rows: [
          { id: "ds1", label: "亚马逊·美国站", platform: "amazon", shop_id: "s1", enabled: true, last_sync_at: now, last_sync_status: "failed", sync_lag_sec: 100 },
          { id: "ds2", label: "天猫·旗舰店", platform: "tmall", shop_id: "s2", enabled: true, last_sync_at: new Date(now.getTime() - 30 * 3600_000), last_sync_status: "ok", sync_lag_sec: 100 },
          { id: "ds3", label: "京东·自营", platform: "jd", shop_id: "s3", enabled: true, last_sync_at: now, last_sync_status: "ok", sync_lag_sec: 100 },
        ],
      }),
    };
    const r = await execDataQualityWatch(stub as unknown as Queryable, "ws-1");
    const byId = new Map(r.detail.sources.map((s) => [s.id, s.issue]));
    expect(byId.get("ds1")).toBe("failed");
    expect(byId.get("ds2")).toBe("stale");
    expect(byId.get("ds3")).toBe("ok");
    expect(r.headline.value).toBe(2);
  });
});

describe("video-batch-produce（分镜脚本）", () => {
  it("六镜结构与时长", () => {
    const shots = buildStoryboard({ sku: "A", title: "便携榨汁杯", sellingPoints: ["30 秒速榨", "USB-C 充电"], priceText: "$29.99" });
    expect(shots).toHaveLength(6);
    expect(shots.map((s) => s.role)).toEqual(["hook", "pain", "feature", "proof", "offer", "cta"]);
    expect(shots.reduce((s, x) => s + x.durationSec, 0)).toBe(24);
    const r = execVideoStoryboard([{ sku: "A", title: "t", sellingPoints: [], priceText: "$1" }]);
    expect(r.headline.value).toBe(1);
  });
});

describe("execReplenishmentModel（汇总出口）", () => {
  it("headline 与 trace 完整", () => {
    const r = execReplenishmentModel([{
      sku: "A", shopId: "s1", dailySales: 5, qtyOnHand: 10, inTransitUnits: 0,
      leadTimeDays: 30, safetyDays: 7, targetCoverDays: 45,
    }]);
    expect(r.headline.value).toBeGreaterThan(0);
    expect(r.traces[0]!.formula).toContain("补货点");
  });
});
