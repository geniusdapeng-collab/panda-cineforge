/**
 * @workloom/connectors · PlatformConnector 接口
 * 六族方法统一抽象 16 个电商平台的读写面（详见 types.ts 平台清单；叙事口径 13 平台 + 1 独立站）。
 * 每个方法标注 read/write 与执行面级别 L1-L5（落地策略见 README）；
 * 所有方法返回 Receipt<T>：含 verified 与 raw 证据快照，
 * 对齐底座纪律——无回执 = 未核实，未核实不得转完成（L3.6/E3.7）。
 */
import type {
  AdReportQuery,
  AdReportRow,
  BidAdjust,
  BudgetAdjust,
  Campaign,
  Conversation,
  InventoryItem,
  Listing,
  ListingDraft,
  MessageInput,
  MultimodalMessageInput,
  OrderNoteUpdate,
  OrderSummary,
  PageQuery,
  PageResult,
  PlatformId,
  PriceUpdate,
  ShopRef,
  StatementDetail,
  StatementSummary,
  StockUpdate,
  TransferInput,
  TransferOrder,
} from "./types.js";

/** 执行回执：data 之外必须带核实位与原始证据 */
export interface Receipt<T> {
  data: T;
  /** 外部系统是否已确认真实生效；false 时上游禁止转完成 */
  verified: boolean;
  /** 平台原始响应/证据快照（审计位，原样透传） */
  raw?: unknown;
  /** 回执编号，供事件链 links 引用 */
  receiptId: string;
  /** 回执生成时间（ISO 8601，含时区） */
  at: string;
}

export interface PlatformConnector {
  readonly platformId: PlatformId;

  // ---------- orders 订单族 ----------

  /** read · L1：只读采集，官方开放平台订单列表 */
  listOrders(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<OrderSummary>>>;

  /** write · L2：写卖家备注，低风险，官方 API 直写 + 回读核实 */
  updateOrderNote(shop: ShopRef, orderId: string, note: OrderNoteUpdate): Promise<Receipt<{ orderId: string }>>;

  // ---------- listings 商品族 ----------

  /** read · L1：单品详情只读 */
  getListing(shop: ShopRef, listingId: string): Promise<Receipt<Listing>>;

  /** write · L5：改价直接影响成交与毛利，高危写，需审批 + 回读核实 */
  updatePrice(shop: ShopRef, listingId: string, price: PriceUpdate): Promise<Receipt<Listing>>;

  /** write · L3：库存写，走确定性适配器（幂等键防超卖） */
  updateStock(shop: ShopRef, listingId: string, stock: StockUpdate): Promise<Receipt<Listing>>;

  /** write · L5：上架发布面向消费者可见，高危写，需审批 */
  publishListing(shop: ShopRef, draft: ListingDraft): Promise<Receipt<Listing>>;

  // ---------- ads 广告族 ----------

  /** read · L1：推广计划列表只读 */
  listCampaigns(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<Campaign>>>;

  /** read · L1：报表只读 */
  getAdReport(shop: ShopRef, query: AdReportQuery): Promise<Receipt<PageResult<AdReportRow>>>;

  /** write · L4：调预算影响现金流，默认 AI 浏览器剧本候补 + 审批 */
  adjustBudget(shop: ShopRef, campaignId: string, budget: BudgetAdjust): Promise<Receipt<Campaign>>;

  /** write · L4：调出价，同预算口径 */
  adjustBid(shop: ShopRef, targetId: string, bid: BidAdjust): Promise<Receipt<{ targetId: string }>>;

  // ---------- warehouse 仓储族 ----------

  /** read · L1：库存只读 */
  getInventory(shop: ShopRef, sku?: string): Promise<Receipt<PageResult<InventoryItem>>>;

  /** write · L3：创建调拨单，确定性适配器 + 幂等 */
  createTransfer(shop: ShopRef, input: TransferInput): Promise<Receipt<TransferOrder>>;

  // ---------- settlement 结算族（只读族） ----------

  /** read · L1：账单列表只读 */
  listStatements(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<StatementSummary>>>;

  /** read · L1：账单明细只读 */
  getStatementDetail(shop: ShopRef, statementId: string): Promise<Receipt<StatementDetail>>;

  // ---------- messages 消息族 ----------

  /** read · L1：会话列表只读 */
  listConversations(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<Conversation>>>;

  /** write · L2：纯文本客服消息，官方 API 直写 */
  sendMessage(shop: ShopRef, conversationId: string, message: MessageInput): Promise<Receipt<{ messageId: string }>>;

  /** write · L4：多模态消息（图/视频/文件），部分平台无官方 API，走浏览器剧本 + 审批 */
  sendMultimodalMessage(
    shop: ShopRef,
    conversationId: string,
    message: MultimodalMessageInput,
  ): Promise<Receipt<{ messageId: string }>>;
}
