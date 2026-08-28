/** 对账复核线单测：佣金错算 / 退款未冲抵 / 广告费不符 / 物流多收 / 差异率统计 */
import { describe, expect, it } from "vitest";
import { analyzeRecon } from "../src/analyzers/recon.js";
import { CTX, makeSnapshot } from "./helpers.js";

const order = (id: string, amount: number, status: "completed" | "refunding" = "completed") => ({
  shopId: "shop-a",
  orderId: id,
  sku: "SKU-1",
  amount,
  currency: "CNY",
  qty: 1,
  status,
  createdAt: "2026-08-10T10:00:00+08:00",
});

describe("recon · 佣金错算", () => {
  it("实提 5.8% vs 应提 5%（差 0.8pp > 0.5pp）→ 命中，金额 = 差值（exact）", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 10000)],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-1", amount: 10000, currency: "CNY" },
            { lineId: "LN-2", type: "commission", refId: "O-1", amount: 580, currency: "CNY" },
          ],
        },
      ],
    });
    const fs = analyzeRecon(s, CTX).filter((f) => f.title.includes("佣金错算"));
    expect(fs).toHaveLength(1);
    // 应提 10000×0.05 = 500，实提 580 → 多提 80
    expect(fs[0]!.estimatedImpact?.amount).toBe(80);
    expect(fs[0]!.estimatedImpact?.confidence).toBe("exact");
  });

  it("差 0.4pp ≤ 0.5pp → 不命中（边界）", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 10000)],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-1", amount: 10000, currency: "CNY" },
            { lineId: "LN-2", type: "commission", refId: "O-1", amount: 540, currency: "CNY" },
          ],
        },
      ],
    });
    expect(analyzeRecon(s, CTX).filter((f) => f.title.includes("佣金错算"))).toHaveLength(0);
  });

  it("店铺缺 commissionRate → 佣金子项跳过（降级不报错）", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 10000)],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [{ lineId: "LN-2", type: "commission", refId: "O-1", amount: 9999, currency: "CNY" }],
        },
      ],
    });
    s.shops.forEach((x) => delete x.commissionRate);
    expect(() => analyzeRecon(s, CTX)).not.toThrow();
    expect(analyzeRecon(s, CTX).filter((f) => f.title.includes("佣金错算"))).toHaveLength(0);
  });
});

describe("recon · 退款未冲抵", () => {
  it("退款中订单在账单但无 refund 行 → 命中 P1", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 2000, "refunding")],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [{ lineId: "LN-1", type: "order", refId: "O-1", amount: 2000, currency: "CNY" }],
        },
      ],
    });
    const fs = analyzeRecon(s, CTX).filter((f) => f.title.includes("退款未冲抵"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.severity).toBe("P1");
    expect(fs[0]!.estimatedImpact?.amount).toBe(2000);
  });

  it("有 refund 行 → 不命中", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 2000, "refunding")],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-1", amount: 2000, currency: "CNY" },
            { lineId: "LN-2", type: "refund", refId: "O-1", amount: -2000, currency: "CNY" },
          ],
        },
      ],
    });
    expect(analyzeRecon(s, CTX).filter((f) => f.title.includes("退款未冲抵"))).toHaveLength(0);
  });
});

describe("recon · 广告费与物流", () => {
  it("账单广告扣款 1100 vs 后台 1000（差 10% > 1%）→ 命中 P1", () => {
    const s = makeSnapshot({
      adsCampaigns: [
        {
          shopId: "shop-a",
          campaignId: "C-1",
          name: "计划",
          status: "running" as const,
          dailyBudget: 500,
          currency: "CNY",
          spendToday: 0,
          daily: [{ date: "2026-08-15", spend: 1000, gmv: 5000 }],
        },
      ],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-X", amount: 999999, currency: "CNY" },
            { lineId: "LN-3", type: "ad-deduction", refId: "C-1", amount: 1100, currency: "CNY" },
          ],
        },
      ],
    });
    const fs = analyzeRecon(s, CTX).filter((f) => f.title.includes("广告费与后台不符"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.estimatedImpact?.amount).toBe(100);
  });

  it("物流账单 900 vs 应计 100单×8=800（多收 12.5% > 1%）→ 命中 P2", () => {
    const orderLines = Array.from({ length: 100 }, (_, i) => ({ lineId: `LN-O-${i}`, type: "order" as const, refId: `O-${i}`, amount: 100, currency: "CNY" }));
    const s = makeSnapshot({
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [...orderLines, { lineId: "LN-L", type: "logistics", refId: "BATCH", amount: 900, currency: "CNY" }],
        },
      ],
    });
    const fs = analyzeRecon(s, CTX).filter((f) => f.title.includes("物流多收"));
    expect(fs).toHaveLength(1);
    expect(fs[0]!.estimatedImpact?.amount).toBe(100);
  });
});

describe("recon · 差异率统计", () => {
  it("每份账单产出一条差异率统计；越 0.3% 红线升 P1", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 10000)],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-1", amount: 10000, currency: "CNY" },
            { lineId: "LN-2", type: "commission", refId: "O-1", amount: 580, currency: "CNY" },
          ],
        },
      ],
    });
    const stat = analyzeRecon(s, CTX).filter((f) => f.title.includes("差异率"));
    expect(stat).toHaveLength(1);
    // 差异 80 / 订单总额 10000 = 0.8% > 0.3% → P1
    expect(stat[0]!.severity).toBe("P1");
    expect(stat[0]!.calculation.result).toBe("0.800%");
  });

  it("无差异账单 → 差异率 0%，P2 留档", () => {
    const s = makeSnapshot({
      orders: [order("O-1", 10000)],
      statements: [
        {
          shopId: "shop-a",
          statementId: "S-202608",
          period: "2026-08",
          lines: [
            { lineId: "LN-1", type: "order", refId: "O-1", amount: 10000, currency: "CNY" },
            { lineId: "LN-2", type: "commission", refId: "O-1", amount: 500, currency: "CNY" },
          ],
        },
      ],
    });
    const stat = analyzeRecon(s, CTX).filter((f) => f.title.includes("差异率"));
    expect(stat).toHaveLength(1);
    expect(stat[0]!.severity).toBe("P2");
  });
});
