/** 库存健康线单测：积压 / 断货 / 库龄 / 仓间失衡，正反例 + 边界 */
import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/analyzers/inventory.js";
import { CTX, makeSnapshot } from "./helpers.js";

describe("inventory · 积压", () => {
  it("周转 75 天 > 60 → 命中，占用资金 = 库存×成本（exact）", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 150, inTransit: 0, avgDailySales: 2, currency: "CNY" }],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("积压"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.impact?.amount).toBe(6000); // 150 × 40
    expect(fs[0]!.impact?.confidence).toBe("exact");
  });

  it("周转恰好 60 天 → 不命中（边界 >60）", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 120, inTransit: 0, avgDailySales: 2, currency: "CNY" }],
    });
    expect(analyzeInventory(s, CTX).filter((f) => f.title.includes("积压"))).toHaveLength(0);
  });

  it("零动销且有库存 → 周转∞ 命中 P1", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 30, inTransit: 0, avgDailySales: 0, currency: "CNY" }],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("积压"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
  });
});

describe("inventory · 断货", () => {
  it("可售 5 天 < 7 且在途 0 → 命中 P1", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 10, inTransit: 0, avgDailySales: 2, currency: "CNY" }],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("断货"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
  });

  it("可售 5 天但在途 >0 → 不命中", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 10, inTransit: 50, avgDailySales: 2, currency: "CNY" }],
    });
    expect(analyzeInventory(s, CTX).filter((f) => f.title.includes("断货"))).toHaveLength(0);
  });

  it("可售 2 天 → 升 P0", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 4, inTransit: 0, avgDailySales: 2, currency: "CNY" }],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("断货"));
    expect(fs[0]!.severity).toBe("P0");
  });
});

describe("inventory · 库龄", () => {
  it("海外仓库龄 95 天 > 90 → 命中 P1", () => {
    const s = makeSnapshot({
      inventory: [{ sku: "SKU-1", warehouseId: "WH-LA", warehouseName: "洛杉矶一号仓", warehouseType: "overseas", available: 20, inTransit: 0, ageDays: 95, avgDailySales: 1, currency: "CNY" }],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("库龄"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
    expect(fs[0]!.impact?.amount).toBe(800); // 20 × 40
  });

  it("库龄恰好 90 → 不命中（边界 >90）；国内仓不扫库龄", () => {
    const s = makeSnapshot({
      inventory: [
        { sku: "SKU-1", warehouseId: "WH-LA", warehouseName: "洛杉矶一号仓", warehouseType: "overseas", available: 20, inTransit: 0, ageDays: 90, avgDailySales: 1, currency: "CNY" },
        { sku: "SKU-2", warehouseId: "WH-CD", warehouseName: "成都一号仓", warehouseType: "domestic", available: 20, inTransit: 0, ageDays: 200, avgDailySales: 1, currency: "CNY" },
      ],
    });
    expect(analyzeInventory(s, CTX).filter((f) => f.title.includes("库龄"))).toHaveLength(0);
  });
});

describe("inventory · 仓间失衡", () => {
  it("同 SKU 一仓断货边缘 + 一仓积压 → 命中 P1", () => {
    const s = makeSnapshot({
      inventory: [
        { sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 6, inTransit: 0, avgDailySales: 2, currency: "CNY" },
        { sku: "SKU-1", warehouseId: "WH-2", warehouseName: "成都二号仓", warehouseType: "domestic", available: 200, inTransit: 0, avgDailySales: 1, currency: "CNY" },
      ],
    });
    const fs = analyzeInventory(s, CTX).filter((f) => f.title.includes("仓间失衡"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
  });

  it("两仓都健康 → 不命中", () => {
    const s = makeSnapshot({
      inventory: [
        { sku: "SKU-1", warehouseId: "WH-1", warehouseName: "成都一号仓", warehouseType: "domestic", available: 40, inTransit: 0, avgDailySales: 2, currency: "CNY" },
        { sku: "SKU-1", warehouseId: "WH-2", warehouseName: "成都二号仓", warehouseType: "domestic", available: 30, inTransit: 0, avgDailySales: 2, currency: "CNY" },
      ],
    });
    expect(analyzeInventory(s, CTX).filter((f) => f.title.includes("仓间失衡"))).toHaveLength(0);
  });
});
