/**
 * server · dialog 意图/置信度纯函数单测（不触 DB）
 * M8：与 base intents 同一张规则表——complaint>biz_query>service_request>kb_qa；
 *     疑问句优先 kb_qa；「修/修一下/坏了」直连 service_request。
 * H5：置信度归一化三档边界（≥0.72 直答 / 0.5–0.72 附提示 / <0.5 拒答）。
 */
import { describe, expect, it } from "vitest";
import { classify, tierOfScore, ticketKindOf, CONFIDENCE_HIGH, CONFIDENCE_MEDIUM } from "./dialog.js";

describe("classify 意图规则（M8 与 base 同表 + 电商售后动作兜底）", () => {
  const cases: Array<[string, string, string?]> = [
    ["我要投诉，收到的商品破损了", "complaint"],
    ["查一下我的订单", "biz_query", "query_order"],
    ["我的会员积分还有多少", "biz_query", "query_member"],
    ["你们的退换货政策有哪些", "biz_query", "query_catalog"],
    ["我的工单进度怎么样了", "biz_query", "query_ticket"],
    ["退款多久到账", "kb_qa"],              // 疑问句优先 kb_qa 不建单
    ["退货上门取件几点来", "kb_qa"],          // 含售后词但表疑问 → kb_qa
    ["充电宝坏了，帮我修一下", "service_request"], // 坏了/修 直连建单
    ["我要退货，收纳箱买多了", "service_request"], // 规则表未命中 → 电商售后动作兜底建单
    ["附近地铁站怎么走", "kb_qa"],            // 无规则命中 → 默认 kb_qa（低置信拒答）
  ];
  for (const [text, intent, tool] of cases) {
    it(`「${text}」→ ${intent}${tool ? `/${tool}` : ""}`, () => {
      const r = classify(text);
      expect(r.intent).toBe(intent);
      if (tool) expect(r.tool).toBe(tool);
    });
  }
});

describe("ticketKindOf service_request → 工单类型（电商售后口径）", () => {
  it("退款/退货/换货/价保/纠纷/维修/物流 分类", () => {
    expect(ticketKindOf("我要退款，还未发货")).toBe("refund");
    expect(ticketKindOf("我要退货，收纳箱买多了")).toBe("return");
    expect(ticketKindOf("尺码买小了想换货")).toBe("exchange");
    expect(ticketKindOf("申请价保，刚买就降价")).toBe("price_protect");
    expect(ticketKindOf("保修责任有争议，申请鉴定")).toBe("dispute");
    expect(ticketKindOf("充电宝坏了，帮我修一下")).toBe("repair");
    expect(ticketKindOf("帮我催一下发货")).toBe("delivery");
    expect(ticketKindOf("帮我看看有没有这款的配件")).toBe("other");
  });
});

describe("tierOfScore 置信度三档（H5，归一化 0..1）", () => {
  it("阈值边界", () => {
    expect(CONFIDENCE_HIGH).toBe(0.72);
    expect(CONFIDENCE_MEDIUM).toBe(0.45); // 评测校准：区分度地板与拒答边界拉开
    expect(tierOfScore(0.95)).toBe("high");
    expect(tierOfScore(0.72)).toBe("high");
    expect(tierOfScore(0.71)).toBe("medium");
    expect(tierOfScore(0.45)).toBe("medium");
    expect(tierOfScore(0.44)).toBe("low");
    expect(tierOfScore(0)).toBe("low");
    expect(tierOfScore(undefined)).toBe("low");
  });
  it("越界输入归一化", () => {
    expect(tierOfScore(1.2)).toBe("high");
    expect(tierOfScore(-0.3)).toBe("low");
  });
});
