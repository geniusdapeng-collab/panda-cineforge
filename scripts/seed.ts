/**
 * A5 · 演示种子数据（PRD V2.5 P 章示例场景：熊猫优选集团）
 * 用法：pnpm db:seed（读取 .env；幂等，可重复执行）
 *
 * 内容：demo 租户 / 熊猫优选集团工作区 / 3 人类成员（创始人·董事长/运营总监/财务总监）/ 81 Agent preset 实例 /
 *      集团一档 + 14 店铺档案（含 forbidden 硬约束 + 价格带/毛利红线/广告红线/客服SLA 字段组）/
 *      基线围栏 R1–R30（ecom-baseline/v1）装载 / 160 官方技能 /
 *      10 触发器 / 昨夜夜班班次 / 100 条五元事件（哈希链，含 5 条经营剧情链 + 勾稽约束）/ 审批样例 / 组织记忆
 *
 * 纪律：
 *  - 事件只经 workloom_gateway 角色写入（F1.2），其余表走 owner 种子连接（D10）；
 *  - 每条事件写入前过 safeParseBusinessEvent（附录 E 校验）；
 *  - 幂等：组织模型 ON CONFLICT DO NOTHING；事件 UNIQUE(tenant_id,event_id) 冲突丢弃（L1.4）；
 *  - 验收：写入后回读 100 条事件逐条过 zod，五元字段完整率必须 100%（附录 H-1）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import YAML from "yaml";
import { safeParseReplayAwareEvent } from "@workloom/base/workdata";
import { eventHash as _eh } from "@workloom/base/workdata";
// #32 修复：哈希链统一生产口径（events.ts 的 canonicalJson/eventHash）——
// 此前种子用 JSON.stringify 键序算哈希，与生产 canonicalJson 口径不一致，
// 种子 100 条事件用生产验证器重算全部不符（链上两种算法混杂）
import { eventHash } from "@workloom/base/workdata";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const BUNDLE_DIR = join(REPO_ROOT, "bundles/ecommerce");

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:workloom@localhost:5432/workloom";
const GATEWAY_URL =
  process.env.DATABASE_GATEWAY_URL ??
  "postgres://workloom_gateway:workloom_dev_gateway@localhost:5432/workloom";

/* ================= 固定演示标识（幂等键） ================= */

const TENANT_ID = "tenant-demo";
const TENANT_NAME = "演示租户（Demo）";
const WS_ID = "ws-yunqi";
const WS_NAME = "熊猫优选集团";
const WS_SLUG = "panda-group";
const FENCE_VERSION = "ecom-baseline/v1"; // 与 bundles/ecommerce/fences/ecom-baseline.yml 的 version 一致

const MEMBERS = [
  { id: "MEM-001", name: "周正邦（创始人·董事长）", role: "owner" },
  { id: "MEM-002", name: "林晓薇（运营总监）", role: "manager" },
  { id: "MEM-003", name: "赵启铭（财务总监）", role: "readonly" },
] as const;

const EVENT_BASE = 8800; // 事件编号 E-8801 起（PRD 展示口径）
const EVENT_COUNT = 100;
const GENESIS_HASH = "GENESIS";

/* ================= 工具 ================= */

/** 确定性伪随机（mulberry32）：演示数据可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260816);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));

function iso(d: Date): string {
  return d.toISOString();
}

/** 演示时间轴：昨天 00:00 到今天现在；夜班段额外加密（22:00–08:30，F4.1） */
function demoTimeline(): Date[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const span = now.getTime() - start.getTime();
  const times: Date[] = [];
  for (let i = 0; i < EVENT_COUNT; i++) {
    // 60% 落在夜班窗口（昨晚 22:00 → 今 08:30），40% 全天均匀
    let t: number;
    if (i % 5 < 3) {
      const nightStart = new Date(start); nightStart.setHours(22, 0, 0, 0);
      const nightEnd = new Date(start); nightEnd.setDate(nightEnd.getDate() + 1); nightEnd.setHours(8, 30, 0, 0);
      t = nightStart.getTime() + rand() * (nightEnd.getTime() - nightStart.getTime());
    } else {
      t = start.getTime() + rand() * span;
    }
    times.push(new Date(t));
  }
  times.sort((a, b) => a.getTime() - b.getTime());
  return times;
}

/* ================= Bundle 资产读取 ================= */

interface Preset {
  preset_key: string;
  name: string;
  version: string;
  kind: string;
  description: string;
  readonly: boolean;
  night_shift: boolean;
  high_risk: boolean;
  fence_bindings: string[];
  skills: string[];
  tools: Array<{ name: string; access: string; desc: string }>;
  prompt: unknown;
  write_back: string[];
}

function loadPresets(): Preset[] {
  const dir = join(BUNDLE_DIR, "presets");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .sort()
    .map((f) => YAML.parse(readFileSync(join(dir, f), "utf-8")) as Preset);
}

interface FenceRule {
  rule_id: string;
  name: string;
  level: "auto" | "review" | "block";
  is_baseline: boolean;
  match: { object_types: string[]; actions: string[] };
  when: string;
  note?: string;
}

function loadFences(): FenceRule[] {
  const doc = YAML.parse(readFileSync(join(BUNDLE_DIR, "fences/ecom-baseline.yml"), "utf-8"));
  return (doc?.rules ?? []) as FenceRule[];
}

interface SkillDoc {
  name: string;
  description: string;
  body: string;
  fenceBindings: string[];
}

function loadSkills(): SkillDoc[] {
  const dir = join(BUNDLE_DIR, "skills");
  return readdirSync(dir)
    .sort()
    .map((d) => {
      const raw = readFileSync(join(dir, d, "SKILL.md"), "utf-8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const fm = YAML.parse(m?.[1] ?? "{}");
      const bindMap: Record<string, string[]> = {
        "revenue-manager": ["R1", "R2", "R7", "R8"],
        "review-crisis": ["R6"],
        "channel-reconciler": ["R4", "R5"],
        "inspection-suite": [],
        "night-audit-suite": ["R5"],
        "checkin-checkout": ["R4", "R14"],
        "customer-service": ["R13"],
        "content-marketing": ["R3", "R15"],
        "retention-manager": ["R9"],
        "inventory-procurement": ["R11"],
        "staff-scheduler": ["R12"],
        "safety-compliance": ["R10"],
        "finance-reporting": [],
        "morning-briefing": [],
        "handover-manager": [],
        "pricing-matrix": ["R1", "R2"],
        "review-asset-mining": [],
        "room-service-dispatch": ["R14"],
        "maintenance-dispatch": [],
        "ai-live-assistant": ["R15", "R2"],
        "ota-operations": [],
        "guest-profile-crm": [],
        "phone-concierge": ["R9", "R13"],
        "overbooking-parity-guard": ["R17", "R18", "R2"],
        "incident-postmortem": ["R10"],
      };
      return {
        name: String(fm.name ?? d),
        description: String(fm.description ?? ""),
        body: (m?.[2] ?? "").trim(),
        fenceBindings: bindMap[String(fm.name ?? d)] ?? [],
      };
    });
}

/** 14 店铺矩阵主数据（升级计划 §四 4.1：13 平台、国内军 8 店 + 跨境军 6 店） */
const SHOP_MATRIX = [
  { id: "SHOP-TMALL", name: "熊猫优选天猫旗舰店", platform: "天猫", category: "3C数码配件", currency: "CNY", army: "国内军", gmv: "28亿 RMB", site: "cn" },
  { id: "SHOP-JD", name: "熊猫优选京东自营店", platform: "京东", category: "3C数码配件", currency: "CNY", army: "国内军", gmv: "19亿 RMB", site: "cn" },
  { id: "SHOP-PDD", name: "熊猫智选拼多多店", platform: "拼多多", category: "家居日用", currency: "CNY", army: "国内军", gmv: "11亿 RMB", site: "cn" },
  { id: "SHOP-DOUYIN", name: "熊猫严选抖音店", platform: "抖音电商", category: "3C+家居（直播为主）", currency: "CNY", army: "国内军", gmv: "16亿 RMB", site: "cn" },
  { id: "SHOP-KUAISHOU", name: "熊猫生活快手店", platform: "快手", category: "家居日用", currency: "CNY", army: "国内军", gmv: "6亿 RMB", site: "cn" },
  { id: "SHOP-XHS", name: "熊猫美学小红书店", platform: "小红书", category: "设计家居", currency: "CNY", army: "国内军", gmv: "4亿 RMB", site: "cn" },
  { id: "SHOP-SPH", name: "熊猫优选视频号小店", platform: "视频号", category: "全品类", currency: "CNY", army: "国内军", gmv: "3亿 RMB", site: "cn" },
  { id: "SHOP-TMALLG", name: "PandaHome 天猫国际店", platform: "天猫国际", category: "进口家居", currency: "CNY", army: "国内军", gmv: "15亿 RMB", site: "cn" },
  { id: "SHOP-AMZ", name: "PandaTech", platform: "亚马逊", category: "3C配件", currency: "USD", army: "跨境军", gmv: "21亿 USD", site: "us/eu/jp" },
  { id: "SHOP-TEMU", name: "PandaHome", platform: "Temu", category: "家居", currency: "USD", army: "跨境军", gmv: "9亿 USD", site: "us" },
  { id: "SHOP-TTS", name: "PandaLife", platform: "TikTok Shop", category: "家居好物", currency: "USD", army: "跨境军", gmv: "8亿 USD", site: "us/sea" },
  { id: "SHOP-SHOPEE", name: "PandaSelect", platform: "Shopee", category: "3C+家居", currency: "USD", army: "跨境军", gmv: "6亿 USD", site: "sea" },
  { id: "SHOP-AE", name: "PandaGlobal", platform: "速卖通", category: "全品类", currency: "USD", army: "跨境军", gmv: "5亿 USD", site: "global" },
  { id: "SHOP-DTC", name: "panda-home.com", platform: "Shopify", category: "品牌站", currency: "USD", army: "跨境军", gmv: "4亿 USD", site: "us/eu" },
] as const;

/** 单店档案：按 archive.schema.json 字段组生成（价格带/毛利红线/广告红线/客服SLA/forbidden） */
function shopArchive(s: (typeof SHOP_MATRIX)[number]): Record<string, unknown> {
  const cny = s.currency === "CNY";
  const unit = cny ? "¥" : "$";
  // 价格带与广告红线按平台特性分档（国内付费占比低→高：拼多多 15% / 抖音 45%；跨境亚马逊广告占比 25%）
  const band: Record<string, [number, number]> = cny
    ? { "3C数码配件": [29, 299], "家居日用": [19, 199], "设计家居": [99, 899] }
    : { "3C配件": [9.99, 59.99], "家居": [14.99, 89.99], "品牌站": [19.99, 129.99] };
  return {
    shop_profile: {
      name: s.name, platform: s.platform, site: s.site, category: s.category,
      segment: "global_group", open_date: "2023-03-18", shop_new: false,
    },
    platform_credential_ref: { ref_key: `panda/${s.id.toLowerCase()}`, vault: "kms://workloom-demo" },
    business: {
      price_bands: band,
      margin_floor: 1.15, // R2 毛利红线熔断同源
      floor_price: cny ? { "SKU-3C-1001": 69, "SKU-HM-2001": 39 } : { "SKU-3C-1001": 12.99, "SKU-HM-2001": 9.99 },
      refund_policy: cny
        ? { no_reason_days: 7, freight_insurance: true, refund_review_cny: 1000 }
        : { no_reason_days: 30, returnless_refund_usd: 25, refund_review_usd: 200 },
    },
    ads_guardrail: {
      daily_budget_cap: cny ? 300_000 : 40_000, // R4 同源
      acos_breakeven: cny ? 0.22 : 0.28, // R3 利润保险丝同源（分 SKU 盈亏平衡 ACoS）
      promo_budget_tier: "T2",
    },
    inventory_params: {
      safety_stock_days: 14, lead_time_days: cny ? 7 : 35,
      turnover_days_cap: 60, stockout_alert_days: 7, test_order_cap: 500,
    },
    cs_sla: {
      first_response_sec: cny ? 30 : 120, bad_review_sla_hours: 2, // R9 差评 2h SLA 同源
      escalation_keywords: ["投诉工商", "律师", "曝光", "315", "lawsuit", "lawyer"], // R12 同源
      languages: cny ? ["zh"] : ["en", "es", "de", "ja"], night_trusteeship: !cny, // 跨境店夜班托管
    },
    compliance_zone: {
      banned_words: ["最低价全网保证", "百分百治愈", "fda approved"],
      ip_registry: ["PandaTech®", "PandaHome®", "熊猫优选®"],
      qualification: cny ? "3C 认证齐全" : "CE/FCC/UL 认证齐全，EPR 已注册",
    },
    approval_matrix: cny
      ? { refund_review_threshold: 1000, procurement_review_cny: 100_000, procurement_l4_cny: 1_000_000, compensation: "review_only", night_high_risk: "block" }
      : { refund_review_threshold_usd: 200, procurement_review_usd: 20_000, procurement_l4_usd: 100_000, compensation: "review_only", night_high_risk: "block" },
    forbidden: cny
      ? [
          { rule: `${s.platform} 全店售价不低于成本×1.15（毛利红线）`, scope: "price" },
          { rule: "不承诺档案之外的赔偿金额与免费赠品", scope: "cs" },
        ]
      : [
          { rule: `亚马逊 US 站 3C 类目不低于 $9.99`, scope: "price" },
          { rule: "不承诺 returnless refund 超过 $25", scope: "aftersale" },
        ],
  };
}

/** 集团一档 + 14 店铺档案（bundles/ecommerce/schemas/archive.schema.json 对齐） */
function pandaArchive(): Record<string, unknown> {
  const shops = SHOP_MATRIX.map((s) => ({ shop_id: s.id, army: s.army, ...shopArchive(s) }));
  return {
    // —— 顶层兼容键（底座/前端消费：property/charter/business/goals/inspection/forbidden） ——
    property: { name: WS_NAME, city: "深圳", shops: 14, platforms: 13, segment: "global_group", erp_vendor: "示例ERP" },
    // 数字CEO 宪章（D21，演示：董事长已完成深度授权 → 试用期第 2 天）
    charter: {
      version: 1,
      mode: "trial",
      identity: { name: "公司CEO", persona: "稳健经营型" },
      autonomy: { price_band: [0.85, 1.15], procurement_cap: 100_000, campaign_cap: 50_000 },
      escalate: ["修改毛利红线/安全禁区相关", "单月累计让利超上限", "围栏规则放宽（任何放宽）", "新平台/新站点上线", "对外公开承诺（赔偿/召回/声明）", "采购 ≥$10 万（R20 升 L4）", "宪章变更"],
      briefing: { daily: "08:30", weekly: "Mon 09:00", monthly: "1st 10:00", channel: "both" },
      circuit_breaker: { window_days: 14, kpi_floor: { margin_rate: 0.13, acos: 0.28 }, tightened: false },
      grant: {
        event_id: "E-SEED-GRANT01", granted_by: "MEM-001",
        granted_at: new Date(Date.now() - 9 * 86400e3).toISOString(),
        disclosure_version: "risk-v1",
        clauses: ["自主调价", "自主采购（限额内）", "自主广告调优", "自主对外回复", "试用降档规则", "AI 非法律责任主体·授权人承担经营决策责任"],
        shadow_days: 3, trial_days: 7,
        trial_ends_at: new Date(Date.now() + 5 * 86400e3).toISOString(),
        retain_until: null,
      },
      updated_at: new Date().toISOString(),
    },
    brand_guideline: {
      tone: "真诚克制，不夸大功效、不承诺档案外补偿",
      banned_words: ["最低价全网保证", "百分百满意", "fda approved"],
      image_rules: "首图白底实拍、无水印、1:1 或 3:4；A+ 页面品牌故事统一模板",
      live_rules: "直播口播不承诺最低价，涉费承诺一律挂起人审（R21）",
    },
    // 集团经营基线（槽①汇总口径；分店明细见 shops[]）
    business: {
      price_bands: { "3C数码配件": [29, 299], "家居日用": [19, 199], "设计家居": [99, 899] },
      margin_floor: 1.15,
      floor_price: { "SKU-3C-1001": 69, "SKU-HM-2001": 39 },
      commission_rules: { "天猫": 0.05, "京东": 0.08, "拼多多": 0.03, "抖音电商": 0.05, "亚马逊": 0.15, "Temu": 0.10, "Shopify": 0.02 },
      refund_policy: { no_reason_days: 7, cross_border_days: 30 },
    },
    // —— 集团一档（schemas 集团层字段组） ——
    group_budget: {
      year_gmv_target: { cny: 102e8, usd: 53e8 },
      month_2026_08: { gmv_cny: 9.2e8, ad_spend_cny: 7800e4, note: "暑期+黑五备货双节奏" },
      ad_budget_pools: { 国内军: 160e4, 跨境军: 100e4, unit: "cny_per_day" }, // 日耗 260 万元口径
      procurement_l4_line_usd: 100_000, // R20 ≥$10 万升 L4 同源
    },
    group_org: {
      digital_army_size: 81, structure: "1+2+N：指挥层 4 / 共享中台 27 / 国内军 26 / 跨境军 24",
      human_members: ["MEM-001 董事长", "MEM-002 运营总监", "MEM-003 财务总监"],
      night_shift: "夜班班组主攻跨时区（美东/欧洲白天 = 北京 22:00-08:30）",
    },
    fx_settlement: {
      currencies: ["CNY", "USD", "EUR", "JPY", "GBP"], // 5 币种月结对账
      settlement_paths: { USD: "PingPong→招行离岸", EUR: "万里汇→中行", JPY: "连连→招行" },
      fx_reprice_threshold: 0.02, // R14 汇率波动 >2% 触发重定价同源
      hedge_policy: "30% 自然对冲 + 远期锁汇",
    },
    tax_vat_profile: {
      vat_registrations: ["UK", "DE", "FR", "IT", "ES", "PL", "CZ", "JP", "US sales tax"], // 9 国税号
      epr: "德法包装法/WEEE 已注册", duty_basis: "DDP 为主",
    },
    // —— 世界观主数据（§五 第 1 步） ——
    product_matrix: {
      brands: ["熊猫优选（大众3C）", "熊猫美学（设计家居）", "PandaTech（海外3C）", "PandaHome（海外家居）"],
      spu: 1900, sku: 8600, sku_cn: 5200, sku_cross: 3400,
      hero_skus: ["SKU-3C-1001 磁吸充电宝", "SKU-HM-2001 折叠收纳箱", "SKU-DS-3001 原木置物架"],
      lifecycle: { launch: 0.15, growth: 0.20, burst: 0.08, stable: 0.35, decline: 0.15, clearance: 0.07 },
    },
    warehouses: {
      cn: ["东莞一仓", "义乌二仓", "深圳保税仓", "杭州前置仓"],
      overseas: ["美东", "美西", "德国", "波兰", "日本", "英国", "澳洲"], fba: true,
      stock_value_cny: 11.3e8,
    },
    logistics: { cn_express: ["顺丰", "中通", "极兔"], forwarders: 18, overseas_last_mile: ["UPS", "DHL", "Yamato"] },
    suppliers: [
      { name: "东莞锂威电子", kind: "3C", terms_days: 60, backup: false, score: 4.6 },
      { name: "义乌恒洁家居", kind: "家居日用", terms_days: 45, backup: false, score: 4.3 },
      { name: "佛山木语设计工坊", kind: "设计家居", terms_days: 90, backup: true, score: 4.8 },
      { name: "深圳芯联科技", kind: "3C", terms_days: 30, backup: true, score: 4.1 },
    ],
    competitors: [
      { name: "倍思科技", platforms: ["天猫", "京东", "亚马逊"], price_band: [39, 259] },
      { name: "Anker", platforms: ["亚马逊", "Shopify"], price_band: [15.99, 69.99] },
      { name: "网易严选", platforms: ["天猫", "抖音电商"], price_band: [29, 399] },
    ],
    audience: { 价格敏感型: 0.42, 品质家庭: 0.33, 数码发烧友: 0.15, 海外中产: 0.10 },
    history_curve: {
      "2026-06": { gmv_cny: 8.6e8, margin_rate: 0.156, acos: 0.21, turnover_days: 42 },
      "2026-07": { gmv_cny: 9.0e8, margin_rate: 0.151, acos: 0.23, turnover_days: 45 },
      "2026-08": { gmv_cny: 9.2e8, margin_rate: 0.148, acos: 0.24, turnover_days: 44 },
    },
    account_health: { odr: 0.008, late_shipment_rate: 0.012, valid_tracking_rate: 0.995, note: "R29 越限判定基线" },
    sop: ["差评 2h 内响应（R9）", "调价须附竞对与毛利测算依据", "夜班对账三轮比对，差异率红线 0.3%"],
    promo_calendar: {
      horizon_days: 90,
      events: [
        { date: "2026-11-11", name: "双11", tier: "T1", strategy: "提前 21 天战备审批（R27）" },
        { date: "2026-11-27", name: "黑五网一", tier: "T1", strategy: "跨时区作战，夜班班组主场" },
      ],
      price_protect_windows: [{ platform: "京东", days: 30 }], // R13 价保期改价熔断同源
    },
    operations: {
      night_window: { start: "22:00", end: "08:00", package_time: "08:30" },
      inspection_cron: ["07:00", "15:00", "23:00"],
      daily_orders: 96_000, daily_cs_sessions: 42_000, ad_campaigns: 340,
    },
    goals: {
      year: { gmv_cny: 102e8, gmv_usd: 53e8, margin_rate: 0.15, acos: 0.22, bad_review_rate: 0.02, repurchase_rate: 0.28, turnover_days: 45 },
      month_2026_08: { gmv_cny: 9.2e8, margin_rate: 0.148, acos: 0.24, note: "暑期旺季 + 黑五备货" },
      breakdown: {
        platforms: { "天猫": 0.18, "京东": 0.12, "抖音电商": 0.10, "亚马逊": 0.22, "Temu": 0.09, "其他": 0.29 },
        categories: { "3C数码配件": 0.46, "家居日用": 0.34, "设计家居": 0.20 },
      },
      tracking: "goal.tracking 事件按周回写达成率与偏差归因（p12 仪表盘数据源）",
    },
    approval_matrix: {
      refund_review_threshold: 1000,
      procurement_review_threshold: 100_000,
      compensation: "review_only",
      night_high_risk: "block",
    },
    compensation_policy: { max_goodwill_amount_cny: 500, returnless_refund_usd: 25, upgrade_promise: "forbidden", refund_channel: "multi-reconciler" },
    memory: { case_index: [], note: "处置案例索引（第五类 case 记忆落地前的配置层锚点）" },
    faq_kb: {
      top_questions: [
        { q: "支持七天无理由退货吗", a: "国内店支持 7 天无理由（跨境店 30 天），退货运费险已投保", source_call_ids: [], confirmed: true },
        { q: "充电宝可以带上飞机吗", a: "10000mAh/20000mAh 款额定能量 ≤100Wh，符合民航随身携带标准", source_call_ids: [], confirmed: true },
        { q: "跨境订单关税谁承担", a: "DDP 模式关税由我方承担，买家到手价即最终价", source_call_ids: [], confirmed: true },
      ],
      last_mined_at: null,
      pending_candidates: [],
    },
    // 巡检只读快照（M9/F9.1 探针输入：多平台价格采样/库存同步/新评价/违规采样）
    inspection: {
      channels: [
        { channel: "天猫", price: 89, parity: true, status: "online" },
        { channel: "京东", price: 89, parity: true, status: "online" },
        { channel: "拼多多", price: 75, parity: false, status: "online" },
      ],
      roomStates: [
        { roomType: "SKU-3C-1001 东莞一仓", synced: true },
        { roomType: "SKU-HM-2001 义乌二仓", synced: true },
        { roomType: "SKU-3C-1001 FBA 美西", synced: false },
      ],
      reviews: [
        { id: "rv-douyin-9901", channel: "抖音电商", score: 5 },
        { id: "rv-amz-1032", channel: "亚马逊", score: 2 },
      ],
      violations: [],
    },
    // 集团级 forbidden（L1.6 硬约束汇总；分店 forbidden 见 shops[]）
    forbidden: [
      { rule: "全集团售价不低于成本×1.15（毛利红线 R2 同源）", scope: "price" },
      { rule: "不承诺档案之外的赔偿金额", scope: "cs" },
      { rule: "禁止刷单/删差评/侵权词上架（R11/R24 物理阻断）", scope: "compliance" },
    ],
    // —— 14 店铺档案（一店一档 ×14，schemas shop 层字段组） ——
    shops,
  };
}

/* ================= 事件剧本生成 ================= */

interface SeedEvent {
  event_id: string;
  who: { type: "human" | "agent" | "system"; id: string; version?: string };
  context: {
    tenant_id: string;
    workspace_id: string;
    time: string;
    channel?: string;
    stage?: string;
    store?: string;
    [k: string]: unknown;
  };
  object: { type: string; id?: string; [k: string]: unknown };
  decision: {
    action: string;
    before?: unknown;
    after?: unknown;
    basis?: string[];
    memory_refs?: string[];
    [k: string]: unknown;
  };
  rule_impact: Array<{ rule_id: string; version: string; result: string }>;
  receipt?: { synced?: boolean; snapshot_uri?: string; verified_at?: string };
  model_trace?: { model_id: string; tier?: string; window?: string; credits?: number };
  links?: string[];
  [k: string]: unknown;
}

/* ================= 电商实体常量（世界观主数据，升级计划 §五 第 1 步） ================= */

/** 品牌矩阵：熊猫优选（大众3C）/ 熊猫美学（设计家居）/ PandaTech（海外3C）/ PandaHome（海外家居） */
const BRANDS = ["熊猫优选", "熊猫美学", "PandaTech", "PandaHome"] as const;

/** SKU 类目池：3C数码配件 / 家居日用 / 设计家居（成本→毛利红线 ×1.15 与 R2 同源） */
const SKU_POOL = [
  { id: "SKU-3C-1001", label: "磁吸充电宝 10000mAh", brand: "熊猫优选", category: "3C数码配件", cost: 42, price: 89 },
  { id: "SKU-3C-1002", label: "氮化镓快充头 65W", brand: "熊猫优选", category: "3C数码配件", cost: 35, price: 79 },
  { id: "SKU-3C-1003", label: "Type-C 编织数据线 1.5m", brand: "PandaTech", category: "3C数码配件", cost: 6, price: 19.9 },
  { id: "SKU-HM-2001", label: "折叠收纳箱 55L", brand: "熊猫优选", category: "家居日用", cost: 18, price: 49 },
  { id: "SKU-HM-2002", label: "真空压缩袋 8 件套", brand: "PandaHome", category: "家居日用", cost: 12, price: 35 },
  { id: "SKU-HM-2003", label: "厨房硅胶铲 5 件套", brand: "PandaHome", category: "家居日用", cost: 9, price: 29 },
  { id: "SKU-DS-3001", label: "原木置物架 三层", brand: "熊猫美学", category: "设计家居", cost: 130, price: 329 },
  { id: "SKU-DS-3002", label: "侘寂风陶瓷台灯", brand: "熊猫美学", category: "设计家居", cost: 95, price: 259 },
] as const;

/** 13 平台常量（SHOP_MATRIX 为 14 店铺明细，见档案段） */
const PLATFORMS = [
  "天猫", "京东", "拼多多", "抖音电商", "快手", "小红书", "视频号",
  "天猫国际", "亚马逊", "Temu", "TikTok Shop", "Shopee", "速卖通",
] as const;

/** 国内仓 4 + 海外仓 7 + FBA（11 仓网） */
const WAREHOUSES = [
  "东莞一仓", "义乌二仓", "深圳保税仓", "杭州前置仓",
  "海外仓-美东", "海外仓-美西", "海外仓-德国", "海外仓-波兰", "海外仓-日本", "海外仓-英国", "海外仓-澳洲", "FBA-美西",
] as const;

/** 广告投放/客服/仓储 Agent 池（preset_key 均存在于 bundles/ecommerce/presets） */
const AD_AGENTS = ["tmall-ads", "douyin-ads", "kuaishou-ads", "amz-ppc", "dtc-ads"] as const;
const CS_AGENTS = ["tmall-cs", "jd-cs", "pdd-cs", "douyin-cs", "kuaishou-cs", "xhs-cs", "tmallg-cs", "cs-en", "cs-eu", "cs-apac", "shopee-cs"] as const;
const WH_AGENTS = ["cn-warehouse", "overseas-warehouse", "amz-fba", "freight-forwarder"] as const;

/** 订单勾稽台账（§五 第 3 步勾稽约束的落地锚点）：
 *  广告花费 → 订单归因（attr_campaign）；退款单 → 原订单；库存出库 → 订单履约。
 *  生成顺序固定（i 升序）→ 台账内容可复现。 */
interface OrderLedger {
  event_id: string;
  order_id: string;
  shop: (typeof SHOP_MATRIX)[number];
  sku: (typeof SKU_POOL)[number];
  qty: number;
  amount: number;
  campaign_id: string | null;
}
const orderLedger: OrderLedger[] = [];
/** 待履约队列：scene 0 推入、scene 3 _shift 出库（出库=订单履约） */
const fulfillmentQueue: OrderLedger[] = [];
/** 最近一个广告计划 ID（供订单归因标记引用） */
let lastCampaignId: string | null = null;

/** 生成一条剧本事件（(i-1)%12 轮转 12 类电商场景；固定序号埋 5 条经营剧情链） */
function makeEvent(i: number, time: Date, presets: Preset[]): SeedEvent {
  const id = `E-SEED-${EVENT_BASE + i}`;
  const scene = (i - 1) % 12;
  const baseCtx = {
    tenant_id: TENANT_ID,
    workspace_id: WS_ID,
    time: iso(time),
    stage: "stable",
    store: WS_NAME,
  };
  const hour = time.getHours();
  const window = hour >= 22 || hour < 8 ? "off-peak" : "peak";
  const mt = (tier: "standard" | "flagship") => ({
    model_id: "mock-ecommerce-001",
    tier,
    window,
    credits: tier === "flagship" ? 2 : 1,
  });
  const receipt = (t: Date) => ({
    synced: true,
    snapshot_uri: `data/snapshots/${id.toLowerCase()}.png`,
    verified_at: iso(new Date(t.getTime() + 45_000)),
  });
  const agentWho = (key: string) => {
    const p = presets.find((x) => x.preset_key === key)!;
    return { type: "agent" as const, id: p.preset_key, version: p.version };
  };
  const ri = (rule_id: string, result: "pass" | "review" | "blocked") => [
    { rule_id, version: FENCE_VERSION, result },
  ];

  /* ---------- 经营剧情事件链（§五 第 4 步，5 条固定序号剧情，links 成链） ---------- */
  switch (i) {
    // 剧情②：亚马逊 ACoS 连续 3 天爆表 → 利润保险丝熔断降预算请示
    case 20:
      return {
        event_id: id,
        who: agentWho("amz-ppc"),
        context: { ...baseCtx, channel: "亚马逊", shop: "SHOP-AMZ" },
        object: { type: "ad_campaign", id: "CAMP-AMZ-SP-3077", label: "PandaTech 磁吸充电宝 SP 自动组" },
        decision: {
          action: "ads.acos.alert",
          before: { acos_breakeven: 0.28 },
          after: { acos_3d: [0.31, 0.34, 0.38], consecutive_days: 3, spend_usd: 4200 },
          basis: ["剧情②：ACoS 连续 3 天 > 盈亏平衡点 0.28", "分 SKU 盈亏平衡 ACoS 与档案 ads_guardrail 同源"],
        },
        rule_impact: ri("R3", "review"),
        model_trace: mt("standard"),
      };
    case 21:
      return {
        event_id: id,
        who: agentWho("budget-controller"),
        context: { ...baseCtx, channel: "亚马逊", shop: "SHOP-AMZ" },
        object: { type: "ad_campaign", id: "CAMP-AMZ-SP-3077", label: "PandaTech 磁吸充电宝 SP 自动组" },
        decision: {
          action: "ads.budget.fuse",
          before: { daily_budget_usd: 1500 },
          after: { daily_budget_usd: 1050, cut: "-30%", escalate_to: "MEM-002 运营总监" },
          basis: ["利润保险丝：自动降预算 30% 并请示（R3）"],
        },
        rule_impact: ri("R3", "review"),
        links: [`E-SEED-${EVENT_BASE + 20}`],
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    // 剧情①：爆款断货预警 → 紧急采购请示
    case 40:
      return {
        event_id: id,
        who: agentWho("demand-planner"),
        context: { ...baseCtx, channel: "天猫", shop: "SHOP-TMALL" },
        object: { type: "stock", id: "SKU-3C-1001", label: "磁吸充电宝 10000mAh（爆款期）" },
        decision: {
          action: "stock.stockout.alert",
          after: { days_cover: 5.2, daily_sales: 1800, inbound_in_transit: 0, warehouse: "东莞一仓" },
          basis: ["剧情①：可售天数 5.2 < 7 且补货在途为 0（R7 断货预警线）"],
        },
        rule_impact: ri("R7", "review"),
        model_trace: mt("standard"),
      };
    case 41:
      return {
        event_id: id,
        who: agentWho("procurement-buyer"),
        context: { ...baseCtx, channel: "供应链" },
        object: { type: "purchase_order", id: "PO-20260827-011", label: "磁吸充电宝紧急补货 3 万台" },
        decision: {
          action: "procurement.urgent.request",
          after: { sku: "SKU-3C-1001", qty: 30_000, amount_cny: 1_260_000, supplier: "东莞锂威电子", lead_time_days: 12 },
          basis: ["剧情①：紧急采购请示", "金额 ¥126 万 ≥ 分级人审线（R20）"],
        },
        rule_impact: [...ri("R7", "review"), ...ri("R20", "review")],
        links: [`E-SEED-${EVENT_BASE + 40}`],
        model_trace: mt("flagship"),
      };
    // 剧情③：抖音直播间差评危机 → 2 小时 SLA 防御窗口
    case 55:
      return {
        event_id: id,
        who: agentWho("douyin-cs"),
        context: { ...baseCtx, channel: "抖音电商", shop: "SHOP-DOUYIN" },
        object: { type: "review", id: "RV-DY-77520", label: "直播间 1 星差评" },
        decision: {
          action: "review.detect",
          after: { rating: 1, topic: "直播间展示与实物色差", live_exposure: "当场 2.3 万人在线", sla_hours: 2 },
          basis: ["剧情③：差评危机，2h SLA 防御窗口开启（R9）"],
        },
        rule_impact: ri("R9", "review"),
        model_trace: mt("standard"),
      };
    case 56:
      return {
        event_id: id,
        who: agentWho("douyin-cs"),
        context: { ...baseCtx, channel: "抖音电商", shop: "SHOP-DOUYIN" },
        object: { type: "review", id: "RV-DY-77520" },
        decision: {
          action: "review.reply",
          after: { draft: "非常抱歉色差给您带来困扰。我们已复核直播间灯光校色并支持无理由退换+运费险，客服将私信您跟进……", sla_deadline_min: 118 },
          basis: ["品牌规范致歉结构", "已核对 forbidden：无档案外补偿承诺"],
        },
        rule_impact: ri("R9", "review"),
        links: [`E-SEED-${EVENT_BASE + 55}`],
        model_trace: mt("flagship"),
      };
    case 57:
      return {
        event_id: id,
        who: { type: "human", id: "MEM-002" },
        context: { ...baseCtx, channel: "inapp" },
        object: { type: "review", id: "RV-DY-77520" },
        decision: {
          action: "approval.gesture",
          after: { gesture: "approve", weight: 1, elapsed_min: 94 },
          basis: ["剧情③收口：运营总监 94 分钟内批准发出（SLA 2h 达标）"],
        },
        rule_impact: [],
        links: [`E-SEED-${EVENT_BASE + 56}`],
      };
    // 剧情⑥：跟卖突袭 → 取证驱赶
    case 70:
      return {
        event_id: id,
        who: agentWho("ip-shield"),
        context: { ...baseCtx, channel: "亚马逊", shop: "SHOP-AMZ" },
        object: { type: "listing", id: "B0CXYZ8899", label: "PandaTech 磁吸充电宝 US 站 Listing" },
        decision: {
          action: "hijack.alert",
          after: { hijacker: "Seller-X9TRADE", price_undercut_usd: 3.5, buybox_lost: true, detected_at: "夜间巡检" },
          basis: ["剧情⑥：跟卖突袭，Buy Box 丢失（R19 跟卖预警）"],
        },
        rule_impact: ri("R19", "review"),
        model_trace: mt("standard"),
      };
    case 71:
      return {
        event_id: id,
        who: agentWho("ip-shield"),
        context: { ...baseCtx, channel: "亚马逊", shop: "SHOP-AMZ" },
        object: { type: "listing", id: "B0CXYZ8899" },
        decision: {
          action: "hijack.evidence.file",
          after: { evidence: ["跟卖截图 ×4", "test buy 订单 112-****-****", "品牌备案号 PandaTech®"], route: "亚马逊违规举报 + 品牌驱赶函" },
          basis: ["剧情⑥：取证完毕，驱赶动作请示（R19）"],
        },
        rule_impact: ri("R19", "review"),
        links: [`E-SEED-${EVENT_BASE + 70}`],
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    // 剧情⑦：汇率单日波动 2.3% → 跨境全线重定价评估
    case 85:
      return {
        event_id: id,
        who: agentWho("fx-settler"),
        context: { ...baseCtx, channel: "集团财务" },
        object: { type: "fx_rate", id: "USD/CNY" },
        decision: {
          action: "fx.volatility.alert",
          before: { usd_cny: 7.12 },
          after: { usd_cny: 7.28, change_pct: 0.023 },
          basis: ["剧情⑦：单日波动 2.3% > 2% 阈值（R14 重定价触发线）"],
        },
        rule_impact: ri("R14", "review"),
        model_trace: mt("standard"),
      };
    case 86:
      return {
        event_id: id,
        who: agentWho("fx-settler"),
        context: { ...baseCtx, channel: "集团财务" },
        object: { type: "price", id: "cross-border-all", label: "跨境军 6 店 3400 SKU" },
        decision: {
          action: "pricing.fx.reprice.assess",
          after: { scope: "跨境军 6 店 3400 SKU", margin_impact_pt: -1.8, proposal: "US 站全线 +2.5%，EU 站 +1.8%", est_hours: 4 },
          basis: ["剧情⑦：重定价评估请示（R14）", "毛利红线 ×1.15 复核通过"],
        },
        rule_impact: ri("R14", "review"),
        links: [`E-SEED-${EVENT_BASE + 85}`],
        model_trace: mt("flagship"),
      };
  }

  /* ---------- 常规 12 类场景轮转 ---------- */
  switch (scene) {
    case 0: {
      // 订单创建（分店铺分时段；35% 带广告归因标记——勾稽：广告花费 → 订单回响）
      const shop = pick(SHOP_MATRIX);
      const sku = pick(SKU_POOL);
      const qty = int(1, 3);
      const amount = Math.round(sku.price * qty * 100) / 100;
      const attributed = rand() < 0.35 ? lastCampaignId : null;
      const order_id = `OD-${shop.id.slice(5)}-${EVENT_BASE + i}`;
      const rec: OrderLedger = { event_id: id, order_id, shop, sku, qty, amount, campaign_id: attributed };
      orderLedger.push(rec);
      fulfillmentQueue.push(rec);
      return {
        event_id: id,
        who: { type: "system", id: "platform-webhook" },
        context: { ...baseCtx, channel: shop.platform, shop: shop.id, timezone: shop.currency === "USD" ? "目的地时区" : "Asia/Shanghai" },
        object: { type: "order", id: order_id, label: sku.label },
        decision: {
          action: "order.create",
          after: { qty, amount, currency: shop.currency, brand: sku.brand, attr_campaign: attributed },
          basis: attributed ? ["广告归因：点击 24h 内下单（与广告流水勾稽）"] : ["自然流量下单"],
        },
        rule_impact: [],
        receipt: receipt(time),
      };
    }
    case 1: {
      // 广告计划调整（计划/调价/预算；每第 4 次为预算上调 >30% → R4 review）
      const agent = pick(AD_AGENTS);
      const shop = pick(SHOP_MATRIX);
      const campId = `CAMP-${shop.id.slice(5)}-${int(1000, 3999)}`;
      lastCampaignId = campId;
      const bigRaise = i % 48 === 1;
      return {
        event_id: id,
        who: agentWho(agent),
        context: { ...baseCtx, channel: shop.platform, shop: shop.id },
        object: { type: "ad_campaign", id: campId, label: `${pick(SKU_POOL).label} 推广计划` },
        decision: bigRaise
          ? {
              action: "ads.budget.raise",
              before: { daily_budget: 2000 },
              after: { daily_budget: 2900, change_pct: 0.45 },
              basis: ["大促预热提量，日预算上调 45% > 30%（R4 必审）"],
            }
          : {
              action: pick(["ads.bid.adjust", "ads.keyword.add", "ads.budget.pacing"]),
              after: { acos: Math.round((0.15 + rand() * 0.15) * 100) / 100, ctr: Math.round((0.02 + rand() * 0.04) * 1000) / 1000 },
              basis: ["分时调价模型", "类目基准 ± 波动"],
            },
        rule_impact: bigRaise ? ri("R4", "review") : [],
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    }
    case 2: {
      // 客服会话（售前 55% / 物流 25% / 售后 20%；含多模态标记 image/screenshot/video；多语言）
      const modality = pick(["text", "text", "text", "image", "screenshot", "video"] as const);
      const intent = pick(["pre_sale", "pre_sale", "pre_sale", "logistics", "logistics", "aftersale"] as const);
      const lang = pick(["zh", "zh", "zh", "zh", "en", "en", "ja", "de"] as const);
      const multimodalNote =
        modality === "screenshot" ? "买家截图：订单异常/报错页，视觉识别已解析"
        : modality === "image" ? "买家图片：找同款/辨型号咨询"
        : modality === "video" ? "买家视频：故障诊断，转安装指导话术"
        : null;
      return {
        event_id: id,
        who: agentWho(pick(CS_AGENTS)),
        context: { ...baseCtx, channel: pick(PLATFORMS) },
        object: { type: "cs_session", id: `CS-${int(100000, 999999)}` },
        decision: {
          action: "cs.reply",
          after: { intent, lang, modality, resolved: rand() > 0.18, first_response_sec: int(8, 90), ...(multimodalNote ? { multimodal: multimodalNote } : {}) },
          basis: ["知识库 + 商品库双源合成应答", "售前转化导向：内嵌商品卡片"],
        },
        rule_impact: [],
        model_trace: mt(modality === "text" ? "standard" : "flagship"),
      };
    }
    case 3: {
      // 库存出库 = 订单履约（勾稽：从待履约队列取单，qty 与订单一致）
      const ord = fulfillmentQueue.shift();
      if (!ord) {
        // 队列空（不应发生：scene 0 先于 scene 3）——兜底记一条盘点事件
        return {
          event_id: id,
          who: agentWho(pick(WH_AGENTS)),
          context: { ...baseCtx, channel: "仓储" },
          object: { type: "stock", id: pick(SKU_POOL).id },
          decision: { action: "stock.count", after: { variance: 0 }, basis: ["循环盘点"] },
          rule_impact: [],
          model_trace: mt("standard"),
        };
      }
      return {
        event_id: id,
        who: agentWho(pick(WH_AGENTS)),
        context: { ...baseCtx, channel: "仓储", shop: ord.shop.id },
        object: { type: "stock", id: ord.sku.id, label: ord.sku.label },
        decision: {
          action: "stock.outbound",
          after: { order_id: ord.order_id, qty_out: ord.qty, warehouse: pick(WAREHOUSES), balance_after: int(200, 9000) },
          basis: ["出库 = 订单履约（库存流水与订单流勾稽）"],
        },
        rule_impact: [],
        links: [ord.event_id],
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    }
    case 4: {
      // 售后退款（勾稽：退款单关联原订单；≥¥1000/$200 → R5 review）
      const ord = orderLedger[int(0, Math.max(0, orderLedger.length - 1))];
      const amount = ord ? Math.round(ord.amount * 100) / 100 : int(100, 300);
      const big = amount >= 1000 || i % 36 === 4;
      const refundAmount = big ? Math.max(amount, int(1000, 2600)) : amount;
      return {
        event_id: id,
        who: agentWho(pick(CS_AGENTS)),
        context: { ...baseCtx, channel: ord?.shop.platform ?? pick(PLATFORMS), shop: ord?.shop.id },
        object: { type: "aftersale", id: `AS-${int(100000, 999999)}`, label: ord?.sku.label },
        decision: {
          action: "aftersale.refund",
          params: { amount: refundAmount, currency: ord?.shop.currency ?? "CNY" },
          after: { reason: pick(["七天无理由", "物流破损", "与描述不符", "拍错/多拍"]), original_order: ord?.order_id ?? null },
          basis: ["退款单关联原订单（售后流与订单流勾稽）", big ? "金额 ≥¥1000/$200 → R5 必审" : "政策内自动退款"],
        },
        rule_impact: big ? ri("R5", "review") : [],
        links: ord ? [ord.event_id] : [],
        model_trace: mt("standard"),
      };
    }
    case 5: {
      // 评价处置（差评回复 AI 起草 → R9 review；好评资产化 pass）
      const bad = rand() < 0.6;
      return {
        event_id: id,
        who: agentWho(pick(["tmall-cs", "douyin-cs", "cs-en", "service-qc"] as const)),
        context: { ...baseCtx, channel: pick(PLATFORMS) },
        object: { type: "review", id: `RV-${int(10000, 99999)}` },
        decision: bad
          ? {
              action: "review.reply",
              params: { rating: int(1, 3) },
              after: { draft: "非常抱歉给您带来不好的体验，我们已核实并安排补发/退款……" },
              basis: ["差评 2h SLA（R9）", "已核对 forbidden：无档案外补偿承诺"],
            }
          : {
              action: "review.asset.boost",
              params: { rating: 5 },
              after: { action: "置顶 + 沉淀 FAQ + 素材入品牌资产库" },
              basis: ["好评资产化（review-asset-mining）"],
            },
        rule_impact: bad ? ri("R9", "review") : [],
        model_trace: mt("standard"),
      };
    }
    case 6: {
      // 夜班对账（订单×平台账单×广告/售后三方比对；差异率 ≈0.3% 脏数据红线）
      const gmv = int(80, 120) * 10000;
      const hasDiff = i % 24 === 6;
      const diff = hasDiff ? Math.round(gmv * 0.003) : 0;
      return {
        event_id: id,
        who: agentWho("multi-reconciler"),
        context: { ...baseCtx, channel: "夜班" },
        object: { type: "settlement", id: `STL-${pick(PLATFORMS)}-${int(100, 999)}` },
        decision: {
          action: "settlement.reconcile",
          after: {
            gmv_sample: gmv, diff, diff_rate: Math.round((diff / gmv) * 10000) / 10000, rounds: 3,
            ...(hasDiff ? { note: "三方差异 ≈0.3%，已立项追查（对账Agent 演示发现点）" } : {}),
          },
          basis: ["订单流水 × 平台账单 × 广告/售后扣款三方比对（账单与订单/广告/售后可对平）"],
        },
        rule_impact: [],
        model_trace: mt("standard"),
      };
    }
    case 7: {
      // 库存入库 / 仓间调拨 / FBA 补货（库存余额逐日连续）
      const action = pick(["stock.inbound", "stock.transfer", "fba.replenish"] as const);
      return {
        event_id: id,
        who: agentWho(pick(WH_AGENTS)),
        context: { ...baseCtx, channel: "仓储" },
        object: { type: "stock", id: pick(SKU_POOL).id },
        decision: {
          action,
          after: {
            qty: int(200, 3000),
            ...(action === "stock.transfer" ? { from: pick(WAREHOUSES), to: pick(WAREHOUSES) } : { warehouse: pick(WAREHOUSES) }),
          },
          basis: [action === "fba.replenish" ? "FBA 补货计划（fba-replenish）" : "安全库存 14 天口径补货"],
        },
        rule_impact: [],
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    }
    case 8: {
      // 合规告警 / 风控（R11 违规阻断 · R24 侵权图上新阻断 · R12 升级关键词转人工 · R18 价格倒挂）
      const variant = i % 4;
      if (variant === 0) {
        return {
          event_id: id,
          who: agentWho("rule-sentinel"),
          context: { ...baseCtx, channel: pick(PLATFORMS) },
          object: { type: "listing", id: `LS-${int(10000, 99999)}` },
          decision: {
            action: "listing.publish",
            after: { blocked_word: pick(["最低价全网保证", "fda approved", "百分百治愈"]) },
            basis: ["命中违禁词表（R11 违规动作物理阻断）"],
          },
          rule_impact: ri("R11", "blocked"),
          model_trace: mt("standard"),
        };
      }
      if (variant === 1) {
        return {
          event_id: id,
          who: agentWho("ip-shield"),
          context: { ...baseCtx, channel: "亚马逊", shop: "SHOP-AMZ" },
          object: { type: "creative", id: `IMG-${int(1000, 9999)}` },
          decision: {
            action: "listing.image.block",
            after: { reason: "首图含迪士尼形象局部，未授权", route: "上新阻断 + 素材退回设计" },
            basis: ["侵权图上新阻断（R24）"],
          },
          rule_impact: ri("R24", "blocked"),
          model_trace: mt("standard"),
        };
      }
      if (variant === 2) {
        return {
          event_id: id,
          who: agentWho(pick(CS_AGENTS)),
          context: { ...baseCtx, channel: pick(PLATFORMS) },
          object: { type: "cs_session", id: `CS-${int(100000, 999999)}` },
          decision: {
            action: "cs.escalate",
            after: { keyword: pick(["投诉工商", "律师函", "曝光媒体"]), routed_to: "人工专家席", context_summary: "已带完整上下文摘要" },
            basis: ["命中升级关键词（R12 自动转人工）"],
          },
          rule_impact: ri("R12", "review"),
          model_trace: mt("standard"),
        };
      }
      // 多平台价格倒挂告警（competitor-radar 只读巡检）
      return {
        event_id: id,
        who: agentWho("competitor-radar"),
        context: { ...baseCtx, channel: "夜班" },
        object: { type: "price", id: "SKU-HM-2001" },
        decision: {
          action: "price.parity.watch",
          after: { platform_low: "拼多多 ¥75", platform_ref: "天猫 ¥89", gap_pct: 0.157 },
          basis: ["倒挂 15.7% > 15%（R18 倒挂告警）", "频次自律：请求间隔 ≥3s（L3.3）"],
        },
        rule_impact: ri("R18", "review"),
        model_trace: mt("standard"),
      };
    }
    case 9: {
      // 刊登 / 调价（R1 单日降价 ≤10% auto pass；夜班调价 ≤3% R17 pass；毛利红线复核）
      const sku = pick(SKU_POOL);
      const before = sku.price;
      const night = window === "off-peak";
      const after = Math.round(before * (1 - rand() * (night ? 0.03 : 0.09)) * 100) / 100;
      const floorOk = after >= sku.cost * 1.15;
      return {
        event_id: id,
        who: agentWho(pick(["listing-factory", "temu-pricing"] as const)),
        context: { ...baseCtx, channel: pick(PLATFORMS) },
        object: { type: "price", id: sku.id, label: sku.label },
        decision: {
          action: "price.adjust",
          before: { price: before },
          after: { price: after, margin_floor_ok: floorOk },
          basis: [night ? "夜班调价微调 ≤3%（R17 自动上限）" : "单日降价 ≤10%（R1 自动上限）", "毛利红线 ×1.15 复核"],
        },
        rule_impact: ri(night ? "R17" : "R1", "pass"),
        receipt: receipt(time),
        model_trace: mt("standard"),
      };
    }
    case 10: {
      // 人类审批手势（董事长/运营总监拍板）
      return {
        event_id: id,
        who: { type: "human", id: pick(["MEM-001", "MEM-002"] as const) },
        context: { ...baseCtx, channel: "inapp" },
        object: { type: pick(["aftersale", "review", "ad_campaign", "purchase_order"] as const), id: `AP-${int(1000, 9999)}` },
        decision: {
          action: "approval.gesture",
          after: { gesture: pick(["approve", "approve", "reject"] as const), weight: 1 },
          basis: ["裁决判据齐全（action/params/base_price），非保守全上浮"],
        },
        rule_impact: [],
      };
    }
    default: {
      // 系统事件：夜班状态机 / 决策包交付（夜班完成项）/ 记忆固化
      const pkg = i % 24 === 11;
      return {
        event_id: id,
        who: { type: "system", id: "night-shift" },
        context: { ...baseCtx, channel: "夜班" },
        object: { type: "shop", id: WS_ID },
        decision: pkg
          ? {
              action: "night.package.deliver",
              after: { done: 9, pending: 3, need_human: 2, items: ["跨境店客服托管会话 ×412", "FBA 补货建议 ×6", "跟卖巡检 ×14 店", "对账三轮比对 ×13 平台"] },
              basis: ["夜班决策包 08:30 交付（F4.8）"],
            }
          : {
              action: pick(["night.run.start", "memory.consolidate"] as const),
              after: { note: "夜班状态机推进（F4.8）" },
            },
        rule_impact: [],
      };
    }
  }
}

/* ================= 主流程 ================= */

async function main(): Promise<void> {
  const presets = loadPresets();
  const fences = loadFences();
  const skillsDocs = loadSkills();
  console.log(`✓ Bundle 资产读取：${presets.length} preset / ${fences.length} 围栏 / ${skillsDocs.length} 技能`);

  // —— 组织模型走 owner 连接（种子/迁移账号，RLS 对其不生效；见 0001_init.sql 注记）
  const owner = new pg.Client({ connectionString: DATABASE_URL });
  await owner.connect();

  const q = (text: string, params: unknown[]) => owner.query(text, params);

  // 租户 / 工作区
  await q(
    `INSERT INTO tenants (id, name, plan) VALUES ($1,$2,'pro') ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID, TENANT_NAME],
  );
  await q(
    `INSERT INTO workspaces (id, tenant_id, name, slug, industry, stage, night_config)
     VALUES ($1,$2,$3,$4,'ecommerce','stable',$5) ON CONFLICT (id) DO NOTHING`,
    [
      WS_ID,
      TENANT_ID,
      WS_NAME,
      WS_SLUG,
      JSON.stringify({
        enabled: true,
        candidateTime: "18:00",
        startTime: "22:00",
        packageTime: "08:30",
        timezone: "Asia/Shanghai",
      }),
    ],
  );
  console.log("✓ 租户与工作区：demo / 熊猫优选集团");

  // 人类成员（创始人·董事长 owner / 运营总监 manager / 财务总监 readonly，F5.6）
  for (const m of MEMBERS) {
    await q(
      `INSERT INTO members (id, workspace_id, member_no, name, role)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (workspace_id, member_no) DO NOTHING`,
      [`${m.id.toLowerCase()}-id`, WS_ID, m.id, m.name, m.role],
    );
  }
  console.log(`✓ 人类成员 ×${MEMBERS.length}（${MEMBERS.map((m) => `${m.name}/${m.role}`).join("、")}）`);

  // Agent preset 实例（IM.5；F2.10 fence_bindings 原样落库）
  for (const p of presets) {
    await q(
      `INSERT INTO agents (id, workspace_id, preset_key, name, version, kind, readonly, fence_bindings, skills, status, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ready',$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        `agt-${p.preset_key}`,
        WS_ID,
        p.preset_key,
        p.name,
        p.version,
        p.kind,
        p.readonly,
        JSON.stringify(p.fence_bindings),
        JSON.stringify(p.skills),
        JSON.stringify({
          description: p.description,
          night_shift: p.night_shift,
          high_risk: p.high_risk,
          tools: p.tools,
          prompt: p.prompt,
          write_back: p.write_back,
        }),
      ],
    );
  }
  console.log(`✓ Agent 实例 ×${presets.length}（81 人数字军团 preset 全量实例化，L9.1）`);

  // 集团一档 + 14 店铺档案（槽①；forbidden 双写：archive 内 + 独立列，L1.6）
  // dataMode=simulated：落地向导（D24）横幅事实源——种子库即「全模拟运行态」，向导启用真实模式后翻转
  const archive: Record<string, unknown> = { ...pandaArchive(), dataMode: "simulated" };
  await q(
    `INSERT INTO profiles (workspace_id, tenant_id, industry, archive, forbidden, pii_vault)
     VALUES ($1,$2,'ecommerce',$3,$4,NULL)
     ON CONFLICT (workspace_id) DO UPDATE SET archive = EXCLUDED.archive, forbidden = EXCLUDED.forbidden, updated_at = now()`,
    [WS_ID, TENANT_ID, JSON.stringify(archive), JSON.stringify(archive.forbidden)],
  );
  console.log("✓ 集团一档 + 14 店铺档案（含 forbidden 硬约束，毛利红线 ×1.15 与 R2 同源）");

  // 基线围栏装载（R1–R30，active；单调守卫 F2.3 由阶段二 B4 判定器执行）
  // 版本化装载纪律：id 含版本 slug（重复 seed 不撞 pkey）；同 rule_id 的旧 active 版本滚动为 rolled_back，保证单一生效版本
  const fenceVerSlug = FENCE_VERSION.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  for (const r of fences) {
    await q(
      `UPDATE fence_rules SET status = 'rolled_back'
       WHERE workspace_id = $1 AND rule_id = $2 AND version <> $3 AND status = 'active'`,
      [WS_ID, r.rule_id, FENCE_VERSION],
    );
    await q(
      `INSERT INTO fence_rules (id, rule_id, version, workspace_id, name, level, match_spec, action, is_baseline, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active','system:seed')
       ON CONFLICT (rule_id, version, workspace_id) DO UPDATE SET status = 'active', match_spec = EXCLUDED.match_spec, action = EXCLUDED.action`,
      [
        `fr-${r.rule_id.toLowerCase()}-${fenceVerSlug}-${WS_ID}`,
        r.rule_id,
        FENCE_VERSION,
        WS_ID,
        r.name,
        r.level,
        JSON.stringify({ ...r.match, when: r.when }),
        JSON.stringify({ result: r.level === "auto" ? "pass" : r.level === "review" ? "review" : "blocked", note: r.note ?? "" }),
        r.is_baseline,
      ],
    );
  }
  console.log(`✓ 基线围栏装载 ×${fences.length}（${FENCE_VERSION}，active）`);

  // 官方技能 + 安装绑定（F8.1/F8.2）
  for (const s of skillsDocs) {
    const skillId = `skill-${s.name}`;
    await q(
      `INSERT INTO skills (id, level, bundle, name, version, description, fence_bindings, body, desensitized)
       VALUES ($1,'official','ecommerce',$2,'1.0.0',$3,$4,$5,false)
       ON CONFLICT (id) DO NOTHING`,
      [skillId, s.name, s.description, JSON.stringify(s.fenceBindings), s.body],
    );
    await q(
      `INSERT INTO skill_installs (skill_id, workspace_id, installed_by, installed_version, fence_bindings_snapshot)
       SELECT $1,$2,'MEM-001', s.version, s.fence_bindings FROM skills s WHERE s.id=$1
       ON CONFLICT (skill_id, workspace_id) DO NOTHING`,
      [skillId, WS_ID],
    );
  }
  console.log(`✓ 官方技能 ×${skillsDocs.length} 已安装（围栏绑定随安装生效）`);

  // 团队技能 + 行业共享技能（P6 装备库三区演示数据；F8.1 三级体系；幂等 ON CONFLICT）
  await q(
    `INSERT INTO skills (id, level, bundle, name, version, description, fence_bindings, body, desensitized)
     VALUES ('skill-t-ws-yunqi-weekly-ops-review','team','ecommerce','周一经营复盘','1.2.0',
             '每周一 08:00 自动汇总上周经营：GMV/毛利/ACoS/差评闭环/调价采纳率，产出复盘报告草稿（本工作区自建，F8.3 三要素零代码锻造）。',
             '[]',
             '# 周一经营复盘\n\n## 触发（何时用）\n每周一 08:00 定时触发。\n\n## 步骤（怎么做）\n1. 汇总上周 14 店 GMV 与毛利曲线（只读）。\n2. 汇总 ACoS、差评闭环与调价采纳率。\n3. 产出复盘报告草稿进 P4 待审。\n\n## 边界（什么不做）\n不直接改价、不直接回评价。',
             false)
     ON CONFLICT (id) DO NOTHING`,
    [],
  );
  await q(
    `INSERT INTO skill_installs (skill_id, workspace_id, installed_by)
     VALUES ('skill-t-ws-yunqi-weekly-ops-review',$1,'MEM-002') ON CONFLICT (skill_id, workspace_id) DO NOTHING`,
    [WS_ID],
  );
  await q(
    `INSERT INTO skills (id, level, bundle, name, version, description, fence_bindings, body, desensitized)
     VALUES ('skill-i-peak-season-sprint','industry','east-china-ecommerce-alliance','黑五大促冲刺包','2.1.0',
             '华东跨境大卖联盟共享：黑五网一冲刺打法包（竞对盯价+广告分时加码+差评快反 SOP），326 店在用；上架前已脱敏（L8.1 ✓）。',
             '["R3","R4"]',
             '# 黑五大促冲刺包\n\n## 触发（何时用）\n黑五网一/双11 大促冲刺期。\n\n## 步骤（怎么做）\n1. 竞对盯价：同类目价差 >5% 提醒。\n2. 广告分时加码建议（ACoS 越限自动降预算，R3 管辖）。\n3. 差评快反 SOP（R9 2h SLA 必审）。\n\n## 边界（什么不做）\n不触碰毛利红线（R2 红线）。',
             true)
     ON CONFLICT (id) DO NOTHING`,
    [],
  );
  console.log(`✓ 团队技能 ×1（已装）+ 行业共享技能 ×1（已脱敏待装）`);

  // 触发器（F4.7：07:00 巡检 / 22:00 夜班出征 + 行业 4 个：差评SLA/价格倒挂/FAQ萃取/库龄周报）
  const triggers = [
    { id: "tg-inspection-0700", name: "每日 07:00 只读巡检", kind: "cron", schedule: "0 7 * * *", action: { dispatch: "rule-sentinel", template: "inspection.daily" } },
    { id: "tg-night-2200", name: "夜班 22:00 战队出征", kind: "cron", schedule: "0 22 * * *", action: { dispatch: "night-shift", template: "night.run.start" } },
    { id: "tg-review-sla-30min", name: "差评 SLA 扫描（每 30 分钟，R9 联动）", kind: "cron", schedule: "*/30 * * * *", action: { dispatch: "service-qc", template: "review.sla.scan" } },
    { id: "tg-parity-15min", name: "价格倒挂看门狗（每 15 分钟，R18 联动）", kind: "cron", schedule: "*/15 * * * *", action: { dispatch: "competitor-radar", template: "price.parity.scan" } },
    { id: "tg-faq-mine-sun", name: "FAQ 知识库周萃取（周日 03:00）", kind: "cron", schedule: "0 3 * * 0", action: { dispatch: "kb-trainer", template: "faq.weekly.mine" } },
    { id: "tg-incident-weekly", name: "库龄与断货周报（周一 04:00）", kind: "cron", schedule: "0 4 * * 1", action: { dispatch: "overseas-warehouse", template: "warehouse.weekly.report" } },
    // 数字CEO 节拍（D21：CEO Loop；调度器消费前经治理守卫校验 charter.mode）
    { id: "tg-ceo-brief-0830", name: "公司CEO 晨报 08:30", kind: "cron", schedule: "30 8 * * *", action: { beat: "daily" } },
    { id: "tg-ceo-queue-2h", name: "公司CEO 裁决巡检 2h", kind: "cron", schedule: "7 */2 * * *", action: { beat: "queue" } },
    { id: "tg-ceo-deviation", name: "公司CEO 目标偏差扫描", kind: "cron", schedule: "15 */4 * * *", action: { beat: "deviation" } },
    { id: "tg-ceo-breaker", name: "公司CEO 自治熔断巡检", kind: "cron", schedule: "45 23 * * *", action: { beat: "breaker" } },
  ];
  for (const t of triggers) {
    await q(
      `INSERT INTO triggers (id, workspace_id, name, kind, schedule, action, enabled, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,true,'MEM-001') ON CONFLICT (id) DO NOTHING`,
      [t.id, WS_ID, t.name, t.kind, t.schedule, JSON.stringify(t.action)],
    );
  }
  console.log("✓ 触发器 ×10（巡检/夜班 + 行业 4 + 公司CEO 节拍 ×4）");

  // 演示线程（P1/P2 有数据可投影）
  const threads = [
    { id: "T-101", title: "亚马逊 ACoS 爆表处置（保险丝降预算）", mode: "quest", status: "completed", done: 6, total: 6, agent: "agt-amz-ppc", by: "MEM-001" },
    { id: "T-102", title: "抖音直播间差评危机处置（2h SLA）", mode: "quest", status: "pending_review", done: 3, total: 5, agent: "agt-douyin-cs", by: "MEM-002" },
    { id: "T-103", title: "Q4 新品刊登冲刺（天猫/Shopify）", mode: "agent", status: "running", done: 1, total: 4, agent: "agt-listing-factory", by: "MEM-002" },
  ];
  for (const t of threads) {
    await q(
      `INSERT INTO threads (id, tenant_id, workspace_id, title, mode, status, progress_done, progress_total, created_by, agent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [t.id, TENANT_ID, WS_ID, t.title, t.mode, t.status, t.done, t.total, t.by, t.agent],
    );
  }
  console.log(`✓ 演示线程 ×${threads.length}（completed / pending_review / running）`);

  // 凭据引用占位（F7.7/L7.3：演示环境密文为占位串，真实加密阶段二实现）
  for (const c of [
    { id: "cred-platform-tmall", provider: "platform-tmall", ref_key: "panda/shop-tmall" },
    { id: "cred-platform-amazon", provider: "platform-amazon", ref_key: "panda/shop-amz" },
  ]) {
    await q(
      `INSERT INTO credentials (id, workspace_id, provider, ref_key, secret_enc, scopes, health)
       VALUES ($1,$2,$3,$4,'demo-placeholder-ciphertext',$5,'unknown') ON CONFLICT (id) DO NOTHING`,
      [c.id, WS_ID, c.provider, c.ref_key, JSON.stringify(["read", "write"])],
    );
  }
  console.log("✓ 凭据引用 ×2（占位密文，事件只记引用 ID）");

  // —— 事件写入：切 gateway 角色（F1.2 唯一可 INSERT biz_events）
  await owner.end();
  const gw = new pg.Client({ connectionString: GATEWAY_URL });
  await gw.connect();
  await gw.query("SELECT set_config('app.workspace_id', $1, false)", [WS_ID]);
  await gw.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_ID]);

  // 哈希链续接（幂等重跑时接在已有链尾之后；链内已存在的事件靠 UNIQUE 丢弃）
  const last = await gw.query(
    `SELECT hash FROM biz_events WHERE tenant_id=$1 ORDER BY seq DESC LIMIT 1`,
    [TENANT_ID],
  );
  let prevHash = (last.rows[0]?.hash as string) ?? GENESIS_HASH;

  const times = demoTimeline();
  // 线程归属：广告/ACoS 剧情挂 T-101，差评剧情与评价场景挂 T-102，刊登调价挂 T-103，其余挂夜班会话
  const sessionOf = (i: number): string | null => {
    if (i === 20 || i === 21) return "T-101";
    if (i === 55 || i === 56 || i === 57) return "T-102";
    const scene = (i - 1) % 12;
    return scene === 1 ? "T-101" : scene === 5 ? "T-102" : scene === 9 ? "T-103" : null;
  };

  let inserted = 0;
  let dupSkipped = 0;
  for (let i = 1; i <= EVENT_COUNT; i++) {
    const ev = makeEvent(i, times[i - 1] as Date, presets);
    const checked = safeParseReplayAwareEvent(ev as never);
    if (!checked.success) {
      throw new Error(`种子事件 ${ev.event_id} 未过附录 E 校验：${checked.error.message}`);
    }
    // #32：哈希输入与存库 payload 均为 zod parse 后的 checked.data（与 appendEvent 逐字节一致）
    const payload = JSON.stringify(checked.data);
    const hash = eventHash(prevHash, checked.data);
    const res = await gw.query(
      `INSERT INTO biz_events (event_id, tenant_id, workspace_id, session_id, payload, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, event_id) DO NOTHING
       RETURNING seq`,
      [ev.event_id, TENANT_ID, WS_ID, sessionOf(i), payload, prevHash, hash, ev.context.time],
    );
    if (res.rowCount && res.rowCount > 0) {
      prevHash = hash; // 只有真实落库的事件才进链
      inserted += 1;
    } else {
      dupSkipped += 1;
    }
  }

  console.log(`✓ 五元事件：新写入 ${inserted} 条，幂等丢弃 ${dupSkipped} 条（L1.4）`);

  // CEO 晨报事件（剧场汇报气泡/董事长视图简报流的数据源；幂等键 E-8999）
  {
    const ev = {
      event_id: "E-SEED-8999",
      who: { type: "agent", id: "captain", version: "v1.0" },
      context: { tenant_id: TENANT_ID, workspace_id: WS_ID, time: new Date().toISOString(), stage: "stable", store: WS_NAME },
      object: { type: "workspace", id: WS_ID, label: WS_NAME },
      decision: {
        action: "ceo.briefing",
        after: { text: "董事长，早报已备：昨夜班组完成 14 项作业（跨境店托管会话/对账/跟卖巡检各线正常），1 件抖音差评处置请您拍板；本周 GMV、毛利与 ACoS 趋势见节拍控制台；亚马逊保险丝已降预算 30% 待您确认。试用期边界降一档执行中。" },
        basis: ["CEO Loop 日频晨报 08:30"],
      },
      rule_impact: [],
      receipt: { synced: true, snapshot_uri: "data/snapshots/e-8999.png", verified_at: new Date().toISOString() },
      model_trace: { model_id: "mock-ecommerce-001", tier: "standard", window: "peak", credits: 1 },
    };
    const checked = safeParseReplayAwareEvent(ev as never);
    if (!checked.success) throw new Error(`晨报事件未过校验：${checked.error.message}`);
    const payload = JSON.stringify(checked.data);
    const hash = eventHash(prevHash, checked.data);
    await gw.query(
      `INSERT INTO biz_events (event_id, tenant_id, workspace_id, session_id, payload, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7) ON CONFLICT (tenant_id, event_id) DO NOTHING`,
      [ev.event_id, TENANT_ID, WS_ID, payload, prevHash, hash, ev.context.time],
    );
    console.log("✓ CEO 晨报事件（剧场汇报气泡数据源）");
  }

  // 审批样例：取最近两条 review 结果事件挂审批（一 pending 一 approved）
  const reviewEvents = await gw.query(
    `SELECT event_id, payload FROM biz_events
     WHERE tenant_id=$1 AND workspace_id=$2
       AND payload->'rule_impact' @> '[{"result":"review"}]'::jsonb
     ORDER BY seq DESC LIMIT 2`,
    [TENANT_ID, WS_ID],
  );
  for (const [idx, row] of reviewEvents.rows.entries()) {
    const p = row.payload as SeedEvent;
    const status = idx === 0 ? "pending" : "approved";
    await gw.query(
      `INSERT INTO approvals (approval_id, tenant_id, workspace_id, event_id, channel, status, gesture, snapshot, decided_by, decided_at)
       VALUES ($1,$2,$3,$4,'inapp',$5,$6,$7,$8,$9)
       ON CONFLICT (event_id, channel) DO NOTHING`,
      [
        `apr-${row.event_id.toLowerCase()}`,
        TENANT_ID,
        WS_ID,
        row.event_id,
        status,
        status === "approved"
          ? JSON.stringify({ type: "approve", weight: 1 })
          : null,
        JSON.stringify({
          before: p.decision.before ?? null,
          after: p.decision.after ?? null,
          // D21：裁决判据字段（action/params/base_price）——公司CEO 可据此裁决而非保守全上浮
          action: p.decision.action,
          params: p.decision.params ?? {},
          base_price: (p.decision.before as Record<string, unknown> | null)?.price ?? null,
          expires_at: iso(new Date(Date.now() + 24 * 3600 * 1000)), // G6：24h
        }),
        status === "approved" ? "MEM-001" : null,
        status === "approved" ? new Date().toISOString() : null,
      ],
    );
  }
  console.log(`✓ 审批样例 ×${reviewEvents.rows.length}（pending/approved 各一，UNIQUE(event_id,channel) 幂等）`);

  // 昨夜夜班班次（package_generated，决策包统计三栏）
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const runDate = yesterday.toISOString().slice(0, 10);
  await gw.query(
    `INSERT INTO night_runs (id, workspace_id, run_date, status, fence_snapshot_version, candidate_count, stats, started_at, package_event_id)
     VALUES ($1,$2,$3,'package_generated',$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO NOTHING`,
    [
      `nr-${runDate}`,
      WS_ID,
      runDate,
      FENCE_VERSION,
      14,
      JSON.stringify({ done: 9, pending: 3, need_human: 2, credits_used: 96, credits_est: 118 }),
      new Date(yesterday.setHours(22, 0, 0, 0)).toISOString(),
      `E-SEED-${EVENT_BASE + EVENT_COUNT}`,
    ],
  );
  console.log(`✓ 夜班班次 nr-${runDate}（package_generated，围栏快照 ${FENCE_VERSION}）`);

  // 组织记忆 + 归因（F1.4）
  const memories = [
    { id: "mem-3c-weekend", kind: "pattern", content: "3C 配件周末转化率高，周六 10:00 前提价 5% 转化损失最小", source: ["E-SEED-8801"] },
    { id: "mem-review-sop", kind: "sop", content: "差评回复结构：致歉→核实→已采取措施→改进承诺，不承诺档案外补偿（R9 2h SLA）", source: ["E-SEED-8802"] },
  ];
  for (const m of memories) {
    await gw.query(
      `INSERT INTO org_memory (memory_id, tenant_id, workspace_id, scope, kind, content, source_events, confidence)
       VALUES ($1,$2,$3,'workspace',$4,$5,$6,0.6)
       ON CONFLICT (memory_id) DO NOTHING`,
      [m.id, TENANT_ID, WS_ID, m.kind, m.content, m.source],
    );
    await gw.query(
      `INSERT INTO memory_usage (memory_id, event_id, workspace_id) VALUES ($1,$2,$3)
       ON CONFLICT (memory_id, event_id) DO NOTHING`,
      [m.id, m.source[0], WS_ID],
    );
  }
  console.log(`✓ 组织记忆 ×${memories.length}（含来源事件归因）`);

  // —— 验收（附录 H-1）：回读本批次 100 条，逐条过 zod，五元完整率必须 100%
  // 按本批显式 ID 清单回读（不用字符串范围：库里可能存在历史遗留事件，词法区间会误纳）
  const batchIds = Array.from({ length: EVENT_COUNT }, (_, i) => `E-SEED-${EVENT_BASE + 1 + i}`);
  const check = await gw.query(
    `SELECT payload FROM biz_events
     WHERE tenant_id=$1 AND workspace_id=$2 AND event_id = ANY($3::text[])
     ORDER BY seq`,
    [TENANT_ID, WS_ID, batchIds],
  );
  let valid = 0;
  for (const row of check.rows) {
    if (safeParseReplayAwareEvent(row.payload as never).success) valid += 1;
  }
  const rate = check.rowCount ? valid / check.rowCount : 0;
  console.log(`✓ 验收（H-1）：回读 ${check.rowCount} 条，五元字段完整 ${valid} 条，完整率 ${(rate * 100).toFixed(1)}%`);
  if (check.rowCount !== EVENT_COUNT || rate !== 1) {
    throw new Error(`验收失败：期望 ${EVENT_COUNT} 条且完整率 100%（实际 ${check.rowCount} 条 / ${(rate * 100).toFixed(1)}%）`);
  }

  // ============ AI 服务前台 · 运行态剧本（电商买家服务前台：售前转化/售后全链路） ============
  const svcQ = (text: string, params: unknown[]) => gw.query(text, params);

  // C 端买家（会员绑定 + 跨境游客各一）
  await svcQ(
    `INSERT INTO c_users (id, workspace_id, channel, openid, nickname, member_id, created_at)
     VALUES
       ('cu-chenjing', $1, 'wechat-mini', 'openid-chenjing', '陈静', 'M-TM-10086', $2),
       ('cu-amy', $1, 'h5', 'fp-amy-8f3a', 'Amy Chen', NULL, $3)
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID, new Date(Date.now() - 30 * 86400000).toISOString(), new Date(Date.now() - 2 * 86400000).toISOString()],
  );

  // 知识库第二集合：售后与物流政策目录 + 官网来源登记
  await svcQ(
    `INSERT INTO kb_collections (id, workspace_id, name, description)
     VALUES ('kbc-aftersales-policy', $1, '售后与物流政策', '退换退款、运费险、保修、物流时效与跨境关税说明')
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID],
  );
  const policyMd = `# 售后与物流政策\n\n## 退换退款\n国内店 7 天无理由退货（跨境店 30 天），退货运费险已投保；退款原路退回，1-3 个工作日到账。\n\n## 保修\n3C 数码配件整机保修 12 个月，数据线等易耗品保修 6 个月，人为损坏除外。\n\n## 物流时效\n国内 16:00 前付款当日发货，顺丰/中通 48-72 小时送达；跨境标准线 7-15 天，快线 5-8 天。\n\n## 跨境关税\nDDP 模式关税由我方承担，买家到手价即最终价，无二次收费。`;
  await svcQ(
    `INSERT INTO kb_documents (id, workspace_id, collection_id, title, source_kind, source_url, version, status, content_md, hash, created_at)
     VALUES ('kbd-aftersales-policy', $1, 'kbc-aftersales-policy', '售后与物流政策', 'manual', NULL, 1, 'active', $2, 'seed-hash-policy', $3)
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID, policyMd, new Date(Date.now() - 20 * 86400000).toISOString()],
  );
  const policyChunks: [number, string, string][] = [
    [0, '退换退款', '国内店 7 天无理由退货（跨境店 30 天），退货运费险已投保；退款原路退回，1-3 个工作日到账。'],
    [1, '保修', '3C 数码配件整机保修 12 个月，数据线等易耗品保修 6 个月，人为损坏除外。'],
    [2, '物流时效', '国内 16:00 前付款当日发货，顺丰/中通 48-72 小时送达；跨境标准线 7-15 天，快线 5-8 天。'],
    [3, '跨境关税', 'DDP 模式关税由我方承担，买家到手价即最终价，无二次收费。'],
  ];
  for (const [idx, heading, content] of policyChunks) {
    await svcQ(
      `INSERT INTO kb_chunks (workspace_id, document_id, chunk_index, heading, content)
       SELECT $1,'kbd-aftersales-policy',$2,$3,$4
       WHERE NOT EXISTS (SELECT 1 FROM kb_chunks WHERE document_id='kbd-aftersales-policy' AND chunk_index=$2)`,
      [WS_ID, idx, heading, content],
    );
  }
  await svcQ(
    `INSERT INTO kb_sources (id, workspace_id, url, fingerprint, last_crawled_at, schedule_cron, status)
     VALUES ('kbs-official-site', $1, 'https://www.panda-home.example', 'fp-a91c', $2, '0 3 * * *', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID, new Date(Date.now() - 86400000).toISOString()],
  );

  // 会话 1：会员陈静——售前问答（充电宝上飞机 + 物流时效，高置信带引用）
  await svcQ(
    `INSERT INTO c_conversations (id, workspace_id, c_user_id, channel, status, created_at, last_message_at)
     VALUES ('cv-seed-001', $1, 'cu-chenjing', 'wechat-mini', 'open', $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID, new Date(Date.now() - 26 * 3600000).toISOString(), new Date(Date.now() - 26 * 3600000 + 90000).toISOString()],
  );
  const conv1Msgs: [string, string, string, number, string, number][] = [
    ['user', '这个 10000mAh 的磁吸充电宝能带上飞机吗？', '', 0, '[]', 0],
    ['assistant', '【航空携带】这款磁吸充电宝额定能量 37Wh（≤100Wh），符合民航随身携带标准，可放心登机。会员今日下单享顺丰包邮。', 'kb_qa', 0.95, JSON.stringify([{ documentTitle: '买家常见问答·商品咨询', heading: '充电宝可以带上飞机吗', content: '10000mAh/20000mAh 款额定能量 ≤100Wh，符合民航随身携带标准。' }]), 24],
    ['user', '现在下单什么时候能到？我在杭州', '', 0, '[]', 0],
    ['assistant', '【物流时效】16:00 前付款当日从杭州前置仓发货，顺丰 48 小时内送达；您是黑卡会员，可优先拣货。', 'kb_qa', 0.93, JSON.stringify([{ documentTitle: '售后与物流政策', heading: '物流时效', content: '国内 16:00 前付款当日发货，顺丰/中通 48-72 小时送达。' }]), 21],
  ];
  for (let i = 0; i < conv1Msgs.length; i++) {
    const m = conv1Msgs[i]!;
    await svcQ(
      `INSERT INTO c_messages (workspace_id, conversation_id, role, content, intent, confidence, citations, latency_ms, created_at)
       SELECT $1,'cv-seed-001',$2,$3,$4,$5,$6::jsonb,$7,$8
       WHERE NOT EXISTS (SELECT 1 FROM c_messages WHERE conversation_id='cv-seed-001' AND content=$3)`,
      [WS_ID, m[0], m[1], m[2] || null, m[3] || null, m[4], m[5] || null, new Date(Date.now() - 26 * 3600000 + i * 30000).toISOString()],
    );
  }

  // 会话 2：跨境买家 Amy——多模态（截图订单异常）→ 退款工单
  await svcQ(
    `INSERT INTO c_conversations (id, workspace_id, c_user_id, channel, status, created_at, last_message_at)
     VALUES ('cv-seed-002', $1, 'cu-amy', 'h5', 'open', $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID, new Date(Date.now() - 3 * 3600000).toISOString(), new Date(Date.now() - 3 * 3600000 + 120000).toISOString()],
  );
  const conv2Msgs: [string, string, string, number, string, number][] = [
    ['user', '[截图] 我的订单 OD-AMZ-88231 显示已签收但我没收到', '', 0, '[]', 0],
    ['assistant', '很抱歉给您带来困扰。截图已识别：订单 OD-AMZ-88231 物流状态异常。已为您生成退款核查工单，客服专员将在 2 小时内跟进，进度实时通知您。', 'service_request', 0.91, '[]', 28],
  ];
  for (let i = 0; i < conv2Msgs.length; i++) {
    const m = conv2Msgs[i]!;
    await svcQ(
      `INSERT INTO c_messages (workspace_id, conversation_id, role, content, intent, confidence, citations, latency_ms, created_at)
       SELECT $1,'cv-seed-002',$2,$3,$4,$5,$6::jsonb,$7,$8
       WHERE NOT EXISTS (SELECT 1 FROM c_messages WHERE conversation_id='cv-seed-002' AND content=$3)`,
      [WS_ID, m[0], m[1], m[2] || null, m[3] || null, m[4], m[5] || null, new Date(Date.now() - 3 * 3600000 + i * 40000).toISOString()],
    );
  }

  // 工单 ×3（退款/退货/纠纷三种状态）+ 流转时间线
  const tickets: [string, string, string | null, string, string, string, string, string | null, string | null, number][] = [
    ['tck-seed-001', 'cu-amy', 'cv-seed-002', 'refund', 'OD-AMZ-88231 签收未收到货退款核查', 'processing', 'high', '售后组', 'Lily', 2],
    ['tck-seed-002', 'cu-chenjing', null, 'return', '折叠收纳箱 55L 七天无理由退货', 'assigned', 'normal', '售后组', null, 1],
    ['tck-seed-003', 'cu-amy', null, 'complaint', '快充头使用两周后接触不良', 'done', 'high', '值班主管', 'David', 20],
  ];
  for (const t of tickets) {
    await svcQ(
      `INSERT INTO c_tickets (id, workspace_id, c_user_id, conversation_id, kind, title, payload, status, priority, dept, assignee, sla_due_at, result, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'{}',$7,$8,$9,$10,$11,$12,$13,$14,$14)
       ON CONFLICT (id) DO NOTHING`,
      [t[0], WS_ID, t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8],
       new Date(Date.now() + 2 * 3600000).toISOString(),
       t[5] === 'done' ? JSON.stringify({ text: '已为您免费换新并承担来回运费，旧件无需退回。', rating: { score: 5 } }) : null,
       `seed-${t[0]}`, new Date(Date.now() - t[9] * 3600000 / 10).toISOString()],
    );
  }
  const tl: [string, string, string, string, string, number][] = [
    ['tck-seed-001', 'create', 'c_user', 'cu-amy', '截图识别订单异常，对话中建单', 180],
    ['tck-seed-001', 'assign', 'agent', 'agt-service-desk', '智能分派 → 售后组（跨境退款）', 179],
    ['tck-seed-001', 'start', 'staff', 'Lily', '已联系物流商核查签收底单', 95],
    ['tck-seed-002', 'create', 'c_user', 'cu-chenjing', '订单页自助申请退货', 60],
    ['tck-seed-002', 'assign', 'agent', 'agt-service-desk', '智能分派 → 售后组', 59],
    ['tck-seed-003', 'create', 'c_user', 'cu-amy', '质量问题投诉类必建单', 480],
    ['tck-seed-003', 'assign', 'agent', 'agt-service-desk', '智能分派 → 值班主管', 479],
    ['tck-seed-003', 'start', 'staff', 'David', '已核实批次质检报告', 460],
    ['tck-seed-003', 'complete', 'staff', 'David', '免费换新 + 免退回旧件', 430],
    ['tck-seed-003', 'rate', 'c_user', 'cu-amy', '满意度 5 星', 400],
  ];
  for (const e of tl) {
    await svcQ(
      `INSERT INTO c_ticket_events (workspace_id, ticket_id, action, actor_type, actor_id, detail, created_at)
       SELECT $1,$2,$3,$4,$5,$6::jsonb,$7
       WHERE NOT EXISTS (SELECT 1 FROM c_ticket_events WHERE ticket_id=$2 AND action=$3 AND actor_id=$4)`,
      [WS_ID, e[0], e[1], e[2], e[3], JSON.stringify({ note: e[4] }), new Date(Date.now() - e[5] * 60000).toISOString()],
    );
  }

  // 推送箱：受理 + 办结通知（仿服务通知）
  const notifs: [string, string, string, string, number][] = [
    ['ntf-seed-001', 'cu-amy', 'ticket.accepted', '您的退款核查工单「OD-AMZ-88231 签收未收到货」已受理，售后组 Lily 处理中。', 170],
    ['ntf-seed-002', 'cu-amy', 'ticket.completed', '您的投诉工单「快充头接触不良」已办结：已免费换新并免退回旧件。欢迎评价。', 425],
    ['ntf-seed-003', 'cu-chenjing', 'ticket.accepted', '您的退货工单「折叠收纳箱 55L 七天无理由退货」已受理，上门取件时间将短信通知。', 55],
  ];
  for (const n of notifs) {
    await svcQ(
      `INSERT INTO c_notifications (workspace_id, c_user_id, channel, kind, payload, driver, status, created_at)
       SELECT $1,$2,'h5',$3,$4::jsonb,'mock','delivered',$5
       WHERE NOT EXISTS (SELECT 1 FROM c_notifications WHERE c_user_id=$2 AND kind=$3 AND payload->>'text'=$6)`,
      [WS_ID, n[1], n[2], JSON.stringify({ text: n[3], mock: true }), new Date(Date.now() - n[4] * 60000).toISOString(), n[3]],
    );
  }
  console.log("✓ 买家服务前台运行态：买家×2 / 知识库集合×2+官网源 / 会话×2（含多模态截图）/ 工单×3（全状态+时间线）/ 通知×3");

  // ============ AI 服务前台 · 知识库全量预置（电商买家 FAQ · seed 内联数据） ============
  // 说明：bundles/ecommerce/service-front 目录由他人负责改造，seed 不依赖其酒店 JSON，
  //      买家 FAQ/售后政策/物流说明在此内联（8 大类 48 问 + 政策详解 + 物流说明）。
  interface FaqCategory { key: string; docTitle: string; items: Array<{ q: string; a: string }> }
  const BUYER_FAQ: FaqCategory[] = [
    { key: "order-pay", docTitle: "买家常见问答·订单与支付", items: [
      { q: "下单后多久发货？", a: "国内店 16:00 前付款当日发货，16:00 后次日发货；跨境店 24-48 小时内出库。" },
      { q: "可以修改收货地址吗？", a: "未发货订单可在订单详情页自助改址；已发货订单请联系客服尝试拦截，不保证成功。" },
      { q: "支持哪些支付方式？", a: "国内店支持支付宝/微信/云闪付/花呗分期；跨境店支持 Visa/Mastercard/PayPal。" },
      { q: "怎么开发票？", a: "国内店支持电子普票与增值税专票，订单完成后在「我的订单-申请开票」自助办理，1-3 个工作日开出。" },
      { q: "订单显示已签收但没收到怎么办？", a: "请先查看代收点/快递柜；确认未收到请联系客服，我们将核查签收底单，核实后支持退款或补发。" },
      { q: "可以合并订单发货吗？", a: "同店铺同地址的未发货订单可联系客服合并，合并后多付运费将原路退回。" },
    ] },
    { key: "logistics", docTitle: "买家常见问答·物流配送", items: [
      { q: "国内配送多久能到？", a: "顺丰/中通 48-72 小时送达；江浙沪皖次日达，偏远地区 3-5 天。" },
      { q: "跨境订单时效多久？", a: "标准线 7-15 天，快线 5-8 天；清关延误属不可抗力，客服可协助查询。" },
      { q: "支持指定快递吗？", a: "默认顺丰/中通智能分配；指定顺丰可在下单页备注，差额运费需补 5 元。" },
      { q: "物流一直不更新怎么办？", a: "超过 48 小时无更新请联系客服，我们将向快递商发起查单并在 24 小时内答复。" },
      { q: "大件家具送装一体吗？", a: "设计家居类大件支持送装一体（覆盖 200 城），下单页可选择安装时段。" },
      { q: "海外仓发货还是国内直发？", a: "美/欧/日站点爆款由本地海外仓发货（2-5 天），长尾 SKU 国内直发（7-15 天）。" },
    ] },
    { key: "return-refund", docTitle: "买家常见问答·退换退款", items: [
      { q: "支持几天无理由退货？", a: "国内店 7 天无理由（跨境店 30 天），商品完好不影响二次销售即可。" },
      { q: "退货运费谁承担？", a: "已投保运费险：无理由退货由保险赔付首重；质量问题来回运费均由我方承担。" },
      { q: "退款多久到账？", a: "退货签收验收后 24 小时内退款，原路退回 1-3 个工作日到账。" },
      { q: "可以换货吗？", a: "支持同 SKU 换货（尺码/颜色）；换货发出前会先质检，3-5 天完成。" },
      { q: "跨境退货要寄回国内吗？", a: "不需要。低值商品支持 returnless refund（退款免退货 ≤$25）；高值商品退回本地海外仓。" },
      { q: "已拆封还能退吗？", a: "3C 产品拆封未激活可退；已激活产品非质量问题不支持无理由退货，可走保修。" },
    ] },
    { key: "warranty", docTitle: "买家常见问答·售后保修", items: [
      { q: "充电宝保修多久？", a: "3C 数码配件整机保修 12 个月，数据线等易耗品保修 6 个月，人为损坏除外。" },
      { q: "保修期内坏了怎么处理？", a: "联系客服提供订单号与故障照片/视频，确认后免费换新或维修，来回运费我方承担。" },
      { q: "过保了还能修吗？", a: "提供付费维修服务（仅收配件成本费），具体报价以客服评估为准。" },
      { q: "如何判断是不是人为损坏？", a: "外观无明显磕碰进液、序列号完整即按非人为处理；争议件可寄回检测中心鉴定。" },
      { q: "产品有批次问题会召回吗？", a: "若确认批次缺陷，我们将主动短信/站内信通知召回，免费换新并承担全部运费。" },
      { q: "海外买家怎么保修？", a: "美/欧/日买家寄回本地海外仓即可，流程与国内一致，运费由我方承担。" },
    ] },
    { key: "promo-price", docTitle: "买家常见问答·优惠与价保", items: [
      { q: "优惠券怎么叠加？", a: "店铺券与平台券可叠加，同类型券单笔限用一张；结算页自动匹配最优组合。" },
      { q: "买贵了能补差价吗？", a: "京东店支持 30 天价保，其他国内店支持 7 天价保；自助申请入口在订单详情页。" },
      { q: "会员有什么权益？", a: "黑卡会员：95 折 + 优先发货 + 专属客服；金卡会员：97 折 + 生日券。积分 1 元=1 分，100 分抵 1 元。" },
      { q: "直播间价格是最低价吗？", a: "直播间专享价为当期活动价，我们不做「全网最低」承诺；价保期内买贵可补差。" },
      { q: "大促期间多久发货？", a: "双11/黑五期间订单量激增，国内店承诺 72 小时内发出，超时按平台规则赔付。" },
      { q: "拼团失败会自动退款吗？", a: "会的，拼团失败 24 小时内自动原路退款，无需任何操作。" },
    ] },
    { key: "product", docTitle: "买家常见问答·商品咨询", items: [
      { q: "充电宝可以带上飞机吗？", a: "10000mAh/20000mAh 款额定能量 ≤100Wh，符合民航随身携带标准，可登机（不可托运）。" },
      { q: "快充头兼容我的手机吗？", a: "65W 氮化镓快充头支持 PD3.0/QC4+/PPS 协议，兼容主流品牌；详情页有完整兼容列表。" },
      { q: "收纳箱承重多少？", a: "折叠收纳箱 55L 静态承重 80kg，可叠放 3 层；PP 材质无异味，母婴可用。" },
      { q: "原木置物架需要组装吗？", a: "需要简单组装（附工具与视频教程，约 15 分钟）；送装一体城市可选择免费安装。" },
      { q: "有色差怎么办？", a: "显示器差异可能造成轻微色差；以实物为准，不满意支持 7 天无理由退货（运费险覆盖）。" },
      { q: "可以找同款/辨型号吗？", a: "可以，直接发图片给客服，AI 视觉识别会在店内匹配同款或兼容型号。" },
    ] },
    { key: "cross-border", docTitle: "买家常见问答·跨境购物", items: [
      { q: "关税谁承担？", a: "DDP 模式关税由我方承担，到手价即最终价，无二次收费。" },
      { q: "支持哪些语言客服？", a: "中/英/西/日/德/法/泰/越 8 语种，24 小时在线（夜班 AI 托管 + 人工兜底）。" },
      { q: "电压/插头适配吗？", a: "3C 产品均为宽电压 100-240V；欧规/英规/日规插头按站点默认配置，详情页可切换。" },
      { q: "跨境订单能开形式发票吗？", a: "可以，联系客服提供公司抬头，1 个工作日内发送 PDF 形式发票（Commercial Invoice）。" },
      { q: "Tracking 信息在哪里看？", a: "发货后自动推送追踪号，可在 17track 或承运商官网查询全程轨迹。" },
      { q: "包裹被海关扣了怎么办？", a: "DDP 模式下由我方清关代理处理，无需买家操作；延误超 10 天可申请全额退款。" },
    ] },
    { key: "account-member", docTitle: "买家常见问答·账号与会员", items: [
      { q: "会员积分怎么算？", a: "实付 1 元=1 积分，100 积分抵 1 元；评价晒单 +20 分，生日月双倍积分。" },
      { q: "如何升级黑卡会员？", a: "年累计消费满 8000 元或 12 笔订单自动升级，次月 1 日生效。" },
      { q: "忘记密码怎么办？", a: "登录页点「忘记密码」，通过手机/邮箱验证码重置；跨境站支持 magic link 免密登录。" },
      { q: "可以注销账号吗？", a: "可以，设置-账号安全-注销账号；注销后订单记录按法规保留 3 年，个人信息匿名化。" },
      { q: "订阅邮件怎么退订？", a: "营销邮件底部有退订链接，一键退订；退订后不影响订单通知类必要邮件。" },
      { q: "多个平台账号能合并积分吗？", a: "熊猫优选集团旗下国内店铺积分互通，跨境站点积分独立累计。" },
    ] },
  ];

  // ① 买家常见问答集合（8 文档 / 48 知识块：一问一答即一块）
  await svcQ(
    `INSERT INTO kb_collections (id, workspace_id, name, description)
     VALUES ('kbc-buyer-faq', $1, '买家常见问答', '八大类 48 条买家高频问题与标准答案（AI 买家服务前台核心知识源）')
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID],
  );
  let faqChunks = 0;
  for (const cat of BUYER_FAQ) {
    const docId = `kbd-faq-${cat.key}`;
    const md = [`# ${cat.docTitle}`, ...cat.items.map((it) => `## ${it.q}\n${it.a}`)].join("\n\n");
    await svcQ(
      `INSERT INTO kb_documents (id, workspace_id, collection_id, title, source_kind, source_url, version, status, content_md, hash, created_at)
       VALUES ($1, $2, 'kbc-buyer-faq', $3, 'manual', NULL, 1, 'active', $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [docId, WS_ID, cat.docTitle, md, `seed-hash-faq-${cat.key}`, new Date(Date.now() - 18 * 86400000).toISOString()],
    );
    for (let i = 0; i < cat.items.length; i++) {
      const it = cat.items[i]!;
      const r = await svcQ(
        `INSERT INTO kb_chunks (workspace_id, document_id, chunk_index, heading, content)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (SELECT 1 FROM kb_chunks WHERE document_id=$2 AND chunk_index=$3)`,
        [WS_ID, docId, i, it.q, it.a],
      );
      faqChunks += (r as unknown as { rowCount: number }).rowCount ?? 0;
    }
  }

  // ② 售后服务政策详解（R5/R10/R26 判定口径的买家侧表达）
  {
    const md = `# 售后服务政策详解\n\n## 退款权限分级\n≤¥1000/$200 政策内自动退款；超出人工复核（R5）。\n\n## 补偿口径\n客诉 goodwill 补偿上限 ¥500，超出必审（R10）；不承诺档案外赔偿。\n\n## 退换承诺边界\n客服承诺不得超出店铺退换政策（R26），高危承诺一律人审后发出。\n\n## 纠纷升级路由\n命中「投诉工商/律师/曝光」关键词自动转人工专家席（R12），带完整上下文摘要。`;
    await svcQ(
      `INSERT INTO kb_documents (id, workspace_id, collection_id, title, source_kind, source_url, version, status, content_md, hash, created_at)
       VALUES ('kbd-aftersales-detail', $1, 'kbc-aftersales-policy', '售后服务政策详解', 'manual', NULL, 1, 'active', $2, 'seed-hash-aftersales-detail', $3)
       ON CONFLICT (id) DO NOTHING`,
      [WS_ID, md, new Date(Date.now() - 18 * 86400000).toISOString()],
    );
    const detailChunks: [number, string, string][] = [
      [0, '退款权限分级', '≤¥1000/$200 政策内自动退款；超出人工复核（R5）。'],
      [1, '补偿口径', '客诉 goodwill 补偿上限 ¥500，超出必审（R10）；不承诺档案外赔偿。'],
      [2, '退换承诺边界', '客服承诺不得超出店铺退换政策（R26），高危承诺一律人审后发出。'],
      [3, '纠纷升级路由', '命中「投诉工商/律师/曝光」关键词自动转人工专家席（R12），带完整上下文摘要。'],
    ];
    for (const [idx, heading, content] of detailChunks) {
      await svcQ(
        `INSERT INTO kb_chunks (workspace_id, document_id, chunk_index, heading, content)
         SELECT $1, 'kbd-aftersales-detail', $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM kb_chunks WHERE document_id='kbd-aftersales-detail' AND chunk_index=$2)`,
        [WS_ID, idx, heading, content],
      );
    }
  }

  // ③ 多模态服务指引（截图/图片/视频三管线应答口径，§九）
  {
    const md = `# 多模态买家服务指引\n\n## 截图管线\n订单异常/报错页截图 → 视觉识别解析订单号与错误码 → 知识库合成应答或一键建单。\n\n## 图片管线\n找同款/辨型号/尺码咨询 → 视觉匹配商品库 → 内嵌商品卡片应答（售前转化导向）。\n\n## 视频管线\n故障诊断/安装指导 → 关键帧抽取比对故障库 → 分步指导话术，必要时转人工视频客服。`;
    await svcQ(
      `INSERT INTO kb_documents (id, workspace_id, collection_id, title, source_kind, source_url, version, status, content_md, hash, created_at)
       VALUES ('kbd-multimodal-guide', $1, 'kbc-aftersales-policy', '多模态买家服务指引', 'manual', NULL, 1, 'active', $2, 'seed-hash-multimodal-guide', $3)
       ON CONFLICT (id) DO NOTHING`,
      [WS_ID, md, new Date(Date.now() - 18 * 86400000).toISOString()],
    );
    const mmChunks: [number, string, string][] = [
      [0, '截图管线', '订单异常/报错页截图 → 视觉识别解析订单号与错误码 → 知识库合成应答或一键建单。'],
      [1, '图片管线', '找同款/辨型号/尺码咨询 → 视觉匹配商品库 → 内嵌商品卡片应答（售前转化导向）。'],
      [2, '视频管线', '故障诊断/安装指导 → 关键帧抽取比对故障库 → 分步指导话术，必要时转人工视频客服。'],
    ];
    for (const [idx, heading, content] of mmChunks) {
      await svcQ(
        `INSERT INTO kb_chunks (workspace_id, document_id, chunk_index, heading, content)
         SELECT $1, 'kbd-multimodal-guide', $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM kb_chunks WHERE document_id='kbd-multimodal-guide' AND chunk_index=$2)`,
        [WS_ID, idx, heading, content],
      );
    }
  }
  console.log(`✓ 知识库全量预置：买家 FAQ ${BUYER_FAQ.length} 类 ${BUYER_FAQ.reduce((n, c) => n + c.items.length, 0)} 问（新入库 ${faqChunks} 块）+ 售后政策详解 + 多模态服务指引`);

  // ============ AI 服务前台 · 扩充运行态（多客群/会员/订单/会话/工单/SLA） ============
  // 多客群买家（抖音/拼多多/日本站/德国站）+ 会员档案 + 电商订单
  await svcQ(
    `INSERT INTO c_users (id, workspace_id, channel, openid, nickname, member_id, created_at)
     VALUES
       ('cu-liuna', $1, 'wechat-mini', 'openid-liuna', '刘娜', 'M-DY-20888', $2),
       ('cu-wangfang', $1, 'wechat-mini', 'openid-wangfang', '王芳', 'M-PDD-31520', $3),
       ('cu-sato', $1, 'alipay', 'ali-sato-7a21', '佐藤健', NULL, $4),
       ('cu-mueller', $1, 'h5', 'fp-mueller-3c18', 'Herr Müller', NULL, $5)
     ON CONFLICT (id) DO NOTHING`,
    [WS_ID,
      new Date(Date.now() - 60 * 86400000).toISOString(), new Date(Date.now() - 21 * 86400000).toISOString(),
      new Date(Date.now() - 45 * 86400000).toISOString(), new Date(Date.now() - 86400000).toISOString()],
  );
  await svcQ(
    `INSERT INTO demo_members (workspace_id, member_id, name, tier, points)
     VALUES
       ($1, 'M-DY-20888', '刘娜', '熊猫黑卡', 26800),
       ($1, 'M-PDD-31520', '王芳', '熊猫金卡', 9800)
     ON CONFLICT (workspace_id, member_id) DO NOTHING`,
    [WS_ID],
  );
  // demo_orders 表结构不变（room_type 列承载商品口径，check_in/check_out 承载下单/签收时间）
  await svcQ(
    `INSERT INTO demo_orders (workspace_id, order_id, member_id, room_type, check_in, check_out, amount_fen, status)
     VALUES
       ($1, 'OD-DY-20260824-108', 'M-DY-20888', '磁吸充电宝 10000mAh ×2', $2, $3, 17800, '已签收'),
       ($1, 'OD-PDD-20260822-076', 'M-PDD-31520', '折叠收纳箱 55L ×4', $4, $5, 19600, '配送中'),
       ($1, 'OD-DY-20260810-033', 'M-DY-20888', '氮化镓快充头 65W ×1', $6, $7, 7900, '已签收')
     ON CONFLICT (workspace_id, order_id) DO NOTHING`,
    [WS_ID,
      new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() - 2 * 3600000).toISOString(),
      new Date(Date.now() - 2 * 86400000).toISOString(), new Date(Date.now() + 86400000).toISOString(),
      new Date(Date.now() - 14 * 86400000).toISOString(), new Date(Date.now() - 13 * 86400000).toISOString()],
  );

  // 扩充会话 ×4（优惠券/图片找同款/视频故障诊断建单/英文跨境关税 全链路演示）
  const convs: Array<[string, string, string, number, Array<[string, string, string, number, string, number]>]> = [
    ["cv-seed-003", "cu-liuna", "wechat-mini", 8, [
      ["user", "直播间领的 199-30 券怎么用不了？", "", 0, "[]", 0],
      ["assistant", "【用券规则】该券限抖音店家居类目使用，您购物车中的充电宝属 3C 类目不适用；已为您匹配 3C 专享 99-15 券，结算页自动抵扣。黑卡会员还可叠 95 折。", "kb_qa", 0.94, JSON.stringify([{ documentTitle: "买家常见问答·优惠与价保", heading: "优惠券怎么叠加？", content: "店铺券与平台券可叠加，同类型券单笔限用一张；结算页自动匹配最优组合。" }]), 26],
      ["user", "那我先下单充电宝，收纳箱等开播再买", "", 0, "[]", 0],
      ["assistant", "好的，已为您保留购物车。收纳箱今晚 20:00 直播间专享价 ¥45（日常 ¥49），开播前 10 分钟提醒您。", "pre_sale_convert", 0.9, "[]", 22],
    ]],
    ["cv-seed-004", "cu-wangfang", "wechat-mini", 5, [
      ["user", "[图片] 这个款式的置物架你们有类似的吗？", "", 0, "[]", 0],
      ["assistant", "已为您视觉匹配：店内「原木置物架 三层」（SKU-DS-3001）相似度 92%，侘寂风同款设计，今日下单送免打孔配件包。", "pre_sale_convert", 0.93, "[]", 24],
    ]],
    ["cv-seed-005", "cu-mueller", "h5", 2, [
      ["user", "[Video] The GaN charger stops charging intermittently. Order OD-AMZ-90217.", "", 0, "[]", 0],
      ["assistant", "抱歉给您带来不便。视频关键帧已分析：初步判定为线材接触不良。已为您生成售后工单：OD-AMZ-90217 快充头故障，支持免费换新（保修 12 个月内，来回运费我方承担）。", "service_request", 0.9, "[]", 27],
    ]],
    ["cv-seed-006", "cu-sato", "alipay", 12, [
      ["user", "関税は別途かかりますか？最終的な支払い総額はいくらですか？", "", 0, "[]", 0],
      ["assistant", "【関税について】DDP（関税込み）配送のため、表示価格が最終お支払い総額です。追加料金は一切かかりません。日本国内はヤマト運輸で 2-5 日お届けします。", "kb_qa", 0.92, JSON.stringify([{ documentTitle: "买家常见问答·跨境购物", heading: "关税谁承担？", content: "DDP 模式关税由我方承担，到手价即最终价，无二次收费。" }]), 31],
    ]],
  ];
  for (const [cvId, cuId, ch, hoursAgo, msgs] of convs) {
    await svcQ(
      `INSERT INTO c_conversations (id, workspace_id, c_user_id, channel, status, created_at, last_message_at)
       VALUES ($1, $2, $3, $4, 'open', $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [cvId, WS_ID, cuId, ch, new Date(Date.now() - hoursAgo * 3600000).toISOString(), new Date(Date.now() - hoursAgo * 3600000 + 120000).toISOString()],
    );
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]!;
      await svcQ(
        `INSERT INTO c_messages (workspace_id, conversation_id, role, content, intent, confidence, citations, latency_ms, created_at)
         SELECT $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9
         WHERE NOT EXISTS (SELECT 1 FROM c_messages WHERE conversation_id=$2 AND content=$4)`,
        [WS_ID, cvId, m[0], m[1], m[2] || null, m[3] || null, m[4], m[5] || null, new Date(Date.now() - hoursAgo * 3600000 + i * 40000).toISOString()],
      );
    }
  }

  // 扩充工单 ×5（退款/换货/退货/纠纷/价保 含 1 张 SLA 超时单）+ 时间线 + 通知
  const tickets2: Array<[string, string, string | null, string, string, string, string, string | null, string | null, number]> = [
    ["tck-seed-004", "cu-liuna", "cv-seed-004", "exchange", "原木置物架换货（层板色差）", "done", "normal", "售后组", "换货专线-小周", 5],
    ["tck-seed-005", "cu-mueller", "cv-seed-005", "refund", "OD-AMZ-90217 快充头间歇断充", "processing", "high", "跨境售后组", "Lily", 2],
    ["tck-seed-006", "cu-wangfang", null, "return", "真空压缩袋 8 件套 七天无理由退货", "assigned", "normal", "售后组", null, 1],
    ["tck-seed-007", "cu-sato", null, "complaint", "数据线一个月断裂（保修判定争议）", "created", "normal", "跨境售后组", null, 26], // SLA 超时样例（created 超 2h 未分派）
    ["tck-seed-008", "cu-liuna", null, "other", "价保申请：收纳箱 7 天内降价 ¥4", "done", "high", "客服专家组", "价保专员-阿May", 30],
  ];
  for (const t of tickets2) {
    await svcQ(
      `INSERT INTO c_tickets (id, workspace_id, c_user_id, conversation_id, kind, title, payload, status, priority, dept, assignee, sla_due_at, result, idempotency_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'{}',$7,$8,$9,$10,$11,$12,$13,$14,$14)
       ON CONFLICT (id) DO NOTHING`,
      [t[0], WS_ID, t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8],
       new Date(Date.now() + (t[5] === "created" ? -3600000 : 2 * 3600000)).toISOString(), // 超时样例 due_at 已过
       t[5] === "done" ? JSON.stringify({ text: t[3] === "exchange" ? "换新件已发出，顺丰单号已推送。" : "差价 ¥4 已原路退回，感谢您对价保政策的信任。", rating: { score: 5 } }) : null,
       `seed-${t[0]}`, new Date(Date.now() - t[9] * 3600000).toISOString()],
    );
  }
  const tl2: Array<[string, string, string, string, string, number]> = [
    ["tck-seed-004", "create", "c_user", "cu-liuna", "对话中确认换货", 300],
    ["tck-seed-004", "assign", "agent", "agt-service-desk", "智能分派 → 售后组（换货专线）", 299],
    ["tck-seed-004", "complete", "staff", "换货专线-小周", "换新件已发出并推送单号", 290],
    ["tck-seed-005", "create", "c_user", "cu-mueller", "视频诊断建单（保修内）", 120],
    ["tck-seed-005", "assign", "agent", "agt-service-desk", "智能分派 → 跨境售后组", 119],
    ["tck-seed-005", "start", "staff", "Lily", "已安排德国海外仓换新件出库", 100],
    ["tck-seed-006", "create", "c_user", "cu-wangfang", "订单页自助申请退货", 60],
    ["tck-seed-006", "assign", "agent", "agt-service-desk", "智能分派 → 售后组", 59],
    ["tck-seed-007", "create", "c_user", "cu-sato", "支付宝小程序提交", 1560],
    ["tck-seed-008", "create", "c_user", "cu-liuna", "价保自助申请转入", 1800],
    ["tck-seed-008", "assign", "agent", "agt-service-desk", "智能分派 → 客服专家组", 1799],
    ["tck-seed-008", "complete", "staff", "价保专员-阿May", "差价 ¥4 已原路退回", 1500],
  ];
  for (const e of tl2) {
    await svcQ(
      `INSERT INTO c_ticket_events (workspace_id, ticket_id, action, actor_type, actor_id, detail, created_at)
       SELECT $1,$2,$3,$4,$5,$6::jsonb,$7
       WHERE NOT EXISTS (SELECT 1 FROM c_ticket_events WHERE ticket_id=$2 AND action=$3 AND actor_id=$4)`,
      [WS_ID, e[0], e[1], e[2], e[3], JSON.stringify({ note: e[4] }), new Date(Date.now() - e[5] * 60000).toISOString()],
    );
  }
  const notifs2: Array<[string, string, string, string, number]> = [
    ["ntf-seed-004", "cu-liuna", "ticket.completed", "您的换货工单「原木置物架换货」已办结：换新件已发出，顺丰单号已推送。欢迎评价。", 285],
    ["ntf-seed-005", "cu-mueller", "ticket.accepted", "Ihr After-Sales-Ticket「GaN-Ladegerät」wurde angenommen, Ersatz wird aus dem DE-Lager versandt.", 115],
    ["ntf-seed-006", "cu-wangfang", "ticket.accepted", "您的退货工单「真空压缩袋 8 件套退货」已受理，上门取件时间将短信通知。", 58],
    ["ntf-seed-007", "cu-sato", "sla.escalated", "お客様のお問い合わせ「ケーブル断線」は受付超時のため至急対応に格上げし、担当マネージャーが監督します。", 60],
    ["ntf-seed-008", "cu-liuna", "ticket.completed", "您的价保申请已通过：差价 ¥4 已原路退回。感谢您对熊猫优选的信任。", 1495],
  ];
  for (const n of notifs2) {
    await svcQ(
      `INSERT INTO c_notifications (workspace_id, c_user_id, channel, kind, payload, driver, status, created_at)
       SELECT $1,$2,'wechat-mini',$3,$4::jsonb,'mock','delivered',$5
       WHERE NOT EXISTS (SELECT 1 FROM c_notifications WHERE c_user_id=$2 AND kind=$3 AND payload->>'text'=$6)`,
      [WS_ID, n[1], n[2], JSON.stringify({ text: n[3], mock: true }), new Date(Date.now() - n[4] * 60000).toISOString(), n[3]],
    );
  }
  console.log("✓ 买家服务前台扩充运行态：多客群买家×4 / 会员×2 / 订单×3 / 会话×4（含图片/视频多模态+日语）/ 工单×5（含 SLA 超时样例）/ 时间线×11 / 通知×5");

  await gw.end();
  console.log("种子数据完成 ✅（熊猫优选集团演示数据集就绪）");
}

main().catch((err) => {
  console.error("seed 失败：", err?.message ?? err);
  process.exit(1);
});
