/**
 * P28 数据源接入中心（P1）+ 真实表格口径导入（P3）
 *  - 数据源卡片：平台/店铺/授权方式/同步状态与延迟/启停开关；真实连接器 real/mock 徽标（禁止静默回退）
 *  - 同步记录下钻；新增数据源登记（凭据引用不落明文）
 *  - 表格导入：上传 CSV → 映射预览（规则命中+未命中列人工兜底）→ 确认 → 落库（口径即资产，必须人工确认）
 * 数据源：trpc.ecom.datasource.* / trpc.ecom.importer.*
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";

/* tRPC 弱类型通道（与 P26/P27 同一模式） */
interface DsRow {
  id: string; platform: string; shop_id: string; label: string; auth_kind: string;
  enabled: boolean; last_sync_at: string | null; last_sync_status: string | null; sync_lag_sec: number | null;
}
interface ConnectorStatus { platformId: string; mode: "real" | "mock"; reason?: string }
interface SyncLog { id: string; started_at: string; status: string; rows_read: number; rows_written: number; error: string | null }
interface UploadResp { batchId: string; headers: string[]; mapping: Record<string, string>; unmatched: string[]; rowCount: number }
interface BatchRow { id: string; filename: string; target_table: string; status: string; mapping_via: string; row_count: number; imported_count: number; created_at: string }

const svc = () => trpc.ecom as unknown as {
  datasource: {
    list: { query: () => Promise<{ sources: DsRow[]; connectors: ConnectorStatus[] }> };
    syncLogs: { query: (i: { dataSourceId: string }) => Promise<SyncLog[]> };
    add: { mutate: (i: { platform: string; shopId: string; label: string; authKind: "api" | "rpa" | "import" }) => Promise<{ id: string }> };
    toggle: { mutate: (i: { dataSourceId: string; enabled: boolean }) => Promise<{ ok: boolean }> };
  };
  importer: {
    upload: { mutate: (i: { filename: string; targetTable: string; contentBase64: string; mappingOverride?: Record<string, string> }) => Promise<UploadResp> };
    confirm: { mutate: (i: { batchId: string; mapping: Record<string, string> }) => Promise<{ ok: boolean }> };
    commit: { mutate: (i: { batchId: string }) => Promise<{ imported: number }> };
    batches: { query: () => Promise<BatchRow[]> };
  };
};

const SYNC_BADGE: Record<string, { text: string; cls: string }> = {
  ok: { text: "同步正常", cls: "text-go border-go/40" },
  degraded: { text: "同步降级", cls: "text-warn border-warn/40" },
  failed: { text: "同步失败", cls: "text-alert border-alert/40" },
};
const AUTH_TEXT: Record<string, string> = { api: "官方 API", rpa: "浏览器剧本", import: "表格导入" };
const TARGET_TABLES = [
  { id: "payouts", label: "店铺回款" },
  { id: "platform_penalties", label: "平台罚款" },
  { id: "cost_items", label: "成本项" },
  { id: "shipments", label: "头程批次" },
];

function fmtLag(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}min`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export default function P28() {
  const [tab, setTab] = useState<"sources" | "import">("sources");
  const [ready, setReady] = useState(false);
  const [sources, setSources] = useState<DsRow[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [logs, setLogs] = useState<Record<string, SyncLog[]>>({});
  const [expanded, setExpanded] = useState<string>("");
  const [batches, setBatches] = useState<BatchRow[]>([]);
  // 新增数据源表单
  const [form, setForm] = useState({ platform: "amazon", shopId: "", label: "", authKind: "api" as "api" | "rpa" | "import" });
  // 导入状态
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetTable, setTargetTable] = useState("payouts");
  const [upload, setUpload] = useState<UploadResp | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    await ensureDemoLogin();
    const [r, b] = await Promise.all([svc().datasource.list.query(), svc().importer.batches.query()]);
    setSources(r.sources); setConnectors(r.connectors); setBatches(b); setReady(true);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const toggleLogs = async (id: string) => {
    if (expanded === id) { setExpanded(""); return; }
    if (!logs[id]) {
      const l = await svc().datasource.syncLogs.query({ dataSourceId: id });
      setLogs((m) => ({ ...m, [id]: l }));
    }
    setExpanded(id);
  };

  const onToggle = async (ds: DsRow) => {
    setBusy(ds.id);
    await svc().datasource.toggle.mutate({ dataSourceId: ds.id, enabled: !ds.enabled });
    await load(); setBusy("");
  };

  const onAdd = async () => {
    if (!form.shopId || !form.label) { setToast("店铺 ID 与名称必填"); return; }
    setBusy("add");
    await svc().datasource.add.mutate({ platform: form.platform, shopId: form.shopId, label: form.label, authKind: form.authKind });
    setForm({ ...form, shopId: "", label: "" });
    setToast("已登记（凭据引用走 credentials 表，不落明文）");
    await load(); setBusy("");
  };

  const onFile = async (f: File) => {
    setBusy("upload");
    const buf = await f.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const r = await svc().importer.upload.mutate({ filename: f.name, targetTable, contentBase64: b64 });
    setUpload(r); setMappingDraft(r.mapping); setBusy("");
  };

  const onConfirmCommit = async () => {
    if (!upload) return;
    setBusy("commit");
    await svc().importer.confirm.mutate({ batchId: upload.batchId, mapping: mappingDraft });
    const r = await svc().importer.commit.mutate({ batchId: upload.batchId });
    setToast(`导入完成：${r.imported} 行落库（全程五元事件留痕）`);
    setUpload(null); await load(); setBusy("");
  };

  const realCnt = connectors.filter((c) => c.mode === "real").length;

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">接入全景</div>
      {[
        { label: "已登记数据源", n: sources.length, cls: "text-holo" },
        { label: "真实连接器", n: realCnt, cls: "text-go" },
        { label: "Mock 连接器（显式标注）", n: connectors.length - realCnt, cls: "text-warn" },
        { label: "同步失败源", n: sources.filter((s) => s.last_sync_status === "failed").length, cls: "text-alert" },
        { label: "导入批次（近 30）", n: batches.length, cls: "text-ink2" },
      ].map((s) => (
        <div key={s.label} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-xs">
          <span className="text-ink2">{s.label}</span>
          <b className={`font-mono ${s.cls}`}>{s.n}</b>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        真实性纪律：凭据齐全走真实连接器（verified 回执）；缺凭据显式标注 Mock，禁止静默回退。
        表格导入映射必须人工确认才落库——口径即资产，AI 不替您决定口径。
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P28" />} right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">数据源接入中心</h2>
        <span className="text-[11px] tracking-[.2em] text-ink3">P28 · 数据源 / 表格导入</span>
        <div className="ml-auto flex gap-1.5 text-xs">
          {([["sources", "数据源"], ["import", "表格导入"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded border px-2.5 py-1 ${tab === k ? "border-gline bg-card text-gold" : "border-line text-ink2"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && <div className="mb-3 rounded-lg border border-gline bg-card px-3 py-2 text-xs text-gold">{toast}</div>}

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>
      ) : tab === "sources" ? (
        <div className="space-y-3">
          <SystemDivider time="连接器状态" summary="真实 = 官方 API verified 回执；Mock = 演示数据（显式标注）" />
          <div className="flex flex-wrap gap-2">
            {connectors.map((c) => (
              <span key={c.platformId} title={c.reason}
                className={`rounded border px-2 py-1 font-mono text-[11px] ${c.mode === "real" ? "border-go/40 text-go" : "border-warn/40 text-warn"}`}>
                {c.platformId} · {c.mode === "real" ? "真实" : "MOCK"}
              </span>
            ))}
          </div>

          <SystemDivider time="数据源卡片" summary="授权方式 / 同步状态 / 延迟 / 启停（下钻看同步记录）" />
          {sources.length === 0 ? (
            <EmptyState icon="🔌" title="尚未登记数据源" hint="用下方表单登记第一个店铺授权，或切到「表格导入」先跑通真实口径。" />
          ) : sources.map((ds) => {
            const badge = ds.last_sync_status ? SYNC_BADGE[ds.last_sync_status] : undefined;
            return (
              <div key={ds.id} className="rounded-lg border border-line bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink3">{ds.platform}</span>
                  <span className="text-body font-semibold text-ink2">{ds.label}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink3">{AUTH_TEXT[ds.auth_kind] ?? ds.auth_kind}</span>
                  {badge && <span className={`rounded border px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>}
                  <span className="ml-auto font-mono text-[11px] text-ink3">延迟 {fmtLag(ds.sync_lag_sec)}</span>
                  <button onClick={() => void toggleLogs(ds.id)} className="rounded border border-line px-2 py-0.5 text-[11px] text-ink2">
                    {expanded === ds.id ? "收起" : "同步记录"}
                  </button>
                  <button disabled={busy === ds.id} onClick={() => void onToggle(ds)}
                    className={`rounded border px-2 py-0.5 text-[11px] ${ds.enabled ? "border-go/40 text-go" : "border-line text-ink3"}`}>
                    {ds.enabled ? "已启用" : "已停用"}
                  </button>
                </div>
                <div className="mt-1 font-mono text-[11px] text-ink3">
                  {ds.shop_id} · 最近同步 {ds.last_sync_at ? new Date(ds.last_sync_at).toLocaleString("zh-CN") : "从未"}
                </div>
                {expanded === ds.id && (
                  <div className="mt-2 space-y-1 border-t border-line pt-2">
                    {(logs[ds.id] ?? []).length === 0 ? (
                      <div className="text-[11px] text-ink3">暂无同步记录</div>
                    ) : (logs[ds.id] ?? []).map((l) => (
                      <div key={l.id} className="flex gap-3 font-mono text-[11px] text-ink3">
                        <span>{new Date(l.started_at).toLocaleString("zh-CN")}</span>
                        <span className={l.status === "ok" ? "text-go" : l.status === "failed" ? "text-alert" : "text-warn"}>{l.status}</span>
                        <span>读 {l.rows_read} / 写 {l.rows_written}</span>
                        {l.error && <span className="text-alert">{l.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <SystemDivider time="新增数据源" summary="登记授权引用；凭据本体走 credentials 保险柜（AES-256-GCM，不落明文）" />
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-3 text-xs">
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="rounded border border-line bg-bg900 px-2 py-1 text-ink2">
              {["amazon", "douyin", "tmall", "jd", "pdd", "temu", "tiktok-shop", "shopee", "shopify"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} placeholder="店铺 ID"
              className="w-32 rounded border border-line bg-bg900 px-2 py-1 text-ink2" />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="展示名（如 亚马逊·美国站）"
              className="w-44 rounded border border-line bg-bg900 px-2 py-1 text-ink2" />
            <select value={form.authKind} onChange={(e) => setForm({ ...form, authKind: e.target.value as "api" | "rpa" | "import" })}
              className="rounded border border-line bg-bg900 px-2 py-1 text-ink2">
              <option value="api">官方 API</option>
              <option value="rpa">浏览器剧本（computer-use）</option>
              <option value="import">表格导入</option>
            </select>
            <button disabled={busy === "add"} onClick={() => void onAdd()}
              className="rounded border border-gline bg-card px-3 py-1 text-gold">登记</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SystemDivider time="真实表格口径导入" summary="财务核算表 / 定价表 / 仓库跟单表 → 上传 → 映射 → 人工确认 → 落库" />
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-3 text-xs">
            <span className="text-ink2">目标表</span>
            <select value={targetTable} onChange={(e) => setTargetTable(e.target.value)}
              className="rounded border border-line bg-bg900 px-2 py-1 text-ink2">
              {TARGET_TABLES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button disabled={busy === "upload"} onClick={() => fileRef.current?.click()}
              className="rounded border border-gline bg-card px-3 py-1 text-gold">
              {busy === "upload" ? "解析中…" : "上传 CSV 表格"}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            <span className="text-[11px] text-ink3">首行表头（中英文均可）；映射未命中的列由您人工指定</span>
          </div>

          {upload && (
            <div className="rounded-lg border border-gline bg-card p-3">
              <div className="mb-2 text-xs text-ink2">
                批次 <b className="font-mono text-gold">{upload.batchId}</b> · {upload.rowCount} 行 · 未命中列 {upload.unmatched.length} 个
              </div>
              <div className="mb-3 space-y-1">
                {upload.headers.map((h) => (
                  <div key={h} className="flex items-center gap-2 text-xs">
                    <span className="w-40 font-mono text-ink3">{h}</span>
                    <span className="text-ink3">→</span>
                    <input value={mappingDraft[h] ?? ""} placeholder={upload.unmatched.includes(h) ? "人工指定目标字段" : ""}
                      onChange={(e) => setMappingDraft((m) => ({ ...m, [h]: e.target.value }))}
                      className={`w-44 rounded border px-2 py-0.5 font-mono ${upload.unmatched.includes(h) ? "border-warn/50 text-warn" : "border-line text-ink2"} bg-bg900`} />
                  </div>
                ))}
              </div>
              <button disabled={busy === "commit"} onClick={() => void onConfirmCommit()}
                className="rounded border border-gline bg-card px-4 py-1.5 text-xs text-gold">
                {busy === "commit" ? "落库中…" : "确认映射并落库（人工确认闸）"}
              </button>
            </div>
          )}

          <SystemDivider time="导入历史" summary="批次状态：mapped → confirmed → imported（可回滚）" />
          {batches.length === 0 ? (
            <EmptyState icon="📄" title="暂无导入批次" hint="上传第一张真实表格，让系统按您的口径算账。" />
          ) : (
            <div className="space-y-1.5">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-xs">
                  <span className="font-mono text-[11px] text-ink3">{new Date(b.created_at).toLocaleString("zh-CN")}</span>
                  <span className="text-ink2">{b.filename}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink3">{TARGET_TABLES.find((t) => t.id === b.target_table)?.label ?? b.target_table}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] ${b.status === "imported" ? "border-go/40 text-go" : "border-warn/40 text-warn"}`}>{b.status}</span>
                  <span className="ml-auto font-mono text-[11px] text-ink3">{b.imported_count}/{b.row_count} 行 · 映射 {b.mapping_via === "llm" ? "人工/LLM" : "规则"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Bridge>
  );
}
