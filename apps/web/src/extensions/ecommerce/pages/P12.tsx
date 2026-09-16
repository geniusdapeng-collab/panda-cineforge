/**
 * P12 经营目标页（目标设定与追踪：店铺档案 goals 字段组 × goal.tracking 周频回写）
 *  - 年度/月度目标卡（成交总额/毛利率/广告成本占比/周转）+ 平台·类目分解
 *  - 周频达成追踪：目标 vs 时序进度（behind → 琥珀预警）+ 偏差自动归因
 *  - 关联来源：twin.goals（profiles.archive.goals + biz_events goal.tracking）
 * 轮询：15s（D6 其余口径）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../../lib/trpc";
import { Bridge } from "../../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../../components/hud";
import { clientNodeText, clientValueText } from "../display";

interface Tracking {
  event_id: string;
  context: { time: string };
  decision: {
    params?: { week?: number; month?: string };
    after?: {
      gmv?: { target: number; actual: number; pace: string };
      revenue?: { target: number; actual: number };
      attribution?: string[];
    };
    basis?: string[];
  };
}
interface Goals {
  year?: { gmv_cny?: number; gmv_usd?: number; margin_rate?: number; acos?: number; bad_review_rate?: number; repurchase_rate?: number; turnover_days?: number };
  month_2026_08?: { gmv_cny?: number; margin_rate?: number; acos?: number; note?: string };
  breakdown?: { platforms?: Record<string, number>; categories?: Record<string, number> };
}

const pct = (n?: number) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
const yi = (n?: number) => (typeof n === "number" ? `¥${(n / 1e8).toFixed(1)}亿` : "—");

export default function P12() {
  const [ready, setReady] = useState(false);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [trackings, setTrackings] = useState<Tracking[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.goals.query()) as unknown as { goals: Goals | null; trackings: Tracking[] };
      if (stop) return;
      setGoals(r.goals); setTrackings(r.trackings);
      setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const latest = trackings[0];
  const gmvT = latest?.decision.after?.gmv;
  const monthGoal = goals?.month_2026_08;
  const pacePct = useMemo(() => {
    if (!gmvT || !monthGoal?.gmv_cny) return 0;
    return Math.min(100, Math.round((gmvT.actual / monthGoal.gmv_cny) * 100));
  }, [gmvT, monthGoal]);

  const right = (
    <>
      <div className="mb-2 px-1 text-sm tracking-[.2em] text-ink3">年度目标</div>
      <div className="rounded-lg border border-line bg-card p-3 text-sm leading-relaxed text-ink2">
        <div>成交总额 <b className="text-gold">{yi(goals?.year?.gmv_cny)}</b> + <b className="text-gold">${typeof goals?.year?.gmv_usd === "number" ? (goals.year.gmv_usd / 1e8).toFixed(0) : "—"}亿</b></div>
        <div>毛利率 <b className="text-gold">{pct(goals?.year?.margin_rate)}</b> · 广告成本占比 ≤ <b className="text-gold">{pct(goals?.year?.acos)}</b> · 周转 <b className="text-gold">{goals?.year?.turnover_days ?? "—"} 天</b></div>
        <div>差评率 ≤ <b>{pct(goals?.year?.bad_review_rate)}</b> · 复购率 <b>{pct(goals?.year?.repurchase_rate)}</b></div>
      </div>
      <div className="mb-2 mt-3 px-1 text-sm tracking-[.2em] text-ink3">平台分解</div>
      {Object.entries(goals?.breakdown?.platforms ?? {}).map(([k, v]) => (
        <div key={k} className="mb-2">
          <div className="flex min-w-0 justify-between gap-2 text-sm text-ink3"><span className="break-words">{clientNodeText(k, "其他平台")}</span><span className="shrink-0 font-mono">{pct(v)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-bg950"><div className="h-full rounded bg-holo" style={{ width: pct(v) }} /></div>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-sm leading-relaxed text-ink3">
        目标从年初口号变成每周作战：达成偏离时序进度自动归因，并联动经营分析参谋生成补救建议（需人工复核）。
      </div>
    </>
  );

  return (
    <Bridge right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">经营目标</h2>
        <span className="text-sm tracking-[.2em] text-ink3">经营目标追踪</span>
        <span className="flex-1" />
        {monthGoal?.note ? <span className="min-w-0 break-words rounded-lg border border-line bg-card px-2.5 py-1 text-sm text-gold">{clientValueText(monthGoal.note, "目标备注已记录")}</span> : null}
      </div>

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>
      ) : !goals ? (
        <EmptyState icon="🎯" title="尚未设定经营目标" hint="使用目标设定向导：年度目标 → 自动分解到月/平台/类目（可一键采用同规模卖家基准值）。" />
      ) : (
        <div className="space-y-3">
          {/* 月度目标卡 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-line bg-card p-3">
              <div className="text-sm text-ink3">月 成交总额 目标</div>
              <div className="mt-1 text-h1 font-black text-gold">{yi(monthGoal?.gmv_cny)}</div>
              <div className="mt-1 text-sm text-ink3">当前 <b className="text-ink2">{gmvT ? yi(gmvT.actual) : "—"}</b></div>
            </div>
            <div className="rounded-lg border border-line bg-card p-3">
              <div className="text-sm text-ink3">毛利率目标与实际</div>
              <div className="mt-1 text-h1 font-black text-ink2">{pct(monthGoal?.margin_rate)} <span className="text-sm text-ink3">/ {pct(goals?.year?.margin_rate)}</span></div>
              <div className="mt-1 text-sm">
                {gmvT?.pace === "on_track" ? <span className="text-go">● 进度正常</span> : <span className="text-warn">● 落后时序</span>}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-card p-3">
              <div className="text-sm text-ink3">广告成本占比 红线</div>
              <div className="mt-1 text-h1 font-black text-ink2">{pct(monthGoal?.acos)}</div>
              <div className="mt-1 text-sm text-ink3">年目标毛利率 {pct(goals?.year?.margin_rate)}</div>
            </div>
          </div>
          {/* 时序进度条 */}
          <div className="rounded-lg border border-line bg-card p-3">
            <div className="flex justify-between text-sm text-ink3"><span>成交总额达成进度（目标达成率）</span><span className="font-mono text-gold">{pacePct}%</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded bg-bg950">
              <div className={`h-full rounded ${gmvT?.pace === "on_track" ? "bg-go" : "bg-warn"}`} style={{ width: `${pacePct}%` }} />
            </div>
          </div>
          {/* 周频追踪 */}
          <SystemDivider time="周频追踪" summary="经营目标按周回写：达成率 + 时序比对 + 偏差归因（事件同库可溯源）" />
          {trackings.map((t) => {
            const a = t.decision.after ?? {};
            const behind = a.gmv?.pace !== "on_track";
            return (
              <div key={t.event_id} className="rounded-lg border border-line bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-line px-1.5 py-0.5 font-mono text-sm text-ink3">第 {t.decision.params?.week ?? "—"} 周</span>
                  <span className="text-sm text-ink2">成交总额 {yi(a.gmv?.actual)}（目标 {yi(a.gmv?.target)}）</span>
                  <span className={`text-sm ${behind ? "text-warn" : "text-go"}`}>{behind ? "⚠ 落后时序" : "✓ 进度正常"}</span>
                </div>
                {a.attribution && a.attribution.length > 0 ? (
                  <div className="mt-1.5 break-words text-sm text-ink3">偏差归因：{a.attribution.map((x) => <span key={x} className="mr-2 inline-block rounded bg-bg950 px-1.5 py-0.5 text-warn">{clientValueText(x, "经营偏差")}</span>)}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Bridge>
  );
}
