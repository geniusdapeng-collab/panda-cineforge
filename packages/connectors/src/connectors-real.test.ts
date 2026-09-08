/**
 * 真实连接器单元测试（P1）
 * 覆盖：SigV4 签名结构 / 抖店 md5 签名确定性 / env 装配显式回退 / 只读纪律显式失败 /
 *      SP-API 行→DTO 映射（桩 fetch 离线回放）。
 */
import { describe, expect, it } from "vitest";
import {
  AmazonSpApiConnector, ConnectorUnsupportedError, DouyinOpenConnector,
  amazonConnectorFromEnv, douyinConnectorFromEnv, douyinSign, realConnectorStatus, signSigV4,
} from "./index.js";
import type { ShopRef } from "./types.js";

const shop: ShopRef = { platformId: "amazon", shopId: "s1", shopName: "测试店", timezone: "America/Los_Angeles", currency: "USD" };

describe("signSigV4（AWS 签名结构）", () => {
  it("生成规范化 Authorization 头与签名头集", () => {
    const h = signSigV4({
      method: "GET", host: "sellingpartnerapi-na.amazon.com", path: "/orders/v0/orders",
      query: "MarketplaceIds=X", payload: "",
      accessKeyId: "AKID", secretAccessKey: "SECRET", region: "us-east-1",
      service: "execute-api", amzDate: "20260908T120000Z",
    });
    expect(h.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/20260908\/us-east-1\/execute-api\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(h["x-amz-date"]).toBe("20260908T120000Z");
  });
});

describe("douyinSign（确定性）", () => {
  it("同参同签，32 位 md5", () => {
    const a = douyinSign("sec", '{"a":1}', "1700000000");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(douyinSign("sec", '{"a":1}', "1700000000"));
    expect(a).not.toBe(douyinSign("sec", '{"a":2}', "1700000000"));
  });
});

describe("env 装配（显式回退，禁止静默）", () => {
  it("缺凭据返回 null；状态清单标注 mock 与原因", () => {
    expect(amazonConnectorFromEnv({})).toBeNull();
    expect(douyinConnectorFromEnv({})).toBeNull();
    const st = realConnectorStatus({});
    expect(st.every((s) => s.mode === "mock" && s.reason)).toBe(true);
  });
  it("凭据齐全装配真实连接器", () => {
    const env = {
      AMZ_LWA_CLIENT_ID: "a", AMZ_LWA_CLIENT_SECRET: "b", AMZ_LWA_REFRESH_TOKEN: "c",
      AMZ_AWS_ACCESS_KEY_ID: "d", AMZ_AWS_SECRET_ACCESS_KEY: "e", AMZ_MARKETPLACE_ID: "ATVPDKIKX0DER",
    };
    expect(amazonConnectorFromEnv(env)).toBeInstanceOf(AmazonSpApiConnector);
  });
});

describe("只读纪律（显式失败）", () => {
  it("写方法抛 ConnectorUnsupportedError，不允许静默", () => {
    const c = new AmazonSpApiConnector({
      lwaClientId: "a", lwaClientSecret: "b", lwaRefreshToken: "c",
      awsAccessKeyId: "d", awsSecretAccessKey: "e", region: "na", marketplaceId: "X",
    });
    expect(() => c.updatePrice()).toThrow(ConnectorUnsupportedError);
    expect(() => c.listCampaigns()).toThrow(/v2/);
    const d = new DouyinOpenConnector({ appKey: "k", appSecret: "s", shopAccessToken: "t" });
    expect(() => d.adjustBudget()).toThrow(ConnectorUnsupportedError);
  });
});

describe("SP-API 行→DTO 映射（桩 fetch 回放）", () => {
  it("listOrders 映射金额/状态/分页；verified=true", async () => {
    const stubFetch = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("auth/o2/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({
        payload: {
          Orders: [{
            AmazonOrderId: "111-2222222-3333333",
            BuyerInfo: { BuyerName: "Alice" },
            OrderTotal: { Amount: "59.99", CurrencyCode: "USD" },
            OrderStatus: "Shipped",
            NumberOfItemsShipped: 2,
            PurchaseDate: "2026-09-01T10:00:00Z",
          }],
          NextToken: "nxt",
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;
    const c = new AmazonSpApiConnector(
      { lwaClientId: "a", lwaClientSecret: "b", lwaRefreshToken: "c", awsAccessKeyId: "d", awsSecretAccessKey: "e", region: "na", marketplaceId: "X" },
      { fetch: stubFetch },
    );
    const r = await c.listOrders(shop, { pageSize: 10 });
    expect(r.verified).toBe(true);
    expect(r.data.items[0]!.amount.amount).toBe(59.99);
    expect(r.data.items[0]!.status).toBe("shipped");
    expect(r.data.nextCursor).toBe("nxt");
  });
});
