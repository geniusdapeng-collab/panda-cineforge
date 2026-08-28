/**
 * 埋点考卷（集成验证，本任务的成败判据）
 * 参照 twin 剧情口径构造一份含 6 个已知埋点的快照，引擎必须全部独立算出，
 * 且严重度 / 金额口径正确。任何一条漏报或错级 = 考卷不过。
 *
 * 埋点清单：
 *  ① SKU PD-THERMAL-CUP-02 跨平台倒挂 18%（82 vs 100）
 *  ② 计划 AMZ-C-301 ACoS 连续 3 天 0.50 超盈亏线 0.44
 *  ③ SKU PD-PANDA-PLUSH-03 海外仓库龄 95 天
 *  ④ Listing 标题含「全网最低价」违禁词
 *  ⑤ 账单 ST-202608 佣金多提 0.8pp（订单 10000，应提 5%=500，实提 580）
 *  ⑥ 差评 RV-BAD-001 约 72h 未回复
 */
import { describe, expect, it } from "vitest";
import { runFastScan } from "../src/engine.js";
import type { AuditSnapshot, Finding } from "../src/types.js";
import { daysAgo, hoursAgo, NOW } from "./helpers.js";

/** 含 6 个埋点的完整快照（各埋点数据互相隔离，避免交叉触发干扰断言） */
function plantedSnapshot(): AuditSnapshot {
  return {
    snapshotId: "SNAP-PLANTED",
    generatedAt: NOW.toISOString(),
    shops: [
      {
        shopId: "tmall-flagship-001",
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
        shopId: "jd-self-001",
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
      { sku: "PD-THERMAL-CUP-02", cost: 40, currency: "CNY" },
      { sku: "PD-PANDA-PLUSH-03", cost: 55, currency: "CNY" },
      { sku: "PD-TEA-GIFT-04", cost: 10, currency: "CNY" },
    ],
    listings: [
      // 埋点①：同 SKU 天猫 82 / 京东 100 → 倒挂 18%
      { shopId: "tmall-flagship-001", listingId: "TM-L-6602", sku: "PD-THERMAL-CUP-02", title: "熊猫保温杯 316 不锈钢", price: 82, currency: "CNY", status: "on-sale" },
      { shopId: "jd-self-001", listingId: "JD-L-6602", sku: "PD-THERMAL-CUP-02", title: "熊猫保温杯 316 不锈钢", price: 100, currency: "CNY", status: "on-sale" },
      // 埋点④：违禁词「全网最低价」
      { shopId: "tmall-flagship-001", listingId: "TM-L-6604", sku: "PD-TEA-GIFT-04", title: "熊猫茶叶礼盒 全网最低价 送礼首选装", price: 199, currency: "CNY", status: "on-sale" },
    ],
    orders: [
      // 埋点⑤的对账锚：订单 10000（sku 不与任何 Listing 交叉，避免触发价保子项）
      { shopId: "tmall-flagship-001", orderId: "TM-O-88001", amount: 10000, currency: "CNY", qty: 100, status: "completed", createdAt: daysAgo(12) },
    ],
    adsCampaigns: [
      // 埋点②：连续 3 天 ACoS 0.50 > 盈亏线 0.44（京东店成本率 0.4 = 40/100）
      {
        shopId: "jd-self-001",
        campaignId: "AMZ-C-301",
        name: "熊猫优选-爆款拉新计划",
        status: "running",
        dailyBudget: 800,
        currency: "CNY",
        spendToday: 120,
        daily: [
          { date: daysAgo(4).slice(0, 10), spend: 200, gmv: 1000 }, // ACoS 0.20 正常
          { date: daysAgo(3).slice(0, 10), spend: 500, gmv: 1000 }, // 0.50 越线
          { date: daysAgo(2).slice(0, 10), spend: 500, gmv: 1000 }, // 0.50 越线
          { date: daysAgo(1).slice(0, 10), spend: 500, gmv: 1000 }, // 0.50 越线
        ],
      },
    ],
    adKeywords: [],
    inventory: [
      // 埋点③：海外仓库龄 95 天（周转 20 天不触发积压、可售 20 天不触发断货——隔离干净）
      { sku: "PD-PANDA-PLUSH-03", warehouseId: "WH-LA-01", warehouseName: "洛杉矶一号仓", warehouseType: "overseas", available: 20, inTransit: 5, ageDays: 95, avgDailySales: 1, currency: "CNY" },
    ],
    reviews: [
      // 埋点⑥：1 星差评恰好 72h 未回复（>48h 命中；升级线为严格 >72h，恰好 72h 仍 P1）
      { shopId: "tmall-flagship-001", reviewId: "RV-BAD-001", sku: "PD-THERMAL-CUP-02", rating: 1, createdAt: hoursAgo(72), content: "杯子漏水，差评！" },
    ],
    statements: [
      // 埋点⑤：佣金实提 580 vs 应提 10000×5%=500 → 多提 0.8pp
      {
        shopId: "tmall-flagship-001",
        statementId: "ST-202608",
        period: "2026-08",
        lines: [
          { lineId: "ST-LN-1", type: "order", refId: "TM-O-88001", amount: 10000, currency: "CNY" },
          { lineId: "ST-LN-2", type: "commission", refId: "TM-O-88001", amount: 580, currency: "CNY" },
        ],
      },
    ],
    forbiddenWords: [],
  };
}

const report = runFastScan(plantedSnapshot(), { now: NOW });
const all = report.shops.flatMap((s) => s.findings);
const find = (pred: (f: Finding) => boolean): Finding | undefined => all.find(pred);

describe("埋点考卷 · 6 个已知埋点必须全部检出", () => {
  it("① 跨平台倒挂 18% → 检出，P1，挂低价店，价差口径正确", () => {
    const f = find((x) => x.line === "price" && x.title.includes("PD-THERMAL-CUP-02") && x.title.includes("倒挂"));
    expect(f, "埋点①未检出").toBeDefined();
    expect(f!.severity).toBe("P1"); // 18% > 15%，未超 20% 升级线
    expect(f!.shopId).toBe("tmall-flagship-001");
    expect(f!.calculation.inputs["minPrice"]).toBe(82);
    expect(f!.calculation.inputs["maxPrice"]).toBe(100);
    expect(f!.calculation.result).toBe("18%");
  });

  it("② ACoS 连续 3 天越线 → 检出，P1，盈亏线 0.44，金额 = 窗口超支月度折算", () => {
    const f = find((x) => x.line === "ads" && x.title.includes("连续 3 天"));
    expect(f, "埋点②未检出").toBeDefined();
    expect(f!.severity).toBe("P1");
    expect(f!.calculation.inputs["breakeven"]).toBe(0.44);
    // 每日超支 500−1000×0.44=60，3 天 180，月度 180/3×30=1800
    expect(f!.estimatedImpact?.amount).toBe(1800);
    expect(f!.estimatedImpact?.confidence).toBe("baseline");
  });

  it("③ 海外仓库龄 95 天 → 检出，P1，占用资金 = 20 件 × 成本 55 = 1100", () => {
    const f = find((x) => x.line === "inventory" && x.title.includes("库龄 95"));
    expect(f, "埋点③未检出").toBeDefined();
    expect(f!.severity).toBe("P1");
    expect(f!.estimatedImpact?.amount).toBe(1100);
    expect(f!.estimatedImpact?.confidence).toBe("exact");
  });

  it("④ 「全网最低价」违禁词 → 检出，P0（广告法高危）", () => {
    const f = find((x) => x.line === "compliance" && x.title.includes("违禁词"));
    expect(f, "埋点④未检出").toBeDefined();
    expect(f!.severity).toBe("P0");
    expect(String(f!.calculation.inputs["words"])).toContain("全网最低价");
    expect(f!.evidence[0]!.id).toBe("TM-L-6604");
  });

  it("⑤ 佣金多提 0.8pp → 检出，金额 = 80（10000×0.008，exact）", () => {
    const f = find((x) => x.line === "recon" && x.title.includes("佣金错算"));
    expect(f, "埋点⑤未检出").toBeDefined();
    expect(f!.calculation.result).toBe("0.80pp");
    expect(f!.estimatedImpact?.amount).toBe(80);
    expect(f!.estimatedImpact?.confidence).toBe("exact");
  });

  it("⑥ 差评约 72h 未回 → 检出，P1（>48h 命中，未触发 >72h 升级）", () => {
    const f = find((x) => x.line === "reputation" && x.title.includes("未回复"));
    expect(f, "埋点⑥未检出").toBeDefined();
    expect(f!.severity).toBe("P1");
    expect(f!.evidence[0]!.id).toBe("RV-BAD-001");
  });

  it("考卷整体：六线覆盖度全 covered，报告结构完整（一店一份 + 总览 + Top10）", () => {
    for (const line of ["price", "inventory", "ads", "reputation", "compliance", "recon"] as const) {
      expect(report.coverage[line], line).toBe("covered");
    }
    expect(report.shops).toHaveLength(2);
    expect(report.overview.findingCount).toBeGreaterThanOrEqual(6);
    expect(report.top10.length).toBeGreaterThanOrEqual(1);
    // 隔离性兜底：保温杯 SKU 不应误触发毛利破防（82 > 40×1.15=46）
    expect(find((x) => x.title.includes("PD-THERMAL-CUP-02") && x.title.includes("毛利红线"))).toBeUndefined();
  });
});
