/**
 * amazon/sp-api.ts —— 亚马逊 SP-API 只读连接器（P1：真实对接第一枪）
 *
 * 范围（v1 只读纪律：先只读、写入一律走围栏瀑布，本连接器不实现任何写方法）：
 *  - Orders：GET /orders/v0/orders（listOrders）
 *  - Finances：GET /finances/v0/financialEventGroups + /finances/v0/financialEventGroups/{id}/financialEvents
 *    （listStatements / getStatementDetail —— 真实回款与罚款的事实源，落 payouts/platform_penalties）
 *  - FBA Inventory：GET /fba/inventory/v1/summaries（getInventory）
 * 未实现方法一律抛 ConnectorUnsupportedError——显式失败，禁止静默回退（底座纪律）。
 *
 * 认证：LWA refresh_token → access_token（api.amazon.com/auth/o2/token）+ AWS SigV4 签名
 * （iam 角色或 user 凭据；签名实现为零依赖 node:crypto 版，可注入 fetch 便于测试与离线回放）。
 */
import { createHash, createHmac } from "node:crypto";
import type { PlatformConnector, Receipt } from "../interface.js";
import type {
  AdReportQuery, AdReportRow, BidAdjust, BudgetAdjust, Campaign, Conversation,
  InventoryItem, Listing, ListingDraft, MessageInput, MultimodalMessageInput,
  OrderNoteUpdate, OrderSummary, PageQuery, PageResult, PriceUpdate, ShopRef,
  StatementDetail, StatementSummary, StockUpdate, TransferInput, TransferOrder,
} from "../types.js";

/** 显式失败（未实现的写方法/未覆盖的族） */
export class ConnectorUnsupportedError extends Error {
  constructor(method: string) {
    super(`amazon-sp-api 连接器 v1 为只读口径：${method} 未实现（写动作一律走围栏瀑布 + 审批，不在连接器层直写）`);
    this.name = "ConnectorUnsupportedError";
  }
}

export interface SpApiCredentials {
  /** LWA */
  lwaClientId: string;
  lwaClientSecret: string;
  lwaRefreshToken: string;
  /** SigV4（IAM user 或 STS 临时凭据） */
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsSessionToken?: string;
  /** 区域端点：NA=na / EU=eu / FE=fe（sellingpartnerapi-{region}.amazon.com） */
  region: "na" | "eu" | "fe";
  /** 站点 marketplaceId（如 ATVPDKIKX0DER=美国站） */
  marketplaceId: string;
}

export interface SpApiDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  /** access_token 缓存时长（LWA 官方 3600s，默认提前 300s 续期） */
  tokenSkewSec?: number;
}

const HOSTS: Record<SpApiCredentials["region"], string> = {
  na: "sellingpartnerapi-na.amazon.com",
  eu: "sellingpartnerapi-eu.amazon.com",
  fe: "sellingpartnerapi-fe.amazon.com",
};
const AWS_REGIONS: Record<SpApiCredentials["region"], string> = { na: "us-east-1", eu: "eu-west-1", fe: "us-west-2" };

const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();

/** AWS SigV4 签名（SP-API 执行 IAM 模式必须；零依赖实现） */
export function signSigV4(opts: {
  method: string; host: string; path: string; query: string; payload: string;
  accessKeyId: string; secretAccessKey: string; sessionToken?: string;
  region: string; service: string; amzDate: string;
}): Record<string, string> {
  const dateStamp = opts.amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: opts.host,
    "x-amz-date": opts.amzDate,
    "x-amz-content-sha256": sha256Hex(opts.payload),
  };
  if (opts.sessionToken) headers["x-amz-security-token"] = opts.sessionToken;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = [
    opts.method, opts.path, opts.query, canonicalHeaders, signedHeaders, sha256Hex(opts.payload),
  ].join("\n");
  const scope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", opts.amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, opts.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

let receiptSeq = 0;
function receipt<T>(data: T, raw: unknown, verified: boolean): Receipt<T> {
  return {
    data, verified, raw,
    receiptId: `rcpt-amz-${Date.now()}-${++receiptSeq}`,
    at: new Date().toISOString(),
  };
}

/** SP-API 订单状态 → 统一订单状态 */
function mapOrderStatus(s: string): OrderSummary["status"] {
  switch (s) {
    case "Pending": return "pending-payment";
    case "Unshipped": case "PartiallyShipped": return "paid";
    case "Shipped": return "shipped";
    case "Delivered": case "InvoiceUnconfirmed": return "completed";
    case "Canceled": return "closed";
    default: return "paid";
  }
}

export class AmazonSpApiConnector implements PlatformConnector {
  readonly platformId = "amazon" as const;
  private tokenCache: { token: string; expiresAt: number } | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly tokenSkewSec: number;

  constructor(private readonly cred: SpApiCredentials, deps: SpApiDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? (() => new Date());
    this.tokenSkewSec = deps.tokenSkewSec ?? 300;
  }

  /** LWA access_token（带缓存与提前续期） */
  private async accessToken(): Promise<string> {
    const nowSec = this.now().getTime() / 1000;
    if (this.tokenCache && this.tokenCache.expiresAt - this.tokenSkewSec > nowSec) {
      return this.tokenCache.token;
    }
    const r = await this.fetchImpl("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.cred.lwaRefreshToken,
        client_id: this.cred.lwaClientId,
        client_secret: this.cred.lwaClientSecret,
      }).toString(),
    });
    if (!r.ok) throw new Error(`LWA 令牌刷新失败：HTTP ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { access_token: string; expires_in?: number };
    this.tokenCache = { token: j.access_token, expiresAt: nowSec + (j.expires_in ?? 3600) };
    return j.access_token;
  }

  /** SigV4 签名请求（GET/POST 统一入口；query 已编码字符串） */
  private async call<T>(method: string, path: string, query = "", payload = ""): Promise<T> {
    const token = await this.accessToken();
    const host = HOSTS[this.cred.region];
    const amzDate = this.now().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const signed = signSigV4({
      method, host, path, query, payload,
      accessKeyId: this.cred.awsAccessKeyId,
      secretAccessKey: this.cred.awsSecretAccessKey,
      sessionToken: this.cred.awsSessionToken,
      region: AWS_REGIONS[this.cred.region],
      service: "execute-api",
      amzDate,
    });
    const r = await this.fetchImpl(`https://${host}${path}${query ? `?${query}` : ""}`, {
      method,
      headers: {
        ...signed,
        "x-amz-access-token": token,
        "content-type": "application/json",
      },
      body: payload || undefined,
    });
    if (!r.ok) throw new Error(`SP-API ${method} ${path} 失败：HTTP ${r.status} ${await r.text()}`);
    return (await r.json()) as T;
  }

  // ---------- orders 订单族（read · L1） ----------
  async listOrders(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<OrderSummary>>> {
    const createdAfter = new Date(this.now().getTime() - 7 * 86_400_000).toISOString();
    const params = new URLSearchParams({
      MarketplaceIds: this.cred.marketplaceId,
      CreatedAfter: createdAfter,
      MaxResultsPerPage: String(query.pageSize ?? 50),
    });
    if (query.cursor) params.set("NextToken", query.cursor);
    const j = await this.call<{
      payload?: { Orders?: Array<{
        AmazonOrderId: string; BuyerInfo?: { BuyerName?: string };
        OrderTotal?: { Amount?: string; CurrencyCode?: string };
        OrderStatus: string; NumberOfItemsUnshipped?: number; NumberOfItemsShipped?: number;
        PurchaseDate: string;
      }>; NextToken?: string };
    }>("GET", "/orders/v0/orders", params.toString());
    const orders = j.payload?.Orders ?? [];
    return receipt({
      items: orders.map((o) => ({
        orderId: o.AmazonOrderId,
        buyerNick: o.BuyerInfo?.BuyerName ?? "amazon-buyer",
        amount: { amount: Number(o.OrderTotal?.Amount ?? 0), currency: o.OrderTotal?.CurrencyCode ?? shop.currency },
        status: mapOrderStatus(o.OrderStatus),
        itemCount: (o.NumberOfItemsUnshipped ?? 0) + (o.NumberOfItemsShipped ?? 0),
        createdAt: o.PurchaseDate,
      })),
      nextCursor: j.payload?.NextToken,
    }, j, true);
  }

  // ---------- settlement 结算族（read · L1；回款/罚款真实锚点） ----------
  async listStatements(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<StatementSummary>>> {
    const params = new URLSearchParams({ MaxResultsPerPage: String(query.pageSize ?? 20) });
    if (query.cursor) params.set("NextToken", query.cursor);
    const j = await this.call<{
      payload?: { FinancialEventGroupList?: Array<{
        FinancialEventGroupId: string; ProcessingStatus: string;
        OriginalTotal?: { CurrencyAmount?: number; CurrencyCode?: string };
        ConvertedTotal?: { CurrencyAmount?: number; CurrencyCode?: string };
        FundTransferStatus?: string;
        FinancialEventGroupStart?: string; FinancialEventGroupEnd?: string;
      }>; NextToken?: string };
    }>("GET", "/finances/v0/financialEventGroups", params.toString());
    const groups = j.payload?.FinancialEventGroupList ?? [];
    return receipt({
      items: groups.map((g) => ({
        statementId: g.FinancialEventGroupId,
        period: (g.FinancialEventGroupStart ?? "").slice(0, 7),
        grossAmount: { amount: g.OriginalTotal?.CurrencyAmount ?? 0, currency: g.OriginalTotal?.CurrencyCode ?? shop.currency },
        netAmount: { amount: g.ConvertedTotal?.CurrencyAmount ?? 0, currency: g.ConvertedTotal?.CurrencyCode ?? shop.currency },
        status: (g.ProcessingStatus === "Closed" ? "settled" : "settling") as StatementSummary["status"],
      })),
      nextCursor: j.payload?.NextToken,
    }, j, true);
  }

  async getStatementDetail(shop: ShopRef, statementId: string): Promise<Receipt<StatementDetail>> {
    const j = await this.call<{
      payload?: { FinancialEvents?: {
        ShipmentEventList?: Array<{ AmazonOrderId?: string; ShipmentItemList?: Array<{ ItemChargeList?: Array<{ ChargeType: string; ChargeAmount: { CurrencyAmount: number; CurrencyCode: string } }> }> }>;
        RefundEventList?: Array<{ AmazonOrderId?: string }>;
        ServiceFeeEventList?: Array<{ AmazonOrderId?: string; FeeList?: Array<{ FeeType: string; FeeAmount: { CurrencyAmount: number; CurrencyCode: string } }> }>;
      } };
    }>("GET", `/finances/v0/financialEventGroups/${encodeURIComponent(statementId)}/financialEvents`);
    const ev = j.payload?.FinancialEvents ?? {};
    const lines: StatementDetail["lines"] = [];
    let seq = 0;
    for (const s of ev.ShipmentEventList ?? []) {
      for (const item of s.ShipmentItemList ?? []) {
        for (const c of item.ItemChargeList ?? []) {
          lines.push({
            lineId: `${statementId}-L${++seq}`,
            type: "order",
            refId: s.AmazonOrderId ?? "unknown",
            amount: { amount: c.ChargeAmount.CurrencyAmount, currency: c.ChargeAmount.CurrencyCode },
          });
        }
      }
    }
    for (const r of ev.RefundEventList ?? []) {
      lines.push({ lineId: `${statementId}-L${++seq}`, type: "refund", refId: r.AmazonOrderId ?? "unknown", amount: { amount: 0, currency: shop.currency } });
    }
    for (const f of ev.ServiceFeeEventList ?? []) {
      for (const fee of f.FeeList ?? []) {
        lines.push({
          lineId: `${statementId}-L${++seq}`, type: "commission",
          refId: f.AmazonOrderId ?? fee.FeeType,
          amount: { amount: fee.FeeAmount.CurrencyAmount, currency: fee.FeeAmount.CurrencyCode },
        });
      }
    }
    return receipt({
      statementId,
      period: "",
      grossAmount: { amount: 0, currency: shop.currency },
      netAmount: { amount: 0, currency: shop.currency },
      status: "settled",
      lines,
    }, j, true);
  }

  // ---------- warehouse 仓储族（read · L1：FBA 在库） ----------
  async getInventory(_shop: ShopRef, sku?: string): Promise<Receipt<PageResult<InventoryItem>>> {
    const params = new URLSearchParams({
      details: "true",
      granularityType: "Marketplace",
      granularityId: this.cred.marketplaceId,
      marketplaceIds: this.cred.marketplaceId,
    });
    if (sku) params.set("sellerSkus", sku);
    const j = await this.call<{
      payload?: { inventorySummaries?: Array<{
        sellerSku: string; fnSku?: string; asin?: string;
        inventoryDetails?: { fulfillableQuantity?: number; reservedQuantity?: { totalReservedQuantity?: number }; inboundWorkingQuantity?: number };
      }>; };
    }>("GET", "/fba/inventory/v1/summaries", params.toString());
    const items = j.payload?.inventorySummaries ?? [];
    return receipt({
      items: items.map((x) => ({
        sku: x.sellerSku,
        warehouseId: `FBA-${this.cred.marketplaceId}`,
        warehouseName: "FBA",
        available: x.inventoryDetails?.fulfillableQuantity ?? 0,
        locked: x.inventoryDetails?.reservedQuantity?.totalReservedQuantity ?? 0,
        inTransit: x.inventoryDetails?.inboundWorkingQuantity ?? 0,
      })),
    }, j, true);
  }

  // ---------- 写方法与未覆盖族：显式失败（只读 v1 纪律） ----------
  updateOrderNote(): Promise<never> { throw new ConnectorUnsupportedError("updateOrderNote"); }
  getListing(): Promise<never> { throw new ConnectorUnsupportedError("getListing（v2 经 Catalog Items API 补）"); }
  updatePrice(): Promise<never> { throw new ConnectorUnsupportedError("updatePrice（写·L5，走围栏瀑布，不在连接器直写）"); }
  updateStock(): Promise<never> { throw new ConnectorUnsupportedError("updateStock"); }
  publishListing(): Promise<never> { throw new ConnectorUnsupportedError("publishListing"); }
  listCampaigns(): Promise<never> { throw new ConnectorUnsupportedError("listCampaigns（Amazon Ads API 独立授权，v2 补）"); }
  getAdReport(): Promise<never> { throw new ConnectorUnsupportedError("getAdReport（v2 补）"); }
  adjustBudget(): Promise<never> { throw new ConnectorUnsupportedError("adjustBudget（写·L4）"); }
  adjustBid(): Promise<never> { throw new ConnectorUnsupportedError("adjustBid（写·L4）"); }
  createTransfer(): Promise<never> { throw new ConnectorUnsupportedError("createTransfer"); }
  listConversations(): Promise<never> { throw new ConnectorUnsupportedError("listConversations（Messaging API v2 补）"); }
  sendMessage(): Promise<never> { throw new ConnectorUnsupportedError("sendMessage"); }
  sendMultimodalMessage(): Promise<never> { throw new ConnectorUnsupportedError("sendMultimodalMessage"); }
}

/** 从环境变量装配（缺任一项返回 null，由调用方决定回退 mock 并保持标注——禁止静默） */
export function amazonConnectorFromEnv(env: NodeJS.ProcessEnv = process.env): AmazonSpApiConnector | null {
  const required = [
    "AMZ_LWA_CLIENT_ID", "AMZ_LWA_CLIENT_SECRET", "AMZ_LWA_REFRESH_TOKEN",
    "AMZ_AWS_ACCESS_KEY_ID", "AMZ_AWS_SECRET_ACCESS_KEY", "AMZ_MARKETPLACE_ID",
  ] as const;
  if (required.some((k) => !env[k])) return null;
  return new AmazonSpApiConnector({
    lwaClientId: env.AMZ_LWA_CLIENT_ID!,
    lwaClientSecret: env.AMZ_LWA_CLIENT_SECRET!,
    lwaRefreshToken: env.AMZ_LWA_REFRESH_TOKEN!,
    awsAccessKeyId: env.AMZ_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: env.AMZ_AWS_SECRET_ACCESS_KEY!,
    awsSessionToken: env.AMZ_AWS_SESSION_TOKEN,
    region: (env.AMZ_REGION as "na" | "eu" | "fe") ?? "na",
    marketplaceId: env.AMZ_MARKETPLACE_ID!,
  });
}

// 抑制未使用类型告警（接口实现签名保留位）
export type {
  AdReportQuery, AdReportRow, BidAdjust, BudgetAdjust, Campaign, Conversation,
  Listing, ListingDraft, MessageInput, MultimodalMessageInput, OrderNoteUpdate,
  PriceUpdate, StockUpdate, TransferInput, TransferOrder,
};
