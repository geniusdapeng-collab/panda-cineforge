/**
 * P30 头程跟单（P2：对标大卖实战系统「库存跟进/物流」板块——干跨境的，仓库跟单是很重要的点）
 *  - 批次卡片：运单号/柜号、渠道、箱数/件数、起运地→目的地、八节点时间轴（发货→集货→装柜→开船→到港→清关→签收→入网）
 *  - 节点推进（只前进，防回退）；异常标记（联系物流商前置；exception/lost 联动决策卡片冻结货值）
 *  - 库龄结构条（0-30/31-60/61-90/90+；90+ 压现金联动 R6 清仓请示）
 * 数据源：trpc.ecom.shipments.* / trpc.ecom.executors.run(stockout-guard)
 */
import { useCallback, useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";

interface ShipmentRow {
  id: string; shop_id: string; tracking_no: string; carrier: string; channel: string;
  origin: string; destination: string; boxes: number; units: number;
  status: string; current_node: string; loss_flag: boolean; updated_at: string;
}
interface MilestoneRow { shipment_id: string; node: string; occurred_at: string; eta: boolean; note: string }
interface AgeingBucket { bucket: string; qty: number; valueAmount: number; pctOfValue: number }

const svc = () => trpc.ecom as unknown as {
  shipments: {
    list: { query: (i: { status?: string }) => Promise<{ shipments: ShipmentRow[]; milestones: MilestoneRow[]; nodeOrder: string[] }> };
    advance: { mutate: (i: { shipmentId: string; node: string; occurredAt: string; note?: string }) => Promise<{ milestoneId: string }> };
    markException: { mutate: (i: { shipmentId: string; reason: string; lost?: boolean }) => Promise<{ ok: boolean }> };
  };
  executors: {
    run: { query: (i: { skill: "stockout-guard" }) => Promise<{ detail: { ageing: AgeingBucket[] }; narrativeHints: string[] }> };
  };
};

const NODE_LABEL: Record<string, string> = {
  departed: "国内仓发货", consolidated: "集货完成", loaded: "已装柜", sailed: "船期开船",
  arrived: "到达目的港", clearing: "清关处理中", signed: "仓库签收", shelved: "入网上架",
};
const CHANNEL_TEXT: Record<string, string> = { sea: "海运", air: "空运", rail: "铁路", express: "快递" };
const money = (v: number): string => `¥${Math.round(v).toLocaleString()}`;
const fmtD = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function P30() {
  const [ready, setReady] = useState(false);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [nodeOrder, setNodeOrder] = useState<string[]>([]);
  const [ageing, setAgeing] = useState<AgeingBucket[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    await ensureDemoLogin();
    const [s, g] = await Promise.all([
      svc().shipments.list.query(filter ? { status: filter } : {}),
      svc().executors.run.query({ skill: "stockout-guard" }),
    ]);
    setShipments(s.shipments); setMilestones(s.milestones); setNodeOrder(s.nodeOrder);
    setAgeing(g.detail.ageing); setHints(g.narrativeHints);
    setReady(true);
  }, [filter]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const nextNode = (ship: ShipmentRow): string | null => {
    const idx = nodeOrder.indexOf(ship.current_node);
    return idx >= 0 && idx < nodeOrder.length - 1 ? nodeOrder[idx + 1]! : null;
  };

  const onAdvance = async (ship: ShipmentRow) => {
    const nn = nextNode(ship);
    if (!nn) return;
    setBusy(ship.id);
    await svc().shipments.advance.mutate({ shipmentId: ship.id, node: nn, occurredAt: new Date().toISOString() });
    setToast(`批次 ${ship.tracking_no} 已推进至「${NODE_LABEL[nn]}」（节点只前进，全程留痕）`);
    await load(); setBusy("");
  };

  const onException = async (ship: ShipmentRow) => {
    const reason = window.prompt("异常原因（将写五元事件并联动决策卡片冻结货值）：", "物流停滞，联系物流商核实");
    if (!reason) return;
    setBusy(ship.id);
    await svc().shipments.markException.mutate({ shipmentId: ship.id, reason });
    await load(); setBusy("");
  };

  const inTransit = shipments.filter((s) => !["signed", "shelved"].includes(s.status)).length;
  const exceptions = shipments.filter((s) => ["exception", "lost"].includes(s.status)).length;
  const ageing90 = ageing.find((a) => a.bucket === "90+");

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">跟单全景</div>
      {[
        { label: "在途批次", n: inTransit, cls: "text-holo" },
        { label: "异常/灭失批次", n: exceptions, cls: exceptions > 0 ? "text-alert" : "text-go" },
        { label: "90+ 天库龄货值", n: money(ageing90?.valueAmount ?? 0), cls: (ageing90?.pctOfValue ?? 0) > 15 ? "text-warn" : "text-ink2" },
      ].map((s) => (
        <div key={s.label} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-xs">
          <span className="text-ink2">{s.label}</span>
          <b className={`font-mono ${s.cls}`}>{s.n}</b>
        </div>
      ))}
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">库龄结构</div>
      <div className="rounded-lg border border-line bg-card p-3">
        {ageing.map((a) => (
          <div key={a.bucket} className="mb-1.5 flex items-center gap-2 text-[11px]">
            <span className="w-12 font-mono text-ink3">{a.bucket}天</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-bg900">
              <div className={`h-full ${a.bucket === "90+" ? "bg-alert" : a.bucket === "61-90" ? "bg-warn" : "bg-go"}`}
                style={{ width: `${Math.min(100, a.pctOfValue)}%` }} />
            </div>
            <span className="w-10 text-right font-mono text-ink2">{a.pctOfValue}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        {hints[0] ?? "断货 <7 天触发 R7 紧急采购请示；库龄 >60 天触发 R6 清仓请示。"}
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P30" />} right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">头程跟单</h2>
        <span className="text-[11px] tracking-[.2em] text-ink3">P30 · 跨境物流八节点</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="ml-auto rounded border border-line bg-bg900 px-2 py-1 text-xs text-ink2">
          <option value="">全部状态</option>
          {["departed", "sailed", "arrived", "clearing", "signed", "exception", "lost"].map((s) => (
            <option key={s} value={s}>{NODE_LABEL[s] ?? s}</option>
          ))}
        </select>
      </div>

      {toast && <div className="mb-3 rounded-lg border border-gline bg-card px-3 py-2 text-xs text-gold">{toast}</div>}

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={5} /></>
      ) : shipments.length === 0 ? (
        <EmptyState icon="🚢" title="暂无头程批次" hint="到 P28 表格导入上传仓库跟单表，批次即刻进入八节点时间轴。" />
      ) : (
        <div className="space-y-3">
          <SystemDivider time="批次时间轴" summary="发货→集货→装柜→开船→到港→清关→签收→入网（节点只前进，防回退校验）" />
          {shipments.map((ship) => {
            const curIdx = nodeOrder.indexOf(ship.current_node);
            const ms = milestones.filter((m) => m.shipment_id === ship.id);
            const nn = nextNode(ship);
            const isException = ["exception", "lost"].includes(ship.status);
            return (
              <div key={ship.id} className={`rounded-lg border bg-card p-3 ${isException ? "border-alert/50" : "border-line"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-body font-semibold text-ink2">{ship.tracking_no}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink3">{CHANNEL_TEXT[ship.channel] ?? ship.channel}</span>
                  <span className="text-[11px] text-ink3">{ship.carrier || "物流商未填"}</span>
                  <span className="text-[11px] text-ink3">{ship.origin} → {ship.destination}</span>
                  <span className="font-mono text-[11px] text-ink3">{ship.boxes} 箱 / {ship.units} 件</span>
                  {isException && <span className="rounded border border-alert/40 px-1.5 py-0.5 text-[11px] text-alert">{ship.status === "lost" ? "灭失" : "异常"}</span>}
                  <span className="ml-auto flex gap-1.5">
                    {nn && !isException && (
                      <button disabled={busy === ship.id} onClick={() => void onAdvance(ship)}
                        className="rounded border border-gline px-2 py-0.5 text-[11px] text-gold">
                        推进至「{NODE_LABEL[nn]}」
                      </button>
                    )}
                    {!isException && (
                      <button disabled={busy === ship.id} onClick={() => void onException(ship)}
                        className="rounded border border-alert/40 px-2 py-0.5 text-[11px] text-alert">
                        标记异常 / 联系物流商
                      </button>
                    )}
                  </span>
                </div>
                {/* 八节点时间轴 */}
                <div className="mt-3 flex items-center">
                  {nodeOrder.map((node, i) => {
                    const done = i <= curIdx;
                    const m = ms.find((x) => x.node === node);
                    return (
                      <div key={node} className="flex flex-1 items-center last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`h-2.5 w-2.5 rounded-full ${done ? (isException && i === curIdx ? "bg-alert" : "bg-go") : "bg-line"}`} />
                          <div className={`mt-1 whitespace-nowrap text-[10px] ${done ? "text-ink2" : "text-ink3"}`}>
                            {NODE_LABEL[node]}
                          </div>
                          <div className="font-mono text-[10px] text-ink3">{m ? fmtD(m.occurred_at) : ""}</div>
                        </div>
                        {i < nodeOrder.length - 1 && <div className={`mx-1 mb-5 h-px flex-1 ${i < curIdx ? "bg-go/60" : "bg-line"}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Bridge>
  );
}
