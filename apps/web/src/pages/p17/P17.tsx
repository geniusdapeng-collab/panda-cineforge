/**
 * P17 海外仓地图（E1–E6：仓网总览 / 入出库流水 / 调拨平衡 / 库龄与断货预警）
 * 数据源：twin.events（stock.inbound / stock.outbound / stock.transfer / stock.count / stock.stockout.alert / fba.replenish）+ twin.archive（warehouses）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";
import { Ev, fmtTime, HBar, Note, PageHead, Row, Stat, Tag } from "../../components/Twin";

interface Warehouses {
  cn?: string[];
  overseas?: string[];
  fba?: boolean;
  stock_value_cny?: number;
}

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">仓网履约</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">库存是事件流的衍生品：出库=订单履约，余额逐日连续勾稽；盘点从「计数」退化为「校验」。库龄与断货预警直达采购沙盘。</div>
  </>
);

export default function P17() {
  const [ready, setReady] = useState(false);
  const [evs, setEvs] = useState<Ev[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouses | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const [r, arch] = await Promise.all([
        trpc.twin.events.query({ actions: ["stock.inbound", "stock.outbound", "stock.transfer", "stock.count", "stock.stockout.alert", "fba.replenish"], limit: 100 }) as unknown as Promise<Ev[]>,
        trpc.twin.archive.query() as unknown as Promise<{ archive: { warehouses?: Warehouses } } | null>,
      ]);
      if (stop) return;
      setEvs(r); setWarehouses(arch?.archive?.warehouses ?? null); setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const inbounds = useMemo(() => evs.filter((e) => e.decision.action === "stock.inbound"), [evs]);
  const outbounds = useMemo(() => evs.filter((e) => e.decision.action === "stock.outbound"), [evs]);
  const transfers = useMemo(() => evs.filter((e) => e.decision.action === "stock.transfer" || e.decision.action === "fba.replenish"), [evs]);
  const alerts = useMemo(() => evs.filter((e) => e.decision.action === "stock.stockout.alert"), [evs]);

  const overseasCount = (warehouses?.overseas?.length ?? 0) + (warehouses?.fba ? 1 : 0);

  return (
    <Bridge right={rightPanel} left={<PageNav current="P17" />}>
      <PageHead title="海外仓地图" tag="P17 · 海外仓" extra={<Tag tone="holo">在库货值 {warehouses?.stock_value_cny ? `¥${(warehouses.stock_value_cny / 1e8).toFixed(1)}亿` : "—"}</Tag>} />
      {!ready ? (<><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="国内仓" value={warehouses?.cn?.length ?? "—"} hint="库存健康与周转红线" />
            <Stat label="海外仓 + FBA" value={overseasCount || "—"} tone="text-holo" hint="调拨平衡 · 库龄管理" />
            <Stat label="出库履约（窗口）" value={outbounds.length} tone="text-go" hint="出库 = 订单履约勾稽" />
            <Stat label="断货预警（R7）" value={alerts.length} tone="text-warn" hint="可售 <7 天联动采购" />
          </div>

          <SystemDivider time="仓网布局" summary="国内 4 仓 · 海外 7 仓 + FBA（美东/美西/德国/波兰/日本/英国/澳洲）" />
          <div className="grid grid-cols-2 gap-2.5">
            {(warehouses?.cn ?? []).map((w, i) => (
              <div key={w} className="rounded-lg border border-line bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs"><b className="text-ink2">{w}</b><Tag tone="go">在营</Tag><span className="flex-1" /><span className="font-mono text-[10.5px] text-ink3">CN-{i + 1}</span></div>
                <HBar label="库存健康" pct={88 - i * 6} tone="bg-go" />
              </div>
            ))}
            {(warehouses?.overseas ?? []).map((w, i) => (
              <div key={w} className="rounded-lg border border-line bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs"><b className="text-ink2">海外仓 · {w}</b><Tag tone="holo">跨境</Tag><span className="flex-1" /><span className="font-mono text-[10.5px] text-ink3">OW-{i + 1}</span></div>
                <HBar label="库存健康" pct={82 - i * 5} tone="bg-holo" />
              </div>
            ))}
            {warehouses?.fba ? (
              <div className="rounded-lg border border-gline bg-card px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs"><b className="text-gold">FBA 仓网</b><Tag tone="gold">亚马逊</Tag></div>
                <HBar label="IPI 健康" pct={76} tone="bg-gold" />
              </div>
            ) : null}
          </div>

          <SystemDivider time="入出库与调拨流水" summary="采购入库 / 出库履约（与订单勾稽）/ 仓间调拨 / FBA 补货——库存余额逐日连续" />
          {[...inbounds.slice(0, 3), ...outbounds.slice(0, 6), ...transfers.slice(0, 4)]
            .sort((a, b) => +new Date(b.context.time) - +new Date(a.context.time))
            .map((ev) => {
              const a = ev.decision.after ?? {};
              const act = ev.decision.action;
              const desc = act === "stock.outbound"
                ? `履约单 ${String(a.order_id ?? "")} · 出库 ${String(a.qty_out ?? "—")} · ${String(a.warehouse ?? "")} · 余 ${String(a.balance_after ?? "—")}`
                : act === "stock.transfer"
                  ? `${String(a.from ?? "")} → ${String(a.to ?? "")} · ${String(a.qty ?? "—")} 件`
                  : `${act === "fba.replenish" ? "FBA 补货" : "入库"} ${String(a.qty ?? "—")} 件 · ${String(a.warehouse ?? "")}`;
              return (
                <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<Tag tone={act === "stock.outbound" ? "go" : "holo"}>{act === "stock.outbound" ? "出库履约" : act === "stock.transfer" ? "调拨" : act === "fba.replenish" ? "FBA" : "入库"}</Tag>}>
                  <b className="text-ink2">{ev.object.label ?? ev.object.id}</b>
                  <span className="text-ink3"> · {desc}</span>
                </Row>
              );
            })}
          {evs.length === 0 ? <EmptyState icon="📦" title="暂无库存流水" hint="入出库/调拨事件将按履约实时生成。" /> : null}

          <SystemDivider time="断货预警" summary="可售天数 <7 且补货在途为 0 → 预警并联动紧急采购请示（R7）" />
          {alerts.length === 0 ? <div className="rounded-lg border border-line bg-card p-3 text-xs text-go">✓ 当前无断货风险 SKU</div> : alerts.map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<Tag tone="warn">R7 预警</Tag>}>
              <b className="text-ink2">{ev.object.label ?? ev.object.id}</b>
              <span className="text-ink3"> · 可售 {String(ev.decision.after?.days_cover ?? "—")} 天 · 日销 {String(ev.decision.after?.daily_sales ?? "—")} · {String(ev.decision.after?.warehouse ?? "")}</span>
            </Row>
          ))}
          <Note>海外仓调拨官平衡 7 仓 + FBA 库龄；库龄 90 天 SKU 自动进入清仓预案，头程物流官按时效与成本择优发运。</Note>
        </div>
      )}
    </Bridge>
  );
}
