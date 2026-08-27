/**
 * service · 业务查询适配器（电商买家示例，packages 无关的服务端侧实现）
 * 契约：query_order / query_member / query_catalog / query_ticket 四个工具的统一适配口；
 * 本实现读本库 demo_orders / demo_members 演示数据（c_users.member_id 已绑定则按会员过滤）。
 * demo_orders 表结构不变：room_type 列承载商品口径（「商品名 ×数量」），
 * check_in/check_out 列承载下单/签收日期（与 scripts/seed.ts 的电商种子语义对齐）。
 * S4 PII 纪律：memberId 为空时 queryOrders/queryMember 一律返回空集 + bindRequired:true +
 * 绑定引导文案，禁止回退全量演示集（他人 PII 不得回灌给未绑定访客）；demo 标注保留。
 * 全部读写经 svcQuery（RLS 事务上下文）。
 */
import { ensureServiceSchema } from "../store.js";
import { svcQuery } from "../events.js";

export interface BizCtx { workspaceId: string; cUserId: string; memberId?: string | null }

/** 电商订单（demo_orders 行的电商化解读：商品/SKU/数量/金额/物流状态/售后入口） */
export interface DemoOrder {
  orderId: string; productName: string; sku: string; quantity: number;
  amountYuan: number; status: string; logistics: string;
  orderedAt: string; signedAt: string;
}
export interface DemoMember { memberId: string; name: string; tier: string; points: number; coupons: number }

/** pg date 列可能是 Date 或字符串，统一输出 YYYY-MM-DD */
function dateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** 「商品名 ×N」拆分为商品名 + 数量（种子数据口径，无 ×N 视为 1 件） */
function parseProduct(raw: string): { productName: string; quantity: number } {
  const m = /^(.+?)\s*×\s*(\d+)\s*$/.exec(raw);
  return m ? { productName: m[1]!.trim(), quantity: Number(m[2]) } : { productName: raw, quantity: 1 };
}

/** 演示 SKU：表内无独立 SKU 列，由订单号尾号确定性派生（演示口径） */
function skuOf(orderId: string): string {
  const tail = orderId.split("-").pop() ?? "0";
  return `SKU-${tail.padStart(6, "0")}`;
}

/** 物流状态摘要（按订单状态派生，演示口径） */
function logisticsOf(status: string, signedAt: string): string {
  if (status.includes("签收") || status.includes("完成")) return `顺丰速运 · ${signedAt} 已签收`;
  if (status.includes("配送") || status.includes("发货")) return "顺丰速运 · 运输中，预计 48 小时内送达";
  return "仓库拣货中，48 小时内发出";
}

/** 可用优惠券张数（演示口径：按会员等级派生） */
function couponsOf(tier: string): number {
  if (tier.includes("黑卡")) return 6;
  if (tier.includes("金")) return 3;
  if (tier.includes("银")) return 2;
  return 1;
}

/** 服务目录条目（退换政策/保修/安装指导；priceYuan 不适用，保持可选以兼容旧契约） */
export interface CatalogItem { sku: string; name: string; priceYuan?: number; category: string; tip: string }

export interface BizAdapter {
  queryOrder(ctx: BizCtx): Promise<{ orders: DemoOrder[]; demo: boolean; bindRequired?: boolean; hint?: string }>;
  queryMember(ctx: BizCtx): Promise<{ member: DemoMember | null; demo: boolean; bindRequired?: boolean; hint?: string }>;
  queryCatalog(ctx: BizCtx): Promise<{ items: CatalogItem[]; demo: boolean }>;
  queryTicket(ctx: BizCtx, params: { ticketId?: string }): Promise<{ ticket: Record<string, unknown> | null; demo: boolean }>;
}

/** S4 未绑定统一应答：空集 + bindRequired:true + 绑定引导文案（不回退全量演示集） */
const BIND_HINT = "您还未绑定会员身份，完成手机号验证绑定后即可查询本人订单与会员信息。";

/**
 * 买家服务目录（退换货政策/保修/安装指导，演示内联子集；
 * 全量结构化目录见 bundles/ecommerce/service-front/service-catalog.json）。
 */
const SERVICE_CATALOG: CatalogItem[] = [
  { sku: "SVC-RET-7D", name: "7 天无理由退货（国内店）", category: "退换货政策", tip: "「我的订单-申请售后」自助提交，运费险赔付首重" },
  { sku: "SVC-RET-30D", name: "30 天无理由退货（跨境店）", category: "退换货政策", tip: "退回本地海外仓即可，无需寄回国内" },
  { sku: "SVC-QA-EXCHANGE", name: "质量问题退换", category: "退换货政策", tip: "签收 48 小时内提供照片/视频凭证，来回运费我方承担" },
  { sku: "SVC-PRICE-PROTECT", name: "价保补差申请", category: "退换货政策", tip: "订单详情页自助申请，系统秒级比对补差" },
  { sku: "SVC-WAR-3C-12M", name: "3C 整机保修（12 个月）", category: "保修服务", tip: "非人为功能故障免费换新或维修" },
  { sku: "SVC-WAR-ACC-6M", name: "易耗品保修（6 个月）", category: "保修服务", tip: "外观无进液/弯折即按非人为处理" },
  { sku: "SVC-INSTALL-BIG", name: "大家电/家具预约安装", category: "安装指导", tip: "送装一体覆盖 200 城，下单页选择安装时段" },
  { sku: "SVC-INSTALL-VIDEO", name: "视频安装诊断", category: "安装指导", tip: "发安装视频给客服，AI 关键帧比对标准步骤并分步纠正" },
];

export const ecomBizAdapter: BizAdapter = {
  async queryOrder(ctx) {
    await ensureServiceSchema();
    if (!ctx.memberId) {
      return { orders: [], demo: true, bindRequired: true, hint: BIND_HINT };
    }
    const rows = await svcQuery(
      ctx.workspaceId,
      `SELECT order_id, room_type, check_in, check_out, amount_fen, status FROM demo_orders
       WHERE workspace_id=$1 AND member_id=$2 ORDER BY check_in DESC LIMIT 10`,
      [ctx.workspaceId, ctx.memberId],
    );
    return {
      orders: rows.map((x) => {
        const orderId = String(x.order_id);
        const { productName, quantity } = parseProduct(String(x.room_type));
        const status = String(x.status);
        const signedAt = dateStr(x.check_out);
        return {
          orderId, productName, sku: skuOf(orderId), quantity,
          amountYuan: Number(x.amount_fen) / 100, status,
          logistics: logisticsOf(status, signedAt),
          orderedAt: dateStr(x.check_in), signedAt,
        };
      }),
      demo: true,
    };
  },

  async queryMember(ctx) {
    await ensureServiceSchema();
    if (!ctx.memberId) {
      return { member: null, demo: true, bindRequired: true, hint: BIND_HINT };
    }
    const rows = await svcQuery(
      ctx.workspaceId,
      `SELECT member_id, name, tier, points FROM demo_members WHERE workspace_id=$1 AND member_id=$2`,
      [ctx.workspaceId, ctx.memberId],
    );
    const x = rows[0];
    const tier = x ? String(x.tier) : "";
    return {
      member: x ? { memberId: String(x.member_id), name: String(x.name), tier, points: Number(x.points), coupons: couponsOf(tier) } : null,
      demo: true,
    };
  },

  async queryCatalog(ctx) {
    await ensureServiceSchema();
    void ctx;
    return { items: SERVICE_CATALOG, demo: true };
  },

  async queryTicket(ctx, params) {
    await ensureServiceSchema();
    if (!params.ticketId) return { ticket: null, demo: true };
    const rows = await svcQuery(
      ctx.workspaceId,
      `SELECT id, kind, title, status, dept, assignee, created_at FROM c_tickets WHERE workspace_id=$1 AND id=$2 AND c_user_id=$3`,
      [ctx.workspaceId, params.ticketId, ctx.cUserId],
    );
    return { ticket: rows[0] ?? null, demo: true };
  },
};

export type BizTool = "query_order" | "query_member" | "query_catalog" | "query_ticket";

export async function runBizTool(
  tool: BizTool,
  ctx: BizCtx,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (tool) {
    case "query_order": return ecomBizAdapter.queryOrder(ctx);
    case "query_member": return ecomBizAdapter.queryMember(ctx);
    case "query_catalog": return ecomBizAdapter.queryCatalog(ctx);
    case "query_ticket": return ecomBizAdapter.queryTicket(ctx, params as { ticketId?: string });
  }
}
