import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import pg from "pg";
import { closeAllPools, getAppPool, getGatewayPool } from "@workloom/db";
import { signDemoToken, type Identity } from "@workloom/base/tenancy";
import { gatewayAppend } from "@workloom/base/workdata";
import { activateRuleVersion } from "@workloom/base/fence-engine";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

const RUN_DB = process.env.RUN_DB_TESTS === "1"
  && Boolean(process.env.DATABASE_URL && process.env.DATABASE_APP_URL && process.env.DATABASE_GATEWAY_URL);

describe.skipIf(!RUN_DB)("围栏确认 HTTP/PG：预演、版本、审批与回滚同链", () => {
  const suffix = randomUUID();
  const tenantId = `tenant-fence-http-${suffix}`;
  const workspaceId = `ws-fence-http-${suffix}`;
  const foreignWorkspaceId = `ws-fence-foreign-${suffix}`;
  const owner = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let tokens: { owner: string; foreign: string; readonly: string; denied: string };
  let sequence = 970000;
  const requestErrors: string[] = [];

  const rule = (level: "auto" | "review" | "block" = "auto") => ({
    ruleId: `R${++sequence}`, name: "围栏确认回归候选", level,
    objectTypes: ["fence_probe"], actions: ["fence_probe.adjust"], when: "true",
  });
  type Candidate = ReturnType<typeof rule>;

  async function request(path: string, body: unknown, token?: string) {
    const req = new Request(`http://fence-regression.local/trpc/${path}`, {
      method: "POST", headers: {
        "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
      }, body: JSON.stringify(body),
    });
    const res = await fetchRequestHandler({
      endpoint: "/trpc", req, router: appRouter, createContext: () => createContext(req),
      onError: ({ error }) => { requestErrors.push(error.message); },
    });
    const json = await res.json() as {
      result: { data: { dryRunId: string; eventId: string } };
      error: { message: string };
    };
    return { status: res.status, json };
  }

  async function dryRun(candidate: Candidate): Promise<string> {
    const res = await request("fence.dryRun", candidate, tokens.owner);
    expect(res.status, requestErrors.at(-1)).toBe(200);
    expect(res.json.result.data.dryRunId).toBeTypeOf("string");
    return res.json.result.data.dryRunId;
  }

  async function confirm(candidate: Candidate, dryRunId: string, token = tokens.owner) {
    return request("fence.confirmDryRun", { dryRunId, rule: candidate }, token);
  }

  async function rowState(dryRunId: string) {
    return (await owner.query<{ status: string }>("SELECT status FROM fence_dry_runs WHERE id=$1", [dryRunId])).rows[0]?.status;
  }

  async function candidates(ruleId: string) {
    return (await owner.query<{ id: string; version: string; status: string; level: string }>(
      "SELECT id,version,status,level FROM fence_rules WHERE workspace_id=$1 AND rule_id=$2 ORDER BY version",
      [workspaceId, ruleId],
    )).rows;
  }

  async function proposeAndApprove(candidate: Candidate) {
    const dryRunId = await dryRun(candidate);
    const proposal = await confirm(candidate, dryRunId);
    expect(proposal.status).toBe(200);
    const eventId = proposal.json.result.data.eventId as string;
    const approvalId = (await owner.query<{ approval_id: string; snapshot: { high_risk?: boolean } }>(
      "SELECT approval_id,snapshot FROM approvals WHERE workspace_id=$1 AND event_id=$2", [workspaceId, eventId],
    )).rows[0]!;
    expect(approvalId.snapshot.high_risk).toBe(true);
    const approved = await request("approvals.decide", { approvalId: approvalId.approval_id, gesture: "approve" }, tokens.owner);
    expect(approved.status).toBe(200);
    const event = (await owner.query<{ payload: { decision: { after: { ruleRowId: string; version: string; dryRunId: string } } } }>(
      "SELECT payload FROM biz_events WHERE workspace_id=$1 AND event_id=$2", [workspaceId, eventId],
    )).rows[0]!.payload.decision.after;
    expect(event.dryRunId).toBe(dryRunId);
    expect((await candidates(candidate.ruleId)).find((row) => row.id === event.ruleRowId)).toMatchObject({ status: "active", version: event.version });
    return { dryRunId, event, approvalId: approvalId.approval_id };
  }

  beforeAll(async () => {
    await owner.query("INSERT INTO tenants(id,name,plan) VALUES($1,'围栏 HTTP 回归专用','pro')", [tenantId]);
    for (const ws of [workspaceId, foreignWorkspaceId]) {
      await owner.query("INSERT INTO workspaces(id,tenant_id,slug,name,industry,stage) VALUES($1,$2,$1,'围栏回归','test','stable')", [ws, tenantId]);
      for (const [memberNo, role, permissions] of [
        ["MEM-001", "owner", {}], ["MEM-003", "readonly", {}],
        ["MEM-002", "manager", { deny: ["workspace.write"] }],
      ] as const) {
        await owner.query("INSERT INTO members(id,workspace_id,member_no,name,role,permissions) VALUES($1,$2,$3,$3,$4,$5)",
          [`${ws}-${memberNo}`, ws, memberNo, role, JSON.stringify(permissions)]);
      }
    }
    const token = (ws: string, memberNo: string, role: Identity["role"]) => signDemoToken({
      memberId: `${ws}-${memberNo}`, memberNo, name: "围栏回归", role, tenantId, workspaceId: ws, plan: "pro",
    });
    tokens = {
      owner: await token(workspaceId, "MEM-001", "owner"),
      foreign: await token(foreignWorkspaceId, "MEM-001", "owner"),
      readonly: await token(workspaceId, "MEM-003", "readonly"),
      denied: await token(workspaceId, "MEM-002", "manager"),
    };
    for (let i = 0; i < 10; i++) await gatewayAppend(getGatewayPool(), {
      tenantId, workspaceId, actor: { id: "MEM-001", type: "human" },
    }, {
      who: { id: "MEM-001", type: "human" },
      context: { tenant_id: tenantId, workspace_id: workspaceId, time: new Date().toISOString() },
      object: { type: "fence_probe", id: `sample-${i}` }, decision: { action: "fence_probe.read" }, rule_impact: [],
    });
  });

  afterAll(async () => {
    // 事件账本只追加；保留独立 UUID 工作区，不删除审计事实或其他用例数据。
    await Promise.allSettled([owner.end(), closeAllPools()]);
  });

  it("真实 HTTP 确认→具名版本提案→人工批准→规则生效", async () => {
    const candidate = rule();
    const { dryRunId, event } = await proposeAndApprove(candidate);
    expect(await rowState(dryRunId)).toBe("confirmed");
    expect(event.version).toBe("v1");
    expect(event.ruleRowId).toBe(`fr-${candidate.ruleId.toLowerCase()}-v1-${workspaceId}`);
  });

  it("同规则连续加严分配独立版本；放宽在确认前拒绝", async () => {
    const candidate = rule();
    await proposeAndApprove(candidate);
    await proposeAndApprove({ ...candidate, level: "review" });
    await proposeAndApprove({ ...candidate, level: "block" });
    expect(await candidates(candidate.ruleId)).toEqual([
      expect.objectContaining({ version: "v1", status: "rolled_back" }),
      expect.objectContaining({ version: "v2", status: "rolled_back" }),
      expect.objectContaining({ version: "v3", status: "active", level: "block" }),
    ]);
    const id = await dryRun(candidate);
    const rejected = await confirm(candidate, id);
    expect(rejected.status).toBe(400);
    expect(rejected.json.error.message).toContain("只可加严");
    expect(await rowState(id)).toBe("pending");
    expect(await candidates(candidate.ruleId)).toHaveLength(3);
  });

  it("候选在回放后被编辑或旧报告没有快照时，必须重跑预演", async () => {
    const candidate = rule("review");
    const changedId = await dryRun(candidate);
    const changed = await confirm({ ...candidate, level: "block" }, changedId);
    expect(changed.status).toBe(400);
    expect(changed.json.error.message).toContain("重新预演");
    expect(await rowState(changedId)).toBe("pending");
    const legacyId = await dryRun(candidate);
    await owner.query("UPDATE fence_dry_runs SET report=report-'candidateRules'-'candidateDefaultLevel' WHERE id=$1 AND workspace_id=$2", [legacyId, workspaceId]);
    expect((await confirm(candidate, legacyId)).status).toBe(400);
    expect(await rowState(legacyId)).toBe("pending");
    expect(await candidates(candidate.ruleId)).toHaveLength(0);
  });

  it("真实已批准的提案不得换绑到另一个候选行或预演", async () => {
    const approved = await proposeAndApprove(rule());
    const gesture = (await owner.query<{ event_id: string }>(
      `SELECT event_id FROM biz_events WHERE workspace_id=$1
        AND payload->'decision'->>'action'='approval.gesture'
        AND payload->'decision'->'after'->>'approvalId'=$2 ORDER BY seq DESC LIMIT 1`,
      [workspaceId, approved.approvalId],
    )).rows[0]!.event_id;
    const other = rule();
    const otherId = await dryRun(other);
    expect((await confirm(other, otherId)).status).toBe(200);
    const pending = (await candidates(other.ruleId))[0]!;
    await expect(activateRuleVersion(getAppPool(), { tenantId, workspaceId }, {
      ruleRowId: pending.id, dryRunId: otherId, approvalEventId: gesture,
    })).rejects.toThrow(/未绑定/);
    expect((await candidates(other.ruleId))[0]!.status).toBe("pending_approval");
    await expect(activateRuleVersion(getAppPool(), { tenantId, workspaceId }, {
      ruleRowId: approved.event.ruleRowId, dryRunId: otherId, approvalEventId: gesture,
    })).rejects.toThrow(/未绑定/);
  });

  it("匿名、只读、显式禁写与另一个工作区均不能确认本工作区预演", async () => {
    const candidate = rule();
    const id = await dryRun(candidate);
    expect((await request("fence.confirmDryRun", { dryRunId: id, rule: candidate })).status).toBe(401);
    expect((await confirm(candidate, id, tokens.readonly)).status).toBe(403);
    expect((await confirm(candidate, id, tokens.denied)).status).toBe(403);
    expect((await confirm(candidate, id, tokens.foreign)).status).toBe(400);
    expect(await rowState(id)).toBe("pending");
    expect(await candidates(candidate.ruleId)).toHaveLength(0);
  });

  it("相同预演并发确认恰好一次；不同预演并发同规则不复用版本", async () => {
    const candidate = rule();
    const sameId = await dryRun(candidate);
    const same = await Promise.all([confirm(candidate, sameId), confirm(candidate, sameId)]);
    expect(same.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await candidates(candidate.ruleId)).toHaveLength(1);
    const independent = rule();
    // 请求可以落在同一毫秒；预演身份不能依赖时间戳分辨率来避免主键冲突。
    const fixedClock = vi.spyOn(Date, "now").mockReturnValue(1792810000000);
    let ids: string[];
    try {
      ids = await Promise.all([dryRun(independent), dryRun(independent)]);
    } finally {
      fixedClock.mockRestore();
    }
    expect(ids[0]).not.toBe(ids[1]);
    const distinct = await Promise.all(ids.map((id) => confirm(independent, id)));
    expect(distinct.map((r) => r.status)).toEqual([200, 200]);
    expect((await candidates(independent.ruleId)).map((row) => row.version)).toEqual(["v1", "v2"]);
  });

  it("无效输入不写库；候选插入失败回滚确认，恢复后可重试", async () => {
    const candidate = rule();
    const id = await dryRun(candidate);
    for (const invalid of [
      { ...candidate, ruleId: "bad" }, { ...candidate, name: "" },
      { ...candidate, actions: [] }, { ...candidate, objectTypes: [""] }, { ...candidate, when: "" },
    ]) expect((await request("fence.confirmDryRun", { dryRunId: id, rule: invalid }, tokens.owner)).status).toBe(400);
    expect(await rowState(id)).toBe("pending");
    const constraint = `fence_fail_${suffix.replaceAll("-", "")}`;
    await owner.query(`ALTER TABLE fence_rules ADD CONSTRAINT "${constraint}" CHECK (workspace_id <> '${workspaceId}' OR rule_id <> '${candidate.ruleId}')`);
    try {
      expect((await confirm(candidate, id)).status).toBe(500);
      expect(await rowState(id)).toBe("pending");
      expect(await candidates(candidate.ruleId)).toHaveLength(0);
    } finally {
      await owner.query(`ALTER TABLE fence_rules DROP CONSTRAINT "${constraint}"`);
    }
    expect((await confirm(candidate, id)).status).toBe(200);
    expect(await rowState(id)).toBe("confirmed");
    expect(await candidates(candidate.ruleId)).toHaveLength(1);
  });
});
