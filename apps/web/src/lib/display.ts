/**
 * 展示字典层（B 端界面统一口径）——系统枚举 / 动作码 / 技术 ID / cron → 中文展示名。
 *
 * 根因修复（高保真走查：界面裸奔英文字段名与代码）：
 * 页面组件不得直接渲染系统原始值（status/kind/action/cron/技术 ID），
 * 一律经本层映射；未收录的值走兜底人性化处理，保证任何情况下不出现
 * 「processing / render.submit / 0 8 * * *」这类原始串直接上屏。
 *
 * 扩展纪律：新域（新工单类型/新动作码）落地时同步登记本表；行业版在
 * ACTION_TEXT_EXT 追加行业动作码即可，无需改组件。
 */

// —— 工单域 ——
export const TICKET_STATUS_TEXT: Record<string, string> = {
  created: "已受理",
  assigned: "已分派",
  processing: "处理中",
  done: "已完成",
  closed: "已关闭",
};

export const TICKET_KIND_TEXT: Record<string, string> = {
  delivery: "物流查询",
  repair: "退换售后",
  complaint: "投诉建议",
  other: "其他需求",
  service_request: "服务请求",
};

export const TICKET_PRIORITY_TEXT: Record<string, string> = {
  normal: "普通",
  high: "加急",
  urgent: "紧急",
};

export const TICKET_ACTOR_TEXT: Record<string, string> = {
  c_user: "买家",
  staff: "员工",
  agent: "AI 员工",
  system: "系统",
};

// —— 知识库域 ——
export const DOC_STATUS_TEXT: Record<string, string> = {
  active: "生效中",
  disabled: "已停用",
  pending_review: "待审核",
};

export const SOURCE_KIND_TEXT: Record<string, string> = {
  upload: "文档上传",
  official_site: "官网抓取",
  manual: "手工录入",
};

// —— 审批域 ——
export const APPROVAL_STATUS_TEXT: Record<string, string> = {
  pending: "待审批",
  approved: "已批准",
  rejected: "已驳回",
  edited: "已改派",
  escalated: "已升级",
};

// —— 对话意图 ——
export const INTENT_TEXT: Record<string, string> = {
  chat: "闲聊",
  kb_qa: "知识问答",
  biz_query: "业务查询",
  service_request: "服务请求",
  complaint: "投诉",
};

// —— 围栏级别 ——
export const FENCE_LEVEL_TEXT: Record<string, string> = {
  auto: "自动放行",
  review: "人工复核",
  block: "硬阻断",
};

// —— 通用状态 ——
export const COMMON_STATUS_TEXT: Record<string, string> = {
  active: "运行中",
  paused: "已暂停",
  open: "进行中",
  running: "进行中",
  completed: "已完成",
  failed: "已失败",
  draft: "草稿",
  submitted: "已提交",
  scheduled: "已排期",
  published: "已发布",
  archived: "已归档",
  delivered: "已送达",
  sent: "已发送",
  replied: "已回复",
  blocked: "已隔离",
  pending: "待处理",
  pending_review: "待审查",
  pending_approval: "待审批",
  expired: "已过期",
  rolled_back: "已回滚",
  ready: "就绪",
};

// —— 线程模式 ——
export const THREAD_MODE_TEXT: Record<string, string> = {
  quest: "主线任务",
  ask: "问询",
  agent: "委托执行",
};

/** 动作码 → 中文（底座通用域） */
export const ACTION_TEXT: Record<string, string> = {
  // 经营动作
  "price.adjust": "调整售价",
  "price.query": "查询售价",
  "comment.reply": "回复评论",
  "memory.upsert": "更新组织记忆",
  // 夜班
  "night.note": "夜班记录",
  "night.package": "生成夜班日报",
  "night.handoff": "夜班交接",
  "trigger.fired": "触发定时任务",
  // 服务前台
  "service.ticket.create": "创建工单",
  "service.ticket.assign": "分派工单",
  "service.ticket.advance": "推进工单",
  "service.ticket.complete": "办结工单",
  "service.ticket.escalate": "工单超时升级",
  "service.ticket.rate": "工单满意度评价",
  "service.chat": "服务前台对话",
  "kb.publish": "发布知识文档",
  "kb.collection": "新建知识集合",
  "kb.document": "知识文档入库",
  "kb.search": "检索知识库",
  "kb.crawl": "抓取官网建库",
  // CEO
  "ceo.briefing": "CEO 晨报",
  "captain.decision": "CEO 决策",
  "captain.grant": "签署授权宪章",
  "captain.transit": "宪章状态流转",
};

/** 行业扩展动作码（电商域 twin 事件动作码；行业版可在此追加，组件零改动） */
export const ACTION_TEXT_EXT: Record<string, string> = {
  // 订单与履约
  "order.create": "创建订单",
  "order.confirm": "确认订单",
  "order.reconcile": "订单对账",
  "order.refund": "订单退款",
  "settlement.reconcile": "多平台对账",
  "aftersale.refund": "售后退款",
  // 价格与刊登
  "price.publish": "发布价格",
  "price.parity.watch": "价格倒挂巡检",
  "pricing.fx.reprice.assess": "汇率重定价评估",
  "listing.publish": "刊登上架",
  "listing.image.block": "主图合规阻断",
  // 库存与仓储
  "inventory.sync": "同步库存",
  "inventory.sync.restore": "恢复库存上架",
  "stock.inbound": "采购入库",
  "stock.outbound": "出库履约",
  "stock.transfer": "仓间调拨",
  "stock.count": "循环盘点",
  "stock.stockout.alert": "断货预警",
  "fba.replenish": "FBA 补货",
  // 广告
  "ads.acos.alert": "ACoS 爆表告警",
  "ads.budget.fuse": "广告预算熔断",
  "ads.budget.raise": "广告预算上调",
  // 客服与评价
  "cs.reply": "客服应答",
  "cs.escalate": "客服升级转人工",
  "review.detect": "差评侦测",
  "review.reply": "回复评价",
  "review.asset.boost": "好评资产化",
  // 风控与合规
  "hijack.alert": "跟卖突袭告警",
  "hijack.evidence.file": "跟卖证据固化",
  "fx.volatility.alert": "汇率波动告警",
  "procurement.urgent.request": "紧急采购请示",
  "alert.escalate": "告警升级",
  "incident.report": "断点上报",
  "incident.resolve": "断点处置",
  // 经营快照
  "store.daily.summary": "店铺日结快照",
  "content.publish": "内容发布",
  "competitor.fetch": "竞对采集",
};

const ACTION_PART_TEXT: Record<string, string> = {
  create: "创建",
  assign: "分派",
  advance: "推进",
  complete: "办结",
  escalate: "升级",
  submit: "提交",
  approve: "审批",
  publish: "发布",
  update: "更新",
  confirm: "确认",
  query: "查询",
  adjust: "调整",
  reply: "回复",
  fetch: "抓取",
  reconcile: "核销",
  consolidate: "整理",
  dispatch: "派发",
  send: "发送",
  boost: "加热",
  attribute: "归因",
  scan: "扫描",
  capture: "捕获",
  nurture: "培育",
  promote: "推广",
  report: "播报",
  snapshot: "快照",
  gesture: "手势",
  segment: "分群",
  draft: "起草",
  memo: "备忘",
  refund: "退款",
  deliver: "投递",
};

/** 动作码人性化：先查表，未收录则按「域·动作」末段翻译兜底，永不裸奔原始码 */
export function actionText(action: string): string {
  const hit = ACTION_TEXT[action] ?? ACTION_TEXT_EXT[action] ?? ACTION_OPS_TEXT[action];
  if (hit) return hit;
  const parts = action.split(".");
  const tail = parts[parts.length - 1] ?? action;
  return ACTION_PART_TEXT[tail] ?? tail.replace(/_/g, " ");
}

/** 枚举通用展示：给定字典与值，未收录时把下划线串转为空格分词（小字展示，不用英文全大写） */
export function dictText(dict: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return dict[value] ?? value.replace(/_/g, " ");
}

/** 技术 ID 友好化：tck-seed-001 → ···001；apr-e-9064 → ···9064；无可提取尾号则原样 */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  const m = id.match(/(\d+)$/);
  return m ? `···${m[1]}` : id;
}

/** cron → 中文读法（覆盖系统内全部实际用到的表达式；未知表达式兜底原样） */
export function cronText(expr: string): string {
  const known: Record<string, string> = {
    "*/30 * * * *": "每 30 分钟",
    "0 * * * *": "每小时整点",
    "0 */2 * * *": "每 2 小时",
    "0 */4 * * *": "每 4 小时",
    "0 3 * * *": "每天 03:00",
    "0 4 * * *": "每天 04:00",
    "0 8 * * *": "每天 08:00",
    "30 8 * * *": "每天 08:30",
    "0 18 * * *": "每天 18:00",
    "0 4 * * 0": "每周日 04:00",
  };
  if (known[expr]) return known[expr];
  // 通用解析：0 H * * * → 每天 HH:00；M H * * * → 每天 HH:MM
  const daily = expr.match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/);
  if (daily) return `每天 ${daily[2]!.padStart(2, "0")}:${daily[1]!.padStart(2, "0")}`;
  const hourly = expr.match(/^\*\/(\d+) \* \* \* \*$/);
  if (hourly) return `每 ${hourly[1]} 分钟`;
  return expr;
}

/** 置信度 → 中文档位 */
export function confidenceText(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 0.72) return "高置信";
  if (score >= 0.45) return "中置信";
  return "低置信";
}

/** 延迟毫秒 → 友好读法 */
export function latencyText(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// —— 行动者/员工代号 → 中文名（F-CN1：界面不出现 reconcile-agent/guest-success 这类原始 ID）——
/** preset_key / actor id → 中文名。成员编号（MEM-xxx）与事件编号（E-xxx）属代号，原样保留 */
export const ACTOR_TEXT: Record<string, string> = {
  // —— 集团指挥层（4）——
  "group-ceo": "集团数字CEO",
  "biz-analyst": "经营分析参谋",
  "budget-controller": "预算管控官",
  "digital-hr": "数字HR",
  // —— 共享中台（27）——
  "data-warehouse": "数据口径官",
  "sku-pl-accountant": "SKU损益核算师",
  "competitor-radar": "竞对雷达",
  "market-intel": "市场情报员",
  "selection-analyst": "选品算账师",
  "spu-master": "全球商品库官",
  "listing-factory": "刊登工厂长",
  "localization-editor": "本地化主编",
  "demand-planner": "需求预测师",
  "procurement-buyer": "采购执行员",
  "cn-warehouse": "国内仓网管家",
  "overseas-warehouse": "海外仓调拨官",
  "freight-forwarder": "头程物流官",
  "reverse-logistics": "逆向物流专员",
  "multi-reconciler": "多平台对账师",
  "fx-settler": "多币种结算师",
  "vat-specialist": "VAT税务师",
  "cash-forecaster": "资金沙盘师",
  "rule-sentinel": "平台规则哨兵",
  "ip-shield": "知识产权护盾",
  "account-guardian": "账号健康官",
  "creative-studio": "素材工场长",
  "brand-private": "品牌私域运营",
  "kb-trainer": "客服知识训练师",
  "service-qc": "客服质检官",
  "mm-engineer": "多模态理解工程师",
  "live-producer": "直播中控长",
  // —— 国内作战军（26）——
  "tmall-head": "天猫店长",
  "tmall-ops": "天猫活动运营",
  "tmall-ads": "天猫投手",
  "tmall-cs": "天猫客服",
  "jd-head": "京东店长",
  "jd-ops": "京东采销协同运营",
  "jd-cs": "京东客服",
  "pdd-head": "拼多多店长",
  "pdd-ops": "拼多多活动运营",
  "pdd-cs": "拼多多客服",
  "douyin-head": "抖音店长",
  "douyin-ads": "千川投手",
  "douyin-live": "抖音直播运营",
  "douyin-video": "抖音短视频编导",
  "douyin-cs": "抖音客服",
  "kuaishou-head": "快手店长",
  "kuaishou-ads": "磁力金牛投手",
  "kuaishou-cs": "快手客服",
  "xhs-head": "小红书店长",
  "xhs-content": "小红书笔记内容",
  "xhs-cs": "小红书客服",
  "channels-head": "视频号店长",
  "channels-cs": "视频号客服",
  "tmallg-head": "天猫国际店长",
  "tmallg-ops": "天猫国际进口跨境运营",
  "tmallg-cs": "天猫国际客服",
  // —— 跨境作战军（24）——
  "amz-us-head": "亚马逊美区店长",
  "amz-eu-head": "亚马逊欧洲店长",
  "amz-jp-head": "亚马逊日本店长",
  "amz-ppc": "亚马逊PPC投手",
  "amz-listing": "亚马逊Listing优化师",
  "amz-account": "亚马逊账号绩效专员",
  "amz-fba": "亚马逊FBA补货协同",
  "temu-head": "Temu半托管店长",
  "temu-pricing": "Temu核价运营",
  "tts-us-head": "TikTokShop美区店长",
  "tts-sea-head": "TikTokShop东南亚店长",
  "tts-creator": "TikTok达人建联",
  "tts-live": "TikTok直播运营",
  "shopee-head": "Shopee/Lazada店长",
  "shopee-cs": "Shopee/Lazada客服",
  "ae-head": "速卖通店长",
  "shein-supply": "SHEIN供货协同",
  "dtc-webmaster": "独立站站长",
  "dtc-seo": "独立站SEO/内容",
  "dtc-edm": "独立站EDM私域",
  "dtc-ads": "独立站投手",
  "cs-en": "英语客服组",
  "cs-eu": "欧洲语言组",
  "cs-apac": "亚太语言组",
  // —— 底座继承 ——
  "inspection-agent": "巡检 Agent",
  "desktop-agent": "桌面 Agent",
  captain: "编排官",
  system: "系统",
  "night-shift": "夜班中心",
};

/**
 * 行动者人性化：先查表；未收录的 xxx-agent 去后缀查词根；MEM-/E-/T- 等编号原样；
 * 其余下划线/连字符串转空格分词（永不裸奔原始 ID）
 */
export function actorText(id: string): string {
  if (!id) return "—";
  const hit = ACTOR_TEXT[id];
  if (hit) return hit;
  if (/^(MEM|E|T|VID|R|G)-/.test(id)) return id; // 编号类保留
  if (id.endsWith("-agent")) {
    const root = id.slice(0, -6);
    return `${ACTOR_TEXT[root] ?? root.replace(/[-_]/g, " ")} Agent`;
  }
  return id.replace(/[-_]/g, " ");
}

/** 夜班/运营高频动作码补录（F-CN1） */
export const ACTION_OPS_TEXT: Record<string, string> = {
  // 夜班/运营高频动作码（点式全量，F-CN1；与种子/套件动作码对齐）
  "approval.gesture": "审批手势",
  "ask.answer": "问询应答",
  "audience.segment": "客群分群",
  "booking.confirm": "订单确认",
  "campaign.publish": "活动发布",
  "campaign.schedule": "活动排期",
  "competitor.fetch": "竞对抓取",
  "content.publish": "内容发布",
  "conversion.attribute": "成交归因",
  "coupon.create": "创建券",
  "coupon.promote": "券推广",
  "funnel.weekly": "漏斗周报",
  "geo.publish": "GEO 发布",
  "guest.care.send": "买家关怀",
  "inspection.scan": "巡检扫描",
  "intent.radar.report": "意图雷达播报",
  "lead.assign": "线索分派",
  "lead.capture": "线索捕获",
  "lead.nurture": "线索培育",
  "live.campaign": "直播活动",
  "market.scan": "市场扫描",
  "member.referral": "会员转介绍",
  "memory.consolidate": "记忆整理",
  "night.package.deliver": "夜班日报投递",
  "night.run.start": "夜班开始",
  "order.reconcile": "对账核销",
  "order.refund": "订单退款",
  "render.review": "渲染审片",
  "review.asset.boost": "好评加热",
  "review.reply": "回复评价",
  "script.draft": "脚本起草",
  "strategy.memo": "策略备忘",
  "thread.dispatch": "任务派发",
  "visibility.snapshot": "曝光快照",
  // 裸词别名（历史数据兼容）
  reconcile: "对账核销",
  fetch: "竞对抓取",
  send: "发送",
  answer: "即时应答",
  dispatch: "任务派发",
  boost: "加热推广",
  weekly: "周报汇总",
  attribute: "成交归因",
  referral: "转介绍跟进",
  "morning-briefing": "晨报",
  consolidate: "记忆整理",
  deliver: "夜班投递",
  start: "开始",
  scan: "巡检扫描",
};

/** 行动载荷人性化：常见 JSON 键 → 中文键值对；非对象原样返回（F-CN1） */
const PAYLOAD_KEY_TEXT: Record<string, string> = {
  diff: "差异", rounds: "轮次", card: "竞对", price: "价格", sku: "SKU", count: "数量",
  note: "备注", gmv: "GMV", acos: "ACoS", margin_rate: "毛利率", qty: "数量", amount: "金额",
  warehouse: "仓库", days_cover: "可售天数", rating: "评分", score: "评分", status: "状态",
  intent: "意图", lang: "语种", currency: "币种",
};
export function payloadText(after: unknown, maxLen = 160): string {
  if (after == null) return "";
  if (typeof after !== "object") return String(after).slice(0, maxLen);
  const parts = Object.entries(after as Record<string, unknown>).map(([k, v]) => {
    const key = PAYLOAD_KEY_TEXT[k] ?? k;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `${key} ${val}`;
  });
  return parts.join(" · ").slice(0, maxLen);
}
