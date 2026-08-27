/**
 * scripts/seed-boost.ts · 熊猫优选集团电商经营饱满运行态增强包（客群：电商创始人/运营总监）（SALES-DEMO）
 * 用法：pnpm db:seed:boost（幂等：事件存在即跳过、审批同 ID 跳过）
 */
import pg from "pg";
import { eventHash, safeParseReplayAwareEvent } from "@workloom/base/workdata";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:workloom@localhost:5432/workloom";
const GATEWAY_URL = process.env.DATABASE_GATEWAY_URL ?? "postgres://workloom_gateway:workloom_dev_gateway@localhost:5432/workloom";
const TENANT_ID = "tenant-demo";
const WS_ID = "ws-panda";
const WS_NAME = "熊猫优选集团";
const FENCE_VERSION = "ecom-baseline/v1"; // 与 bundles/ecommerce/fences/ecom-baseline.yml 一致
const GENESIS_HASH = "GENESIS";

const now = Date.now();
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const who = (id: string, version = "v1.0") => ({ type: "agent" as const, id, version });
const ctx = (time: string) => ({ tenant_id: TENANT_ID, workspace_id: WS_ID, time, stage: "stable", store: WS_NAME });
const mt = { model_id: "mock-ecommerce-001", tier: "standard", window: "peak", credits: 1 };
const receipt = (time: string) => ({ synced: true, snapshot_uri: "data/snapshots/boost.png", verified_at: time });
const ri = (rule_id: string, result = "pass") => [{ rule_id, version: FENCE_VERSION, result }];

const EVENTS: unknown[] = [
  { event_id: "E-SEED-BT-0101", who: who("biz-analyst"), context: ctx(at(2800)), object: { type: "order", id: "dau-d1", label: "今日订单大盘" },
    decision: { action: "order.daily.summary", after: {"orders": 96_800, "gmv_cny": 3120e4, "gmv_usd": 186e4, "shops": {"天猫": 18_200, "京东": 12_600, "抖音": 15_400, "亚马逊": 9_800, "其他": 40_800}}, basis: ["13 平台实时同步"] },
    rule_impact: [], receipt: receipt(at(2800)), model_trace: mt },
  { event_id: "E-SEED-BT-0102", who: who("tmall-ads"), context: ctx(at(2600)), object: { type: "ad_campaign", id: "CAMP-TM-2210", label: "双11 预热直通车" },
    decision: { action: "ads.budget.raise", after: {"plan": "双11 预热直通车", "from": 180e4, "to": 260e4, "change_pct": 0.44, "reason": "大促预热提量，日预算上调 44%", "roi_est": "+18%"}, basis: ["大促作战室预算模型"] },
    rule_impact: ri("R4","review"), receipt: receipt(at(2600)), model_trace: mt },
  { event_id: "E-SEED-BT-0103", who: who("multi-reconciler"), context: ctx(at(2400)), object: { type: "settlement", id: "rc-d", label: "13 平台月结对账" },
    decision: { action: "settlement.reconcile", after: {"orders": 2_860_000, "diff_rate": 0.003, "platforms": 13, "currencies": 5, "note": "连续 30 天差异率 ≤0.3%，全部立项闭环"}, basis: ["订单×账单×广告/售后三方对账 SOP"] },
    rule_impact: [], receipt: receipt(at(2400)), model_trace: mt },
  { event_id: "E-SEED-BT-0104", who: who("douyin-cs"), context: ctx(at(2200)), object: { type: "review", id: "rv-88201", label: "差评 2h 处置" },
    decision: { action: "review.reply", after: {"rating": 2, "topic": "快充头发热", "sla": "1小时42分", "comp": "免费换新（政策内）", "public": true}, basis: ["差评 2h SLA（R9）"] },
    rule_impact: ri("R9","review"), receipt: receipt(at(2200)), model_trace: mt },
  { event_id: "E-SEED-BT-0105", who: who("service-qc"), context: ctx(at(2100)), object: { type: "review", id: "rv-88215", label: "好评资产化" },
    decision: { action: "review.asset.boost", after: {"rating": 5, "topic": "收纳箱承重实测", "action": "置顶 + 沉淀 FAQ + 入详情页素材库", "exposures": 18_600}, basis: ["好评资产化（review-asset-mining）"] },
    rule_impact: [], receipt: receipt(at(2100)), model_trace: mt },
  { event_id: "E-SEED-BT-0106", who: who("cs-en"), context: ctx(at(2000)), object: { type: "cs_session", id: "cs-5521", label: "多模态工单·截图" },
    decision: { action: "service.ticket.complete", after: {"modality": "screenshot", "issue": "买家截图：优惠券未抵扣报错页", "resolved": "识别错误码 + 补发券", "sla_min": 12, "rating": 5}, basis: ["截图管线 15 分钟 SLA"] },
    rule_impact: [], receipt: receipt(at(2000)), model_trace: mt },
  { event_id: "E-SEED-BT-0107", who: who("cs-eu"), context: ctx(at(1900)), object: { type: "cs_session", id: "cs-5522", label: "多模态工单·视频" },
    decision: { action: "service.ticket.complete", after: {"modality": "video", "issue": "买家视频：置物架安装卡顿", "resolved": "关键帧比对 → 分步安装指导", "sla_min": 26, "rating": 5}, basis: ["视频管线 30 分钟 SLA"] },
    rule_impact: [], receipt: receipt(at(1900)), model_trace: mt },
  { event_id: "E-SEED-BT-0108", who: who("cs-apac"), context: ctx(at(1800)), object: { type: "cs_session", id: "cs-3392", label: "夜间多语种客服" },
    decision: { action: "cs.reply", after: {"lang": "ja", "intent": "物流查询", "duration_s": 47, "resolved": true, "hour": "02:13", "trusteeship": "夜班 AI 托管"}, basis: ["跨境店 24h 覆盖（夜班班组主场）"] },
    rule_impact: ri("R16","pass"), receipt: receipt(at(1800)), model_trace: mt },
  { event_id: "E-SEED-BT-0109", who: who("competitor-radar"), context: ctx(at(1600)), object: { type: "price", id: "parity-al", label: "价格倒挂警报" },
    decision: { action: "price.parity.watch", after: {"sku": "SKU-HM-2001", "issue": "拼多多 ¥75 vs 天猫 ¥89 倒挂 15.7%", "action": "已告警并生成调价建议"}, basis: ["多平台价格守护（R18）"] },
    rule_impact: ri("R18","review"), receipt: receipt(at(1600)), model_trace: mt },
  { event_id: "E-SEED-BT-0110", who: who("amz-fba"), context: ctx(at(1400)), object: { type: "stock", id: "fba-rp", label: "FBA 补货" },
    decision: { action: "fba.replenish", after: {"sku": "SKU-3C-1001", "qty": 12_000, "route": "东莞一仓 → 美西 FBA", "eta_days": 18, "peak": "黑五备货"}, basis: ["黑五备货沙盘（promo-stockup）"] },
    rule_impact: [], receipt: receipt(at(1400)), model_trace: mt },
  { event_id: "E-SEED-BT-0111", who: who("demand-planner"), context: ctx(at(1300)), object: { type: "stock", id: "SKU-3C-1002", label: "断货预警" },
    decision: { action: "stock.stockout.alert", after: {"days_cover": 6.1, "daily_sales": 950, "inbound_in_transit": 0, "action": "已下紧急采购单请示"}, basis: ["R7 断货预警 <7 天且在途为 0"] },
    rule_impact: ri("R7","review"), receipt: receipt(at(1300)), model_trace: mt },
  { event_id: "E-SEED-BT-0112", who: who("ip-shield"), context: ctx(at(1200)), object: { type: "listing", id: "B0CXYZ8899", label: "跟卖驱赶周报" },
    decision: { action: "hijack.weekly", after: {"detected": 7, "evicted": 6, "buybox_recover": "98.2%", "channels": ["亚马逊 US", "亚马逊 EU"]}, basis: ["IP 护盾 + 跟卖预警（R19）"] },
    rule_impact: [], receipt: receipt(at(1200)), model_trace: mt },
  { event_id: "E-SEED-BT-0113", who: who("fx-settler"), context: ctx(at(1100)), object: { type: "fx_rate", id: "fx-week", label: "多币种结汇" },
    decision: { action: "fx.settle", after: {"usd": 186e4, "eur": 42e4, "jpy": 680e4, "gbp": 18e4, "hedge": "30% 远期锁汇已执行"}, basis: ["5 币种月结 + 套保策略"] },
    rule_impact: [], receipt: receipt(at(1100)), model_trace: mt },
  { event_id: "E-SEED-BT-0114", who: who("night-shift"), context: ctx(at(480)), object: { type: "night_package", id: "np-d", label: "夜班日报" },
    decision: { action: "night.package.deliver", after: {"overnight": {"cs_sessions": 4_120, "hijack_scans": 14, "reconcile_platforms": 13, "resolved": "100%", "escalation": 0}, "note": "跨时区托管全覆盖"}, basis: ["夜班值守（美欧白天 = 北京夜）"] },
    rule_impact: [], receipt: receipt(at(480)), model_trace: mt },
  { event_id: "E-SEED-BT-0115", who: who("group-ceo"), context: ctx(at(60)), object: { type: "shop", id: "brief-d", label: "CEO 晨报" },
    decision: { action: "ceo.briefing", after: {"gmv_cny": "3120 万", "orders": 96_800, "acos": "0.21", "reconcile": "差异率 0.3% 内(30d)", "review_sla": "100%", "today": "双11 预算请示 1 件 + 紧急采购请示 1 件"}, basis: ["晨报节拍"] },
    rule_impact: [], receipt: receipt(at(60)), model_trace: mt },
];

const APPROVALS = [
  { id: "apr-boost-h1", eventRef: "E-SEED-BT-0102",
    snapshot: { action: "ads.budget.raise", summary: "双11 预热预算审批：直通车日耗 ¥180 万 → ¥260 万（+44%）", title: "双11 预算 ¥180万→¥260万",
      ceo_rationale: "大促预热期流量成本上行 22%，提量后预估 ROI +18%；仍处集团广告预算池 T2 档内", rule_version: "R4 ecom-baseline/v1", gate: "必审",
      params: {"plan": "双11 预热直通车", "from": 180e4, "to": 260e4, "change_pct": 0.44},
      before: {"daily_budget": 180e4}, after: {"daily_budget": 260e4, "roi_est": "+18%"} } },
  { id: "apr-boost-h2", eventRef: "E-SEED-BT-0111",
    snapshot: { action: "procurement.urgent.request", summary: "紧急采购审批：氮化镓快充头 12 万台 ¥420 万（东莞锂威，12 天交期）", title: "紧急采购 12 万台 ¥420 万",
      ceo_rationale: "可售天数 6.1 天且黑五在途为 0；供应商评分 4.6，建议分批到货（6 万 + 6 万）降断货风险", rule_version: "R7+R20 ecom-baseline/v1", gate: "必审",
      params: {"sku": "SKU-3C-1002", "qty": 120_000, "amount_cny": 420e4, "lead_time_days": 12},
      before: {"days_cover": 6.1}, after: {"qty": 120_000, "amount_cny": 420e4, "split": "6万+6万 分批"} } },
];

async function main() {
  const owner = new pg.Client({ connectionString: DATABASE_URL });
  await owner.connect();
  let aprNew = 0;
  for (const a of APPROVALS) {
    const exists = await owner.query(`SELECT 1 FROM approvals WHERE approval_id=$1`, [a.id]);
    if ((exists.rowCount ?? 0) > 0) continue;
    await owner.query(
      `INSERT INTO approvals (approval_id, tenant_id, workspace_id, event_id, channel, status, tier, snapshot, created_at)
       VALUES ($1,$2,$3,$4,'inapp','pending','l4_chairman',$5,$6)`,
      [a.id, TENANT_ID, WS_ID, (a as unknown as { eventRef: string }).eventRef, JSON.stringify(a.snapshot), at(90)],
    );
    aprNew++;
  }
  console.log(`✓ 待审批：新写入 ${aprNew} 条（L4 董事长级）`);
  await owner.end();

  const gw = new pg.Client({ connectionString: GATEWAY_URL });
  await gw.connect();
  await gw.query("BEGIN");
  await gw.query("SELECT set_config('app.workspace_id', $1, true)", [WS_ID]);
  await gw.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_ID]);
  const last = await gw.query(`SELECT hash FROM biz_events WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY seq DESC LIMIT 1`, [TENANT_ID, WS_ID]);
  let prevHash = (last.rows[0]?.hash as string) ?? GENESIS_HASH;
  let inserted = 0, skipped = 0;
  for (const raw of EVENTS) {
    const ev = raw as { event_id: string; context: { time: string } };
    const checked = safeParseReplayAwareEvent(ev as never);
    if (!checked.success) throw new Error(`事件 ${ev.event_id} 未过校验：${checked.error.message}`);
    const dup = await gw.query(`SELECT 1 FROM biz_events WHERE tenant_id=$1 AND event_id=$2`, [TENANT_ID, ev.event_id]);
    if ((dup.rowCount ?? 0) > 0) { skipped++; continue; }
    const payload = JSON.stringify(checked.data);
    const hash = eventHash(prevHash, checked.data);
    const res = await gw.query<{ inserted: boolean }>(
      `SELECT * FROM append_event_insert($1,$2,$3,$4,$5,$6,$7,$8)`,
      [ev.event_id, TENANT_ID, WS_ID, null, payload, prevHash, hash, ev.context.time],
    );
    if (res.rows[0]?.inserted) { prevHash = hash; inserted++; } else skipped++;
  }
  await gw.query("COMMIT");
  await gw.end();
  console.log(`✓ 剧本事件：新写入 ${inserted} 条，幂等跳过 ${skipped} 条`);
  console.log("熊猫优选集团饱满运行态就绪 ✅（日均 9.68 万单 · ACoS 0.21 · 对账差异 ≤0.3%(30d) · 差评2h SLA · L4决策2件）");
}

main().catch((e) => { console.error(e); process.exit(1); });
