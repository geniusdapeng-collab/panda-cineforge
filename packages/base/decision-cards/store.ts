/**
 * decision-cards/store.ts —— 卡片状态投影与决策→任务闭环
 *
 * 事件溯源口径（与全仓一致：账本=事件投影）：
 *  - 卡片本体由 calculators 实时计算（确定性 ID，同因不重发）；
 *  - 状态（pending/accepted/dismissed/tasked）由 decision.card.* 五元事件回放叠加；
 *  - 转任务 = 写 decision.task.created 事件（载荷含 assignee/due/expected_benefit），
 *    任务完成回填实际收益走 decision.task.outcome（归因飞轮：预期 vs 实际偏差入组织记忆）。
 */
import type pg from "pg";
import {
  decisionCard, type DecisionCard, type DecisionCardView, type DecisionStatus,
  type DecisionTaskPayload,
} from "./model.js";

type Q = Pick<pg.Pool | pg.PoolClient, "query">;

/** 决策域事件动作（哈希链检索键） */
export const DECISION_ACTIONS = {
  issued: "decision.card.issued",
  decided: "decision.card.decided",
  taskCreated: "decision.task.created",
  taskOutcome: "decision.task.outcome",
} as const;

interface DecisionEventRow {
  payload: {
    object?: { id?: string };
    decision?: { action?: string; after?: Record<string, unknown> };
    context?: { time?: string };
    who?: { id?: string };
  };
}

/** 读取状态投影：cardId → {status, decided_by, decided_at, task_event_id} */
export async function loadDecisionStates(
  q: Q, workspaceId: string,
): Promise<Map<string, { status: DecisionStatus; decided_by?: string; decided_at?: string; task_event_id?: string }>> {
  const r = await q.query<DecisionEventRow>(
    `SELECT payload FROM biz_events
      WHERE workspace_id = $1
        AND payload->'decision'->>'action' = ANY($2)
      ORDER BY seq ASC`,
    [workspaceId, [DECISION_ACTIONS.decided, DECISION_ACTIONS.taskCreated]],
  );
  const map = new Map<string, { status: DecisionStatus; decided_by?: string; decided_at?: string; task_event_id?: string }>();
  for (const row of r.rows) {
    const cardId = row.payload.object?.id;
    const action = row.payload.decision?.action;
    if (!cardId || !action) continue;
    const after = row.payload.decision?.after ?? {};
    if (action === DECISION_ACTIONS.decided) {
      const st = after.status === "dismissed" ? "dismissed" : "accepted";
      map.set(cardId, {
        status: st,
        decided_by: row.payload.who?.id,
        decided_at: row.payload.context?.time,
      });
    } else if (action === DECISION_ACTIONS.taskCreated) {
      const prev = map.get(cardId);
      map.set(cardId, { ...prev, status: "tasked", task_event_id: String(after.task_event_id ?? "") });
    }
  }
  return map;
}

/** 卡片列表 = 实时计算 × 状态投影（默认按金额绝对值降序，pending 优先） */
export async function listDecisionCards(q: Q, workspaceId: string, cards: DecisionCard[]): Promise<DecisionCardView[]> {
  const states = await loadDecisionStates(q, workspaceId);
  return cards
    .map((c) => {
      const st = states.get(c.id);
      return { ...c, status: st?.status ?? "pending", decided_by: st?.decided_by, decided_at: st?.decided_at, task_event_id: st?.task_event_id };
    })
    .sort((a, b) => {
      const rank = (s: DecisionStatus) => (s === "pending" ? 0 : 1);
      return rank(a.status) - rank(b.status) || Math.abs(b.amount_impact) - Math.abs(a.amount_impact);
    });
}

/** 卡片校验（写路径入口把关：缺 calculation 或金额来源非 sql 一律拒收） */
export function assertCardIntegrity(card: unknown): DecisionCard {
  const raw = card as { attribution?: unknown[] };
  if (!Array.isArray(raw?.attribution) || raw.attribution.length < 2) {
    throw new Error("决策卡片归因链至少两环（数据变化→归因分析）");
  }
  const parsed = decisionCard.parse(card);
  if (parsed.calculation.source !== "sql") {
    throw new Error(`决策卡片金额来源非法（${parsed.calculation.source}）——金额只能来自 SQL/规则引擎（铁律①）`);
  }
  return parsed;
}

/** 构造 decision.task.created 事件载荷（路由层据此写五元事件） */
export function buildTaskPayload(
  card: DecisionCard, opts: { assignee?: string; dueAt: string; taskEventId: string },
): DecisionTaskPayload {
  return {
    card_id: card.id,
    title: card.suggested_action,
    assignee: opts.assignee ?? card.assignee,
    due_at: opts.dueAt,
    expected_benefit: Math.abs(card.amount_impact),
    currency: card.currency,
  };
}
