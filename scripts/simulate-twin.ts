/**
 * A6 · 售前数字孪生：熊猫优选集团 30 天经营模拟（PRD 售前演示场景）
 * 用法：pnpm db:seed && pnpm demo:twin（在种子之上叠加 30 天经营数据；幂等，可重复执行）
 *      pnpm demo:twin:snapshot  —— 导出快照到 demo/twin/panda-30d.sql.gz
 *      pnpm demo:twin:restore   —— 免模拟一键恢复快照（售前现场演示用）
 *
 * 目的：让客户在签约前看到「一个真实使用中的电商集团」——
 *   30 天 × 14 店铺 × 六条流水线（订单/广告/客服/库存/售后/财务）五元事件，
 *   含一次大促节点（第 20–22 天「黑五跨时区作战」）与 12 个经营剧情在 30 天轴上的分布，
 *   完整哈希链、审批流、围栏命中（R1–R30 样本）、根因闭环与知识库生长。
 *
 * 纪律：
 *  - 确定性随机（mulberry32 固定种子），任意时刻重跑产出逐字节一致的数据集；
 *  - 事件只经 workloom_gateway 角色写入（F1.2），逐条过 safeParseBusinessEvent（附录 E）；
 *  - 哈希链与生产同口径（eventHash/canonicalJson，#32 修复口径）；
 *  - 幂等：UNIQUE(tenant_id,event_id) 冲突丢弃（L1.4），审批 ON CONFLICT DO NOTHING。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { safeParseBusinessEvent } from "@workloom/shared";
import { eventHash } from "@workloom/base/workdata";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BUNDLE_DIR = join(REPO_ROOT, "bundles/ecommerce");

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:workloom@localhost:5432/workloom";
const GATEWAY_URL =
  process.env.DATABASE_GATEWAY_URL ??
  "postgres://workloom_gateway:workloom_dev_gateway@localhost:5432/workloom";

const TENANT_ID = "tenant-demo";
const WS_ID = "ws-panda";
const WS_NAME = "熊猫优选集团";
const FENCE_VERSION = "ecom-baseline/v1"; // 与 seed 装载的基线围栏版本一致
const GENESIS_HASH = "GENESIS";
const EVENT_BASE = 20000; // 事件编号 E-20001 起（与 seed 的 E-88xx 区段隔离）
const DAYS = 30;
const START = new Date("2026-07-22T00:00:00+08:00"); // 固定窗口：2026-07-22 ~ 2026-08-20

/* ================= 确定性随机 ================= */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260821);
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const iso = (d: Date) => d.toISOString();

/* ================= 演示维度（升级计划 §四/§五：14 店铺 × 品牌 × SKU × 仓网） ================= */
/** 14 店铺矩阵（与 seed.ts SHOP_MATRIX 同口径；site 决定时区节律） */
const SHOP_MATRIX = [
  { id: "SHOP-TMALL", name: "熊猫优选天猫旗舰店", platform: "天猫", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-JD", name: "熊猫优选京东自营店", platform: "京东", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-PDD", name: "熊猫智选拼多多店", platform: "拼多多", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-DOUYIN", name: "熊猫严选抖音店", platform: "抖音电商", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-KUAISHOU", name: "熊猫生活快手店", platform: "快手", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-XHS", name: "熊猫美学小红书店", platform: "小红书", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-SPH", name: "熊猫优选视频号小店", platform: "视频号", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-TMALLG", name: "PandaHome 天猫国际店", platform: "天猫国际", currency: "CNY", army: "国内军", site: "cn" },
  { id: "SHOP-AMZ", name: "PandaTech", platform: "亚马逊", currency: "USD", army: "跨境军", site: "us/eu/jp" },
  { id: "SHOP-TEMU", name: "PandaHome", platform: "Temu", currency: "USD", army: "跨境军", site: "us" },
  { id: "SHOP-TTS", name: "PandaLife", platform: "TikTok Shop", currency: "USD", army: "跨境军", site: "us/sea" },
  { id: "SHOP-SHOPEE", name: "PandaSelect", platform: "Shopee", currency: "USD", army: "跨境军", site: "sea" },
  { id: "SHOP-AE", name: "PandaGlobal", platform: "速卖通", currency: "USD", army: "跨境军", site: "global" },
  { id: "SHOP-DTC", name: "panda-home.com", platform: "Shopify", currency: "USD", army: "跨境军", site: "us/eu" },
] as const;
type Shop = (typeof SHOP_MATRIX)[number];

/** SKU 池（成本 ×1.15 毛利红线与 R2 同源，与 seed 同口径） */
const SKU_POOL = [
  { id: "SKU-3C-1001", label: "磁吸充电宝 10000mAh", category: "3C数码配件", cost: 42, price: 89 },
  { id: "SKU-3C-1002", label: "氮化镓快充头 65W", category: "3C数码配件", cost: 35, price: 79 },
  { id: "SKU-3C-1003", label: "Type-C 编织数据线 1.5m", category: "3C数码配件", cost: 6, price: 19.9 },
  { id: "SKU-HM-2001", label: "折叠收纳箱 55L", category: "家居日用", cost: 18, price: 49 },
  { id: "SKU-HM-2002", label: "真空压缩袋 8 件套", category: "家居日用", cost: 12, price: 35 },
  { id: "SKU-HM-2003", label: "厨房硅胶铲 5 件套", category: "家居日用", cost: 9, price: 29 },
  { id: "SKU-DS-3001", label: "原木置物架 三层", category: "设计家居", cost: 130, price: 329 },
  { id: "SKU-DS-3002", label: "侘寂风陶瓷台灯", category: "设计家居", cost: 95, price: 259 },
] as const;

/** 国内仓 4 + 海外仓 7 + FBA（11 仓网） */
const WAREHOUSES = [
  "东莞一仓", "义乌二仓", "深圳保税仓", "杭州前置仓",
  "海外仓-美东", "海外仓-美西", "海外仓-德国", "海外仓-波兰", "海外仓-日本", "海外仓-英国", "海外仓-澳洲", "FBA-美西",
] as const;

const AD_AGENTS = ["tmall-ads", "douyin-ads", "kuaishou-ads", "amz-ppc", "dtc-ads"] as const;
const CS_AGENTS = ["tmall-cs", "jd-cs", "pdd-cs", "douyin-cs", "kuaishou-cs", "xhs-cs", "tmallg-cs", "cs-en", "cs-eu", "cs-apac", "shopee-cs"] as const;
const WH_AGENTS = ["cn-warehouse", "overseas-warehouse", "amz-fba", "freight-forwarder"] as const;
const CS_TOPICS = ["充电宝上飞机", "物流时效", "跨境关税", "尺码/型号咨询", "优惠券叠加", "价保申请", "发票开具", "退换政策", "保修范围", "找同款/辨型号"] as const;

interface Preset { preset_key: string; version: string }
function loadPresets(): Preset[] {
  const dir = join(BUNDLE_DIR, "presets");
  return readdirSync(dir).sort().map((f) => {
    const raw = readFileSync(join(dir, f), "utf-8");
    return {
      preset_key: raw.match(/^preset_key:\s*(.+)$/m)?.[1]?.trim() ?? f.replace(/\.yml$/, ""),
      version: raw.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? "v1.0",
    };
  });
}
let PRESETS: Preset[] = [];
const agentWho = (key: string) => {
  const p = PRESETS.find((x) => x.preset_key === key);
  return { type: "agent" as const, id: key, version: p?.version ?? "v1.0" };
};
const humanWho = (id: string) => ({ type: "human" as const, id });

interface TwinEvent {
  event_id: string;
  who: { type: "human" | "agent" | "system"; id: string; version?: string };
  context: { tenant_id: string; workspace_id: string; time: string; channel?: string; stage?: string; store?: string; shop?: string; [k: string]: unknown };
  object: { type: string; id?: string; [k: string]: unknown };
  decision: { action: string; before?: unknown; after?: unknown; basis?: string[]; [k: string]: unknown };
  rule_impact: Array<{ rule_id: string; version: string; result: string }>;
  receipt?: { synced?: boolean; snapshot_uri?: string; verified_at?: string };
  model_trace?: { model_id: string; tier?: string; window?: string; credits?: number };
  links?: string[];
  [k: string]: unknown;
}

let seq = 0;
const nextId = () => `E-${EVENT_BASE + ++seq}`;
const mt = (tier: "standard" | "flagship", night: boolean) => ({
  model_id: "mock-ecommerce-001", tier, window: night ? "off-peak" : "peak", credits: tier === "flagship" ? 2 : 1,
});
const receipt = (t: Date, id: string) => ({
  synced: true, snapshot_uri: `data/snapshots/${id.toLowerCase()}.png`, verified_at: iso(new Date(t.getTime() + 45_000)),
});
const ctx = (t: Date, channel?: string, shop?: string) => ({
  tenant_id: TENANT_ID, workspace_id: WS_ID, time: iso(t), stage: "stable", store: WS_NAME,
  ...(channel ? { channel } : {}), ...(shop ? { shop } : {}),
});
const at = (day: number, h: number, m = int(0, 59)) =>
  new Date(START.getTime() + day * 86_400_000 + (h * 60 + m) * 60_000);
/** 店铺时段节律：国内店 8–23 点；跨境店按目的地时区（欧美白天 = 北京深夜，夜班班组主场） */
const shopHour = (s: Shop) =>
  s.army === "国内军" ? int(8, 23) : pick([22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16] as const);

/** 审批队列登记项（review/block 事件 → approvals 表） */
interface ApprovalItem { eventId: string; level: "review" | "block"; title: string; time: Date }
const approvalsToCreate: ApprovalItem[] = [];

/** 夜班决策包事件登记（事件落库后回填 night_runs 表） */
const nightPackages: Array<{ day: number; runDate: string; eventId: string; done: number; pending: number; escalate: number }> = [];
const fmtDate = (day: number) => new Date(START.getTime() + day * 86_400_000 + 8 * 3_600_000).toISOString().slice(0, 10);

/** 订单勾稽台账（§五 真实感红线：广告→订单归因、出库=订单履约、退款→原订单） */
interface OrderLedger { event_id: string; order_id: string; shop: Shop; sku: (typeof SKU_POOL)[number]; qty: number; amount: number; campaign_id: string | null }
const orderLedger: OrderLedger[] = [];
const fulfillmentQueue: OrderLedger[] = [];
let lastCampaignId: string | null = null;

/** 大促节点：第 20–22 天「黑五跨时区作战」（0 基索引 19–21） */
const BLACK_FRIDAY = [19, 20, 21] as const;
const isPromo = (d: number) => (BLACK_FRIDAY as readonly number[]).includes(d);
const promoFactor = (d: number, s: Shop) => (isPromo(d) ? (s.army === "跨境军" ? 4 : 1.5) : 1);

/* ================= 六条流水线生成器 ================= */
/** ① 订单流：按店铺画像 × 星期系数 × 大促脉冲生成；35% 带广告归因标记 */
function evOrderCreate(t: Date, shop: Shop): TwinEvent {
  const sku = pick(SKU_POOL);
  const qty = int(1, 3);
  const amount = Math.round(sku.price * qty * (shop.currency === "USD" ? 0.22 : 1) * 100) / 100;
  const attributed = rand() < 0.35 ? lastCampaignId : null;
  const id = nextId();
  const order_id = `OD-${shop.id.slice(5)}-${int(100000, 999999)}`;
  orderLedger.push({ event_id: id, order_id, shop, sku, qty, amount, campaign_id: attributed });
  fulfillmentQueue.push(orderLedger[orderLedger.length - 1] as OrderLedger);
  return {
    event_id: id, who: { type: "system", id: "platform-webhook" },
    context: { ...ctx(t, shop.platform, shop.id), timezone: shop.currency === "USD" ? "目的地时区" : "Asia/Shanghai" },
    object: { type: "order", id: order_id, label: sku.label },
    decision: {
      action: "order.create",
      after: { qty, amount, currency: shop.currency, attr_campaign: attributed },
      basis: attributed ? ["广告归因：点击 24h 内下单（与广告流水勾稽）"] : ["自然流量下单"],
    },
    rule_impact: [], receipt: receipt(t, id),
  };
}
/** ② 广告流水：计划级调价/加词/分时；ACoS 有趋势有噪声（R1/R4/R17 管辖边界内） */
function evAdsAdjust(t: Date, shop: Shop, night: boolean): TwinEvent {
  const id = nextId();
  const campId = `CAMP-${shop.id.slice(5)}-${int(1000, 3999)}`;
  lastCampaignId = campId;
  const acos = Math.round((0.15 + rand() * 0.12) * 100) / 100;
  return {
    event_id: id, who: agentWho(pick(AD_AGENTS)),
    context: { ...ctx(t, shop.platform, shop.id), night_shift: night },
    object: { type: "ad_campaign", id: campId, label: `${pick(SKU_POOL).label} 推广计划` },
    decision: {
      action: pick(["ads.bid.adjust", "ads.keyword.add", "ads.budget.pacing"] as const),
      after: { acos, ctr: Math.round((0.02 + rand() * 0.04) * 1000) / 1000, spend: int(300, 8000), currency: shop.currency },
      basis: night ? ["谷时窗口批量作业（费率 ≤20%）", "类目基准 ± 波动"] : ["分时调价模型", "ACoS 趋势+噪声（利润保险丝监测中）"],
    },
    rule_impact: [], receipt: receipt(t, id), model_trace: mt("standard", night),
  };
}
/** ③ 客服会话流：售前 55% / 物流 25% / 售后 20%；多模态三管线；多语言 */
function evCsSession(t: Date, shop: Shop): TwinEvent {
  const id = nextId();
  const modality = pick(["text", "text", "text", "text", "image", "screenshot", "video"] as const);
  const intent = pick(["pre_sale", "pre_sale", "pre_sale", "logistics", "logistics", "aftersale"] as const);
  const lang = shop.currency === "CNY" ? "zh" : pick(["en", "en", "de", "ja", "es"] as const);
  const topic = pick(CS_TOPICS);
  const multimodal =
    modality === "screenshot" ? "买家截图：订单异常/报错页，视觉识别已解析"
    : modality === "image" ? "买家图片：找同款/辨型号，已匹配商品库"
    : modality === "video" ? "买家视频：故障诊断，转安装指导话术"
    : null;
  return {
    event_id: id, who: agentWho(pick(CS_AGENTS)),
    context: ctx(t, shop.platform, shop.id),
    object: { type: "cs_session", id: `CS-${int(100000, 999999)}` },
    decision: {
      action: "cs.reply",
      params: { topic },
      after: { intent, lang, modality, resolved: rand() > 0.18, first_response_sec: shop.currency === "CNY" ? int(8, 30) : int(30, 120), ...(multimodal ? { multimodal } : {}) },
      basis: ["知识库 + 商品库双源合成应答", "售前转化导向：内嵌商品卡片/优惠券"],
    },
    rule_impact: [], model_trace: mt(modality === "text" ? "standard" : "flagship", false),
  };
}
/** ④ 库存流水：出库 = 订单履约（从待履约队列取单，qty 与订单一致） */
function evStockOutbound(t: Date): TwinEvent {
  const ord = fulfillmentQueue.shift();
  const id = nextId();
  if (!ord) {
    return {
      event_id: id, who: agentWho(pick(WH_AGENTS)), context: ctx(t, "仓储"),
      object: { type: "stock", id: pick(SKU_POOL).id },
      decision: { action: "stock.count", after: { variance: 0, warehouse: pick(WAREHOUSES) }, basis: ["循环盘点，账实相符"] },
      rule_impact: [], model_trace: mt("standard", false),
    };
  }
  return {
    event_id: id, who: agentWho(pick(WH_AGENTS)),
    context: ctx(t, "仓储", ord.shop.id),
    object: { type: "stock", id: ord.sku.id, label: ord.sku.label },
    decision: {
      action: "stock.outbound",
      after: { order_id: ord.order_id, qty_out: ord.qty, warehouse: ord.shop.army === "跨境军" ? pick(["海外仓-美东", "海外仓-美西", "海外仓-德国", "海外仓-日本", "FBA-美西"] as const) : pick(["东莞一仓", "义乌二仓", "杭州前置仓"] as const), balance_after: int(200, 9000) },
      basis: ["出库 = 订单履约（库存流水与订单流勾稽）"],
    },
    rule_impact: [], links: [ord.event_id], receipt: receipt(t, id),
  };
}
/** ⑤ 售后流：退款关联原订单；≥¥1000/$200 → R5 必审 */
function evRefund(t: Date): TwinEvent {
  const id = nextId();
  const ord = orderLedger.length > 0 ? orderLedger[int(0, orderLedger.length - 1)] : undefined;
  const big = rand() < 0.12;
  const cny = (ord?.shop.currency ?? "CNY") === "CNY";
  const amount = big ? (cny ? int(1000, 2600) : int(200, 580)) : Math.round((ord?.amount ?? int(30, 200)) * 100) / 100;
  const ev: TwinEvent = {
    event_id: id, who: agentWho(pick(CS_AGENTS)),
    context: ctx(t, ord?.shop.platform ?? "天猫", ord?.shop.id),
    object: { type: "aftersale", id: `AS-${int(100000, 999999)}`, label: ord?.sku.label },
    decision: {
      action: "aftersale.refund",
      params: { amount, currency: ord?.shop.currency ?? "CNY" },
      after: { reason: pick(["七天无理由", "物流破损", "与描述不符", "拍错/多拍"] as const), original_order: ord?.order_id ?? null },
      basis: ["退款单关联原订单（售后流与订单流勾稽）", big ? "金额超分级线 → R5 必审" : "政策内自动退款"],
    },
    rule_impact: big ? [{ rule_id: "R5", version: FENCE_VERSION, result: "review" }] : [],
    links: ord ? [ord.event_id] : [], model_trace: mt("standard", false),
  };
  if (big) approvalsToCreate.push({ eventId: id, level: "review", title: `大额退款必审（R5）：${ord?.shop.platform ?? "平台"} ¥/$${amount}`, time: t });
  return ev;
}
/** 评价流：好评资产化（auto）；差评 R9 2h SLA 必审 */
function evReview(t: Date, shop: Shop, bad: boolean): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: agentWho(pick(["tmall-cs", "douyin-cs", "cs-en", "service-qc"] as const)),
    context: ctx(t, shop.platform, shop.id),
    object: { type: "review", id: `RV-${int(10000, 99999)}` },
    decision: bad
      ? {
          action: "review.reply",
          params: { rating: int(1, 3) },
          after: { draft: "非常抱歉给您带来不好的体验，我们已核实问题并安排补发/退款，客服将私信跟进……", sla_hours: 2 },
          basis: ["差评 2h SLA（R9）", "已核对 forbidden：无档案外补偿承诺"],
        }
      : {
          action: "review.asset.boost",
          params: { rating: 5 },
          after: { action: "置顶 + 沉淀 FAQ + 素材入品牌资产库" },
          basis: ["好评资产化（review-asset-mining）"],
        },
    rule_impact: bad ? [{ rule_id: "R9", version: FENCE_VERSION, result: "review" }] : [],
    model_trace: mt("standard", false),
  };
}
/** ⑥ 财务流水：订单 × 平台账单 × 广告/售后三方比对；留 ≈0.3% 脏数据供对账演示 */
function evReconcile(t: Date, withDiff: boolean): TwinEvent {
  const id = nextId();
  const gmv = int(80, 120) * 10000;
  const diff = withDiff ? Math.round(gmv * 0.003) : 0;
  const shop = pick(SHOP_MATRIX);
  return {
    event_id: id, who: agentWho("multi-reconciler"), context: ctx(t, "夜班"),
    object: { type: "settlement", id: `STL-${shop.platform}-${int(100, 999)}` },
    decision: {
      action: "settlement.reconcile",
      after: { gmv_sample: gmv, currency: shop.currency, diff, diff_rate: Math.round((diff / gmv) * 10000) / 10000, rounds: 3, ...(withDiff ? { note: "三方差异 ≈0.3%，已立项追查（对账Agent 演示发现点）" } : {}) },
      basis: ["订单流水 × 平台账单 × 广告/售后扣款三方比对（账单可对平）"],
    },
    rule_impact: [], model_trace: mt("standard", true),
  };
}
/** 夜班：竞对/跟卖/价格带巡检（只读） */
function evCompetitorFetch(t: Date): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: agentWho("competitor-radar"), context: ctx(t, "夜班"),
    object: { type: "competitor", id: "competitor-watch" },
    decision: {
      action: "competitor.fetch",
      after: { cards: 5, hijack_suspects: 0, price_band_shift: pick(["无", "无", "同类目下探 3%"] as const) },
      basis: ["竞店竞品情报卡 ×5 采集", "频次自律：请求间隔 ≥3s（L3.3）"],
    },
    rule_impact: [], receipt: receipt(t, id),
  };
}
/** 夜班 08:30 决策包（大促期间 escalate=1：黑五跨时区作战） */
function evNightPackage(t: Date, day: number): TwinEvent {
  const id = nextId();
  const promo = isPromo(day);
  return {
    event_id: id, who: { type: "system", id: "night-shift" }, context: ctx(t, "夜班"),
    object: { type: "shift", id: `nr-${fmtDate(day)}` },
    decision: {
      action: "night.package.deliver",
      after: {
        done: promo ? int(18, 26) : int(8, 14), pending: int(0, 3),
        escalate: promo ? 1 : day % 9 === 0 ? 1 : 0, fence_snapshot: FENCE_VERSION,
        ...(promo ? { war_room: "黑五跨时区作战：欧美盘托管会话/广告分时加码/跟卖巡检加密" } : {}),
      },
      basis: ["夜班班组三段投影（✓已完成/◆待审批/▲需介入）", "跨境店客服托管 = 夜班班组主场"],
    },
    rule_impact: [], receipt: receipt(t, id),
  };
}
/** 调价：白班 R1（单日降价 ≤10%）/ 夜班 R17（微调 ≤3%），毛利红线 ×1.15 复核 */
function evPriceAdjust(t: Date, night: boolean): TwinEvent {
  const sku = pick(SKU_POOL);
  const id = nextId();
  const before = sku.price;
  const after = Math.round(before * (1 - rand() * (night ? 0.03 : 0.09)) * 100) / 100;
  const rule = night ? "R17" : "R1";
  return {
    event_id: id, who: agentWho(pick(["listing-factory", "temu-pricing"] as const)),
    context: { ...ctx(t, pick(SHOP_MATRIX).platform), night_shift: night },
    object: { type: "price", id: sku.id, label: sku.label },
    decision: {
      action: "price.adjust", before: { price: before },
      after: { price: after, margin_floor_ok: after >= sku.cost * 1.15 },
      basis: [night ? "夜班调价微调 ≤3%（R17 自动上限）" : "单日降价 ≤10%（R1 自动上限）", "毛利红线 ×1.15 复核"],
    },
    rule_impact: [{ rule_id: rule, version: FENCE_VERSION, result: "pass" }],
    receipt: receipt(t, id), model_trace: mt("standard", night),
  };
}
/** 内容/素材：短视频、笔记、详情页 AIGC 发布（R24 侵权图上新阻断过检） */
function evContentPublish(t: Date): TwinEvent {
  const id = nextId();
  const platform = pick(["抖音电商", "小红书", "TikTok Shop"] as const);
  return {
    event_id: id, who: agentWho(pick(["douyin-video", "xhs-content", "creative-studio"] as const)),
    context: ctx(t, platform),
    object: { type: "content", id: `CT-${int(1000, 9999)}` },
    decision: {
      action: "content.publish",
      params: { platform },
      after: { published: true, title: pick(["磁吸充电宝 3 秒上手的收纳哲学", "小户型的折叠魔法：55L 收纳箱实测", "GaN 快充头多口同时充不掉速？实测"] as const) },
      basis: ["违禁词/侵权图检查通过（R11/R24）", "品牌规范校验通过"],
    },
    rule_impact: [{ rule_id: "R24", version: FENCE_VERSION, result: "pass" }],
    receipt: receipt(t, id), model_trace: mt("flagship", false),
  };
}
/** 刊登/入库/调拨/FBA 补货（库存余额逐日连续） */
function evStockInbound(t: Date): TwinEvent {
  const id = nextId();
  const action = pick(["stock.inbound", "stock.transfer", "fba.replenish"] as const);
  return {
    event_id: id, who: agentWho(pick(WH_AGENTS)), context: ctx(t, "仓储"),
    object: { type: "stock", id: pick(SKU_POOL).id },
    decision: {
      action,
      after: {
        qty: int(200, 3000),
        ...(action === "stock.transfer" ? { from: pick(WAREHOUSES), to: pick(WAREHOUSES) } : { warehouse: pick(WAREHOUSES) }),
      },
      basis: [action === "fba.replenish" ? "FBA 补货计划（fba-replenish）" : "安全库存 14 天口径补货"],
    },
    rule_impact: [], receipt: receipt(t, id),
  };
}

/* ================= 12 个经营剧情（30 天轴分布，§五 第 4 步） ================= */
/** ① 爆款断货预警 → 紧急采购请示（R7 + R20 分级人审） */
function evStockoutAlert(t: Date): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "爆款断货预警：磁吸充电宝可售 5.2 天（R7）", time: t });
  return {
    event_id: id, who: agentWho("demand-planner"), context: ctx(t, "天猫", "SHOP-TMALL"),
    object: { type: "stock", id: "SKU-3C-1001", label: "磁吸充电宝 10000mAh（爆款期）" },
    decision: {
      action: "stock.stockout.alert",
      after: { days_cover: 5.2, daily_sales: 1800, inbound_in_transit: 0, warehouse: "东莞一仓" },
      basis: ["剧情①：可售天数 5.2 < 7 且补货在途为 0（R7 断货预警线）"],
    },
    rule_impact: [{ rule_id: "R7", version: FENCE_VERSION, result: "review" }],
    model_trace: mt("standard", false),
  };
}
function evUrgentProcurement(t: Date, link: string): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "紧急采购 ¥126 万：磁吸充电宝 3 万台（R20 分级人审）", time: t });
  return {
    event_id: id, who: agentWho("procurement-buyer"), context: ctx(t, "供应链"),
    object: { type: "purchase_order", id: "PO-20260726-011", label: "磁吸充电宝紧急补货 3 万台" },
    decision: {
      action: "procurement.urgent.request",
      after: { sku: "SKU-3C-1001", qty: 30_000, amount_cny: 1_260_000, supplier: "东莞锂威电子", lead_time_days: 12 },
      basis: ["剧情①：紧急采购请示", "金额 ¥126 万 ≥ 分级人审线（R20）"],
    },
    rule_impact: [{ rule_id: "R7", version: FENCE_VERSION, result: "review" }, { rule_id: "R20", version: FENCE_VERSION, result: "review" }],
    links: [link], model_trace: mt("flagship", false),
  };
}
/** ② 亚马逊 ACoS 连续 3 天爆表 → 利润保险丝熔断降预算（R3） */
function evAcosDaily(t: Date, dayIdx: number, acos: number): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: agentWho("amz-ppc"), context: ctx(t, "亚马逊", "SHOP-AMZ"),
    object: { type: "ad_campaign", id: "CAMP-AMZ-SP-3077", label: "PandaTech 磁吸充电宝 SP 自动组" },
    decision: {
      action: "ads.acos.daily",
      after: { acos, acos_breakeven: 0.28, day_index: dayIdx, spend_usd: int(1100, 1600) },
      basis: [`剧情②：ACoS 第 ${dayIdx} 天 ${acos} > 盈亏平衡点 0.28（连续监测中）`],
    },
    rule_impact: [], model_trace: mt("standard", false),
  };
}
function evAcosFuse(t: Date, links: string[]): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "ACoS 连续 3 天爆表：保险丝降预算 30%（R3）", time: t });
  return {
    event_id: id, who: agentWho("budget-controller"), context: ctx(t, "亚马逊", "SHOP-AMZ"),
    object: { type: "ad_campaign", id: "CAMP-AMZ-SP-3077" },
    decision: {
      action: "ads.budget.fuse",
      before: { daily_budget_usd: 1500, acos_3d: [0.31, 0.34, 0.38] },
      after: { daily_budget_usd: 1050, cut: "-30%", escalate_to: "MEM-002 运营总监" },
      basis: ["剧情②：利润保险丝——ACoS 连续 3 天 > 盈亏平衡点，自动降预算 30% 并请示（R3）"],
    },
    rule_impact: [{ rule_id: "R3", version: FENCE_VERSION, result: "review" }],
    links, receipt: receipt(t, id), model_trace: mt("standard", false),
  };
}
/** ③ 抖音直播间差评危机 → 2h SLA 防御窗口（R9，94 分钟内人审收口） */
function evLiveBadReview(t: Date): [TwinEvent, TwinEvent, TwinEvent] {
  const detectId = nextId();
  const replyId = nextId();
  const gestureId = nextId();
  approvalsToCreate.push({ eventId: replyId, level: "review", title: "直播间 1 星差评回复审批（R9 2h SLA）", time: t });
  return [
    {
      event_id: detectId, who: agentWho("douyin-cs"), context: ctx(t, "抖音电商", "SHOP-DOUYIN"),
      object: { type: "review", id: "RV-DY-77520", label: "直播间 1 星差评" },
      decision: {
        action: "review.detect",
        after: { rating: 1, topic: "直播间展示与实物色差", live_exposure: "当场 2.3 万人在线", sla_hours: 2 },
        basis: ["剧情③：差评危机，2h SLA 防御窗口开启（R9）"],
      },
      rule_impact: [{ rule_id: "R9", version: FENCE_VERSION, result: "review" }],
      model_trace: mt("standard", false),
    },
    {
      event_id: replyId, who: agentWho("douyin-cs"), context: ctx(new Date(t.getTime() + 40 * 60_000), "抖音电商", "SHOP-DOUYIN"),
      object: { type: "review", id: "RV-DY-77520" },
      decision: {
        action: "review.reply",
        after: { draft: "非常抱歉色差给您带来困扰。我们已复核直播间灯光校色并支持无理由退换+运费险，客服将私信您跟进……", sla_deadline_min: 118 },
        basis: ["品牌规范致歉结构", "已核对 forbidden：无档案外补偿承诺"],
      },
      rule_impact: [{ rule_id: "R9", version: FENCE_VERSION, result: "review" }],
      links: [detectId], model_trace: mt("flagship", false),
    },
    {
      event_id: gestureId, who: humanWho("MEM-002"), context: ctx(new Date(t.getTime() + 94 * 60_000), "inapp"),
      object: { type: "review", id: "RV-DY-77520" },
      decision: {
        action: "approval.gesture",
        after: { gesture: "approve", weight: 1, elapsed_min: 94 },
        basis: ["剧情③收口：运营总监 94 分钟内批准发出（SLA 2h 达标）"],
      },
      rule_impact: [], links: [replyId],
    },
  ];
}
/** ④ 大促作战周：战备模式切换（R27 必审）+ 作战室排班 */
function evWarRoomActivate(t: Date): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "大促战备模式切换：黑五作战室启用（R27）", time: t });
  return {
    event_id: id, who: agentWho("group-ceo"), context: ctx(t, "集团指挥层"),
    object: { type: "shop", id: WS_ID, label: "黑五跨时区作战室" },
    decision: {
      action: "promo.warroom.activate",
      after: {
        mode: "promo_peak", window: "第 20–22 天（黑五+网一）",
        measures: ["审批提速通道（预设白名单 auto 放行）", "广告预算大盘上浮 40%", "夜班班组全员战备排班", "熔断清单：毛利红线/违禁词不放行"],
      },
      basis: ["剧情④：大促作战周——系统级战备切换请示（R27）", "流量峰值预案与熔断清单已备"],
    },
    rule_impact: [{ rule_id: "R27", version: FENCE_VERSION, result: "review" }],
    model_trace: mt("flagship", false),
  };
}
/** ⑤ 黑五跨时区作战：作战室日报（峰值脉冲的系统投影） */
function evWarRoomDashboard(t: Date, dayNo: number): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: { type: "system", id: "promo-war-room" }, context: ctx(t, "大促作战室"),
    object: { type: "shop", id: WS_ID },
    decision: {
      action: "promo.warroom.dashboard",
      after: {
        day: dayNo, peak_orders_today: `${int(28, 46)} 万单（采样投影）`, cross_border_share: 0.62,
        cs_sessions_hosted_night: int(1800, 3200), acos_fuse_triggered: 0, hijack_alerts: int(0, 2),
      },
      basis: ["剧情⑤：黑五跨时区作战——欧美白天=北京深夜，夜班班组主场作战", "大促脉冲：跨境店订单 ×4 系数"],
    },
    rule_impact: [],
  };
}
/** ⑥ 跟卖突袭 → 取证驱赶（R19） */
function evHijackAlert(t: Date): [TwinEvent, TwinEvent] {
  const alertId = nextId();
  const evId = nextId();
  approvalsToCreate.push({ eventId: evId, level: "review", title: "跟卖取证完毕：驱赶动作请示（R19）", time: t });
  return [
    {
      event_id: alertId, who: agentWho("ip-shield"), context: ctx(t, "亚马逊", "SHOP-AMZ"),
      object: { type: "listing", id: "B0CXYZ8899", label: "PandaTech 磁吸充电宝 US 站 Listing" },
      decision: {
        action: "hijack.alert",
        after: { hijacker: "Seller-X9TRADE", price_undercut_usd: 3.5, buybox_lost: true, detected_at: "夜间巡检" },
        basis: ["剧情⑥：跟卖突袭，Buy Box 丢失（R19 跟卖预警）"],
      },
      rule_impact: [{ rule_id: "R19", version: FENCE_VERSION, result: "review" }],
      model_trace: mt("standard", true),
    },
    {
      event_id: evId, who: agentWho("ip-shield"), context: ctx(new Date(t.getTime() + 3 * 3_600_000), "亚马逊", "SHOP-AMZ"),
      object: { type: "listing", id: "B0CXYZ8899" },
      decision: {
        action: "hijack.evidence.file",
        after: { evidence: ["跟卖截图 ×4", "test buy 订单 112-****-****", "品牌备案号 PandaTech®"], route: "亚马逊违规举报 + 品牌驱赶函" },
        basis: ["剧情⑥：取证完毕，驱赶动作请示（R19）"],
      },
      rule_impact: [{ rule_id: "R19", version: FENCE_VERSION, result: "review" }],
      links: [alertId], receipt: receipt(t, evId), model_trace: mt("standard", true),
    },
  ];
}
/** ⑦ 汇率单日波动 2.3% → 跨境全线重定价评估（R14） */
function evFxVolatility(t: Date): [TwinEvent, TwinEvent] {
  const alertId = nextId();
  const assessId = nextId();
  approvalsToCreate.push({ eventId: assessId, level: "review", title: "USD/CNY 波动 2.3%：跨境 6 店重定价评估（R14）", time: t });
  return [
    {
      event_id: alertId, who: agentWho("fx-settler"), context: ctx(t, "集团财务"),
      object: { type: "fx_rate", id: "USD/CNY" },
      decision: {
        action: "fx.volatility.alert",
        before: { usd_cny: 7.12 },
        after: { usd_cny: 7.28, change_pct: 0.023 },
        basis: ["剧情⑦：单日波动 2.3% > 2% 阈值（R14 重定价触发线）"],
      },
      rule_impact: [{ rule_id: "R14", version: FENCE_VERSION, result: "review" }],
      model_trace: mt("standard", false),
    },
    {
      event_id: assessId, who: agentWho("fx-settler"), context: ctx(new Date(t.getTime() + 2 * 3_600_000), "集团财务"),
      object: { type: "price", id: "cross-border-all", label: "跨境军 6 店 3400 SKU" },
      decision: {
        action: "pricing.fx.reprice.assess",
        after: { scope: "跨境军 6 店 3400 SKU", margin_impact_pt: -1.8, proposal: "US 站全线 +2.5%，EU 站 +1.8%", est_hours: 4 },
        basis: ["剧情⑦：重定价评估请示（R14）", "毛利红线 ×1.15 复核通过"],
      },
      rule_impact: [{ rule_id: "R14", version: FENCE_VERSION, result: "review" }],
      links: [alertId], model_trace: mt("flagship", false),
    },
  ];
}
/** ⑧ 欧盟 VAT 税率变更 → 售价重算（R15） */
function evVatChange(t: Date): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "德国 VAT 19%→21% 预案：EU 站售价重算（R15）", time: t });
  return {
    event_id: id, who: agentWho("vat-specialist"), context: ctx(t, "集团财务"),
    object: { type: "tax_vat", id: "VAT-DE", label: "德国 VAT 税号 DE****" },
    decision: {
      action: "vat.change.recalc",
      before: { vat_rate: 0.19 },
      after: { vat_rate: 0.21, affected_sku: 860, proposal: "EU 站含税价同步 +1.7%，DDP 口径毛利影响 -0.9pt" },
      basis: ["剧情⑧：欧盟 VAT 税率变更预案（R15 售价重算）", "9 国税号档案已核对"],
    },
    rule_impact: [{ rule_id: "R15", version: FENCE_VERSION, result: "review" }],
    model_trace: mt("flagship", false),
  };
}
/** ⑨ 海外仓 SKU 库龄 90 天 → 清仓预案（R6 周转超标） */
function evAgedStock(t: Date): TwinEvent {
  const id = nextId();
  approvalsToCreate.push({ eventId: id, level: "review", title: "海外仓-波兰 库龄 90 天：真空压缩袋清仓预案（R6）", time: t });
  return {
    event_id: id, who: agentWho("overseas-warehouse"), context: ctx(t, "仓储"),
    object: { type: "stock", id: "SKU-HM-2002", label: "真空压缩袋 8 件套（海外仓-波兰）" },
    decision: {
      action: "stock.age.alert",
      after: { age_days: 90, qty: 4200, value_usd: 21800, turnover_days: 96, proposal: "捆绑促销 + 站外 Deal 站清仓，残值回收率预估 62%" },
      basis: ["剧情⑨：库龄 90 天 > 周转 60 天红线（R6 清仓预案请示）", "库存当现金管：滞库资金占用已计入沙盘"],
    },
    rule_impact: [{ rule_id: "R6", version: FENCE_VERSION, result: "review" }],
    model_trace: mt("standard", false),
  };
}
/** ⑩ 拼多多价格倒挂 → 多平台价格守护（R18） */
function evParityAlert(t: Date): [TwinEvent, TwinEvent] {
  const alertId = nextId();
  const fixId = nextId();
  approvalsToCreate.push({ eventId: alertId, level: "review", title: "拼多多倒挂 15.7%：多平台价格守护（R18）", time: t });
  return [
    {
      event_id: alertId, who: agentWho("competitor-radar"), context: ctx(t, "拼多多", "SHOP-PDD"),
      object: { type: "price", id: "SKU-HM-2001", label: "折叠收纳箱 55L" },
      decision: {
        action: "price.parity.watch",
        after: { platform_low: "拼多多 ¥75", platform_ref: "天猫 ¥89", gap_pct: 0.157 },
        basis: ["剧情⑩：倒挂 15.7% > 15%（R18 倒挂告警）", "看门狗每 15 分钟巡检（tg-parity-15min）"],
      },
      rule_impact: [{ rule_id: "R18", version: FENCE_VERSION, result: "review" }],
      model_trace: mt("standard", false),
    },
    {
      event_id: fixId, who: agentWho("pdd-ops"), context: ctx(new Date(t.getTime() + 2 * 3_600_000), "拼多多", "SHOP-PDD"),
      object: { type: "price", id: "SKU-HM-2001" },
      decision: {
        action: "channel.parity.fixed",
        before: { price: 75 },
        after: { restored_price: 85, approved_by: "MEM-002" },
        basis: ["剧情⑩收口：运营总监批准恢复一致性定价", "检出→处置→结果三段留痕"],
      },
      rule_impact: [], links: [alertId], receipt: receipt(t, fixId),
    },
  ];
}
/** ⑪ 供应商交期延误 → 备货沙盘调整 */
function evSupplierDelay(t: Date): [TwinEvent, TwinEvent] {
  const alertId = nextId();
  const adjustId = nextId();
  approvalsToCreate.push({ eventId: adjustId, level: "review", title: "供应商延误 9 天：黑五备货沙盘调整请示", time: t });
  return [
    {
      event_id: alertId, who: agentWho("procurement-buyer"), context: ctx(t, "供应链"),
      object: { type: "supplier", id: "SUP-DG-011", label: "东莞锂威电子" },
      decision: {
        action: "supplier.delay.alert",
        after: { po: "PO-20260726-011", delay_days: 9, reason: "电芯原料到港延误", affected_sku: "SKU-3C-1001" },
        basis: ["剧情⑪：供应商交期延误，断货风险窗口重新测算"],
      },
      rule_impact: [], model_trace: mt("standard", false),
    },
    {
      event_id: adjustId, who: agentWho("demand-planner"), context: ctx(new Date(t.getTime() + 4 * 3_600_000), "供应链"),
      object: { type: "purchase_order", id: "PO-20260726-011" },
      decision: {
        action: "procurement.plan.adjust",
        after: { backup_supplier: "惠州恒芯能源", split_order: "3 万台拆 2:1 双源供货", cash_impact_cny: 380_000, stockout_risk: "从 8 天压回 3 天" },
        basis: ["剧情⑪：备货沙盘调整——双源供货 + 资金占用重算（cash-sandbox）"],
      },
      rule_impact: [{ rule_id: "R20", version: FENCE_VERSION, result: "review" }],
      links: [alertId], model_trace: mt("flagship", false),
    },
  ];
}
/** ⑫ 客服截图识别出产品批次缺陷 → 多模态→质检派单→召回评估（R28） */
function evBatchDefect(t: Date): [TwinEvent, TwinEvent, TwinEvent] {
  const shotId = nextId();
  const qcId = nextId();
  const recallId = nextId();
  approvalsToCreate.push({ eventId: recallId, level: "review", title: "批次缺陷召回评估：快充头 B2607 批次（R28）", time: t });
  return [
    {
      event_id: shotId, who: agentWho("cs-en"), context: ctx(t, "亚马逊", "SHOP-AMZ"),
      object: { type: "cs_session", id: `CS-${int(100000, 999999)}` },
      decision: {
        action: "cs.reply",
        after: { modality: "screenshot", multimodal: "买家截图：充电器报错页 + 机身批次码 B2607，视觉识别已解析", lang: "en", resolved: true },
        basis: ["剧情⑫：截图识别出批次共性缺陷线索（3 日内同批次第 5 起）"],
      },
      rule_impact: [], model_trace: mt("flagship", true),
    },
    {
      event_id: qcId, who: agentWho("mm-engineer"), context: ctx(new Date(t.getTime() + 1 * 3_600_000), "客服中台"),
      object: { type: "task", id: `QC-${int(1000, 9999)}`, label: "B2607 批次质检派单" },
      decision: {
        action: "quality.inspect.dispatch",
        after: { batch: "B2607", similar_cases_3d: 5, defect_hypothesis: "批次电容耐压不足致间歇断充", routed_to: "供应商质量工程师" },
        basis: ["剧情⑫：多模态理解管线聚合相似会话 → 质检派单"],
      },
      rule_impact: [], links: [shotId], model_trace: mt("standard", false),
    },
    {
      event_id: recallId, who: agentWho("service-qc"), context: ctx(new Date(t.getTime() + 5 * 3_600_000), "集团指挥层"),
      object: { type: "alert", id: `QC-B2607`, label: "B2607 批次召回评估" },
      decision: {
        action: "quality.recall.assess",
        after: { scope: "B2607 批次在途+在库 1.2 万件", proposal: "该批次主动换新 + 站内信通知，评价回复统一口径（不主动承认缺陷超质检结论）" },
        basis: ["剧情⑫：召回评估请示（R28 涉质量缺陷承认必审）"],
      },
      rule_impact: [{ rule_id: "R28", version: FENCE_VERSION, result: "review" }],
      links: [qcId], receipt: receipt(t, recallId), model_trace: mt("flagship", false),
    },
  ];
}
/** 周频：FAQ 萃取（kb-trainer） */
function evFaqMine(t: Date, topic: string, hits: number): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: agentWho("kb-trainer"), context: ctx(t),
    object: { type: "cs_session", id: "faq-kb" },
    decision: {
      action: "faq.mine",
      params: { topic, weekly_hits: hits },
      after: { candidate: true, pending_confirm: true },
      basis: [`「${topic}」本周被问 ${hits} 次未命中 → 进入知识库候选（运营总监确认入库）`],
    },
    rule_impact: [], model_trace: mt("standard", false),
  };
}
/** 周频：库龄与断货周报（overseas-warehouse，周一 04:00 触发器联动） */
function evWeeklyReport(t: Date): TwinEvent {
  const id = nextId();
  return {
    event_id: id, who: agentWho("overseas-warehouse"), context: ctx(t, "夜班"),
    object: { type: "warehouse", id: "weekly-stock-report" },
    decision: {
      action: "warehouse.weekly.report",
      after: { aged_over_60d_sku: int(3, 9), stockout_risk_sku: int(1, 4), fba_ipi: int(520, 640), turnover_days: 41 + int(0, 8) },
      basis: ["库龄与断货周报：11 仓网周转/库龄/IPI 全量投影"],
    },
    rule_impact: [],
  };
}

/* ================= 主流程 ================= */
async function main(): Promise<void> {
  const owner = new pg.Client({ connectionString: DATABASE_URL });
  await owner.connect();
  const ws = await owner.query(`SELECT id FROM workspaces WHERE id=$1`, [WS_ID]);
  if (ws.rowCount === 0) {
    throw new Error("未检测到种子数据：请先执行 pnpm db:seed，再运行 pnpm demo:twin");
  }
  PRESETS = loadPresets();
  console.log(`✓ 售前数字孪生启动：${DAYS} 天经营模拟（${START.toISOString().slice(0, 10)} 起，确定性种子）`);

  // —— 逐日生成事件 ——
  const events: Array<{ ev: TwinEvent; session: string | null }> = [];
  const push = (ev: TwinEvent, session: string | null = null) => events.push({ ev, session });

  for (let d = 0; d < DAYS; d++) {
    const dow = new Date(START.getTime() + d * 86_400_000).getDay();
    const weekend = dow === 5 || dow === 6;
    // 14 店铺日销节奏：周末系数（国内 1.3 / 跨境 1.1）× 大促脉冲（黑五跨境 ×4）× 随机扰动
    for (const shop of SHOP_MATRIX) {
      const weekFactor = weekend ? (shop.army === "国内军" ? 1.3 : 1.1) : 1;
      const factor = weekFactor * promoFactor(d, shop);
      const baseOrders = shop.army === "国内军" ? int(1, 3) : int(1, 2);
      const orders = Math.max(1, Math.round(baseOrders * factor));
      // 店铺经营快照（店铺矩阵看板/驾驶舱 KPI 数据源）
      const dayGmv = Math.round(orders * int(6, 14) * 1000 * factor * (shop.currency === "USD" ? 0.22 : 1));
      push({
        event_id: nextId(), who: { type: "system", id: "cockpit-daily" },
        context: ctx(at(d, 23, 55), shop.platform, shop.id),
        object: { type: "shop", id: shop.id, label: shop.name },
        decision: {
          action: "shop.daily.summary",
          after: {
            orders: orders * int(6, 14), gmv: dayGmv, currency: shop.currency,
            acos: Math.round((0.16 + rand() * 0.1) * 100) / 100, cs_sessions: orders * int(3, 6),
            ...(isPromo(d) && shop.army === "跨境军" ? { promo: "黑五峰值 ×4 脉冲" } : {}),
          },
          basis: ["当日订单/广告/客服聚合快照（店铺矩阵看板数据源）"],
        },
        rule_impact: [],
      });
      // 订单流（含跨境时区节律）
      for (let k = 0; k < orders; k++) push(evOrderCreate(at(d, shopHour(shop)), shop));
      // 客服会话流（跨境店夜班加密）
      const sessions = Math.max(1, Math.round(int(1, 2) * (isPromo(d) && shop.army === "跨境军" ? 3 : 1)));
      for (let k = 0; k < sessions; k++) push(evCsSession(at(d, shopHour(shop)), shop), "T-102");
      // 广告流水（在投店铺子集；夜班谷时批量作业）
      if (rand() < 0.6) push(evAdsAdjust(at(d, shop.army === "国内军" ? int(9, 18) : int(22, 23)), shop, shop.army !== "国内军"), "T-101");
      // 评价流（约 20% 差评挂审批）
      if (rand() < 0.55) {
        const bad = rand() < 0.2;
        const t = at(d, shopHour(shop));
        const ev = evReview(t, shop, bad);
        if (bad) approvalsToCreate.push({ eventId: ev.event_id, level: "review", title: `差评回复审批（R9 2h SLA）：${shop.platform}`, time: t });
        push(ev, "T-102");
      }
    }
    // 全链样板单 ×2/日：同一订单号贯穿 下单→出库→结算（穿透演示锚点）
    for (let k = 0; k < 2; k++) {
      const shop = pick(SHOP_MATRIX);
      const sku = pick(SKU_POOL);
      const od = `OD-${shop.id.slice(5)}-${880000 + d * 10 + k}`;
      const e1 = nextId();
      const qty = int(1, 3);
      const amount = Math.round(sku.price * qty * 100) / 100;
      push({
        event_id: e1, who: { type: "system", id: "platform-webhook" }, context: ctx(at(d, int(8, 12)), shop.platform, shop.id),
        object: { type: "order", id: od, label: sku.label },
        decision: { action: "order.create", after: { qty, amount, currency: "CNY" }, basis: ["全链样板单：下单"] },
        rule_impact: [],
      });
      const e2 = nextId();
      push({
        event_id: e2, who: agentWho("cn-warehouse"), context: ctx(at(d, 14, int(0, 59)), "仓储", shop.id),
        object: { type: "stock", id: sku.id, label: sku.label },
        decision: { action: "stock.outbound", after: { order_id: od, qty_out: qty, warehouse: pick(["东莞一仓", "义乌二仓", "杭州前置仓"] as const), balance_after: int(200, 9000) }, basis: ["全链样板单：出库 = 订单履约"] },
        rule_impact: [], links: [e1],
      });
      push({
        event_id: nextId(), who: agentWho("multi-reconciler"), context: ctx(at(d + 1, 11, int(0, 59)), shop.platform, shop.id),
        object: { type: "order", id: od },
        decision: { action: "order.settle", after: { settled: true, commission: Math.round(amount * 0.05 * 100) / 100, invoice_sent: true }, basis: ["全链样板单：平台结算 + 佣金勾稽 + 电子发票开出"] },
        rule_impact: [], links: [e2],
      });
    }
    // 库存流水：出库履约（消耗当日订单队列）+ 入库/调拨/FBA
    for (let k = 0; k < int(3, 5); k++) push(evStockOutbound(at(d, int(9, 17))));
    for (let k = 0; k < int(1, 2); k++) push(evStockInbound(at(d, int(9, 17))));
    // 售后流
    for (let k = 0; k < int(1, 2); k++) push(evRefund(at(d, int(9, 21))));
    // 调价：白班 R1 + 夜班 R17 微调
    push(evPriceAdjust(at(d, int(10, 16)), false), "T-103");
    push(evPriceAdjust(at(d, 23, int(0, 59)), true), "T-103");
    // 夜班：竞对/跟卖巡检 + 三方对账（每周一次留 0.3% 脏数据）+ 08:30 决策包
    push(evCompetitorFetch(at(d, 23, int(0, 30))));
    push(evReconcile(at(d, 23, int(31, 59)), d % 7 === 3));
    const pkg = evNightPackage(at(d + 1, 8, 30), d);
    nightPackages.push({
      day: d, runDate: fmtDate(d), eventId: pkg.event_id,
      done: (pkg.decision.after as { done: number }).done,
      pending: (pkg.decision.after as { pending: number }).pending,
      escalate: (pkg.decision.after as { escalate: number }).escalate,
    });
    push(pkg);
    // 内容营销：每 3 天一篇（短视频/笔记/AIGC 详情页）
    if (d % 3 === 1) push(evContentPublish(at(d, int(15, 20))), "T-103");
    // 黑五作战室日报（第 20–22 天）
    if (isPromo(d)) push(evWarRoomDashboard(at(d, 23, 59), d - 18));
    // 周频：FAQ 萃取 + 库龄周报 + 集团经营目标追踪（仪表盘数据源）
    if (d % 7 === 6) {
      push(evFaqMine(at(d, 3, 5), CS_TOPICS[Math.floor(d / 7) % CS_TOPICS.length] as string, int(3, 6)));
      push(evWeeklyReport(at(d, 4, 0)));
      const wk = Math.floor(d / 7) + 1;
      const gmvNow = int(72, 118) * 10000;
      push({
        event_id: nextId(), who: agentWho("biz-analyst"), context: ctx(at(d, 6, 0)),
        object: { type: "shop", id: WS_ID },
        decision: {
          action: "goal.tracking",
          params: { week: wk, month: "2026-08" },
          after: {
            gmv: { target_wan: 9200, actual_wan: Math.round(gmvNow / 10000), pace: gmvNow >= 92000000 * (wk / 4.3) ? "on_track" : "behind" },
            acos: { target: 0.22, actual: Math.round((0.18 + rand() * 0.08) * 100) / 100 },
            attribution: gmvNow < 90000000 ? ["竞对同类目降价事件 ×2", "拼多多倒挂分流（d5 已处置）"] : [],
          },
          basis: ["月目标 vs 时序进度比对，偏差超阈值自动归因（集团经营仪表盘）"],
        },
        rule_impact: [],
      });
    }
    // —— 12 个经营剧情在 30 天轴上的分布 ——
    if (d === 3) { const a = evStockoutAlert(at(d, 9, 40)); push(a); push(evUrgentProcurement(at(d, 11, 20), a.event_id)); }
    if (d === 4) { const [alert, fix] = evParityAlert(at(d, 14, 20)); push(alert); push(fix); }
    if (d === 5) push(evAcosDaily(at(d, 22, 10), 1, 0.31), "T-101");
    if (d === 6) push(evAcosDaily(at(d, 22, 10), 2, 0.34), "T-101");
    if (d === 7) { const a3 = evAcosDaily(at(d, 22, 10), 3, 0.38); push(a3, "T-101"); push(evAcosFuse(at(d, 23, 5), [a3.event_id]), "T-101"); }
    if (d === 9) { const [de, re, ge] = evLiveBadReview(at(d, 20, 12)); push(de, "T-102"); push(re, "T-102"); push(ge, "T-102"); }
    if (d === 11) { const [al, ev] = evHijackAlert(at(d, 2, 15)); push(al); push(ev); }
    if (d === 13) { const [al, as] = evFxVolatility(at(d, 9, 30)); push(al); push(as); }
    if (d === 15) push(evVatChange(at(d, 10, 0)));
    if (d === 16) push(evAgedStock(at(d, 4, 30)));
    if (d === 18) push(evWarRoomActivate(at(d, 9, 0)));
    if (d === 23) { const [al, ad] = evSupplierDelay(at(d, 10, 45)); push(al); push(ad); }
    if (d === 25) { const [s, q, r] = evBatchDefect(at(d, 1, 35)); push(s, "T-102"); push(q); push(r); }
  }

  // —— 事件落库（gateway 角色 + 哈希链 + 附录 E 校验） ——
  const gw = new pg.Client({ connectionString: GATEWAY_URL });
  await gw.connect();
  await gw.query("SELECT set_config('app.workspace_id', $1, false)", [WS_ID]);
  await gw.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_ID]);
  const last = await gw.query(`SELECT hash FROM biz_events WHERE tenant_id=$1 ORDER BY seq DESC LIMIT 1`, [TENANT_ID]);
  let prevHash = (last.rows[0]?.hash as string) ?? GENESIS_HASH;

  let inserted = 0, dup = 0;
  for (const { ev, session } of events) {
    const checked = safeParseBusinessEvent(ev);
    if (!checked.success) throw new Error(`孪生事件 ${ev.event_id} 未过附录 E 校验：${checked.error.message}`);
    const payload = JSON.stringify(checked.data);
    const hash = eventHash(prevHash, checked.data);
    const res = await gw.query(
      `INSERT INTO biz_events (event_id, tenant_id, workspace_id, session_id, payload, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, event_id) DO NOTHING RETURNING seq`,
      [ev.event_id, TENANT_ID, WS_ID, session, payload, prevHash, hash, ev.context.time],
    );
    if (res.rowCount && res.rowCount > 0) { prevHash = hash; inserted++; } else dup++;
  }
  console.log(`✓ 五元事件：新写入 ${inserted} 条，幂等丢弃 ${dup} 条（30 天 × 14 店铺 × 六条流水线 + 12 剧情）`);

  // —— 审批流（review/block 事件：多数已批准、最新 2 条 pending、1 条驳回） ——
  let aprInserted = 0;
  for (const [idx, a] of approvalsToCreate.entries()) {
    const status = idx >= approvalsToCreate.length - 2 ? "pending" : idx === 3 ? "rejected" : "approved";
    const res = await gw.query(
      `INSERT INTO approvals (approval_id, tenant_id, workspace_id, event_id, channel, status, gesture, snapshot, decided_by, decided_at)
       VALUES ($1,$2,$3,$4,'inapp',$5,$6,$7,$8,$9)
       ON CONFLICT (event_id, channel) DO NOTHING`,
      [
        `apr-${a.eventId.toLowerCase()}`, TENANT_ID, WS_ID, a.eventId, status,
        status === "pending" ? null : JSON.stringify(status === "approved" ? { type: "approve", weight: 1 } : { type: "reject", weight: 1, reason: "补偿超档案口径，退回重拟" }),
        JSON.stringify({ title: a.title, level: a.level }),
        status === "pending" ? null : "MEM-002",
        status === "pending" ? null : iso(new Date(a.time.getTime() + int(20, 120) * 60_000)),
      ],
    );
    aprInserted += res.rowCount ?? 0;
  }
  console.log(`✓ 审批流 ×${aprInserted}（含 pending ×2 / rejected ×1：演示三手势与驳回回流）`);

  // —— 补盲 ①：night_runs ×30（夜班驾驶舱的表格投影，与决策包事件一一对应） ——
  let nrInserted = 0;
  for (const np of nightPackages) {
    const res = await owner.query(
      `INSERT INTO night_runs (id, workspace_id, run_date, status, fence_snapshot_version, candidate_count, stats, started_at, package_event_id)
       VALUES ($1,$2,$3,'package_generated',$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        `nr-${np.runDate}`, WS_ID, np.runDate, FENCE_VERSION, int(3, 5),
        JSON.stringify({ done: np.done, pending: np.pending, escalate: np.escalate, credits: int(7, 11) }),
        iso(new Date(START.getTime() + np.day * 86_400_000 + 22 * 3_600_000)),
        np.eventId,
      ],
    );
    nrInserted += res.rowCount ?? 0;
  }
  console.log(`✓ 夜班班次表 ×${nrInserted}（30 天 package_generated，快照 ${FENCE_VERSION}）`);

  // —— 补盲 ②：组织记忆 ×8 + 使用归因（经验资产化的可见证据） ——
  const evIdBy = async (action: string, limit: number) => {
    const r = await gw.query(
      `SELECT event_id FROM biz_events WHERE tenant_id=$1 AND workspace_id=$2 AND payload->'decision'->>'action'=$3 ORDER BY seq LIMIT $4`,
      [TENANT_ID, WS_ID, action, limit],
    );
    return r.rows.map((x: { event_id: string }) => x.event_id);
  };
  const priceIds = await evIdBy("price.adjust", 5);
  const reviewIds = await evIdBy("review.reply", 5);
  const csIds = await evIdBy("cs.reply", 5);
  const reconIds = await evIdBy("settlement.reconcile", 3);
  const memories = [
    { id: "mem-pat-weekend-3c", scope: "workspace", kind: "pattern", conf: 0.86, content: "3C 配件周末转化率显著高于平日（30 天订单分布），建议周五 10:00 前完成周末调价布局", src: priceIds.slice(0, 3) },
    { id: "mem-pat-night-cs", scope: "workspace", kind: "pattern", conf: 0.82, content: "跨境店会话高峰在北京时间 22:00–02:00（欧美白天），夜班班组托管解决率 82%，零排队", src: csIds.slice(0, 3) },
    { id: "mem-sop-review-apology", scope: "workspace", kind: "sop", conf: 0.9, content: "差评致歉结构 v2：共情→核实→整改→邀约回流；禁用「全网最低/百分百满意」等档案外承诺（R9 2h SLA）", src: reviewIds.slice(0, 3) },
    { id: "mem-sop-acos-fuse", scope: "workspace", kind: "sop", conf: 0.78, content: "利润保险丝 SOP：ACoS 连续 3 天 > 盈亏平衡点 → 自动降预算 30% → 请示运营总监 → 复盘关键词结构", src: reconIds.slice(0, 2) },
    { id: "mem-pref-owner-pricing", scope: "agent", kind: "preference", conf: 0.75, content: "董事长调价偏好：大促提前 3 天布局、单次降价 ≤8% 为宜、毛利红线 x1.15 不放行", src: priceIds.slice(0, 2) },
    { id: "mem-pat-faq-topics", scope: "workspace", kind: "pattern", conf: 0.88, content: "买家咨询 TOP3：充电宝上飞机/物流时效/跨境关税，占会话 55%+，知识库命中即答", src: csIds.slice(2, 5) },
    { id: "mem-pat-fba-replenish", scope: "workspace", kind: "pattern", conf: 0.7, content: "FBA-美西补货提前期 35 天口径偏紧，黑五前 IPI 波动大，建议安全库存上浮至 18 天", src: reconIds.slice(1, 3) },
    { id: "mem-sop-hijack-triage", scope: "workspace", kind: "sop", conf: 0.84, content: "跟卖处置纪律：夜间巡检发现 → 截图/test buy 取证 → 品牌驱赶函请示（R19）→ 复盘 Listing 护城河", src: reviewIds.slice(3, 5) },
  ];
  let memInserted = 0;
  for (const m of memories) {
    const res = await owner.query(
      `INSERT INTO org_memory (memory_id, tenant_id, workspace_id, scope, kind, content, source_events, confidence, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') ON CONFLICT (memory_id) DO NOTHING`,
      [m.id, TENANT_ID, WS_ID, m.scope, m.kind, m.content, m.src, m.conf],
    );
    memInserted += res.rowCount ?? 0;
    for (const evId of m.src.slice(0, 2)) {
      await owner.query(`INSERT INTO memory_usage (memory_id, event_id, workspace_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [m.id, evId, WS_ID]);
    }
  }
  console.log(`✓ 组织记忆 ×${memInserted}（pattern/sop/preference，来源事件可归因）`);

  // —— 补盲 ③：fence_dry_runs ×3（围栏演进史：2 confirmed / 1 rejected，含单调守卫驳回样本） ——
  const dryRuns = [
    { id: "dr-r3-tighten", rule: "R3", ver: "ecom-patch/v-next", status: "confirmed", report: { replayed: 30, would_block: 0, would_review: 2, impact: "ACoS 连续越限 3 天→2 天收紧：回放 30 条广告事件，2 条提前转入必审，无误伤" } },
    { id: "dr-r18-parity", rule: "R18", ver: FENCE_VERSION, status: "confirmed", report: { replayed: 30, would_block: 0, would_review: 3, impact: "倒挂阈值 15%→12% 预演：回放 30 条价格巡检，3 条历史倒挂将告警（d5 已实证）" } },
    { id: "dr-r1-loosen", rule: "R1", ver: "draft-loosen-15pct", status: "rejected", report: { replayed: 30, would_block: 0, would_review: 5, impact: "单日降价上限 10%→15% 放宽提案：单调守卫拒绝（基线只可收紧），运营总监驳回留痕" } },
  ];
  let drInserted = 0;
  for (const dr of dryRuns) {
    const res = await owner.query(
      `INSERT INTO fence_dry_runs (id, workspace_id, rule_id, rule_version, report, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'MEM-002') ON CONFLICT (id) DO NOTHING`,
      [dr.id, WS_ID, dr.rule, dr.ver, JSON.stringify(dr.report), dr.status],
    );
    drInserted += res.rowCount ?? 0;
  }
  console.log(`✓ 围栏 dry-run 报告 ×${drInserted}（含单调守卫驳回样本：只紧不松可演示）`);

  // —— 补盲 ④：托管客户工作区 ×2（owner-cockpit 多客户驾驶舱的数据基础） ——
  const managedClients = [
    { id: "ws-yunlu", name: "云鹿家居（托管客户）", slug: "yunlu-home", shops: 5, platforms: 3, gmv: "1.2亿 RMB/年", dailyOrders: 900, currency: "CNY" },
    { id: "ws-jingluo", name: "鲸落户外（托管客户）", slug: "jingluo-outdoor", shops: 3, platforms: 2, gmv: "3000万 USD/年", dailyOrders: 1500, currency: "USD" },
  ];
  for (const s of managedClients) {
    await owner.query(
      `INSERT INTO workspaces (id, tenant_id, name, slug, industry, stage) VALUES ($1,$2,$3,$4,'ecommerce','stable')
       ON CONFLICT (id) DO NOTHING`,
      [s.id, TENANT_ID, s.name, s.slug],
    );
    await owner.query(
      `INSERT INTO profiles (workspace_id, tenant_id, industry, archive, forbidden, pii_vault)
       VALUES ($1,$2,'ecommerce',$3,$4,NULL) ON CONFLICT (workspace_id) DO NOTHING`,
      [s.id, TENANT_ID, JSON.stringify({ property: { name: s.name, city: "深圳", shops: s.shops, platforms: s.platforms, segment: "managed_client", gmv: s.gmv } }),
       JSON.stringify([{ rule: "全店售价不低于成本×1.15（毛利红线）", scope: "price" }])],
    );
  }
  // 托管客户轻量事件：每日经营快照 + 夜班决策包（驾驶舱 KPI 与 digest 数据源）
  // 哈希链为「每工作区独立链」（verify-chain 按 ws 分组验证）：托管客户事件从各自链尾/GENESIS 续接
  let cliInserted = 0;
  for (const s of managedClients) {
    await gw.query("SELECT set_config('app.workspace_id', $1, false)", [s.id]);
    const cliTail = await gw.query(`SELECT hash FROM biz_events WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY seq DESC LIMIT 1`, [TENANT_ID, s.id]);
    let cliPrev = (cliTail.rows[0]?.hash as string) ?? GENESIS_HASH;
    for (let d = 0; d < DAYS; d++) {
      const dayOrders = Math.round(s.dailyOrders * (1 + (rand() - 0.5) * 0.3) * (isPromo(d) ? 2.5 : 1));
      const evs: TwinEvent[] = [
        {
          event_id: nextId(), who: { type: "system", id: "cockpit-daily" }, context: ctx(at(d, 23, 55)),
          object: { type: "shop", id: s.id, label: s.name },
          decision: {
            action: "shop.daily.summary",
            after: { orders: dayOrders, gmv: dayOrders * int(60, 140), currency: s.currency, shops: s.shops },
            basis: ["当日订单/收款聚合快照（多客户驾驶舱 KPI 数据源）"],
          },
          rule_impact: [],
        },
        {
          event_id: nextId(), who: { type: "system", id: "night-shift" }, context: ctx(at(d + 1, 8, 30), "夜班"),
          object: { type: "shift", id: `nr-${s.id}-${fmtDate(d)}` },
          decision: {
            action: "night.package.deliver",
            after: { done: int(4, 9), pending: int(0, 2), escalate: d % 11 === 0 ? 1 : 0, fence_snapshot: FENCE_VERSION },
            basis: ["夜班班组三段投影（✓已完成/◆待审批/▲需介入）"],
          },
          rule_impact: [],
        },
      ];
      for (const ev of evs) {
        const checked = safeParseBusinessEvent(ev);
        if (!checked.success) throw new Error(`托管客户事件 ${ev.event_id} 未过校验：${checked.error.message}`);
        const payload = JSON.stringify(checked.data);
        const hash = eventHash(cliPrev, checked.data);
        const res = await gw.query(
          `INSERT INTO biz_events (event_id, tenant_id, workspace_id, session_id, payload, prev_hash, hash, created_at)
           VALUES ($1,$2,$3,NULL,$4,$5,$6,$7)
           ON CONFLICT (tenant_id, event_id) DO NOTHING RETURNING seq`,
          [ev.event_id, TENANT_ID, s.id, payload, cliPrev, hash, ev.context.time],
        );
        if (res.rowCount && res.rowCount > 0) { cliPrev = hash; cliInserted++; }
      }
    }
  }
  await gw.query("SELECT set_config('app.workspace_id', $1, false)", [WS_ID]);
  console.log(`✓ 托管客户工作区 ×2（云鹿家居 5 店国内型 / 鲸落户外 3 店跨境型）· 驾驶舱事件 ×${cliInserted}`);

  // —— FAQ 知识库生长结果回写集团一档（萃取产物可见） ——
  const prof = await owner.query(`SELECT archive FROM profiles WHERE workspace_id=$1`, [WS_ID]);
  const archive = prof.rows[0]?.archive as Record<string, unknown>;
  if (archive) {
    const faqKb = (archive.faq_kb ?? {}) as Record<string, unknown>;
    faqKb.last_mined_at = iso(at(DAYS - 1, 3, 5));
    faqKb.pending_candidates = [
      { q: "20000mAh 充电宝能托运吗", weekly_hits: 5, source_session_ids: ["cs-30012", "cs-30088", "cs-30145"], confirmed: false },
      { q: "欧盟 EPR 包装法要买家做什么", weekly_hits: 4, source_session_ids: ["cs-30031", "cs-30102"], confirmed: false },
    ];
    archive.faq_kb = faqKb;
    await owner.query(`UPDATE profiles SET archive=$2, updated_at=now() WHERE workspace_id=$1`, [WS_ID, JSON.stringify(archive)]);
    console.log("✓ FAQ 知识库生长回写（候选 ×2 待运营总监确认，来源会话可归因）");
  }

  // —— 验收：回读本批事件逐条过 zod ——
  const ids = events.map((x) => x.ev.event_id);
  const check = await gw.query(
    `SELECT payload FROM biz_events WHERE tenant_id=$1 AND workspace_id=$2 AND event_id = ANY($3::text[])`,
    [TENANT_ID, WS_ID, ids],
  );
  let valid = 0;
  for (const row of check.rows) if (safeParseBusinessEvent(row.payload).success) valid++;
  const rate = check.rowCount ? valid / check.rowCount : 0;
  console.log(`✓ 验收：回读 ${check.rowCount} 条，五元完整 ${valid} 条，完整率 ${(rate * 100).toFixed(1)}%`);
  if (rate !== 1) throw new Error("验收失败：五元完整率未达 100%");

  // —— P0-3 收尾：全局事件号序列推进到本批最大编号之后（只前进不后退，与 0013 迁移同口径） ——
  // 本脚本事件走 E-20001+ 区段直插（演示批量生成），不入网关分配通道；
  // 不推进序列的话 verify-chain 会把 E-<n> 判为「绕过序列分配」。
  await owner.query(
    `SELECT setval('biz_events_eid_seq',
       GREATEST((SELECT COALESCE(MAX(substring(event_id from '^E-(\\d+)$')::bigint), 0) + 1 FROM biz_events), 9101), false)`,
  );
  console.log("✓ 全局事件号序列已推进（P0-3 分配区间覆盖演示事件段）");

  await gw.end();
  await owner.end();
  console.log("数字孪生完成 ✅（熊猫优选集团 30 天经营态就绪：pnpm demo:twin:snapshot 可导出快照）");
}

main().catch((err) => {
  console.error("孪生模拟失败：", err?.message ?? err);
  process.exit(1);
});
