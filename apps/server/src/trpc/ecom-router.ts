/**
 * ecom-router.ts —— 电商真实化路由域（P0–P3 升级落地）
 *
 * 子域：
 *  - datasource：数据源接入中心（0027 ⑩⑪；卡片=授权+同步状态+真实/mock 标注，禁止静默回退）
 *  - decision：金额化决策卡片（金额只能来自 SQL 计算器；decide/转任务写五元事件闭环）
 *  - finance：利润驾驶舱（shop_profit_waterfall/payouts/penalties/payables 投影）
 *  - shipments：头程跟单（批次+八节点时间轴；节点推进写 milestone + 五元事件）
 *  - executors：★ 技能执行体运行入口（数字层 SQL/规则出数，LLM 只做叙事）
 *  - importer：真实表格口径导入（上传→映射→人工确认→落库；映射必须确认才执行）
 *
 * 纪律：全部读路径走 RLS 事务上下文（set_config 同事务）；写路径五元事件留痕（gatewayAppend）；
 *      金额永远 SQL 出数（铁律①），本文件不出现任何 LLM 生成的数字。
 */
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { getAppPool, getGatewayPool } from "@workloom/db";
import { gatewayAppend } from "@workloom/base/workdata";
import {
  assertCardIntegrity, buildTaskPayload, computeDecisionCards, listDecisionCards,
  DECISION_ACTIONS, type DecisionCard,
} from "@workloom/base/decision-cards";
import { skillExecutors } from "@workloom/audit-engine";
import { realConnectorStatus } from "@workloom/connectors";
import { protectedProcedure, router, scopeOf, writeProcedure } from "./context.js";

const newId = (prefix: string) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;

/** RLS 事务上下文内执行（读路径统一模式，同 router.ts fenceRouter 口径） */
async function withRls<T>(scope: { tenantId: string; workspaceId: string }, fn: (q: pg.PoolClient) => Promise<T>): Promise<T> {
  const app = getAppPool();
  const client = await app.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.workspace_id', $1, true)", [scope.workspaceId]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [scope.tenantId]);
    const r = await fn(client);
    await client.query("COMMIT");
    return r;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** 写五元事件（决策/数据源/导入域统一出口；actor=当前人类成员） */
async function appendEcomEvent(
  ctx: { identity: { memberNo: string } },
  scope: { tenantId: string; workspaceId: string },
  draft: { objectType: string; objectId: string; action: string; after?: Record<string, unknown>; objectLabel?: string },
): Promise<string> {
  const r = await gatewayAppend(getGatewayPool(), {
    ...scope,
    actor: { id: ctx.identity.memberNo, type: "human" },
  }, {
    who: { type: "human", id: ctx.identity.memberNo },
    context: { tenant_id: scope.tenantId, workspace_id: scope.workspaceId, time: new Date().toISOString() },
    object: { type: draft.objectType, id: draft.objectId, label: draft.objectLabel },
    decision: { action: draft.action, after: draft.after },
    rule_impact: [],
  });
  return r.eventId;
}

/* ================= 数据源接入中心 ================= */

const datasourceRouter = router({
  /** 卡片列表：DB 数据源 + 连接器真实/mock 状态（接入中心首页） */
  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = scopeOf(ctx.identity);
    const sources = await withRls(scope, async (q) => {
      const r = await q.query(
        `SELECT id, platform, shop_id, label, auth_kind, enabled,
                last_sync_at, last_sync_status, sync_lag_sec, created_at
           FROM data_sources WHERE workspace_id = $1
          ORDER BY platform, shop_id`,
        [scope.workspaceId],
      );
      return r.rows as unknown as Array<Record<string, unknown>>;
    });
    return { sources, connectors: realConnectorStatus() };
  }),

  /** 同步记录（卡片下钻） */
  syncLogs: protectedProcedure
    .input(z.object({ dataSourceId: z.string().min(1), limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      return withRls(scope, async (q) => {
        const r = await q.query(
          `SELECT id, started_at, finished_at, status, rows_read, rows_written, error
             FROM data_source_sync_logs WHERE workspace_id = $1 AND data_source_id = $2
            ORDER BY started_at DESC LIMIT $3`,
          [scope.workspaceId, input.dataSourceId, input.limit],
        );
        return r.rows as unknown as Array<Record<string, unknown>>;
      });
    }),

  /** 新增数据源（登记授权引用；凭据本体走 credentials 表不落明文） */
  add: writeProcedure
    .input(z.object({
      platform: z.string().min(1).max(40),
      shopId: z.string().min(1).max(64),
      label: z.string().min(1).max(80),
      authKind: z.enum(["api", "rpa", "import"]).default("api"),
      credentialRef: z.string().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const id = newId("ds");
      await withRls(scope, async (q) => {
        await q.query(
          `INSERT INTO data_sources (id, workspace_id, platform, shop_id, label, auth_kind, credential_ref)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (workspace_id, platform, shop_id)
           DO UPDATE SET label = EXCLUDED.label, auth_kind = EXCLUDED.auth_kind,
                         credential_ref = EXCLUDED.credential_ref, updated_at = now()`,
          [id, scope.workspaceId, input.platform, input.shopId, input.label, input.authKind, input.credentialRef ?? null],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "data_source", objectId: id, objectLabel: input.label,
        action: "datasource.add",
        after: { platform: input.platform, shop_id: input.shopId, auth_kind: input.authKind },
      });
      return { id, eventId };
    }),

  /** 启停开关（卡片 toggle） */
  toggle: writeProcedure
    .input(z.object({ dataSourceId: z.string().min(1), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      await withRls(scope, async (q) => {
        await q.query(
          `UPDATE data_sources SET enabled = $3, updated_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.dataSourceId, input.enabled],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "data_source", objectId: input.dataSourceId,
        action: "datasource.toggle", after: { enabled: input.enabled },
      });
      return { ok: true, eventId };
    }),

  /** 记录一次同步结果（连接器同步器/人工回传共用；同步日志 + 卡片状态刷新，同事务） */
  reportSync: writeProcedure
    .input(z.object({
      dataSourceId: z.string().min(1),
      status: z.enum(["ok", "degraded", "failed"]),
      rowsRead: z.number().int().min(0).default(0),
      rowsWritten: z.number().int().min(0).default(0),
      syncLagSec: z.number().int().min(0).optional(),
      error: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const logId = newId("sl");
      await withRls(scope, async (q) => {
        await q.query(
          `INSERT INTO data_source_sync_logs (id, workspace_id, data_source_id, finished_at, status, rows_read, rows_written, error)
           VALUES ($1, $2, $3, now(), $4, $5, $6, $7)`,
          [logId, scope.workspaceId, input.dataSourceId, input.status, input.rowsRead, input.rowsWritten, input.error ?? null],
        );
        await q.query(
          `UPDATE data_sources
              SET last_sync_at = now(), last_sync_status = $3, sync_lag_sec = $4, updated_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.dataSourceId, input.status, input.syncLagSec ?? null],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "data_source", objectId: input.dataSourceId,
        action: "datasource.sync",
        after: { status: input.status, rows_read: input.rowsRead, rows_written: input.rowsWritten, log_id: logId },
      });
      return { logId, eventId };
    }),
});

/* ================= 金额化决策卡片 ================= */

const decisionRouter = router({
  /** 卡片列表（实时 SQL 计算 × 事件状态投影；pending 优先、金额降序） */
  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = scopeOf(ctx.identity);
    return withRls(scope, async (q) => {
      const cards = await computeDecisionCards(q, scope.workspaceId);
      for (const c of cards) assertCardIntegrity(c); // 出卡前铁律校验（宁缺毋滥）
      return { cards: await listDecisionCards(q, scope.workspaceId, cards) };
    });
  }),

  /** 决策（采纳/驳回；写 decision.card.decided 事件） */
  decide: writeProcedure
    .input(z.object({
      cardId: z.string().regex(/^dc-[a-z0-9-]+$/),
      status: z.enum(["accepted", "dismissed"]),
      reason: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "task", objectId: input.cardId,
        action: DECISION_ACTIONS.decided,
        after: { status: input.status, reason: input.reason },
      });
      return { ok: true, eventId };
    }),

  /** 一键转任务（decision.task.created；载荷含执行者/截止/预期收益，归因飞轮入口） */
  convertToTask: writeProcedure
    .input(z.object({
      cardId: z.string().regex(/^dc-[a-z0-9-]+$/),
      assignee: z.string().max(80).optional(),
      dueAt: z.string().min(10), // ISO 8601
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      // 重新计算取卡片本体（卡片=实时投影，不落地——防止篡改金额后转任务）
      const card = await withRls(scope, async (q) => {
        const cards = await computeDecisionCards(q, scope.workspaceId);
        return cards.find((c) => c.id === input.cardId) ?? null;
      });
      if (!card) throw new Error(`决策卡片 ${input.cardId} 不存在或已消解（金额原因已消失）`);
      const taskEventId = newId("E-TASK");
      const payload = buildTaskPayload(card as DecisionCard, {
        assignee: input.assignee, dueAt: input.dueAt, taskEventId,
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "task", objectId: card.id,
        action: DECISION_ACTIONS.taskCreated,
        after: { ...payload, task_event_id: taskEventId },
      });
      return { ok: true, eventId, task: payload };
    }),
});

/* ================= 利润驾驶舱 ================= */

const financeRouter = router({
  /** 驾驶舱主投影：利润瀑布（按店按月）+ 回款/罚款/应付 顶部卡片 */
  cockpit: protectedProcedure
    .input(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() }))
    .query(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const period = input.period ?? new Date().toISOString().slice(0, 7);
      return withRls(scope, async (q) => {
        const [waterfall, payoutCards, penalties, payables] = await Promise.all([
          q.query(
            `SELECT shop_id, to_char(period, 'YYYY-MM') AS period, currency,
                    gross_amount, fee_amount, refund_amount, payout_net,
                    cost_purchase, cost_freight, cost_storage, cost_ads,
                    cost_platform_fee, cost_penalty, cost_total, net_profit, net_margin_pct
               FROM shop_profit_waterfall
              WHERE workspace_id = $1 AND to_char(period, 'YYYY-MM') = $2
              ORDER BY net_profit DESC`,
            [scope.workspaceId, period],
          ),
          q.query(
            `SELECT currency,
                    SUM(gross_amount) AS gross, SUM(net_amount) AS net,
                    CASE WHEN SUM(gross_amount) > 0
                         THEN ROUND(SUM(net_amount) / SUM(gross_amount) * 100, 2) END AS payout_rate_pct
               FROM payouts
              WHERE workspace_id = $1 AND to_char(period_start, 'YYYY-MM') = $2
              GROUP BY currency`,
            [scope.workspaceId, period],
          ),
          q.query(
            `SELECT shop_id, kind, currency, SUM(amount) AS amount, COUNT(*) AS cnt
               FROM platform_penalties
              WHERE workspace_id = $1 AND to_char(occurred_at, 'YYYY-MM') = $2 AND status <> 'waived'
              GROUP BY shop_id, kind, currency ORDER BY amount DESC LIMIT 20`,
            [scope.workspaceId, period],
          ),
          q.query(
            `SELECT supplier, currency, SUM(amount - paid_amount) AS outstanding,
                    MIN(due_at) AS nearest_due,
                    COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_cnt
               FROM payables WHERE workspace_id = $1 AND status <> 'settled'
              GROUP BY supplier, currency ORDER BY outstanding DESC LIMIT 20`,
            [scope.workspaceId],
          ),
        ]);
        return {
          period,
          waterfall: waterfall.rows as unknown as Array<Record<string, unknown>>,
          payoutCards: payoutCards.rows as unknown as Array<Record<string, unknown>>,
          penalties: penalties.rows as unknown as Array<Record<string, unknown>>,
          payables: payables.rows as unknown as Array<Record<string, unknown>>,
        };
      });
    }),

  /** SKU 损益瀑布账（sku-profit-ledger★ 执行体直通） */
  skuLedger: protectedProcedure
    .input(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional(), topN: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      return withRls(scope, async (q) => {
        return skillExecutors.execSkuProfitLedger(q, scope.workspaceId, { period: input.period, topN: input.topN });
      });
    }),
});

/* ================= 头程跟单 ================= */

const MILESTONE_ORDER = ["departed", "consolidated", "loaded", "sailed", "arrived", "clearing", "signed", "shelved"] as const;

const shipmentsRouter = router({
  /** 批次列表 + 每批节点时间轴（跟单页主投影） */
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      return withRls(scope, async (q) => {
        const ships = await q.query(
          `SELECT id, shop_id, tracking_no, carrier, channel, origin, destination,
                  boxes, units, items, status, current_node, loss_flag, created_at, updated_at
             FROM shipments WHERE workspace_id = $1
             ${input.status ? "AND status = $3" : ""}
            ORDER BY updated_at DESC LIMIT $2`,
          input.status ? [scope.workspaceId, input.limit, input.status] : [scope.workspaceId, input.limit],
        );
        const ids = (ships.rows as unknown as Array<{ id: string }>).map((x) => x.id);
        let milestones: Array<Record<string, unknown>> = [];
        if (ids.length > 0) {
          const m = await q.query(
            `SELECT shipment_id, node, occurred_at, eta, note, created_by
               FROM shipment_milestones WHERE workspace_id = $1 AND shipment_id = ANY($2)
              ORDER BY occurred_at ASC`,
            [scope.workspaceId, ids],
          );
          milestones = m.rows as unknown as Array<Record<string, unknown>>;
        }
        return {
          shipments: ships.rows as unknown as Array<Record<string, unknown>>,
          milestones,
          nodeOrder: MILESTONE_ORDER,
        };
      });
    }),

  /** 节点推进（新增节点流水 + 批次状态联动 + 五元事件；节点顺序校验防回退） */
  advance: writeProcedure
    .input(z.object({
      shipmentId: z.string().min(1),
      node: z.enum(MILESTONE_ORDER),
      occurredAt: z.string().min(10),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const result = await withRls(scope, async (q) => {
        const cur = await q.query(
          `SELECT current_node, status FROM shipments WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
          [scope.workspaceId, input.shipmentId],
        );
        const row = (cur.rows as unknown as Array<{ current_node: string; status: string }>)[0];
        if (!row) throw new Error(`批次 ${input.shipmentId} 不存在`);
        const curIdx = MILESTONE_ORDER.indexOf(row.current_node as (typeof MILESTONE_ORDER)[number]);
        const newIdx = MILESTONE_ORDER.indexOf(input.node);
        if (newIdx <= curIdx) {
          throw new Error(`节点不可回退：当前 ${row.current_node}(${curIdx}) → 目标 ${input.node}(${newIdx})（头程时间轴只前进）`);
        }
        const mid = newId("sm");
        await q.query(
          `INSERT INTO shipment_milestones (id, workspace_id, shipment_id, node, occurred_at, eta, note, created_by)
           VALUES ($1, $2, $3, $4, $5, false, $6, $7)`,
          [mid, scope.workspaceId, input.shipmentId, input.node, input.occurredAt, input.note ?? "", ctx.identity.memberNo],
        );
        await q.query(
          `UPDATE shipments SET current_node = $3, status = $3, updated_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.shipmentId, input.node],
        );
        return { milestoneId: mid };
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "shipment_milestone", objectId: result.milestoneId,
        action: "shipment.milestone.advance",
        after: { shipment_id: input.shipmentId, node: input.node, occurred_at: input.occurredAt },
      });
      return { ...result, eventId };
    }),

  /** 异常标记（联系物流商前置动作；exception/lost 触发决策卡片冻结货值计算） */
  markException: writeProcedure
    .input(z.object({ shipmentId: z.string().min(1), reason: z.string().min(1).max(300), lost: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      await withRls(scope, async (q) => {
        await q.query(
          `UPDATE shipments SET status = $3, loss_flag = $4, updated_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.shipmentId, input.lost ? "lost" : "exception", input.lost],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "shipment", objectId: input.shipmentId,
        action: "shipment.exception.mark",
        after: { reason: input.reason, lost: input.lost },
      });
      return { ok: true, eventId };
    }),
});

/* ================= ★ 技能执行体 ================= */

const executorsRouter = router({
  run: protectedProcedure
    .input(z.object({
      skill: z.enum(["sku-profit-ledger", "acos-fuse", "multi-platform-reconciler", "stockout-guard", "data-quality-watch"]),
      period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      return withRls(scope, async (q) => {
        switch (input.skill) {
          case "sku-profit-ledger":
            return skillExecutors.execSkuProfitLedger(q, scope.workspaceId, { period: input.period });
          case "acos-fuse":
            return skillExecutors.execAcosFuse(q, scope.workspaceId, { period: input.period });
          case "multi-platform-reconciler":
            return skillExecutors.execMultiPlatformReconciler(q, scope.workspaceId, { period: input.period });
          case "stockout-guard":
            return skillExecutors.execStockoutGuard(q, scope.workspaceId);
          case "data-quality-watch":
            return skillExecutors.execDataQualityWatch(q, scope.workspaceId);
        }
      });
    }),
});

/* ================= 真实表格口径导入（P3） ================= */

/** 目标表字段白名单（映射只允许落到白名单字段，拒绝任意列注入） */
const IMPORT_TARGET_FIELDS: Record<string, string[]> = {
  payouts: ["shop_id", "platform", "period_start", "period_end", "currency", "gross_amount", "fee_amount", "refund_amount", "net_amount", "settled_at"],
  platform_penalties: ["shop_id", "platform", "kind", "currency", "amount", "reason", "occurred_at"],
  cost_items: ["shop_id", "sku", "category", "currency", "amount", "period", "note"],
  shipments: ["shop_id", "tracking_no", "carrier", "channel", "origin", "destination", "boxes", "units"],
};

/** 确定性列名映射规则（中英文表头 → 目标字段；LLM 辅助只兜底未命中列） */
const HEADER_RULES: Array<[RegExp, string]> = [
  [/^(shop[_ ]?id|店铺|店铺id|店名)$/i, "shop_id"],
  [/^(platform|平台)$/i, "platform"],
  [/^(sku|货号|商品编码)$/i, "sku"],
  [/^(tracking[_ ]?no|运单号|柜号|物流单号)$/i, "tracking_no"],
  [/^(carrier|物流商|货代)$/i, "carrier"],
  [/^(amount|金额|总额)$/i, "amount"],
  [/^(gross|销售额|gmv)$/i, "gross_amount"],
  [/^(net|到账|实收|回款)$/i, "net_amount"],
  [/^(fee|佣金|平台费)$/i, "fee_amount"],
  [/^(refund|退款)$/i, "refund_amount"],
  [/^(currency|币种)$/i, "currency"],
  [/^(kind|类型|罚款类型)$/i, "kind"],
  [/^(reason|原因|事由)$/i, "reason"],
  [/^(category|成本类型|费用类型)$/i, "category"],
  [/^(period|期间|账期|月份)$/i, "period"],
  [/^(boxes|箱数)$/i, "boxes"],
  [/^(units|件数|数量)$/i, "units"],
  [/^(note|备注)$/i, "note"],
  [/^(occurred[_ ]?at|发生时间|罚款时间)$/i, "occurred_at"],
  [/^(settled[_ ]?at|到账时间)$/i, "settled_at"],
];

/** CSV 解析（支持引号转义与逗号/制表符分隔；生产级边界：BOM/CRLF/空行） */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  const delim = lines[0]?.includes("\t") ? "\t" : ",";
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = lines.length > 0 ? parseLine(lines[0]!) : [];
  return { headers, rows: lines.slice(1).map(parseLine) };
}

/** 表头 → 目标字段映射（规则命中；返回未命中列供 LLM/人工兜底） */
export function proposeMapping(headers: string[], targetTable: string): { mapping: Record<string, string>; unmatched: string[] } {
  const allowed = new Set(IMPORT_TARGET_FIELDS[targetTable] ?? []);
  const mapping: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const h of headers) {
    const hit = HEADER_RULES.find(([re, field]) => re.test(h.trim()) && allowed.has(field));
    if (hit) mapping[h] = hit[1];
    else unmatched.push(h);
  }
  return { mapping, unmatched };
}

const importerRouter = router({
  /** 上传并暂存（解析 → 规则映射 → 批次 staged；LLM 辅助映射由前端对未命中列另行问询后随 confirm 提交） */
  upload: writeProcedure
    .input(z.object({
      filename: z.string().min(1).max(200),
      targetTable: z.enum(["payouts", "platform_penalties", "cost_items", "shipments"]),
      contentBase64: z.string().min(8),
      mappingOverride: z.record(z.string(), z.string()).optional(), // 人工/LLM 修正后的映射（源列→目标字段）
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      const text = Buffer.from(input.contentBase64, "base64").toString("utf8");
      const { headers, rows } = parseCsv(text);
      if (headers.length === 0 || rows.length === 0) throw new Error("表格为空或表头缺失（需首行表头 + 至少一行数据）");
      const { mapping, unmatched } = proposeMapping(headers, input.targetTable);
      const finalMapping = { ...mapping, ...(input.mappingOverride ?? {}) };
      // 映射合法性：目标字段必须在白名单
      const allowed = new Set(IMPORT_TARGET_FIELDS[input.targetTable]);
      for (const [src, dst] of Object.entries(finalMapping)) {
        if (!allowed.has(dst)) throw new Error(`列「${src}」映射到非法字段「${dst}」（目标表白名单外，拒绝）`);
      }
      const batchId = newId("ib");
      await withRls(scope, async (q) => {
        await q.query(
          `INSERT INTO import_batches (id, workspace_id, filename, target_table, status, mapping, mapping_via, row_count, created_by)
           VALUES ($1, $2, $3, $4, 'mapped', $5, $6, $7, $8)`,
          [batchId, scope.workspaceId, input.filename, input.targetTable,
            JSON.stringify(finalMapping), input.mappingOverride ? "llm" : "rule", rows.length, ctx.identity.memberNo],
        );
        for (let i = 0; i < rows.length; i++) {
          const raw: Record<string, string> = {};
          headers.forEach((h, j) => { raw[h] = rows[i]![j] ?? ""; });
          await q.query(
            `INSERT INTO import_rows (workspace_id, batch_id, row_no, raw)
             VALUES ($1, $2, $3, $4)`,
            [scope.workspaceId, batchId, i + 1, JSON.stringify(raw)],
          );
        }
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "task", objectId: batchId, objectLabel: input.filename,
        action: "import.batch.uploaded",
        after: { target_table: input.targetTable, row_count: rows.length, unmatched_headers: unmatched },
      });
      return { batchId, headers, mapping: finalMapping, unmatched, rowCount: rows.length, eventId };
    }),

  /** 确认映射（人工确认闸：未确认不得落库——口径即资产，AI 映射必须经人） */
  confirm: writeProcedure
    .input(z.object({ batchId: z.string().min(1), mapping: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      await withRls(scope, async (q) => {
        const b = await q.query(
          `SELECT target_table, status FROM import_batches WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
          [scope.workspaceId, input.batchId],
        );
        const row = (b.rows as unknown as Array<{ target_table: string; status: string }>)[0];
        if (!row) throw new Error(`导入批次 ${input.batchId} 不存在`);
        if (row.status !== "mapped") throw new Error(`批次状态 ${row.status} 不可确认（仅 mapped 可确认）`);
        const allowed = new Set(IMPORT_TARGET_FIELDS[row.target_table] ?? []);
        for (const [src, dst] of Object.entries(input.mapping)) {
          if (!allowed.has(dst)) throw new Error(`列「${src}」映射到非法字段「${dst}」`);
        }
        await q.query(
          `UPDATE import_batches SET status = 'confirmed', mapping = $3, confirmed_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.batchId, JSON.stringify(input.mapping)],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "task", objectId: input.batchId,
        action: "import.batch.confirmed", after: { mapping: input.mapping },
      });
      return { ok: true, eventId };
    }),

  /** 执行落库（confirmed → imported；目标表白名单 + 参数化 SQL + 行级回执） */
  commit: writeProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const scope = scopeOf(ctx.identity);
      let imported = 0;
      await withRls(scope, async (q) => {
        const b = await q.query(
          `SELECT target_table, status, mapping FROM import_batches WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
          [scope.workspaceId, input.batchId],
        );
        const batch = (b.rows as unknown as Array<{ target_table: string; status: string; mapping: Record<string, string> }>)[0];
        if (!batch) throw new Error(`导入批次 ${input.batchId} 不存在`);
        if (batch.status !== "confirmed") throw new Error(`批次状态 ${batch.status} 不可落库（必须先经人工确认）`);
        const rows = await q.query(
          `SELECT id, row_no, raw FROM import_rows WHERE workspace_id = $1 AND batch_id = $2 AND status = 'staged' ORDER BY row_no`,
          [scope.workspaceId, input.batchId],
        );
        for (const r of rows.rows as unknown as Array<{ id: number; row_no: number; raw: Record<string, string> }>) {
          const norm: Record<string, string> = {};
          for (const [src, dst] of Object.entries(batch.mapping)) {
            if (r.raw[src] !== undefined && r.raw[src] !== "") norm[dst] = r.raw[src]!;
          }
          const targetId = newId(batch.target_table === "shipments" ? "sh" : batch.target_table === "payouts" ? "po" : batch.target_table === "platform_penalties" ? "pp" : "ci");
          try {
            await insertImportRow(q, batch.target_table, scope.workspaceId, targetId, norm, ctx.identity.memberNo);
            await q.query(
              `UPDATE import_rows SET status = 'imported', target_id = $3, normalized = $4 WHERE workspace_id = $1 AND id = $2`,
              [scope.workspaceId, r.id, targetId, JSON.stringify(norm)],
            );
            imported++;
          } catch (err) {
            await q.query(
              `UPDATE import_rows SET status = 'failed', error = $3 WHERE workspace_id = $1 AND id = $2`,
              [scope.workspaceId, r.id, err instanceof Error ? err.message.slice(0, 300) : "unknown"],
            );
          }
        }
        await q.query(
          `UPDATE import_batches SET status = 'imported', imported_count = $3, imported_at = now()
            WHERE workspace_id = $1 AND id = $2`,
          [scope.workspaceId, input.batchId, imported],
        );
        return undefined;
      });
      const eventId = await appendEcomEvent(ctx, scope, {
        objectType: "task", objectId: input.batchId,
        action: "import.batch.committed", after: { imported_count: imported },
      });
      return { ok: true, imported, eventId };
    }),

  /** 批次列表（导入历史与回滚入口） */
  batches: protectedProcedure.query(async ({ ctx }) => {
    const scope = scopeOf(ctx.identity);
    return withRls(scope, async (q) => {
      const r = await q.query(
        `SELECT id, filename, target_table, status, mapping_via, row_count, imported_count, error, created_at, imported_at
           FROM import_batches WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [scope.workspaceId],
      );
      return r.rows as unknown as Array<Record<string, unknown>>;
    });
  }),
});

/** 目标表落库（白名单四表；金额 NUMERIC 校验、日期格式校验在 SQL 层完成） */
async function insertImportRow(
  q: Pick<pg.PoolClient, "query">,
  table: string, workspaceId: string, id: string, norm: Record<string, string>, createdBy: string,
): Promise<void> {
  switch (table) {
    case "payouts":
      await q.query(
        `INSERT INTO payouts (id, workspace_id, shop_id, platform, period_start, period_end, currency,
                              gross_amount, fee_amount, refund_amount, net_amount, settled_at, source)
         VALUES ($1,$2,$3,$4,COALESCE($5::date, date_trunc('month', now())::date),
                 COALESCE($6::date, date_trunc('month', now())::date + interval '1 month' - interval '1 day'),
                 COALESCE($7,'CNY'), $8::numeric, COALESCE($9::numeric,0), COALESCE($10::numeric,0), $11::numeric,
                 $12::timestamptz, 'import')
         ON CONFLICT (workspace_id, shop_id, period_start, period_end) DO UPDATE
           SET gross_amount = EXCLUDED.gross_amount, fee_amount = EXCLUDED.fee_amount,
               refund_amount = EXCLUDED.refund_amount, net_amount = EXCLUDED.net_amount`,
        [id, workspaceId, norm.shop_id ?? "unknown-shop", norm.platform ?? "unknown",
          norm.period ? `${norm.period}-01` : null, norm.period_end ?? null,
          norm.currency, norm.gross_amount ?? "0", norm.fee_amount, norm.refund_amount,
          norm.net_amount ?? norm.amount ?? "0", norm.settled_at ?? null],
      );
      return;
    case "platform_penalties":
      await q.query(
        `INSERT INTO platform_penalties (id, workspace_id, shop_id, platform, kind, currency, amount, reason, occurred_at, source)
         VALUES ($1,$2,$3,$4,COALESCE($5,'other'),COALESCE($6,'CNY'),$7::numeric,COALESCE($8,''),COALESCE($9::timestamptz, now()),'import')`,
        [id, workspaceId, norm.shop_id ?? "unknown-shop", norm.platform ?? "unknown",
          norm.kind, norm.currency, norm.amount ?? "0", norm.reason, norm.occurred_at ?? null],
      );
      return;
    case "cost_items":
      await q.query(
        `INSERT INTO cost_items (id, workspace_id, shop_id, sku, category, currency, amount, period, ref_type, source, note)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'CNY'),$7::numeric,
                 COALESCE($8::date, date_trunc('month', now())::date), 'import', 'import', COALESCE($9,''))`,
        [id, workspaceId, norm.shop_id ?? "unknown-shop", norm.sku ?? null,
          norm.category ?? "purchase", norm.currency, norm.amount ?? "0",
          norm.period ? `${norm.period}-01` : null, norm.note],
      );
      return;
    case "shipments":
      await q.query(
        `INSERT INTO shipments (id, workspace_id, shop_id, tracking_no, carrier, channel, origin, destination, boxes, units, created_by)
         VALUES ($1,$2,$3,$4,COALESCE($5,''),COALESCE($6,'sea'),COALESCE($7,''),COALESCE($8,''),
                 COALESCE($9::int,0),COALESCE($10::int,0),$11)`,
        [id, workspaceId, norm.shop_id ?? "unknown-shop", norm.tracking_no ?? id,
          norm.carrier, norm.channel, norm.origin, norm.destination, norm.boxes, norm.units, createdBy],
      );
      return;
    default:
      throw new Error(`非法目标表 ${table}（白名单外，拒绝）`);
  }
}

export const ecomRouter = router({
  datasource: datasourceRouter,
  decision: decisionRouter,
  finance: financeRouter,
  shipments: shipmentsRouter,
  executors: executorsRouter,
  importer: importerRouter,
});
