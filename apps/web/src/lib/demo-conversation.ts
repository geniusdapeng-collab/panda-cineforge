/**
 * demo-conversation.ts · AskRail 演示会话剧本（DEMO-SCRIPT）
 *
 * 目的：全场景运行态——对话框不是空样板间。首开 AskRail 即呈现一段
 * 「卖家 ↔ AI 助手」的真实感经营对话（问询/审批/派单/复盘四幕），
 * 台词数字与种子数据集（熊猫优选集团 30 天经营态）严格同源，不得编造。
 *
 * 纪律：
 *  - 按工作区出剧本（panda-group=熊猫优选集团）；
 *  - 真实用户发消息后剧本不再占位（msgs 非空时以真实会话为准）；
 *  - receipt 标记 unverified（剧本非执行留痕，口径与模拟态横幅一致）。
 */

export interface DemoRailMsg {
  role: "human" | "agent";
  text: string;
  action?: string;
  linkTo?: string;
}

const ECOM_SCRIPT: DemoRailMsg[] = [
  { role: "human", text: "早上好，昨夜经营情况怎么样？" },
  {
    role: "agent", action: "经营简报",
    text: "【今日经营简报】昨日全集团 GMV ¥3,070万（14 店铺 / 13 平台），订单 9.8 万单；13 平台对账三方比对完成，差异率 0.28%（红线 0.3% 内）；差评 SLA 100%（2h 内处置）；夜班客服应答 1.6 万条、8 语种零排队。",
  },
  { role: "human", text: "有什么需要我拍板的？" },
  {
    role: "agent", action: "审批清单",
    text: "2 件 L4 决策等你拍板：① 亚马逊 ACoS 连续 3 天爆表（0.38 > 盈亏平衡 0.28），利润保险丝拟熔断降预算 30%（$1,500→$1,050/日）② 爆款 SKU-3C-1001 可售仅 5.2 天，紧急采购 3 万件请示（¥86万，供应商东莞锂威）。在经营主页或董事长视图可逐条批。",
    linkTo: "/p21",
  },
  { role: "human", text: "黑五备货进度帮我盯一下" },
  {
    role: "agent", action: "任务立项",
    text: "已立项「黑五跨时区作战」：需求预测师重算 7 个海外仓备货量 → 头程物流官锁定美西海运舱位 → 夜班班组（22:00-08:00 欧美日间）全程盯盘 → 异常随时上报。",
    linkTo: "/p1",
  },
  { role: "human", text: "这周评价怎么样？" },
  {
    role: "agent", action: "内容复盘",
    text: "评价周报：全平台评分 4.7（+0.1），1.2 万条新评价。「磁吸稳固」「物流快」热度上升；抖音直播间色差差评 2 小时内处置并公开回复，好评挖矿已反哺 3 条短视频选题。",
  },
];

/** 按工作区取剧本（缺省熊猫优选集团版） */
export function demoRailMessages(_wsName: string): DemoRailMsg[] {
  return ECOM_SCRIPT;
}
