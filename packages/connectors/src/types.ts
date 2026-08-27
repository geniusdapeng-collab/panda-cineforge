/**
 * @workloom/connectors · 核心类型
 * 平台枚举 / 店铺引用 / 分页 / 六族领域 DTO。
 * 说明：任务口径为"13 平台"，但平台清单实列 14 个（国内 8 + 跨境 6），
 * 此处以清单为准全部纳入联合类型，缺哪个平台由 registry 运行时把关。
 */

/** 国内平台 */
export const DOMESTIC_PLATFORM_IDS = [
  "tmall", // 天猫
  "jd", // 京东
  "pdd", // 拼多多
  "douyin", // 抖音
  "kuaishou", // 快手
  "xiaohongshu", // 小红书
  "wechat-channels", // 视频号
  "tmall-global", // 天猫国际
] as const;

/** 跨境平台 */
export const CROSSBORDER_PLATFORM_IDS = [
  "amazon", // 亚马逊
  "temu", // Temu
  "tiktok-shop", // TikTok Shop
  "shopee", // Shopee
  "aliexpress", // 速卖通
  "shopify", // Shopify 独立站
] as const;

export const PLATFORM_IDS = [...DOMESTIC_PLATFORM_IDS, ...CROSSBORDER_PLATFORM_IDS] as const;

/** 13+1 平台联合类型（清单 14 个，见文件头说明） */
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type PlatformRegion = "domestic" | "crossborder";

/**
 * 执行面级别（落地策略详见 README）：
 * L1 只读采集 · L2 官方 API 读写 · L3 确定性适配器 ·
 * L4 AI 浏览器剧本（需审批）· L5 高危写（强审批 + 双人复核）
 */
export type ExecLevel = "L1" | "L2" | "L3" | "L4" | "L5";

/** 店铺引用：一次连接调用的最小定位单元 */
export interface ShopRef {
  platformId: PlatformId;
  shopId: string;
  /** 展示名（如"熊猫优选旗舰店"），仅用于日志/回执快照 */
  shopName?: string;
  /** IANA 时区，如 Asia/Shanghai、America/Los_Angeles */
  timezone: string;
  /** ISO 4217 币种，如 CNY / USD */
  currency: string;
}

/** 分页请求：游标制（平台 API 多为 cursor/nextToken，避免页码漂移） */
export interface PageQuery {
  cursor?: string;
  pageSize?: number;
}

/** 分页结果 */
export interface PageResult<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

// ---------- 金额与通用 ----------

export interface Money {
  /** 最小货币单位（分/cent）之外的十进制值，币种由 currency 标注 */
  amount: number;
  currency: string;
}

// ---------- orders ----------

export type OrderStatus =
  | "pending-payment"
  | "paid"
  | "shipped"
  | "completed"
  | "refunding"
  | "closed";

export interface OrderSummary {
  orderId: string;
  buyerNick: string;
  amount: Money;
  status: OrderStatus;
  itemCount: number;
  createdAt: string; // ISO 8601
}

export interface OrderNoteUpdate {
  note: string;
  /** 平台侧旗帜/标色（天猫/京东支持），不支持的平台忽略 */
  flag?: "none" | "red" | "yellow" | "green" | "blue" | "purple";
}

// ---------- listings ----------

export type ListingStatus = "on-sale" | "off-shelf" | "draft";

export interface Listing {
  listingId: string;
  sku: string;
  title: string;
  price: Money;
  stock: number;
  status: ListingStatus;
}

export interface PriceUpdate {
  price: Money;
  reason?: string;
}

export interface StockUpdate {
  quantity: number;
  mode: "set" | "delta";
  reason?: string;
}

export interface ListingDraft {
  sku: string;
  title: string;
  price: Money;
  stock: number;
  imageUris: string[];
}

// ---------- ads ----------

export type CampaignStatus = "running" | "paused" | "ended";

export interface Campaign {
  campaignId: string;
  name: string;
  status: CampaignStatus;
  dailyBudget: Money;
  spendToday: Money;
}

export interface AdReportQuery extends PageQuery {
  campaignId?: string;
  /** YYYY-MM-DD，闭区间 */
  startDate: string;
  endDate: string;
  granularity?: "day" | "hour";
}

export interface AdReportRow {
  date: string;
  campaignId: string;
  impressions: number;
  clicks: number;
  spend: Money;
  gmv: Money;
  /** gmv / spend，平台未回传时为 0 */
  roi: number;
}

export interface BudgetAdjust {
  dailyBudget: Money;
  reason?: string;
}

export interface BidAdjust {
  bid: Money;
  reason?: string;
}

// ---------- warehouse ----------

export interface InventoryItem {
  sku: string;
  warehouseId: string;
  warehouseName: string;
  available: number;
  locked: number;
  inTransit: number;
}

export interface TransferInput {
  sku: string;
  quantity: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  reason?: string;
}

export interface TransferOrder extends TransferInput {
  transferId: string;
  status: "created" | "in-transit" | "received";
}

// ---------- settlement ----------

export type StatementStatus = "settling" | "settled";

export interface StatementSummary {
  statementId: string;
  /** 账期，如 2026-08 */
  period: string;
  grossAmount: Money;
  netAmount: Money;
  status: StatementStatus;
}

export type StatementLineType = "order" | "refund" | "commission" | "ad-deduction" | "logistics";

export interface StatementLine {
  lineId: string;
  type: StatementLineType;
  /** 关联单据号（订单号/退款单号等） */
  refId: string;
  amount: Money;
}

export interface StatementDetail extends StatementSummary {
  lines: StatementLine[];
}

// ---------- messages ----------

export interface Conversation {
  conversationId: string;
  buyerNick: string;
  lastMessage: string;
  lastAt: string; // ISO 8601
  unread: number;
}

export interface MessageInput {
  text: string;
}

export interface Attachment {
  kind: "image" | "video" | "file";
  uri: string;
  name?: string;
}

export interface MultimodalMessageInput extends MessageInput {
  attachments: Attachment[];
}
