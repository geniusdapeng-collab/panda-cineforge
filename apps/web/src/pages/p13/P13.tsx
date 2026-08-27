/**
 * P13 订单全流程穿透（B1：下单→履约→出库→物流→签收→售后→结算 全链可视）
 * 数据源：twin.events(order.create/settlement.reconcile/aftersale.refund) + twin.objectTrail（单订单正序回放）
 */
import { useEffect, useState } from "react";
import { actionText } from "../../lib/display";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";
import { Ev, fmtTime, PageHead, Row, Stat, Tag, Note } from "../../components/Twin";

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">订单穿透 · TRAIL</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">每环含执行者（人/Agent）、耗时、围栏判定与依据。异常环节一眼定位——订单状态再不用打电话问技术。</div>
  </>
);

export default function P13() {
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<Ev[]>([]);
  const [trail, setTrail] = useState<{ id: string; evs: Ev[] } | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.events.query({ actions: ["order.create", "settlement.reconcile", "aftersale.refund"], limit: 80 })) as unknown as Ev[];
      if (stop) return;
      setOrders(r); setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const openTrail = async (id: string) => {
    const evs = (await trpc.twin.objectTrail.query({ objectId: id })) as unknown as Ev[];
    setTrail({ id, evs });
  };

  const confirms = orders.filter((e) => e.decision.action === "order.create");
  const refunds = orders.filter((e) => e.decision.action === "aftersale.refund");

  return (
    <Bridge right={rightPanel} left={<PageNav current="P13" />}>
      <PageHead title="订单全流程穿透" tag="P13 · ORDER TRAIL" extra={
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) void openTrail(q.trim()); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入订单号（如 OD-882134）"
            className="w-52 rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-ink2 outline-none focus:border-gline" />
          <button type="submit" className="rounded-lg border border-gline bg-card px-3 py-1.5 text-xs text-gold">穿透</button>
        </form>
      } />
      {!ready ? (<><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="订单创建（样本窗口）" value={confirms.length} hint="库存校验后自动确认" />
            <Stat label="对账三轮一致" value={orders.filter((e) => e.decision.action === "settlement.reconcile").length} tone="text-go" hint="订单×平台账单×广告/售后" />
            <Stat label="售后退款（必审）" value={refunds.length} tone="text-warn" hint="≥¥1000 挂起审批" />
          </div>

          {trail && (
            <div className="rounded-lg border border-gline bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <b className="text-body text-gold">{trail.id}</b>
                <span className="text-[11px] text-ink3">全链 {trail.evs.length} 环（正序回放，哈希链可验）</span>
                <span className="flex-1" />
                <button type="button" onClick={() => setTrail(null)} className="text-[11px] text-ink3 hover:text-ink2">收起 ✕</button>
              </div>
              {trail.evs.length === 0 ? <div className="text-xs text-ink3">未找到该对象事件（检查订单号）。</div> : trail.evs.map((ev) => (
                <div key={ev.event_id} className="flex items-start gap-2.5 py-1.5">
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-go" />
                  <div className="text-xs">
                    <span className="font-mono text-ink3">{fmtTime(ev.context.time)}</span>
                    <span className="mx-2 font-semibold text-ink2">{actionText(ev.decision.action)}</span>
                    <span className="text-ink3">{ev.who?.type === "agent" ? `Agent ${ev.who.id}` : ev.who?.id}</span>
                    {ev.rule_impact?.[0] ? <span className="ml-2"><Tag tone="holo">{ev.rule_impact[0].rule_id} {ev.rule_impact[0].result}</Tag></span> : null}
                    {ev.decision.basis?.[0] ? <div className="mt-0.5 text-[11px] text-ink3">{ev.decision.basis[0]}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <SystemDivider time="订单流" summary="每单可点「穿透」查看全链：执行者/耗时/围栏判定/依据 逐环可溯" />
          {orders.slice(0, 25).map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)}
              right={<button type="button" onClick={() => void openTrail(String(ev.object.id))} className="rounded border border-line px-2 py-0.5 font-mono text-[10.5px] text-holo hover:border-gline">穿透</button>}>
              <b className="text-ink2">{ev.object.id}</b>
              <span className="text-ink3"> · {ev.context.channel ?? "平台"} · {ev.decision.action === "order.create" ? `已确认 ✓（库存校验通过）` : ev.decision.action === "settlement.reconcile" ? "对账一致 ✓" : "售后退款审批"}</span>
              {ev.decision.params?.amount ? <span className="ml-2 font-mono text-gold">¥{String(ev.decision.params.amount)}</span> : null}
            </Row>
          ))}
          {orders.length === 0 ? <EmptyState icon="🧾" title="暂无订单事件" hint="订单产生后在此汇聚，支持全链穿透。" /> : null}
          <Note>穿透能力 = 五元事件的天然红利：每环含执行者（人/Agent）、耗时、围栏判定与依据。异常环节一眼定位，不用再打电话问技术。</Note>
        </div>
      )}
    </Bridge>
  );
}
