/** 内置演示数据：API 不可达时优雅降级使用（UI 会标注「演示数据」）。品牌文案一律读配置，无硬编码。 */
import { getConfig } from "./config";
import type { MemberInfo, NotificationItem, Order, TimelineItem, Ticket } from "./types";

export const DEMO_FLAG = "演示数据";

export function getDemoOrders(): Order[] {
  return [
    {
      id: "OD-20260824-7781",
      title: "65W 氮化镓快充头",
      status: "待发货",
      thumb: "充",
      spec: "珍珠白 / 2C1A 三口",
      quantity: 1,
      logistics: "已触发催单，仓库承诺今日 16:00 前出库",
      amount: 129,
    },
    {
      id: "OD-20260818-3356",
      title: "折叠收纳箱 55L",
      status: "运输中",
      thumb: "纳",
      spec: "奶咖色 / 2 件装",
      quantity: 2,
      logistics: "顺丰 SF3120876543 · 已到达杭州转运中心",
      amount: 158,
    },
    {
      id: "OD-20260802-1190",
      title: "原木置物架三层",
      status: "已签收",
      thumb: "架",
      spec: "原木色 / 60×30×90cm",
      quantity: 1,
      logistics: "顺丰 SF3098112233 · 08-04 已签收",
      amount: 199,
    },
  ];
}

export function getDemoMember(): MemberInfo {
  return {
    level: "金卡会员",
    points: 2680,
    coupons: 3,
    benefits: ["会员 97 折", "生日月双倍积分", "每 100 积分抵 1 元", "专属客服优先接入", "常购：数码配件 · 家居收纳"],
    demo: true,
  };
}

export const demoTickets: Ticket[] = [
  {
    id: "TK-20260825-101",
    kind: "repair",
    title: "退换申请：收纳箱换 80L 加大号",
    status: "处理中",
    createdAt: "2026-08-25T10:42:00.000Z",
    slaDueAt: "2026-08-25T14:42:00.000Z",
  },
  {
    id: "TK-20260821-087",
    kind: "other",
    title: "价保申请：快充头 7 天内降价 ¥10",
    status: "已完成",
    createdAt: "2026-08-21T14:05:00.000Z",
  },
  {
    id: "TK-20260820-066",
    kind: "complaint",
    title: "投诉：物流超时 5 天未更新",
    status: "已受理",
    createdAt: "2026-08-20T09:18:00.000Z",
  },
];

export function demoTimeline(ticketId: string): TimelineItem[] {
  const base = Date.now() - 1000 * 60 * 42;
  return [
    {
      action: "created",
      actorType: "guest",
      actorId: "me",
      detail: "售后单已提交，AI 买家服务前台已受理",
      createdAt: new Date(base).toISOString(),
    },
    {
      action: "assigned",
      actorType: "agent",
      actorId: "AI-ServiceDesk",
      detail: "已智能分派至售后组（演示流转）",
      createdAt: new Date(base + 1000 * 60 * 5).toISOString(),
    },
    {
      action: "progress",
      actorType: "staff",
      actorId: "售后专员-阿May",
      detail: `工单 ${ticketId} 处理中，换货商品已安排质检`,
      createdAt: new Date(base + 1000 * 60 * 18).toISOString(),
    },
  ];
}

export function getDemoNotifications(): NotificationItem[] {
  return [
    {
      kind: "ticket.accepted",
      payload: { ticketId: "TK-20260825-101", title: "退换申请：收纳箱换 80L 加大号" },
      createdAt: "2026-08-25T10:42:10.000Z",
      read: false,
    },
    {
      kind: "ticket.completed",
      payload: { ticketId: "TK-20260821-087", title: "价保申请：快充头 7 天内降价 ¥10" },
      createdAt: "2026-08-21T15:30:00.000Z",
      read: true,
    },
    {
      kind: "member.benefit",
      payload: { title: "优惠券到账", detail: "您有 1 张满 99 减 20 券已到账，3 天后过期" },
      createdAt: "2026-08-20T08:00:00.000Z",
      read: true,
    },
  ];
}

/** 关键词匹配的演示应答（用于 /c/chat 降级） */
export function demoChatAnswer(text: string): {
  intent: string;
  answer: string;
  confidence: number;
  citations: { documentTitle: string; heading: string; content: string }[];
  cards?: { kind: "order" | "member" | "catalog"; data: Record<string, unknown> }[];
} {
  const brand = getConfig().brandName;
  const t = text.toLowerCase();
  if (/订单|发货|物流|快递|到哪/.test(text)) {
    return {
      intent: "order.query",
      answer:
        "为您查到 3 笔订单：快充头待发货（已催单，今日 16:00 前出库）、收纳箱运输中（已到杭州转运中心）、置物架已签收。需要催单或改地址请告诉我。",
      confidence: 0.92,
      citations: [
        {
          documentTitle: "买家常见问答·物流查询",
          heading: "下单两天了为什么还没发货？",
          content: "可发订单截图给客服，AI 截图识别会自动关联订单核查：现货订单超 48 小时未发货将触发催单并优先出库。",
        },
      ],
      cards: [{ kind: "order", data: getDemoOrders()[0] as unknown as Record<string, unknown> }],
    };
  }
  if (/会员|积分|优惠券|权益/.test(text)) {
    return {
      intent: "member.info",
      answer: "您当前是金卡会员，积分 2680（可抵 ¥26.8），另有 3 张优惠券可用。金卡享 97 折与生日月双倍积分，详情见下方会员卡。",
      confidence: 0.95,
      citations: [
        {
          documentTitle: "买家常见问答·账号与会员",
          heading: "会员积分怎么算？",
          content: "实付 1 元=1 积分，100 积分抵 1 元；评价晒单 +20 分，生日月双倍积分。",
        },
      ],
      cards: [{ kind: "member", data: getDemoMember() as unknown as Record<string, unknown> }],
    };
  }
  if (/退|换货|价保|发票|保修/.test(text) || /refund|return/.test(t)) {
    return {
      intent: "faq",
      answer:
        "国内店支持 7 天无理由退货（跨境店 30 天），运费险覆盖首重；价保期内买贵可一键补差；电子发票在「我的订单-申请开票」自助办理，1-3 个工作日开出。",
      confidence: 0.88,
      citations: [
        {
          documentTitle: "买家常见问答·退换退款",
          heading: "支持几天无理由退货？",
          content: "国内店 7 天无理由（跨境店 30 天），商品完好不影响二次销售即可。",
        },
      ],
    };
  }
  return {
    intent: "fallback",
    answer: `这个问题我还在学习中，已为您转专人处理，稍后会有客服专员与您联系。您也可以直接发截图、图片或视频给${brand}AI 客服识别问题。`,
    confidence: 0.42,
    citations: [],
  };
}
