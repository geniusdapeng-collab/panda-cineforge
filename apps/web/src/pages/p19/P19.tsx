/**
 * P19 经营问数（A3：从「做报表」到「问问题」——预设问数真实聚合自事件库）
 * 数据源：twin.report（channel_revenue / occ_trend / price_attribution 三预设）
 * 说明：自然语言自由查询在 LLM 取数接线后开放；当前预设问题已是真实聚合，非写死数字。
 */
import { useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";
import { HBar, Note, PageHead, Tag } from "../../components/Twin";

type Q = "channel_revenue" | "occ_trend" | "price_attribution";
const QUESTIONS: Array<{ key: Q; label: string }> = [
  { key: "channel_revenue", label: "本月各平台收入与订单量" },
  { key: "occ_trend", label: "近 30 天经营走势" },
  { key: "price_attribution", label: "调价动作与依据归因" },
];

interface ReportResult { kind: string; rows: Array<Record<string, unknown>> }

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">经营问数</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">从做报表到问问题：数据已在事件库，报表是提问的即时答案。自由问答随 LLM 取数接线开放。</div>
  </>
);

export default function P19() {
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState<Q>("channel_revenue");
  const [result, setResult] = useState<ReportResult | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.report.query({ question: q })) as unknown as ReportResult;
      if (stop) return;
      setResult(r); setReady(true);
    };
    setReady(false);
    void load();
    return () => { stop = true; };
  }, [q]);

  const maxRevenue = Math.max(1, ...(result?.rows.map((r) => Number(r.revenue ?? 0)) ?? [1]));

  return (
    <Bridge right={rightPanel} left={<PageNav current="P19" />}>
      <PageHead title="经营问数" tag="P19 · 经营问数" extra={<Tag tone="holo">问数即答</Tag>} />
      <div className="mb-3 flex flex-wrap gap-2">
        {QUESTIONS.map((x) => (
          <button key={x.key} type="button" onClick={() => setQ(x.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${q === x.key ? "border-gline bg-card text-gold" : "border-line bg-card text-ink3 hover:border-gline"}`}>
            {x.label}
          </button>
        ))}
      </div>
      {!ready || !result ? (<><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>) : (
        <div className="space-y-3">
          {q === "channel_revenue" && (
            <>
              <SystemDivider time="平台收入" summary="order.create 事件实时聚合（订单量 × 金额）" />
              {result.rows.map((r) => (
                <HBar key={String(r.channel)} label={String(r.channel)} pct={Math.round((Number(r.revenue) / maxRevenue) * 100)}
                  value={`¥${Number(r.revenue).toLocaleString()} · ${r.orders} 单`} tone="bg-gold" />
              ))}
              <Note>💡 独立站零平台佣金：净贡献率最高——提升 DTC 占比是品牌私域运营的持续建议方向。集团月报可一键导出。</Note>
            </>
          )}
          {q === "occ_trend" && (
            <>
              <SystemDivider time="30 天走势" summary="store.daily.summary 每日快照（夜班班组生成）" />
              {[...result.rows].reverse().map((r) => (
                <HBar key={String(r.date)} label={String(r.date).slice(5)} pct={Math.min(100, Math.round(Number(r.gmv ?? 0) / 1e6))}
                  value={`GMV ¥${(Number(r.gmv ?? 0) / 10000).toFixed(0)}万 · ${r.orders ?? "—"} 单`} tone="bg-holo" />
              ))}
            </>
          )}
          {q === "price_attribution" && (
            <>
              <SystemDivider time="调价归因" summary="每次调价含 before/after/依据/围栏判定——调价与订单同库，效果可归因" />
              {result.rows.slice(0, 20).map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 text-xs">
                  <span className="font-mono text-[11px] text-ink3">{String(r.time).slice(5, 16)}</span>
                  <span className="text-ink2">{String(r.object)}</span>
                  <span className="font-mono text-ink3">¥{String(r.before)} → <b className="text-gold">¥{String(r.after)}</b></span>
                  <Tag tone="holo">{String(r.rule)}</Tag>
                  <span className="flex-1 truncate text-right text-[11px] text-ink3">{Array.isArray(r.basis) ? (r.basis as string[])[0] : ""}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Bridge>
  );
}
