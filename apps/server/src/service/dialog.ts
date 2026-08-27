/**
 * service · 对话（接口对齐 packages/base/service-dialog 签名；表结构为底座迁移版）
 * 意图流水线（M8：与 packages/base/service-dialog/intents.ts 同一张规则表 ruleBasedIntent）：
 *   complaint（投诉）> biz_query（订单/会员/服务目录/工单进度）> service_request（售后服务类，产 ticketDraft）
 *   > kb_qa（KB 检索三档分流）> chat（规则未命中兜底）
 *   疑问句（几点/时间/吗/呢/怎么/如何）优先 kb_qa 不建单；「修/修一下/坏了」直连 service_request；
 *   电商售后动作（退款/退货/换货/价保/纠纷，规则表未命中时）兜底补判为 service_request。
 * 多模态（演示级，不接真实视觉模型）：mediaKindOfText 识别 [截图]/[图片]/[视频] 标记，
 *   网关联动「截图→订单关联 / 图片→商品卡片 / 视频→安装步骤」回复结构。
 * 置信度三档（H5：检索 score 归一化 0..1，复用 base scoreChunkFallback）：
 *   ≥0.72 直接作答（带引用）；0.45–0.72 作答但附「可能不完全准确」提示；<0.45 诚实拒答 + ticketDraft。
 * 命中 KB 必带 citations，无据不答（诚实拒答）。
 * 全量消息落 c_messages（stats.overview 聚合数据源；mock 仅在响应标注）。
 */
import { ruleBasedIntent } from "@workloom/base/service-dialog";
import { ensureServiceSchema } from "./store.js";
import { searchKB, type KbHit } from "./kb.js";
import { llmCall } from "./llm.js";
import { serviceTx, svcQuery } from "./events.js";
import type { Channel } from "./channels.js";

export type Intent = "chat" | "kb_qa" | "biz_query" | "service_request" | "complaint";
export type BizToolName = "query_order" | "query_member" | "query_catalog" | "query_ticket";

export interface DialogResult {
  conversationId: string;
  intent: Intent;
  answer: string;
  confidence: number;
  citations: Array<{ documentTitle: string; heading: string; content: string }>;
  ticketDraft?: { kind: string; title: string; payload: Record<string, unknown> };
  toolCall?: { tool: BizToolName; params: Record<string, unknown> };
  latencyMs: number;
  mock?: boolean;
}

let seq = 0;
function newId(prefix: string): string {
  seq = (seq + 1) % 46636;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36).padStart(3, "0")}${Math.random().toString(36).slice(2, 6)}`;
}

/* ================= 意图（M8：复用 base 同一张规则表） ================= */

/** 工单/售后进度查询（server 侧特有 biz_query 子类，先于规则表判定） */
const RE_TICKET_STATUS = /工单.*(进度|状态|怎么样)|进度.*工单|售后.*进度/;
const RE_ORDER = /订单|物流|快递|发货|签收|账单|发票记录/;
const RE_MEMBER = /会员|积分|等级|权益|余额|优惠券/;
/** 服务目录查询（退换/保修/安装等政策目录，直连 query_catalog 而非 KB 检索） */
const RE_CATALOG = /服务目录|售后政策|退换货政策|退货政策|保修政策|安装指导|维修政策/;
/** 售后动作指令（规则表未命中时兜底建单；疑问句已在规则表分流 kb_qa，不会走到这里） */
const RE_AFTERSALE_ACTION = /退款|退货|换货|换新|价保|补差|纠纷/;

export function classify(text: string): { intent: Intent; tool?: BizToolName } {
  if (RE_TICKET_STATUS.test(text)) return { intent: "biz_query", tool: "query_ticket" };
  if (RE_CATALOG.test(text)) return { intent: "biz_query", tool: "query_catalog" };
  const ruled = ruleBasedIntent(text);
  if (ruled === "complaint") return { intent: "complaint" };
  if (ruled === "service_request") return { intent: "service_request" };
  if (ruled === "biz_query") {
    if (RE_MEMBER.test(text)) return { intent: "biz_query", tool: "query_member" };
    return { intent: "biz_query", tool: "query_order" };
  }
  // 电商售后动作兜底：规则表（base 通用词表）未命中的退款/退货/换货/价保/纠纷指令 → 建单
  if (!ruled && RE_AFTERSALE_ACTION.test(text)) return { intent: "service_request" };
  return { intent: "kb_qa" }; // 规则未命中：默认先查知识库（低置信走诚实拒答三档）
}

/** service_request 文本 → 工单类型（电商售后口径：退款/退货/换货/纠纷/价保 + 兼容 repair/delivery） */
export function ticketKindOf(
  text: string,
): "refund" | "return" | "exchange" | "dispute" | "price_protect" | "repair" | "delivery" | "other" {
  if (/价保|补差|降价/.test(text)) return "price_protect";
  if (/换货|换新|换尺码|换颜色|换一/.test(text)) return "exchange";
  if (/纠纷|争议|维权|鉴定/.test(text)) return "dispute";
  if (/退款|退钱|仅退款/.test(text)) return "refund";
  if (/退货|退掉|退回|无理由退/.test(text)) return "return";
  if (/维修|修|坏|故障|充不进|无法开机|不制冷|不制热|异响|漏水/.test(text)) return "repair";
  if (/催.*发货|催单|改地址|开发票|补发/.test(text)) return "delivery";
  return "other";
}

/* ================= 多模态消息（演示级，不接真实视觉模型） ================= */

export type MediaKind = "screenshot" | "image" | "video";

/** 文本内多模态标记识别：[截图]/[图片]/[视频] 前缀或显式关键词（与 seed 多模态会话口径一致） */
export function mediaKindOfText(text: string): MediaKind | null {
  if (/\[(截图|screenshot)\]|截图/i.test(text)) return "screenshot";
  if (/\[(视频|video)\]|视频/i.test(text)) return "video";
  if (/\[(图片|image)\]|找同款|找类似|有没有类似/i.test(text)) return "image";
  return null;
}

/* ================= 置信度三档（H5） ================= */

export type ConfidenceTier = "high" | "medium" | "low";
export const CONFIDENCE_HIGH = 0.72;
export const CONFIDENCE_MEDIUM = 0.45;

/** score 归一化（0..1）后分档：≥0.72 高 / 0.45–0.72 中 / <0.45 低 */
export function tierOfScore(score: number | undefined): ConfidenceTier {
  if (score === undefined) return "low";
  const s = Math.max(0, Math.min(1, score));
  if (s >= CONFIDENCE_HIGH) return "high";
  if (s >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}

export const MEDIUM_HINT = "以上回答可能不完全准确，仅供参考；如需确认可联系在线客服。";
export const LOW_REFUSAL = "抱歉，这个问题我暂时无法准确回答，不敢随意编造。已为您准备好工单草稿，确认后转人工客服跟进；您也可以换个说法再问我。";

async function ensureConversation(input: {
  workspaceId: string; cUserId: string; channel: Channel; conversationId?: string;
}): Promise<string> {
  if (input.conversationId) {
    const rows = await svcQuery(
      input.workspaceId,
      `SELECT id FROM c_conversations WHERE workspace_id=$1 AND id=$2 AND c_user_id=$3`,
      [input.workspaceId, input.conversationId, input.cUserId],
    );
    if (rows[0]) return input.conversationId;
  }
  const id = newId("cvn");
  await svcQuery(
    input.workspaceId,
    `INSERT INTO c_conversations (id, workspace_id, c_user_id, channel) VALUES ($1,$2,$3,$4) RETURNING id`,
    [id, input.workspaceId, input.cUserId, input.channel],
  );
  return id;
}

async function logMessage(row: {
  workspaceId: string; conversationId: string; role: "user" | "assistant";
  content: string; intent?: Intent; confidence?: number; citations?: unknown[]; latencyMs?: number;
}): Promise<void> {
  await serviceTx(row.workspaceId, async (client) => {
    await client.query(
      `INSERT INTO c_messages (workspace_id, conversation_id, role, content, intent, confidence, citations, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.workspaceId, row.conversationId, row.role, row.content,
       row.intent ?? null, row.confidence ?? null, JSON.stringify(row.citations ?? []), row.latencyMs ?? null],
    );
    await client.query(
      `UPDATE c_conversations SET last_message_at=now() WHERE workspace_id=$1 AND id=$2`,
      [row.workspaceId, row.conversationId],
    );
  });
}

function citationsOf(hits: KbHit[]): Array<{ documentTitle: string; heading: string; content: string }> {
  return hits.slice(0, 3).map((h) => ({ documentTitle: h.documentTitle, heading: h.heading, content: h.content.slice(0, 300) }));
}

export async function handleMessage(input: {
  workspaceId: string; cUserId: string; channel: Channel; text: string; conversationId?: string;
}): Promise<DialogResult> {
  await ensureServiceSchema();
  const t0 = Date.now();
  const llm = llmCall();
  const mock = !llm;
  const conversationId = await ensureConversation(input);
  await logMessage({ workspaceId: input.workspaceId, conversationId, role: "user", content: input.text });

  const cls = classify(input.text);
  let result: Omit<DialogResult, "conversationId" | "latencyMs" | "mock">;

  if (cls.intent === "biz_query") {
    const tool = cls.tool!;
    const answers: Record<BizToolName, string> = {
      query_order: "为您查询到以下订单：",
      query_member: "为您查询到会员信息：",
      query_catalog: "为您查询到服务目录（退换/保修/安装）：",
      query_ticket: "为您查询到工单进度：",
    };
    result = { intent: "biz_query", answer: answers[tool], confidence: 0.95, citations: [], toolCall: { tool, params: {} } };
  } else if (cls.intent === "complaint") {
    result = {
      intent: "complaint",
      answer: "非常抱歉给您带来不愉快的购物体验。我可以立即为您生成投诉工单，客服团队将优先跟进。请确认是否提交？",
      confidence: 0.9,
      citations: [],
      ticketDraft: { kind: "complaint", title: input.text.slice(0, 40), payload: { text: input.text } },
    };
  } else if (cls.intent === "service_request") {
    const kind = ticketKindOf(input.text);
    result = {
      intent: "service_request",
      answer: "好的，我可以为您生成售后工单，相关团队会尽快处理。请确认是否提交？",
      confidence: 0.85,
      citations: [],
      ticketDraft: { kind, title: input.text.slice(0, 40), payload: { text: input.text } },
    };
  } else {
    // kb_qa：检索三档分流（H5）——score 已归一化 0..1
    const hits = await searchKB({ workspaceId: input.workspaceId, query: input.text, limit: 5 });
    const top = hits[0];
    const tier = tierOfScore(top?.score);
    if (tier === "low") {
      // 诚实拒答 + 工单草稿（不编造；L1 低置信留痕）
      result = {
        intent: "kb_qa",
        answer: LOW_REFUSAL,
        confidence: top?.score ?? 0,
        citations: [],
        ticketDraft: {
          kind: "other",
          title: `知识库未覆盖咨询：${input.text.slice(0, 30)}`,
          payload: { text: input.text, intent: "kb_qa", topScore: top?.score ?? null },
        },
      };
    } else if (top) {
      // top-2 合并：次命中与首命中共享非弱词 token 且自身 ≥0.45 时并入（跨块事实，如「退货运费谁承担」）
      const WEAK = new Set(["时间", "免费", "收费", "可以", "服务", "商品", "订单", "店铺", "买家", "客服", "售后", "东西", "地方", "怎么", "如何", "一下", "价格", "多少钱", "包邮", "工作", "一个", "一件", "一些"]);
      const norm = (t: string) => t.toLowerCase().replace(/(?<=[a-z0-9])-(?=[a-z0-9])/g, "");
      const topHay = norm(`${top.heading}\n${top.content}`);
      const topTokens = new Set(topHay.match(/[a-z0-9]+|[\u4e00-\u9fff]{2}/g) ?? []);
      const topDistinctive = new Set([...topTokens].filter((t) => !WEAK.has(t)));
      const second = hits[1];
      const mergeSecond = second && second.score >= CONFIDENCE_MEDIUM && (() => {
        const sHay = norm(`${second.heading}\n${second.content}`);
        const sTokens = (sHay.match(/[a-z0-9]+|[\u4e00-\u9fff]{2}/g) ?? []).filter((t) => !WEAK.has(t));
        return sTokens.some((t) => topDistinctive.has(t));
      })();
      const blocks = [top, ...(mergeSecond ? [second] : [])];
      let answer = blocks
        .map((h) => `${h.heading ? `【${h.heading}】` : ""}${h.content.replace(/^#\s.*$/m, "").trim().slice(0, 300)}`)
        .join("\n");
      if (llm) {
        try {
          answer = await llm(
            `你是电商买家客服。仅依据以下资料回答买家问题，不要编造资料之外的信息，回答控制在 80 字内。\n买家：${input.text}\n资料：${blocks.map((h) => h.content.slice(0, 400)).join("\n---\n")}`,
          );
        } catch (err) {
          console.warn("[service-c] kb_qa 组答 LLM 失败，使用确定性拼装答案：", err instanceof Error ? err.message : err);
        }
      }
      if (tier === "medium") answer = `${answer}\n${MEDIUM_HINT}`;
      result = { intent: "kb_qa", answer, confidence: Math.max(0, Math.min(1, top.score)), citations: citationsOf(hits) };
    } else {
      result = {
        intent: "kb_qa",
        answer: LOW_REFUSAL,
        confidence: 0,
        citations: [],
        ticketDraft: {
          kind: "other",
          title: `知识库未覆盖咨询：${input.text.slice(0, 30)}`,
          payload: { text: input.text, intent: "kb_qa", topScore: null },
        },
      };
    }
  }

  const latencyMs = Date.now() - t0;
  await logMessage({
    workspaceId: input.workspaceId, conversationId, role: "assistant",
    content: result.answer, intent: result.intent, confidence: result.confidence,
    citations: result.citations, latencyMs,
  });
  return { conversationId, ...result, latencyMs, mock };
}
