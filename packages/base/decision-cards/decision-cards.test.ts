/**
 * decision-cards 单元测试（P2 金额化决策卡片）
 * 覆盖：卡片 ID 确定性 / 完整性校验铁律（金额来源封印）/ 状态投影回放 / 任务载荷构造。
 * 计算器 SQL 层用桩 Queryable 验证行→卡片映射与阈值过滤。
 */
import { describe, expect, it } from "vitest";
import {
  assertCardIntegrity, buildTaskPayload, calcPayoutRateDrop, listDecisionCards,
  makeCardId, DEFAULT_THRESHOLDS, type DecisionCard,
} from "./index.js";

const baseCard: DecisionCard = {
  id: "dc-payout-rate-drop-shop-a-2026-09-cny",
  kind: "payout-rate-drop",
  title: "测试卡片",
  severity: "mid",
  shop_id: "shop-a",
  currency: "CNY",
  amount_impact: -12000,
  attribution: [
    { step: "数据变化", text: "回款率 62%" },
    { step: "归因分析", text: "平台扣费上浮" },
  ],
  suggested_action: "逐笔对账",
  assignee: "reconciliation-officer",
  calculation: { formula: "gap = gross*0.7 - net", inputs: { gross: 100000 }, result: "-¥12,000", source: "sql" },
  evidence_ids: [],
  period: "2026-09",
};

describe("makeCardId", () => {
  it("同因同 ID（确定性去重键）", () => {
    expect(makeCardId("payout-rate-drop", "SHOP A", "2026-09", "CNY"))
      .toBe("dc-payout-rate-drop-shop-a-2026-09-cny");
    expect(makeCardId("payout-rate-drop", "SHOP A", "2026-09", "CNY"))
      .toBe(makeCardId("payout-rate-drop", "shop-a", "2026-09", "cny"));
  });
});

describe("assertCardIntegrity（铁律①②）", () => {
  it("合法卡片放行", () => {
    expect(assertCardIntegrity(baseCard).id).toBe(baseCard.id);
  });
  it("金额来源非 sql 一律拒收", () => {
    const bad = { ...baseCard, calculation: { ...baseCard.calculation, source: "llm" } };
    expect(() => assertCardIntegrity(bad)).toThrow();
  });
  it("归因链少于两环拒收", () => {
    const bad = { ...baseCard, attribution: [{ step: "数据变化", text: "x" }] };
    expect(() => assertCardIntegrity(bad)).toThrow("归因链至少两环");
  });
});

describe("calcPayoutRateDrop（SQL 行→卡片映射）", () => {
  it("低于噪音闸门不出卡；出卡必带 calculation", async () => {
    const stub = {
      query: async () => ({
        rows: [
          { shop_id: "s1", currency: "CNY", period: "2026-09", gross: "100000", payout_net: "62000", rate: 0.62, gap_amount: "8000" },
          { shop_id: "s2", currency: "CNY", period: "2026-09", gross: "10000", payout_net: "6900", rate: 0.69, gap_amount: "100" }, // < 500 噪音闸门
        ],
      }),
    };
    const cards = await calcPayoutRateDrop(stub, "ws-1", DEFAULT_THRESHOLDS);
    expect(cards).toHaveLength(1);
    expect(cards[0].amount_impact).toBe(-8000);
    expect(cards[0].calculation.source).toBe("sql");
    expect(cards[0].attribution.map((a) => a.step)).toEqual(["数据变化", "归因分析", "建议动作"]);
  });
});

describe("listDecisionCards（状态投影回放）", () => {
  it("decided/task.created 事件按 seq 回放叠加，pending 排前", async () => {
    const stub = {
      query: async () => ({
        rows: [
          { payload: { object: { id: baseCard.id }, decision: { action: "decision.card.decided", after: { status: "accepted" } }, context: { time: "2026-09-08T01:00:00Z" }, who: { id: "m-001" } } },
        ],
      }),
    };
    const views = await listDecisionCards(stub, "ws-1", [baseCard, { ...baseCard, id: "dc-other", amount_impact: -99999 }]);
    const decided = views.find((v) => v.id === baseCard.id);
    expect(decided?.status).toBe("accepted");
    expect(decided?.decided_by).toBe("m-001");
    expect(views[0].status).toBe("pending"); // pending 优先
  });
});

describe("buildTaskPayload（决策→任务闭环）", () => {
  it("预期收益取金额绝对值，默认执行者取卡片 assignee", () => {
    const p = buildTaskPayload(baseCard, { dueAt: "2026-09-10T00:00:00Z", taskEventId: "E-100" });
    expect(p.expected_benefit).toBe(12000);
    expect(p.assignee).toBe("reconciliation-officer");
    expect(p.card_id).toBe(baseCard.id);
  });
});
