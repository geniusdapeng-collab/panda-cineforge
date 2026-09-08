/**
 * im-channels/webhook.ts —— 真实 webhook 通道驱动（P3：IM 审批通道转正第一刀）
 *
 * 背景：审批卡片出站长期只有 MockChannelDriver（inapp 回环）；dsh-im 全量 SDK 未随仓。
 *      本驱动覆盖卖家最常用的落地形态——群自定义机器人 webhook：
 *      钉钉（oapi.dingtalk.com/robot/send）/ 企业微信（qyapi.weixin.qq.com/.../webhook/send）/
 *      飞书（open.feishu.cn/.../bot/v2/hook）三家均支持 markdown 卡片，零 SDK 依赖。
 *
 * 纪律：
 *  - webhook URL 只走环境变量/凭据引用（conversationId 即凭据引用键），事件与日志不落明文（L7.3）；
 *  - 未配置 URL → 显式抛 ChannelDriverError（禁止静默回退 mock，底座"显式失败"纪律）；
 *  - 发送失败一律带 HTTP 状态与平台 errcode 上下文抛出，便于对账（先发后写口径见 cards.ts）。
 */
import { ChannelDriverError, type ApprovalCard, type ChannelDriver } from "./cards.js";
import type { ApprovalChannel } from "./registry.js";

export interface WebhookDriverDeps {
  fetch?: typeof fetch;
  /** 环境变量源（默认 process.env；conversationId → env 键的映射见 resolveWebhookUrl） */
  env?: NodeJS.ProcessEnv;
}

/** conversationId → webhook URL 解析（三层：直传 https URL > env 精确键 > env 通道默认键） */
export function resolveWebhookUrl(
  channel: ApprovalChannel, conversationId: string, env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (conversationId.startsWith("https://")) return conversationId; // 直传（测试/临时通道）
  const exactKey = `IM_WEBHOOK_${channel.toUpperCase().replace(/-/g, "_")}_${conversationId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  if (env[exactKey]) return env[exactKey]!;
  const channelKey = `IM_WEBHOOK_${channel.toUpperCase().replace(/-/g, "_")}`;
  return env[channelKey] ?? null;
}

/** 审批卡片 → 三家机器人 markdown 负载 */
export function buildWebhookPayload(
  channel: ApprovalChannel, card: ApprovalCard,
): Record<string, unknown> {
  const lines = [
    `**${card.title}**`,
    `> 对象：${card.objectLabel}`,
    card.ruleHits.length > 0 ? `> 命中规则：${card.ruleHits.join("、")}` : "",
    card.expiresAt ? `> 快照截止：${card.expiresAt}` : "",
    `> 手势：✅批准 / ✏️改派 / ❌驳回（审批单 ${card.approvalId}）`,
  ].filter(Boolean).join("\n\n");
  switch (channel) {
    case "dingtalk":
      return { msgtype: "markdown", markdown: { title: card.title, text: lines } };
    case "wecom":
      return { msgtype: "markdown", markdown: { content: lines } };
    case "feishu":
      return {
        msg_type: "interactive",
        card: {
          header: { title: { tag: "plain_text", content: card.title } },
          elements: [{ tag: "div", text: { tag: "lark_md", content: lines } }],
        },
      };
    default:
      throw new ChannelDriverError(channel, new Error(`webhook 驱动不支持通道 ${channel}（仅 dingtalk/wecom/feishu）`));
  }
}

/** 平台回执判错（钉钉 errcode / 企微 errcode / 飞书 code 三家不同构） */
function assertPlatformOk(channel: ApprovalChannel, body: unknown): void {
  const b = body as { errcode?: number; errmsg?: string; code?: number; msg?: string };
  if (typeof b?.errcode === "number" && b.errcode !== 0) {
    throw new ChannelDriverError(channel, new Error(`平台回执 errcode=${b.errcode} ${b.errmsg ?? ""}`));
  }
  if (typeof b?.code === "number" && b.code !== 0) {
    throw new ChannelDriverError(channel, new Error(`平台回执 code=${b.code} ${b.msg ?? ""}`));
  }
}

export class WebhookChannelDriver implements ChannelDriver {
  private readonly fetchImpl: typeof fetch;
  private readonly env: NodeJS.ProcessEnv;

  constructor(readonly channel: ApprovalChannel, deps: WebhookDriverDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.env = deps.env ?? process.env;
  }

  private async post(target: { conversationId: string }, payload: Record<string, unknown>): Promise<{ channelMsgId: string }> {
    const url = resolveWebhookUrl(this.channel, target.conversationId, this.env);
    if (!url) {
      throw new ChannelDriverError(this.channel, new Error(
        `webhook URL 未配置（conversationId=${target.conversationId}；配置 IM_WEBHOOK_${this.channel.toUpperCase().replace(/-/g, "_")}[_<会话>] 后重试——显式失败，禁止静默回退 mock）`,
      ));
    }
    const r = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new ChannelDriverError(this.channel, new Error(`HTTP ${r.status} ${await r.text()}`));
    const body = (await r.json().catch(() => ({}))) as unknown;
    assertPlatformOk(this.channel, body);
    // 机器人 webhook 无消息 ID 语义，用出站时间戳作幂等锚点（原地更新不可用，退化为追发结果卡）
    return { channelMsgId: `wh-${this.channel}-${Date.now()}` };
  }

  async sendCard(target: { conversationId: string }, card: ApprovalCard): Promise<{ channelMsgId: string }> {
    return this.post(target, buildWebhookPayload(this.channel, card));
  }

  async sendText(target: { conversationId: string }, text: string): Promise<{ channelMsgId: string }> {
    const payload = this.channel === "feishu"
      ? { msg_type: "text", content: { text } }
      : this.channel === "wecom"
        ? { msgtype: "text", text: { content: text } }
        : { msgtype: "text", text: { content: text } };
    return this.post(target, payload);
  }
}
