/**
 * A7 · 样板间管家（twin-genie）—— 电商数据生成器 / 售前演示的活体兜底
 * 用法：pnpm demo:twin:live（常驻进程，默认端口 8790）
 *
 * 三大职责（对应 docs/TWIN-COVERAGE.md 的兜底矩阵）：
 *  ① live tick    —— 每 5 分钟按真实节奏写入环境事件（订单/客服会话/出库），画面永不冻结；
 *  ② 场景合成 API  —— 客户现场点名场景，秒级生成完整剧情（事件+审批+留痕三段式）；
 *  ③ 空态守卫     —— 启动时巡检各 UI 域最小数据量，低于阈值自动补齐（演示永不冷场）。
 *
 * 纪律：事件只经 gateway 角色写入（F1.2）、逐条过附录 E 校验、哈希链与生产同口径。
 *      Genie 事件编号 E-9 区段（与种子 E-88xx/孪生 E-2xxxx 隔离），写入即真实数据，可被 verify-chain 验证。
 */
import http from "node:http";
import pg from "pg";
import { safeParseBusinessEvent } from "@workloom/shared";
import { eventHash } from "@workloom/base/workdata";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:workloom@localhost:5432/workloom";
const GATEWAY_URL =
  process.env.DATABASE_GATEWAY_URL ??
  "postgres://workloom_gateway:workloom_dev_gateway@localhost:5432/workloom";
const PORT = Number(process.env.GENIE_PORT ?? 8790);
const TENANT_ID = "tenant-demo";
const WS_ID = "ws-panda";
const WS_NAME = "熊猫优选集团";
const FENCE_VERSION = "ecom-baseline/v3";
const SISTER_STORES = ["ws-xixi", "ws-manlong"] as const;

const rand = () => Math.random();
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const iso = (d: Date) => d.toISOString();

interface GenieEvent {
  event_id: string;
  who: { type: "human" | "agent" | "system"; id: string; version?: string };
  context: { tenant_id: string; workspace_id: string; time: string; channel?: string; stage?: string; store?: string; [k: string]: unknown };
  object: { type: string; id?: string; [k: string]: unknown };
  decision: { action: string; before?: unknown; after?: unknown; basis?: string[]; [k: string]: unknown };
  rule_impact: Array<{ rule_id: string; version: string; result: string }>;
  [k: string]: unknown;
}

let gseq = 0;
const GBASE = Number(Date.now().toString().slice(-8)) * 1000; // 进程内唯一数字区段（附录 E：event_id 须形如 E-12345）
const nextId = () => `E-${GBASE + ++gseq}`;
const ctx = (t: Date, channel?: string) => ({
  tenant_id: TENANT_ID, workspace_id: WS_ID, time: iso(t), stage: "stable", store: WS_NAME,
  ...(channel ? { channel } : {}),
});
const SKUS = [
  { id: "SKU-3C-MAG-001", label: "磁吸充电宝", base: 129 },
  { id: "SKU-HOME-ORG-014", label: "收纳箱三件套", base: 79 },
  { id: "SKU-3C-AUDIO-027", label: "降噪蓝牙耳机", base: 299 },
] as const;
const CHANNELS = ["天猫", "京东", "拼多多", "抖音"] as const;
const FAQ_TOPICS = ["发货时效", "包邮门槛", "退换政策", "尺码选择", "发票开具", "优惠叠加", "修改地址"] as const;

let owner: pg.Client;
let gw: pg.Client;

/** 事件落库（哈希链续接 + 附录 E 校验），返回是否真实写入 */
async function appendEvent(ev: GenieEvent, wsId = WS_ID): Promise<boolean> {
  const checked = safeParseBusinessEvent(ev);
  if (!checked.success) throw new Error(`Genie 事件 ${ev.event_id} 未过附录 E 校验：${checked.error.message}`);
  const tail = await gw.query(`SELECT hash FROM biz_events WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY seq DESC LIMIT 1`, [TENANT_ID, wsId]);
  const prevHash = (tail.rows[0]?.hash as string) ?? "GENESIS";
  const payload = JSON.stringify(checked.data);
  const hash = eventHash(prevHash, checked.data);
  const res = await gw.query(
    `INSERT INTO biz_events (event_id, tenant_id, workspace_id, session_id, payload, prev_hash, hash, created_at)
     VALUES ($1,$2,$3,NULL,$4,$5,$6,$7) ON CONFLICT (tenant_id, event_id) DO NOTHING RETURNING seq`,
    [ev.event_id, TENANT_ID, wsId, payload, prevHash, hash, ev.context.time],
  );
  return !!(res.rowCount && res.rowCount > 0);
}

async function addApproval(eventId: string, level: "review" | "block", title: string, pending = true) {
  await gw.query(
    `INSERT INTO approvals (approval_id, tenant_id, workspace_id, event_id, channel, status, gesture, snapshot, decided_by, decided_at)
     VALUES ($1,$2,$3,$4,'inapp',$5,$6,$7,$8,$9) ON CONFLICT (event_id, channel) DO NOTHING`,
    [
      `apr-${eventId.toLowerCase()}`, TENANT_ID, WS_ID, eventId,
      pending ? "pending" : "approved",
      pending ? null : JSON.stringify({ type: "approve", weight: 1 }),
      JSON.stringify({ title, level }),
      pending ? null : "MEM-001",
      pending ? null : iso(new Date()),
    ],
  );
}

/* ================= 环境事件（live tick 用） ================= */
function ambientEvent(): GenieEvent {
  const t = new Date();
  const kind = pick(["order", "cs_session", "warehouse", "review_good"] as const);
  const id = nextId();
  if (kind === "order") {
    const sku = pick(SKUS);
    return {
      event_id: id, who: { type: "agent", id: "order-agent" }, context: ctx(t, pick(CHANNELS)),
      object: { type: "order", id: `OD-${int(100000, 999999)}` },
      decision: { action: "order.confirm", params: { qty: int(1, 5), sku: sku.id }, after: { status: "confirmed" }, basis: ["库存与地址校验通过"] },
      rule_impact: [],
    };
  }
  if (kind === "cs_session") {
    const topic = pick(FAQ_TOPICS);
    const hit = rand() < 0.78;
    return {
      event_id: id, who: { type: "agent", id: "cs-agent" }, context: ctx(t),
      object: { type: "cs_session", id: `CS-${int(10000, 99999)}` },
      decision: {
        action: "call.summary",
        params: { intent: hit ? "faq" : "transfer", topic, faq_hit: hit, duration_sec: int(25, 180) },
        after: hit ? { answered: true, answer_source: "faq_kb" } : { transferred: "human-agent" },
        basis: [hit ? `faq_kb 命中「${topic}」` : "超出知识库→转人工"],
      },
      rule_impact: [],
    };
  }
  if (kind === "warehouse") {
    return {
      event_id: id, who: { type: "agent", id: "warehouse-agent" }, context: ctx(t),
      object: { type: "task", id: `WH-${int(10000, 99999)}` },
      decision: { action: "task.complete", after: { warehouse: pick(["华东仓", "华南仓", "美西海外仓"] as const), photo_check: "pass", minutes: int(8, 20) }, basis: ["出库复核+拍照 AI 初检达标"] },
      rule_impact: [],
    };
  }
  return {
    event_id: id, who: { type: "agent", id: "review-agent" }, context: ctx(t, pick(CHANNELS)),
    object: { type: "review", id: `RV-${int(10000, 99999)}` },
    decision: { action: "review.reply", params: { rating: int(4, 5) }, after: { published: true }, basis: ["好评感谢模板+个性化元素"] },
    rule_impact: [],
  };
}

/* ================= 场景合成（客户点名的完整剧情） ================= */
type ScenarioKind = "bad_review" | "parity_alert" | "stockout_purchase" | "review_sla" | "return_spike" | "incident" | "order_burst" | "faq_candidate";
const SCENARIOS: ScenarioKind[] = ["bad_review", "parity_alert", "stockout_purchase", "review_sla", "return_spike", "incident", "order_burst", "faq_candidate"];

async function runScenario(kind: ScenarioKind): Promise<string[]> {
  const t = new Date();
  const written: string[] = [];
  const push = async (ev: GenieEvent, approval?: { level: "review" | "block"; title: string }) => {
    if (await appendEvent(ev)) written.push(ev.event_id);
    if (approval) await addApproval(ev.event_id, approval.level, approval.title, true);
  };

  if (kind === "bad_review") {
    const id = nextId();
    await push({
      event_id: id, who: { type: "agent", id: "review-agent" }, context: ctx(t, pick(CHANNELS)),
      object: { type: "review", id: `RV-${int(10000, 99999)}` },
      decision: {
        action: "review.reply", params: { rating: 2 },
        after: { draft: "非常抱歉给您带来不好的体验，我们已核实商品异响问题并安排补发，运费差价将在 24h 内原路退回……" },
        basis: ["差评防御窗口：共情→核实→整改→邀约回购", "店铺档案 forbidden 已核对"],
      },
      rule_impact: [{ rule_id: "R9", version: FENCE_VERSION, result: "review" }],
    }, { level: "review", title: "差评 2 小时防御窗口（R9 必审）—— 现场点名场景" });
  } else if (kind === "parity_alert") {
    const id = nextId();
    await push({
      event_id: id, who: { type: "agent", id: "competitor-agent" }, context: ctx(t, "拼多多"),
      object: { type: "platform", id: "拼多多" },
      decision: {
        action: "price.publish",
        params: { channel_price: 69, other_channel_min: 89 },
        after: { blocked: true, gap_pct: -22.5 },
        basis: ["发布价 ¥69 低于他平台最低 ¥89，倒挂 22.5% > 15%，多平台价格守护熔断（R18）"],
      },
      rule_impact: [{ rule_id: "R18", version: FENCE_VERSION, result: "blocked" }],
    }, { level: "block", title: "价格倒挂熔断（R18）—— 现场点名场景" });
  } else if (kind === "stockout_purchase") {
    const id = nextId();
    const sku = pick(SKUS);
    await push({
      event_id: id, who: { type: "agent", id: "demand-planner" }, context: ctx(t),
      object: { type: "stock", id: sku.id },
      decision: {
        action: "purchase.urgent", params: { days_of_stock: 5, inbound_qty: 0, sku: sku.id },
        after: { purchase_order: `PO-${int(10000, 99999)}`, pending: true },
        basis: ["断货风险 <7 天且补货在途为 0，自动下紧急采购单请示（R7）"],
      },
      rule_impact: [{ rule_id: "R7", version: FENCE_VERSION, result: "review" }],
    }, { level: "review", title: "爆款断货预警·紧急采购请示（R7）—— 现场点名场景" });
  } else if (kind === "review_sla") {
    const id = nextId();
    await push({
      event_id: id, who: { type: "agent", id: "review-agent" }, context: ctx(t, "京东"),
      object: { type: "review", id: `RV-${int(10000, 99999)}` },
      decision: {
        action: "alert.escalate", params: { review_age_hours: 3, replied: false, rating: 2 },
        after: { escalated_to: "MEM-001", sla_hours: 2 },
        basis: ["差评超 2h 未响应，自动升级店长（R9）"],
      },
      rule_impact: [{ rule_id: "R9", version: FENCE_VERSION, result: "review" }],
    }, { level: "review", title: "差评 SLA 升级（R9）—— 现场点名场景" });
  } else if (kind === "return_spike") {
    const id = nextId();
    const sku = pick(SKUS);
    await push({
      event_id: id, who: { type: "agent", id: "service-qc" }, context: ctx(t),
      object: { type: "aftersale", id: sku.id },
      decision: {
        action: "aftersale.anomaly", params: { return_rate: 0.18, baseline_return_rate: 0.08, sku: sku.id },
        after: { heatmap: "抖音直播间场次集中" },
        basis: ["退货率 18% > 基线 8%×1.5，疑似批次质量缺陷，派单质检（多模态截图线索联动）"],
      },
      rule_impact: [{ rule_id: "R20", version: FENCE_VERSION, result: "review" }],
    }, { level: "review", title: "退货率超基线·质检派单（R20）—— 现场点名场景" });
  } else if (kind === "incident") {
    const id = nextId();
    await push({
      event_id: id, who: { type: "system", id: "incident-monitor" }, context: ctx(t, "夜班"),
      object: { type: "alert", id: `INC-${int(1000, 9999)}` },
      decision: {
        action: "incident.postmortem",
        params: { breakpoint: pick(["平台授权失效", "接口超时", "账号风控预警"] as const), fallback_level: "manual_takeover", root_cause: pick(["数据缺失", "规则未覆盖"] as const) },
        after: { fix: "根因-优化动作已映射，进整改工单" },
        basis: ["三级兜底结案 → 根因强制四分类（未分类不许结案）"],
      },
      rule_impact: [],
    });
  } else if (kind === "order_burst") {
    for (let k = 0; k < 5; k++) {
      const sku = pick(SKUS);
      await push({
        event_id: nextId(), who: { type: "agent", id: "order-agent" }, context: ctx(new Date(t.getTime() + k * 60_000), pick(CHANNELS)),
        object: { type: "order", id: `OD-${int(100000, 999999)}` },
        decision: { action: "order.confirm", params: { qty: int(1, 5), sku: sku.id }, after: { status: "confirmed" }, basis: ["直播间小高峰：订单连发"] },
        rule_impact: [],
      });
    }
  } else if (kind === "faq_candidate") {
    const topic = pick(FAQ_TOPICS);
    await push({
      event_id: nextId(), who: { type: "agent", id: "cs-agent" }, context: ctx(t),
      object: { type: "cs_session", id: "faq-kb" },
      decision: {
        action: "faq.mine", params: { topic, weekly_hits: int(3, 6) },
        after: { candidate: true, pending_confirm: true },
        basis: [`「${topic}」本周多次被问未命中 → 进入 faq_kb 候选（店长确认入库）`],
      },
      rule_impact: [],
    });
  }
  return written;
}

/* ================= 空态守卫（演示永不冷场） ================= */
async function emptyStateGuard(): Promise<string[]> {
  const fixed: string[] = [];
  const todayCount = async (action: string) => {
    const r = await gw.query(
      `SELECT count(*)::int AS n FROM biz_events
       WHERE tenant_id=$1 AND workspace_id=$2 AND payload->'decision'->>'action'=$3
         AND created_at >= now() - interval '20 hours'`,
      [TENANT_ID, WS_ID, action],
    );
    return r.rows[0].n as number;
  };
  if ((await todayCount("order.confirm")) < 3) {
    for (let k = 0; k < 3; k++) await appendEvent(ambientEvent());
    fixed.push("订单补足 ×3");
  }
  if ((await todayCount("call.summary")) < 2) {
    await appendEvent(ambientEvent());
    fixed.push("客服会话摘要补足");
  }
  const pend = await gw.query(
    `SELECT count(*)::int AS n FROM approvals WHERE tenant_id=$1 AND workspace_id=$2 AND status='pending'`,
    [TENANT_ID, WS_ID],
  );
  if ((pend.rows[0].n as number) < 1) {
    const ids = await runScenario("bad_review");
    if (ids.length) fixed.push("pending 审批补足（差评防御窗口）");
  }
  return fixed;
}

/* ================= 主流程 ================= */
async function main(): Promise<void> {
  owner = new pg.Client({ connectionString: DATABASE_URL });
  await owner.connect();
  const ws = await owner.query(`SELECT id FROM workspaces WHERE id=$1`, [WS_ID]);
  if (ws.rowCount === 0) throw new Error("未检测到种子/孪生数据：请先 pnpm db:seed && pnpm demo:twin（或 demo:twin:restore）");
  await owner.end();
  gw = new pg.Client({ connectionString: GATEWAY_URL });
  await gw.connect();
  await gw.query("SELECT set_config('app.workspace_id', $1, false)", [WS_ID]);
  await gw.query("SELECT set_config('app.tenant_id', $1, false)", [TENANT_ID]);

  const guardFixed = await emptyStateGuard();
  console.log(`✓ 空态守卫巡检完成${guardFixed.length ? "：补齐 " + guardFixed.join("、") : "（各域数据充足）"}`);

  // live tick：每 5 分钟 1–2 条环境事件；每 30 分钟跨店快照
  setInterval(async () => {
    try {
      for (let k = 0; k < int(1, 2); k++) await appendEvent(ambientEvent());
    } catch (e) { console.error("tick 写入失败：", (e as Error).message); }
  }, 5 * 60_000);
  setInterval(async () => {
    try {
      for (const sid of SISTER_STORES) {
        const wsRow = await gw.query(`SELECT id FROM workspaces WHERE id=$1`, [sid]);
        if (!wsRow.rowCount) continue;
        const id = nextId();
        await appendEvent({
          event_id: id, who: { type: "system", id: "cockpit-daily" }, context: { ...ctx(new Date()), workspace_id: sid },
          object: { type: "store", id: sid },
          decision: { action: "store.daily.summary", after: { gmv: int(80, 400) * 10000, margin_rate: 0.18 + rand() * 0.12 }, basis: ["驾驶舱心跳快照"] },
          rule_impact: [],
        }, sid);
      }
    } catch (e) { console.error("跨店心跳失败：", (e as Error).message); }
  }, 30 * 60_000);

  const server = http.createServer(async (req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body, null, 2));
    };
    try {
      if (req.method === "GET" && req.url === "/genie/health") {
        const n = await gw.query(`SELECT count(*)::int AS n FROM biz_events WHERE tenant_id=$1`, [TENANT_ID]);
        return send(200, { ok: true, service: "workloom-twin-genie", events: n.rows[0].n, scenarios: SCENARIOS });
      }
      if (req.method === "GET" && req.url === "/genie/scenarios") return send(200, { scenarios: SCENARIOS });
      if (req.method === "POST" && req.url === "/genie/scenario") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const { kind } = JSON.parse(body || "{}") as { kind?: ScenarioKind };
        if (!kind || !SCENARIOS.includes(kind)) return send(400, { error: `kind 须为 ${SCENARIOS.join("/")} 之一` });
        const ids = await runScenario(kind);
        return send(200, { ok: true, kind, events: ids });
      }
      if (req.method === "POST" && req.url === "/genie/tick") {
        const ids: string[] = [];
        for (let k = 0; k < int(2, 4); k++) {
          const ev = ambientEvent();
          if (await appendEvent(ev)) ids.push(ev.event_id);
        }
        return send(200, { ok: true, events: ids });
      }
      if (req.method === "POST" && req.url === "/genie/guard") return send(200, { ok: true, fixed: await emptyStateGuard() });
      send(404, { error: "not found", routes: ["GET /genie/health", "GET /genie/scenarios", "POST /genie/scenario", "POST /genie/tick", "POST /genie/guard"] });
    } catch (e) {
      send(500, { error: (e as Error).message });
    }
  });
  server.listen(PORT, () => {
    console.log(`✅ 样板间管家已就绪：http://localhost:${PORT}/genie/health`);
    console.log(`   · 场景合成（${SCENARIOS.length} 类）：POST /genie/scenario {"kind":"${SCENARIOS[0]}"}`);
    console.log("   · live tick：每 5 分钟写入环境事件（画面永不冻结）");
    console.log("   · 空态守卫：POST /genie/guard 随时手动巡检补齐");
  });
}

main().catch((err) => {
  console.error("样板间管家启动失败：", err?.message ?? err);
  process.exit(1);
});
