/**
 * cn/douyin-open.ts —— 抖店开放平台只读连接器（P1：国内平台第一枪）
 *
 * 范围（v1 只读口径）：
 *  - 订单族：/order/searchList（listOrders）
 *  - 结算族：/settle/getSettleBillList + /settle/getSettleBillDetail（listStatements / getStatementDetail）
 * 认证：app_key + app_secret → client_credential access_token（/oauth2/token）；
 *      业务参数 JSON 序列化后 md5 签名（param_json + timestamp + app_secret 拼接口径）。
 * 写方法与未覆盖族一律显式失败（同 amazon-sp-api 纪律：写动作走围栏瀑布，不在连接器直写）。
 * 端点路径可经 deps.endpoints 覆盖（平台版本演进时不改代码）——显式配置而非静默猜测。
 */
import { createHash } from "node:crypto";
import type { PlatformConnector, Receipt } from "../interface.js";
import type {
  OrderSummary, PageQuery, PageResult, ShopRef, StatementDetail, StatementSummary,
} from "../types.js";
import { ConnectorUnsupportedError } from "../amazon/sp-api.js";

export interface DouyinCredentials {
  appKey: string;
  appSecret: string;
  /** 店铺授权 access_token（oauth 授权码换取；client_credential 仅够公共接口） */
  shopAccessToken: string;
}

export interface DouyinDeps {
  fetch?: typeof fetch;
  baseUrl?: string;            // 默认 https://openapi-fxg.jinritemai.com
  endpoints?: Partial<{ token: string; orderSearch: string; settleList: string; settleDetail: string }>;
}

const DEFAULT_ENDPOINTS = {
  token: "/oauth2/token",
  orderSearch: "/order/searchList",
  settleList: "/settle/getSettleBillList",
  settleDetail: "/settle/getSettleBillDetail",
};

let receiptSeq = 0;
function receipt<T>(data: T, raw: unknown, verified: boolean): Receipt<T> {
  return { data, verified, raw, receiptId: `rcpt-dy-${Date.now()}-${++receiptSeq}`, at: new Date().toISOString() };
}

/** 抖店签名：md5(app_secret + param_json + timestamp + v + app_secret)（平台公开口径，随版本可覆盖） */
export function douyinSign(appSecret: string, paramJson: string, timestamp: string, v = "2"): string {
  return createHash("md5").update(`${appSecret}${paramJson}${timestamp}${v}${appSecret}`).digest("hex");
}

const ORDER_STATUS_MAP: Record<number, OrderSummary["status"]> = {
  0: "pending-payment", 1: "pending-payment", 2: "paid", 3: "shipped",
  4: "completed", 5: "completed", 6: "closed", 7: "refunding",
};

export class DouyinOpenConnector implements PlatformConnector {
  readonly platformId = "douyin" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly ep: typeof DEFAULT_ENDPOINTS;

  constructor(private readonly cred: DouyinCredentials, deps: DouyinDeps = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.baseUrl = deps.baseUrl ?? "https://openapi-fxg.jinritemai.com";
    this.ep = { ...DEFAULT_ENDPOINTS, ...deps.endpoints };
  }

  private async call<T>(endpoint: string, bizParams: Record<string, unknown>): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const paramJson = JSON.stringify(bizParams);
    const sign = douyinSign(this.cred.appSecret, paramJson, timestamp);
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("app_key", this.cred.appKey);
    url.searchParams.set("access_token", this.cred.shopAccessToken);
    url.searchParams.set("timestamp", timestamp);
    url.searchParams.set("v", "2");
    url.searchParams.set("sign", sign);
    url.searchParams.set("sign_method", "md5");
    const r = await this.fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: paramJson,
    });
    if (!r.ok) throw new Error(`抖店 ${endpoint} 失败：HTTP ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { err_no?: number; err_msg?: string; data?: T };
    if (j.err_no !== 0) throw new Error(`抖店 ${endpoint} 业务失败：${j.err_no} ${j.err_msg}`);
    return j.data as T;
  }

  async listOrders(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<OrderSummary>>> {
    const d = await this.call<{
      shop_order_list?: Array<{
        shop_order_id: string; nickname?: string; pay_amount?: number;
        order_status?: number; item_num?: number; create_time?: number;
      }>;
      next_cursor?: string; total?: number;
    }>(this.ep.orderSearch, {
      page: query.cursor ?? "0",
      size: query.pageSize ?? 50,
      start_time: Math.floor((Date.now() - 7 * 86_400_000) / 1000).toString(),
      end_time: Math.floor(Date.now() / 1000).toString(),
    });
    const list = d?.shop_order_list ?? [];
    return receipt({
      items: list.map((o) => ({
        orderId: o.shop_order_id,
        buyerNick: o.nickname ?? "douyin-buyer",
        amount: { amount: o.pay_amount ?? 0, currency: shop.currency },
        status: ORDER_STATUS_MAP[o.order_status ?? 2] ?? "paid",
        itemCount: o.item_num ?? 1,
        createdAt: new Date((o.create_time ?? 0) * 1000).toISOString(),
      })),
      nextCursor: d?.next_cursor,
      total: d?.total,
    }, d, true);
  }

  async listStatements(shop: ShopRef, query: PageQuery): Promise<Receipt<PageResult<StatementSummary>>> {
    const d = await this.call<{
      bill_list?: Array<{ bill_id: string; bill_period?: string; total_amount?: number; settle_amount?: number; status?: number }>;
      next_cursor?: string;
    }>(this.ep.settleList, { page: query.cursor ?? "0", size: query.pageSize ?? 20 });
    const list = d?.bill_list ?? [];
    return receipt({
      items: list.map((b) => ({
        statementId: b.bill_id,
        period: b.bill_period ?? "",
        grossAmount: { amount: b.total_amount ?? 0, currency: shop.currency },
        netAmount: { amount: b.settle_amount ?? 0, currency: shop.currency },
        status: (b.status === 2 ? "settled" : "settling") as StatementSummary["status"],
      })),
      nextCursor: d?.next_cursor,
    }, d, true);
  }

  async getStatementDetail(shop: ShopRef, statementId: string): Promise<Receipt<StatementDetail>> {
    const d = await this.call<{
      bill_id?: string; bill_period?: string; total_amount?: number; settle_amount?: number;
      detail_list?: Array<{ detail_id: string; detail_type?: number; order_id?: string; amount?: number }>;
    }>(this.ep.settleDetail, { bill_id: statementId });
    const typeMap: Record<number, StatementDetail["lines"][number]["type"]> = {
      1: "order", 2: "refund", 3: "commission", 4: "ad-deduction", 5: "logistics",
    };
    return receipt({
      statementId,
      period: d?.bill_period ?? "",
      grossAmount: { amount: d?.total_amount ?? 0, currency: shop.currency },
      netAmount: { amount: d?.settle_amount ?? 0, currency: shop.currency },
      status: "settled",
      lines: (d?.detail_list ?? []).map((x) => ({
        lineId: x.detail_id,
        type: typeMap[x.detail_type ?? 1] ?? "order",
        refId: x.order_id ?? "unknown",
        amount: { amount: x.amount ?? 0, currency: shop.currency },
      })),
    }, d, true);
  }

  // ---------- 写方法与未覆盖族：显式失败（只读 v1 纪律） ----------
  updateOrderNote(): Promise<never> { throw new ConnectorUnsupportedError("douyin.updateOrderNote"); }
  getListing(): Promise<never> { throw new ConnectorUnsupportedError("douyin.getListing（v2 补）"); }
  updatePrice(): Promise<never> { throw new ConnectorUnsupportedError("douyin.updatePrice（写·L5 走围栏瀑布）"); }
  updateStock(): Promise<never> { throw new ConnectorUnsupportedError("douyin.updateStock"); }
  publishListing(): Promise<never> { throw new ConnectorUnsupportedError("douyin.publishListing"); }
  listCampaigns(): Promise<never> { throw new ConnectorUnsupportedError("douyin.listCampaigns（千川 API v2 补）"); }
  getAdReport(): Promise<never> { throw new ConnectorUnsupportedError("douyin.getAdReport（千川 API v2 补）"); }
  adjustBudget(): Promise<never> { throw new ConnectorUnsupportedError("douyin.adjustBudget（写·L4）"); }
  adjustBid(): Promise<never> { throw new ConnectorUnsupportedError("douyin.adjustBid（写·L4）"); }
  getInventory(): Promise<never> { throw new ConnectorUnsupportedError("douyin.getInventory（v2 补）"); }
  createTransfer(): Promise<never> { throw new ConnectorUnsupportedError("douyin.createTransfer"); }
  listConversations(): Promise<never> { throw new ConnectorUnsupportedError("douyin.listConversations（飞鸽 API v2 补）"); }
  sendMessage(): Promise<never> { throw new ConnectorUnsupportedError("douyin.sendMessage"); }
  sendMultimodalMessage(): Promise<never> { throw new ConnectorUnsupportedError("douyin.sendMultimodalMessage"); }
}

/** 从环境变量装配（缺凭据返回 null——调用方显式决定回退，禁止静默） */
export function douyinConnectorFromEnv(env: NodeJS.ProcessEnv = process.env): DouyinOpenConnector | null {
  if (!env.DOUYIN_APP_KEY || !env.DOUYIN_APP_SECRET || !env.DOUYIN_SHOP_ACCESS_TOKEN) return null;
  return new DouyinOpenConnector({
    appKey: env.DOUYIN_APP_KEY,
    appSecret: env.DOUYIN_APP_SECRET,
    shopAccessToken: env.DOUYIN_SHOP_ACCESS_TOKEN,
  });
}
