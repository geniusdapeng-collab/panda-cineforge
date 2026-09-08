/**
 * webhook 通道驱动单测（P3：IM 审批通道转正）
 * 覆盖：URL 解析三层优先级 / 三家负载格式 / 平台回执判错 / 未配置显式失败（禁静默回退）。
 */
import { describe, expect, it } from "vitest";
import {
  buildWebhookPayload, resolveWebhookUrl, WebhookChannelDriver, ChannelDriverError,
  type ApprovalCard,
} from "./index.js";

const card: ApprovalCard = {
  approvalId: "AP-001", eventId: "E-100", title: "审批 AP-001 · price.adjust",
  action: "price.adjust", objectLabel: "SKU-001",
  ruleHits: ["R1:review"], gestures: ["approve", "edit", "reject"], expiresAt: null,
};

describe("resolveWebhookUrl（三层优先级）", () => {
  it("直传 https > env 精确键 > env 通道默认键 > null", () => {
    expect(resolveWebhookUrl("dingtalk", "https://oapi.dingtalk.com/robot/send?access_token=x", {}))
      .toBe("https://oapi.dingtalk.com/robot/send?access_token=x");
    const env = { IM_WEBHOOK_DINGTALK_OPS_GROUP: "https://hook/exact", IM_WEBHOOK_DINGTALK: "https://hook/default" };
    expect(resolveWebhookUrl("dingtalk", "ops-group", env)).toBe("https://hook/exact");
    expect(resolveWebhookUrl("dingtalk", "other", env)).toBe("https://hook/default");
    expect(resolveWebhookUrl("dingtalk", "other", {})).toBeNull();
  });
});

describe("buildWebhookPayload（三家格式）", () => {
  it("钉钉 markdown / 企微 markdown / 飞书 interactive 卡片", () => {
    expect(buildWebhookPayload("dingtalk", card).msgtype).toBe("markdown");
    expect(buildWebhookPayload("wecom", card).msgtype).toBe("markdown");
    const fs = buildWebhookPayload("feishu", card);
    expect(fs.msg_type).toBe("interactive");
    const dt = buildWebhookPayload("dingtalk", card) as { markdown: { text: string } };
    expect(dt.markdown.text).toContain("R1:review");
    expect(dt.markdown.text).toContain("AP-001");
  });
  it("不支持的通道显式抛错", () => {
    expect(() => buildWebhookPayload("inapp", card)).toThrow(ChannelDriverError);
  });
});

describe("WebhookChannelDriver（出站与判错）", () => {
  it("未配置 URL 显式失败（禁止静默回退）", async () => {
    const d = new WebhookChannelDriver("dingtalk", { env: {} });
    await expect(d.sendCard({ conversationId: "ops" }, card)).rejects.toThrow(/未配置/);
  });
  it("平台 errcode 非零抛错带上下文", async () => {
    const stubFetch = (async () => new Response(JSON.stringify({ errcode: 310000, errmsg: "keywords not in content" }), { status: 200 })) as unknown as typeof fetch;
    const d = new WebhookChannelDriver("dingtalk", { fetch: stubFetch, env: { IM_WEBHOOK_DINGTALK: "https://hook/x" } });
    await expect(d.sendCard({ conversationId: "any" }, card)).rejects.toThrow(/310000/);
  });
  it("正常出站返回幂等锚点", async () => {
    const stubFetch = (async () => new Response(JSON.stringify({ errcode: 0 }), { status: 200 })) as unknown as typeof fetch;
    const d = new WebhookChannelDriver("wecom", { fetch: stubFetch, env: { IM_WEBHOOK_WECOM: "https://hook/x" } });
    const r = await d.sendText({ conversationId: "any" }, "审批已通过");
    expect(r.channelMsgId).toMatch(/^wh-wecom-\d+$/);
  });
});
