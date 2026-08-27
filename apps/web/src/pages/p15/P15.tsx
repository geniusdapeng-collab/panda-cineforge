/**
 * P15 评价与差评防御（D1/D2：差评 2h SLA + 处置留痕 + 好评挖矿反哺）
 * 数据源：twin.events（review.reply / review.detect / review.asset.boost）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";
import { Ev, fmtTime, HBar, Note, PageHead, Row, Stat, Tag } from "../../components/Twin";

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">评价防线 · REVIEW</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">差评防御窗口前移到签收后 2 小时；处置案例沉淀组织记忆，同类问题越来越少是工程结果。</div>
  </>
);

export default function P15() {
  const [ready, setReady] = useState(false);
  const [evs, setEvs] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.events.query({ actions: ["review.reply", "review.detect", "review.asset.boost"], limit: 100 })) as unknown as Ev[];
      if (stop) return;
      setEvs(r); setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const replies = useMemo(() => evs.filter((e) => e.decision.action === "review.reply"), [evs]);
  const sla = useMemo(() => evs.filter((e) => e.decision.action === "review.detect"), [evs]);
  const bad = replies.filter((e) => Number(e.decision.params?.rating ?? 5) <= 3);
  const good = replies.length - bad.length;

  return (
    <Bridge right={rightPanel} left={<PageNav current="P15" />}>
      <PageHead title="评价与差评防御" tag="P15 · REVIEWS" extra={<Tag tone="warn">差评 2h SLA · R9</Tag>} />
      {!ready ? (<><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="评价回复（窗口）" value={replies.length} />
            <Stat label="好评自动回复" value={good} tone="text-go" hint="auto 放行留痕" />
            <Stat label="差评必审（R9）" value={bad.length} tone="text-warn" hint="三手势审批后发布" />
            <Stat label="SLA 防御窗口" value={sla.length} tone="text-warn" hint="2h 内响应，超时升级" />
          </div>
          <HBar label="好评率" pct={replies.length ? Math.round((good / replies.length) * 100) : 100} tone="bg-go" />

          <SystemDivider time="SLA 告警" summary="差评侦测即开 2h 防御窗口 → 超时自动升级店长（差评响应慢是流失主因）" />
          {sla.length === 0 ? <div className="rounded-lg border border-line bg-card p-3 text-xs text-go">✓ 当前无超时差评</div> : sla.map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<Tag tone="warn">已升级店长</Tag>}>
              <b className="text-ink2">{ev.object.id}</b>
              <span className="text-ink3"> · {ev.context.channel} · SLA {String(ev.decision.after?.sla_hours ?? 2)}h 窗口 · {String(ev.decision.after?.rating ?? ev.decision.params?.rating ?? "")} 分 · {String(ev.decision.after?.topic ?? "")}</span>
            </Row>
          ))}

          <SystemDivider time="评价处置流" summary="AI 起草 → 三手势审批 → 发布 → 案例沉淀组织记忆" />
          {replies.slice(0, 20).map((ev) => {
            const rating = Number(ev.decision.params?.rating ?? 5);
            const isBad = rating <= 3;
            return (
              <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<Tag tone={isBad ? "warn" : "go"}>{rating} 分 · {isBad ? "R9 已审" : "auto"}</Tag>}>
                <b className="text-ink2">{ev.object.id}</b>
                <span className="text-ink3"> · {ev.context.channel} · {isBad ? String(ev.decision.after?.draft ?? "致歉草稿").slice(0, 30) + "…" : "感谢回复已发布"}</span>
              </Row>
            );
          })}
          {replies.length === 0 ? <EmptyState icon="⭐" title="暂无评价事件" hint="各平台评价将在此汇聚处置。" /> : null}
          <Note>好评挖矿（review-asset-mining）：13 平台好评聚类卖点 TOP 榜，一键反哺小红书/抖音选题——买家夸什么，内容就放大什么。</Note>
        </div>
      )}
    </Bridge>
  );
}
