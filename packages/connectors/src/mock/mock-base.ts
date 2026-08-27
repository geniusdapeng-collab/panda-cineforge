/**
 * mock-base · Mock 连接器工厂
 * 所有平台共享一套确定性演示数据生成器（熊猫优选集团口径）：
 * 同一 (platformId, shopId) 输入永远返回同一批数据，禁止随机数，
 * 保证 demo / 测试可复现。write 方法一律走"回执"模式：回显入参为 raw 证据，
 * verified=true 表示 mock 侧已"核实"（生产适配器必须回读平台确认）。
 */
import type { PlatformConnector, Receipt } from "../interface.js";
import type {
  AdReportQuery,
  AdReportRow,
  Campaign,
  Conversation,
  InventoryItem,
  Listing,
  Money,
  OrderStatus,
  OrderSummary,
  PageQuery,
  PageResult,
  PlatformId,
  PlatformRegion,
  ShopRef,
  StatementDetail,
  StatementLine,
  StatementLineType,
  StatementSummary,
} from "../types.js";

/** 平台演示档案：registry 据此批量生成 mock 连接器 */
export interface PlatformProfile {
  platformId: PlatformId;
  region: PlatformRegion;
  /** 默认演示店铺 */
  demoShop: Omit<ShopRef, "platformId">;
  /** 平台简称，用于拼接单据号前缀，如 TM/JD/AMZ */
  code: string;
}

/** 稳定字符串散列（FNV-1a 32bit），只用于确定性伪随机下标 */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** noUncheckedIndexedAccess 下安全取模取元素 */
function pick<T>(arr: readonly T[], i: number): T {
  const v = arr[((i % arr.length) + arr.length) % arr.length];
  if (v === undefined) throw new Error("pick: 空数组");
  return v;
}

const BUYERS = ["panda***01", "bamboo***7", "momo***88", "ke***ke", "tuan***zi"] as const;
const ORDER_STATUSES: readonly OrderStatus[] = ["paid", "shipped", "completed", "pending-payment", "refunding"];
const SKU_POOL = ["PD-BAMBOO-FIBER-01", "PD-THERMAL-CUP-02", "PD-PANDA-PLUSH-03", "PD-TEA-GIFT-04"] as const;
const LINE_TYPES: readonly StatementLineType[] = ["order", "commission", "ad-deduction", "logistics", "refund"];

function money(amount: number, currency: string): Money {
  return { amount: Math.round(amount * 100) / 100, currency };
}

function paginate<T>(items: T[], query: PageQuery): PageResult<T> {
  const size = query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
  const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  const slice = items.slice(offset, offset + size);
  const next = offset + size;
  return { items: slice, total: items.length, ...(next < items.length ? { nextCursor: String(next) } : {}) };
}

function baseShop(profile: PlatformProfile, shop: ShopRef): ShopRef {
  return { ...profile.demoShop, ...shop, platformId: profile.platformId };
}

/** 回执构造：write 方法统一入口 */
function receipt<T>(profile: PlatformProfile, op: string, data: T, raw: unknown): Receipt<T> {
  return {
    data,
    verified: true,
    raw,
    receiptId: `RCP-${profile.code}-${op}-${hash(`${profile.platformId}:${op}:${JSON.stringify(data)}`).toString(36)}`,
    at: "2026-08-27T10:00:00+08:00",
  };
}

export function createMockConnector(profile: PlatformProfile): PlatformConnector {
  const seed = hash(`${profile.platformId}:${profile.demoShop.shopId}`);
  const cur = profile.demoShop.currency;
  const prefix = profile.code;

  const orders: OrderSummary[] = Array.from({ length: 12 }, (_, i) => ({
    orderId: `${prefix}-O-${String(88001 + i)}`,
    buyerNick: pick(BUYERS, seed + i),
    amount: money(99 + ((seed + i * 37) % 900), cur),
    status: pick(ORDER_STATUSES, seed + i),
    itemCount: 1 + ((seed + i) % 3),
    createdAt: `2026-08-${String(15 + (i % 12)).padStart(2, "0")}T0${i % 9}:30:00+08:00`,
  }));

  const listings: Listing[] = SKU_POOL.map((sku, i) => ({
    listingId: `${prefix}-L-${String(6601 + i)}`,
    sku,
    title: `熊猫优选 ${sku.split("-").slice(1, -1).join(" ")} 款`,
    price: money(59 + ((seed + i * 53) % 400), cur),
    stock: 50 + ((seed + i * 11) % 200),
    status: i === SKU_POOL.length - 1 ? "off-shelf" : "on-sale",
  }));

  const campaigns: Campaign[] = Array.from({ length: 4 }, (_, i) => ({
    campaignId: `${prefix}-C-${String(301 + i)}`,
    name: `熊猫优选-${["品牌词", "爆款拉新", "换季清仓", "会员召回"][i] ?? "通用"}计划`,
    status: i === 3 ? "paused" : "running",
    dailyBudget: money(500 + i * 300, cur),
    spendToday: money(120 + ((seed + i * 17) % 300), cur),
  }));

  const inventory: InventoryItem[] = SKU_POOL.map((sku, i) => ({
    sku,
    warehouseId: `WH-${profile.region === "domestic" ? "CD" : "LA"}-0${1 + (i % 2)}`,
    warehouseName: profile.region === "domestic" ? `成都${i % 2 === 0 ? "一" : "二"}号仓` : `洛杉矶${i % 2 === 0 ? "一" : "二"}号仓`,
    available: 80 + ((seed + i * 13) % 300),
    locked: (seed + i * 7) % 20,
    inTransit: (seed + i * 5) % 40,
  }));

  const statements: StatementSummary[] = ["2026-08", "2026-07", "2026-06"].map((period, i) => {
    const gross = 120000 + ((seed + i * 997) % 60000);
    return {
      statementId: `${prefix}-S-${period.replace("-", "")}`,
      period,
      grossAmount: money(gross, cur),
      netAmount: money(gross * 0.86, cur),
      status: i === 0 ? "settling" : "settled",
    };
  });

  const conversations: Conversation[] = Array.from({ length: 6 }, (_, i) => ({
    conversationId: `${prefix}-M-${String(501 + i)}`,
    buyerNick: pick(BUYERS, seed + i * 3),
    lastMessage: pick(
      ["请问今天能发货吗？", "有优惠券吗？", "尺码怎么选？", "申请退款怎么操作？", "包装可以送礼吗？", "物流到哪里了？"],
      seed + i,
    ),
    lastAt: `2026-08-27T0${i}:1${i}:00+08:00`,
    unread: (seed + i) % 3,
  }));

  const connector: PlatformConnector = {
    platformId: profile.platformId,

    // ---------- orders ----------
    async listOrders(shop, query) {
      const s = baseShop(profile, shop);
      return receipt(profile, "listOrders", paginate(orders, query), { shop: s, mock: true });
    },
    async updateOrderNote(shop, orderId, note) {
      const s = baseShop(profile, shop);
      return receipt(profile, "updateOrderNote", { orderId }, { shop: s, orderId, note, mock: true });
    },

    // ---------- listings ----------
    async getListing(shop, listingId) {
      const s = baseShop(profile, shop);
      const found = listings.find((x) => x.listingId === listingId) ?? pick(listings, seed);
      return receipt(profile, "getListing", found, { shop: s, listingId, mock: true });
    },
    async updatePrice(shop, listingId, price) {
      const s = baseShop(profile, shop);
      const found = listings.find((x) => x.listingId === listingId) ?? pick(listings, seed);
      const updated: Listing = { ...found, price: price.price };
      return receipt(profile, "updatePrice", updated, { shop: s, listingId, price, mock: true });
    },
    async updateStock(shop, listingId, stock) {
      const s = baseShop(profile, shop);
      const found = listings.find((x) => x.listingId === listingId) ?? pick(listings, seed);
      const next = stock.mode === "set" ? stock.quantity : found.stock + stock.quantity;
      const updated: Listing = { ...found, stock: next };
      return receipt(profile, "updateStock", updated, { shop: s, listingId, stock, mock: true });
    },
    async publishListing(shop, draft) {
      const s = baseShop(profile, shop);
      const published: Listing = {
        listingId: `${prefix}-L-${String(7000 + (hash(draft.sku) % 900))}`,
        sku: draft.sku,
        title: draft.title,
        price: draft.price,
        stock: draft.stock,
        status: "on-sale",
      };
      return receipt(profile, "publishListing", published, { shop: s, draft, mock: true });
    },

    // ---------- ads ----------
    async listCampaigns(shop, query) {
      const s = baseShop(profile, shop);
      return receipt(profile, "listCampaigns", paginate(campaigns, query), { shop: s, mock: true });
    },
    async getAdReport(shop, query: AdReportQuery) {
      const s = baseShop(profile, shop);
      const rows: AdReportRow[] = campaigns
        .filter((c) => !query.campaignId || c.campaignId === query.campaignId)
        .map((c, i) => {
          const spend = 100 + ((seed + i * 29) % 400);
          const gmv = spend * (2 + ((seed + i) % 40) / 10);
          return {
            date: query.startDate,
            campaignId: c.campaignId,
            impressions: 8000 + ((seed + i * 131) % 20000),
            clicks: 300 + ((seed + i * 47) % 900),
            spend: money(spend, cur),
            gmv: money(gmv, cur),
            roi: Math.round((gmv / spend) * 100) / 100,
          };
        });
      return receipt(profile, "getAdReport", paginate(rows, query), { shop: s, query, mock: true });
    },
    async adjustBudget(shop, campaignId, budget) {
      const s = baseShop(profile, shop);
      const found = campaigns.find((x) => x.campaignId === campaignId) ?? pick(campaigns, seed);
      const updated: Campaign = { ...found, dailyBudget: budget.dailyBudget };
      return receipt(profile, "adjustBudget", updated, { shop: s, campaignId, budget, mock: true });
    },
    async adjustBid(shop, targetId, bid) {
      const s = baseShop(profile, shop);
      return receipt(profile, "adjustBid", { targetId }, { shop: s, targetId, bid, mock: true });
    },

    // ---------- warehouse ----------
    async getInventory(shop, sku) {
      const s = baseShop(profile, shop);
      const rows = sku ? inventory.filter((x) => x.sku === sku) : inventory;
      return receipt(profile, "getInventory", paginate(rows, {}), { shop: s, sku, mock: true });
    },
    async createTransfer(shop, input) {
      const s = baseShop(profile, shop);
      const order = { ...input, transferId: `${prefix}-T-${String(9001 + (hash(input.sku) % 900))}`, status: "created" as const };
      return receipt(profile, "createTransfer", order, { shop: s, input, mock: true });
    },

    // ---------- settlement ----------
    async listStatements(shop, query) {
      const s = baseShop(profile, shop);
      return receipt(profile, "listStatements", paginate(statements, query), { shop: s, mock: true });
    },
    async getStatementDetail(shop, statementId) {
      const s = baseShop(profile, shop);
      const found = statements.find((x) => x.statementId === statementId) ?? pick(statements, seed);
      const lines: StatementLine[] = Array.from({ length: 5 }, (_, i) => ({
        lineId: `${statementId}-LN-${i + 1}`,
        type: pick(LINE_TYPES, seed + i),
        refId: `${prefix}-O-${String(88001 + i)}`,
        amount: money(((seed + i * 61) % 2000) - 500, cur),
      }));
      const detail: StatementDetail = { ...found, lines };
      return receipt(profile, "getStatementDetail", detail, { shop: s, statementId, mock: true });
    },

    // ---------- messages ----------
    async listConversations(shop, query) {
      const s = baseShop(profile, shop);
      return receipt(profile, "listConversations", paginate(conversations, query), { shop: s, mock: true });
    },
    async sendMessage(shop, conversationId, message) {
      const s = baseShop(profile, shop);
      const data = { messageId: `${prefix}-MSG-${hash(conversationId + message.text).toString(36)}` };
      return receipt(profile, "sendMessage", data, { shop: s, conversationId, message, mock: true });
    },
    async sendMultimodalMessage(shop, conversationId, message) {
      const s = baseShop(profile, shop);
      const data = { messageId: `${prefix}-MSG-MM-${hash(conversationId + message.text).toString(36)}` };
      return receipt(profile, "sendMultimodalMessage", data, { shop: s, conversationId, message, mock: true });
    },
  };

  return connector;
}
