/**
 * P10 断点看板（无人值守向；incident-postmortem 技能的数据投影）
 *  - 断点流：三级兜底处置 + 根因强制四分类（数据缺失/规则未覆盖/能力边界/真随机）
 *  - 周频断点率周报 → 收敛曲线；同类周均≥3 次 → awareness 固化建议
 *  - 数据源：twin.incidents（五元事件库 incident.postmortem / incident.weekly.report）
 * 轮询：15s（D6 其余口径）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";

interface Ev {
  event_id: string;
  context: { time: string };
  decision: {
    action: string;
    params?: { breakpoint?: string; fallback_level?: string; root_cause?: string };
    after?: { fix?: string; next_week_same_kind?: number; incidents?: number; convergence?: string; sink_rate?: number };
    basis?: string[];
  };
}

const RC_COLOR: Record<string, string> = {
  数据缺失: "text-holo",
  规则未覆盖: "text-gold",
  能力边界: "text-warn",
  真随机: "text-ink3",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function P10() {
  const [ready, setReady] = useState(false);
  const [incidents, setIncidents] = useState<Ev[]>([]);
  const [weekly, setWeekly] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.incidents.query()) as unknown as { incidents: Ev[]; weekly: Ev[] };
      if (stop) return;
      setIncidents(r.incidents);
      setWeekly(r.weekly);
      setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const dist = useMemo(() => {
    const m = new Map<string, number>();
    for (const ev of incidents) {
      const rc = ev.decision.params?.root_cause ?? "未分类";
      m.set(rc, (m.get(rc) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [incidents]);
  const total = incidents.length || 1;

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">根因分布 · ROOT CAUSE</div>
      {dist.map(([k, n]) => (
        <div key={k} className="mb-2 rounded-lg border border-line bg-card p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className={RC_COLOR[k] ?? "text-ink2"}>{k}</span>
            <span className="font-mono text-ink3">{Math.round((n / total) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-bg950">
            <div className="h-full rounded bg-holo" style={{ width: `${(n / total) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        闭环纪律：未分类不许结案；同类周均 ≥3 次自动产出固化建议（awareness）。断点率应逐周单调收敛——连续两周上升将告警店长。
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P10" />} right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">断点看板</h2>
        <span className="text-[11px] tracking-[.2em] text-ink3">P10 · INCIDENT LOOP</span>
        <span className="flex-1" />
        <span className="rounded-lg border border-line bg-card px-2.5 py-1 text-[11px] text-ink3">
          30 天断点 <b className="text-gold">{incidents.length}</b> 起 · 周报 <b className="text-gold">{weekly.length}</b> 期
        </span>
      </div>

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>
      ) : incidents.length === 0 ? (
        <EmptyState icon="🎉" title="零断点周期" hint="本周期无断点记录。断点发生后将在此形成根因闭环时间线。" />
      ) : (
        <div className="space-y-3">
          <SystemDivider time="收敛趋势" summary={`近 ${weekly.length} 期周报：断点率 ${weekly[0]?.decision.after?.convergence === "down" ? "逐周下降 ✅" : "波动"} · 层级下沉率 ${Math.round(((weekly[0]?.decision.after?.sink_rate ?? 0) as number) * 100)}%`} />
          {weekly.slice(0, 4).map((w, i) => (
            <div key={w.event_id} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2">
              <span className="font-mono text-[11px] text-ink3">W{weekly.length - i}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-bg950">
                <div className="h-full rounded bg-go" style={{ width: `${Math.max(12, 100 - i * 22)}%` }} />
              </div>
              <span className="text-[11px] text-ink3">断点 {w.decision.after?.incidents ?? "—"} 起</span>
            </div>
          ))}
          <SystemDivider time="断点流" summary="三级兜底（AI→远程→现场）· 根因强制四分类 · 优化动作映射" />
          {incidents.map((ev) => {
            const p = ev.decision.params ?? {};
            const a = ev.decision.after ?? {};
            return (
              <div key={ev.event_id} className="rounded-lg border border-line bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink3">{fmtTime(ev.context.time)}</span>
                  <span className="text-body font-semibold text-ink2">{p.breakpoint ?? "断点"}</span>
                  <span className="flex-1" />
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${RC_COLOR[p.root_cause ?? ""] ?? "text-ink3"} border border-line`}>
                    {p.root_cause ?? "未分类"}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-ink3">
                  处置：<span className="text-ink2">{p.fallback_level ?? "—"}</span>
                  {a.fix ? <> · 优化：<span className="text-go">{a.fix}</span></> : null}
                  {typeof a.next_week_same_kind === "number" ? <> · 次周同类 <b className="text-go">{a.next_week_same_kind}</b> 起</> : null}
                </div>
                {ev.decision.basis?.[0] ? <div className="mt-1 text-[11px] text-ink3">{ev.decision.basis[0]}</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </Bridge>
  );
}
