/** 合规健康线单测：违禁词库 / Listing 扫描 / 绩效红线 */
import { describe, expect, it } from "vitest";
import { analyzeCompliance, BUILTIN_FORBIDDEN_WORDS } from "../src/analyzers/compliance.js";
import { CTX, makeSnapshot } from "./helpers.js";

describe("compliance · 词库", () => {
  it("内置演示词库 ≥50 词", () => {
    expect(BUILTIN_FORBIDDEN_WORDS.length).toBeGreaterThanOrEqual(50);
  });
});

describe("compliance · Listing 违禁词扫描", () => {
  it("标题含「全网最低价」→ 命中 P0（极限词）", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "熊猫保温杯 全网最低价 速抢", price: 100, currency: "CNY", status: "on-sale" }],
    });
    const fs = analyzeCompliance(s, CTX).filter((f) => f.title.includes("违禁词"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P0");
    expect(fs[0]!.calculation).toContain("words=全网最低价");
  });

  it("详情含侵权词「迪士尼同款」→ 命中 P0；普通标题不命中", () => {
    const s = makeSnapshot({
      listings: [
        { shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "毛绒公仔", detail: "迪士尼同款面料", price: 100, currency: "CNY", status: "on-sale" },
        { shopId: "shop-a", listingId: "L-2", sku: "SKU-2", title: "熊猫竹纤维毛巾 柔软亲肤", price: 100, currency: "CNY", status: "on-sale" },
      ],
    });
    const fs = analyzeCompliance(s, CTX).filter((f) => f.title.includes("违禁词"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P0");
    expect(fs[0]!.evidence[0]!.id).toBe("L-1");
  });

  it("下架 Listing 不扫", () => {
    const s = makeSnapshot({
      listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "全网最低价", price: 100, currency: "CNY", status: "off-shelf" }],
    });
    expect(analyzeCompliance(s, CTX).filter((f) => f.title.includes("违禁词"))).toHaveLength(0);
  });

  it("店铺自带违禁词（快照 forbiddenWords）并集命中 → P1", () => {
    const s = makeSnapshot({
      forbiddenWords: ["竹纤维黑科技"],
      listings: [{ shopId: "shop-a", listingId: "L-1", sku: "SKU-1", title: "竹纤维黑科技毛巾", price: 100, currency: "CNY", status: "on-sale" }],
    });
    const fs = analyzeCompliance(s, CTX).filter((f) => f.title.includes("违禁词"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
  });
});

describe("compliance · 绩效红线", () => {
  it("ODR 1.2% > 1% → P0；迟发率 5% > 4% → P1；IPI 350 < 400 → P1", () => {
    const s = makeSnapshot();
    s.shops[0]!.odr = 0.012;
    s.shops[0]!.lateShipmentRate = 0.05;
    s.shops[0]!.ipi = 350;
    const fs = analyzeCompliance(s, CTX);
    expect(fs.find((f) => f.title.includes("ODR"))?.severity).toBe("P0");
    expect(fs.find((f) => f.title.includes("迟发率"))?.severity).toBe("P1");
    expect(fs.find((f) => f.title.includes("IPI"))?.severity).toBe("P1");
  });

  it("边界值：ODR 恰好 1%、迟发率恰好 4%、IPI 恰好 400 → 均不命中", () => {
    const s = makeSnapshot();
    s.shops[0]!.odr = 0.01;
    s.shops[0]!.lateShipmentRate = 0.04;
    s.shops[0]!.ipi = 400;
    s.shops[1]!.odr = 0.01;
    expect(analyzeCompliance(s, CTX).filter((f) => !f.title.includes("违禁词"))).toHaveLength(0);
  });

  it("指标未采集（undefined）→ 跳过不报错", () => {
    const s = makeSnapshot();
    expect(() => analyzeCompliance(s, CTX)).not.toThrow();
  });
});
