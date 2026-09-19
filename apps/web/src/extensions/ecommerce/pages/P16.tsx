/**
 * P16 客服监控墙（D4：多平台多语言会话监控 / 意图识别 / FAQ 知识库自生长 / 关键词升级转人工）
 * 关联来源：twin.events（cs.reply / cs.escalate / faq.mine）+ twin.archive（faq_kb 字段组）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../../lib/trpc";
import { Bridge } from "../../../shell/Bridge";
import { EmptyState, Skeleton, SystemDivider } from "../../../components/hud";
import { Ev, fmtTime, HBar, Note, PageHead, Row, Stat, EcomTag } from "../Twin";
import { dictText } from "../../../lib/display";
import { CS_INTENT_TEXT, LANG_TEXT, clientNodeText, clientValueText } from "../display";

interface FaqKb {
  top_questions?: Array<{ q: string; a: string; confirmed: boolean }>;
  pending_candidates?: Array<{ q: string; weekly_hits?: number; confirmed: boolean }>;
  last_mined_at?: string | null;
}

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-sm tracking-[.2em] text-ink3">客服监控</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-sm leading-relaxed text-ink3">日均 4.2 万条会话、8 语种覆盖；夜班班组主场：北京时间 22:00–08:00 恰为欧美日间高峰。高危承诺一律人审。</div>
  </>
);

export default function P16() {
  const [ready, setReady] = useState(false);
  const [calls, setCalls] = useState<Ev[]>([]);
  const [escalations, setEscalations] = useState<Ev[]>([]);
  const [mines, setMines] = useState<Ev[]>([]);
  const [kb, setKb] = useState<FaqKb | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const [evs, arch] = await Promise.all([
        trpc.twin.events.query({ actions: ["cs.reply", "cs.escalate", "faq.mine"], limit: 100 }) as unknown as Promise<Ev[]>,
        trpc.twin.archive.query() as unknown as Promise<{ archive: { faq_kb?: FaqKb } } | null>,
      ]);
      if (stop) return;
      setCalls(evs.filter((e) => e.decision.action === "cs.reply"));
      setEscalations(evs.filter((e) => e.decision.action === "cs.escalate"));
      setMines(evs.filter((e) => e.decision.action === "faq.mine"));
      setKb(arch?.archive?.faq_kb ?? null);
      setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const resolved = useMemo(() => calls.filter((c) => c.decision.after?.resolved === true).length, [calls]);
  const resolveRate = calls.length ? Math.round((resolved / calls.length) * 100) : 0;

  return (
    <Bridge right={rightPanel}>
      <PageHead title="客服监控墙" tag="客服监控" extra={<EcomTag tone="go">8 语种 · 24h 在线</EcomTag>} />
      {!ready ? (<><Skeleton count={2} height={44} /><Skeleton count={4} /></>) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="会话（窗口）" value={calls.length} />
            <Stat label="AI 独立解决" value={`${resolveRate}%`} tone="text-go" hint="知识库+商品库双源应答" />
            <Stat label="升级转人工" value={escalations.length} tone="text-holo" hint="带完整上下文摘要" />
            <Stat label="多模态消息" value={calls.filter((c) => c.decision.after?.multimodal).length} tone="text-go" hint="截图/图片/视频三管线" />
          </div>
          <HBar label="独立解决率" pct={resolveRate} tone="bg-go" />

          <SystemDivider time="会话流（五元留痕）" summary="意图识别 → 双源合成应答 / 关键词升级转人工（投诉·律师函·曝光媒体 自动路由专家席）" />
          {calls.slice(0, 15).map((ev) => {
            const ok = ev.decision.after?.resolved === true;
            return (
              <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<EcomTag tone={ok ? "go" : "holo"}>{ok ? "已解决" : "跟进中"}</EcomTag>}>
                <b className="text-ink2">「{ev.decision.after?.intent ? dictText(CS_INTENT_TEXT, String(ev.decision.after.intent)) : "咨询"}」</b>
                <span className="break-words text-ink3"> · {ev.decision.after?.lang ? dictText(LANG_TEXT, String(ev.decision.after.lang)) : "中文"} · 首响 {String(ev.decision.after?.first_response_sec ?? "—")} 秒{ev.decision.after?.multimodal ? ` · ${clientValueText(ev.decision.after.multimodal, "多模态消息")}` : ""}</span>
              </Row>
            );
          })}
          {escalations.slice(0, 5).map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<EcomTag tone="warn">已转人工</EcomTag>}>
              <b className="break-words text-warn">「{clientValueText(ev.decision.after?.keyword, "需要人工处理")}」</b>
              <span className="break-words text-ink3"> · 路由 {clientNodeText(ev.decision.after?.routed_to, "人工专家席")} · {clientValueText(ev.decision.after?.context_summary, "上下文摘要已生成")}</span>
            </Row>
          ))}
          {calls.length === 0 ? <EmptyState icon="💬" title="暂无会话" hint="各平台买家会话接入后实时上墙。" /> : null}

          <SystemDivider time="FAQ 知识库自生长" summary="未命中问题周问 ≥3 次自动成候选 · 店长确认入库 · 全平台应答口径一致" />
          {(kb?.top_questions ?? []).map((f) => (
            <Row key={f.q} right={<EcomTag tone="go">已入库 · 首响 ≤3s</EcomTag>}>
              <b className="text-ink2">「{f.q}」</b><span className="text-ink3"> → {f.a}</span>
            </Row>
          ))}
          {(kb?.pending_candidates ?? []).map((f) => (
            <Row key={f.q} right={
              confirmed.has(f.q)
                ? <EcomTag tone="go">已入库 ✓</EcomTag>
                : <button type="button" onClick={() => setConfirmed((s) => new Set(s).add(f.q))} className="rounded border border-gline px-2 py-0.5 font-mono text-sm text-gold">确认入库</button>
            }>
              <b className="text-warn">「{f.q}」</b>
              <span className="text-ink3"> · 周问 {f.weekly_hits ?? "≥3"} 次 · 来源会话可归因</span>
            </Row>
          ))}
          {mines.slice(0, 4).map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<EcomTag tone="gold">萃取记录</EcomTag>}>
              <span className="text-ink3">{String(ev.decision.basis?.[0] ?? "FAQ 萃取")}</span>
            </Row>
          ))}
          <Note>知识库不是人工录入的静态 FAQ——它每周自动变聪明。客服知识训练师维护商品知识库，客服质检官按转化与满意度迭代话术。</Note>
        </div>
      )}
    </Bridge>
  );
}
