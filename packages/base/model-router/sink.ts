/**
 * model-router · 生产事件汇：计量/降级/熔断事件经安全网关落 append-only 库（G8）
 * model_trace 随事件 payload 落库 → 账单=事件投影（L6.3），禁止另建计量管道
 */
import type pg from "pg";
import { gatewayAppend } from "../workdata/gateway.js";
import type { EventSink } from "./router.js";

export class GatewayEventSink implements EventSink {
  constructor(
    private readonly gateway: pg.Pool,
    private readonly scope: { tenantId: string; workspaceId: string },
    private readonly actor: { id: string; version?: string } = { id: "model-router" },
  ) {}

  private async write(decision: Record<string, unknown>, modelTrace?: Record<string, unknown>) {
    await gatewayAppend(this.gateway, {
      ...this.scope,
      actor: { id: this.actor.id, type: "system" },
    }, {
      who: { type: "system", id: this.actor.id },
      context: {
        tenant_id: this.scope.tenantId, workspace_id: this.scope.workspaceId,
        time: new Date().toISOString(),
      },
      object: { type: "store", id: this.scope.workspaceId },
      decision: decision as never,
      rule_impact: [],
      model_trace: modelTrace as never,
    });
  }

  async recordModelTrace(t: { model_id: string; tier: string; window: string; credits: number; action: string; reused?: boolean }) {
    await this.write(
      { action: t.reused ? "memory.reuse" : "model.call", after: { action: t.action, model: t.model_id, reused: t.reused ?? false } },
      { model_id: t.model_id, tier: t.tier, window: t.window, credits: t.credits },
    );
  }

  async recordDegradation(d: { from: string; to: string | null; reason: string; action: string }) {
    // L6.1：切换/降级必写事件，禁止静默换模型
    await this.write({ action: "model.degraded", before: { model: d.from }, after: { model: d.to, reason: d.reason, task: d.action } });
  }

  async recordCircuitBreak(d: { action: string; creditsUsed: number; limit: number }) {
    // L6.4：超限挂起+告警
    await this.write({ action: "model.circuit_break", after: { task: d.action, creditsUsed: d.creditsUsed, limit: d.limit, status: "suspended" } });
  }
}
