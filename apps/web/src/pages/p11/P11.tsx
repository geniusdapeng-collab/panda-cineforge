/**
 * P11 商品价格矩阵（多平台价格守护 + 断货预警投影）
 *  - 跨平台价格倒挂预警（R18）/ 断货预警（R7）/ 主图合规阻断（R24）
 *  - 汇率重定价评估留痕（检出→评估→重定价三段式）
 *  - 连续调价事件流（R1 白班 ≤10% auto / R17 夜班微调 ≤3%，含 before/after/依据）
 *  - 数据源：twin.priceHealth（五元事件库 price.parity.watch / stock.stockout.alert / listing.image.block / pricing.fx.reprice.assess / price.adjust）
 * 轮询：15s（D6 其余口径）
 */
import { useEffect, useMemo, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";

interface Ev {
  event_id: string;
  context: { time: string; channel?: string; night_shift?: boolean };
  object: { type: string; id?: string; label?: string };
  decision: {
    action: string;
    before?: { price?: number };
    after?: {
      price?: number; gap_pct?: number; platform_low?: string; platform_ref?: string;
      days_cover?: number; daily_sales?: number; warehouse?: string; blocked_word?: string;
      reason?: string;
    };
    params?: { channel_price?: number; other_channel_min?: number };
    basis?: string[];
  };
  rule_impact: Array<{ rule_id: string; result: string }>;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const ruleOf = (ev: Ev) => ev.rule_impact?.[0]?.rule_id ?? "";

export default function P11() {
  const [ready, setReady] = useState(false);
  const [blocks, setBlocks] = useState<Ev[]>([]);
  const [fixes, setFixes] = useState<Ev[]>([]);
  const [adjusts, setAdjusts] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.priceHealth.query()) as unknown as { blocks: Ev[]; fixes: Ev[]; adjusts: Ev[] };
      if (stop) return;
      setBlocks(r.blocks); setFixes(r.fixes); setAdjusts(r.adjusts);
      setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const parityBlocks = useMemo(() => blocks.filter((b) => ruleOf(b) === "R18"), [blocks]);
  const stockBlocks = useMemo(() => blocks.filter((b) => ruleOf(b) === "R7"), [blocks]);

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">30 天守护 · GUARD</div>
      {[
        { label: "价格倒挂预警（R18）", n: parityBlocks.length, cls: "text-warn" },
        { label: "断货预警（R7）", n: stockBlocks.length, cls: "text-warn" },
        { label: "重定价评估", n: fixes.length, cls: "text-go" },
        { label: "连续调价动作", n: adjusts.length, cls: "text-holo" },
      ].map((s) => (
        <div key={s.label} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-xs">
          <span className="text-ink2">{s.label}</span>
          <b className={`font-mono ${s.cls}`}>{s.n}</b>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        多平台价格倒挂自动预警；可售天数跌破安全线触发断货预警并联动紧急采购；汇率波动触发全线重定价评估。检出→评估→处置三段留痕，全链可溯。
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P11" />} right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">商品价格矩阵</h2>
        <span className="text-[11px] tracking-[.2em] text-ink3">P11 · PRICE MATRIX</span>
      </div>

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>
      ) : blocks.length === 0 && adjusts.length === 0 ? (
        <EmptyState icon="🛡️" title="全平台价格健康" hint="倒挂/断货零告警。竞对雷达每 15 分钟巡检中。" />
      ) : (
        <div className="space-y-3">
          <SystemDivider time="守护留痕" summary="价格倒挂预警 / 断货预警 / 合规阻断 / 重定价评估（检出→评估→处置）" />
          {[...blocks, ...fixes]
            .sort((a, b) => +new Date(b.context.time) - +new Date(a.context.time))
            .map((ev) => {
              const rule = ruleOf(ev);
              const a = ev.decision.after ?? {};
              const isFix = ev.decision.action.includes("assess") || ev.decision.action.includes("restore");
              return (
                <div key={ev.event_id} className="rounded-lg border border-line bg-card p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink3">{fmtTime(ev.context.time)}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${isFix ? "border-go/40 text-go" : "border-warn/40 text-warn"}`}>
                      {isFix ? "已评估" : rule || "巡检"}
                    </span>
                    <span className="text-body font-semibold text-ink2">
                      {ev.context.channel ?? ev.object.label ?? ev.object.id ?? "平台"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs leading-relaxed text-ink3">
                    {ev.decision.action === "price.parity.watch" && (
                      <>低价平台 <b className="text-warn">{a.platform_low}</b> vs 基准 {a.platform_ref} → 倒挂 {a.gap_pct ? `${(a.gap_pct * 100).toFixed(1)}%` : "—"}（多平台价格守护）</>
                    )}
                    {ev.decision.action === "stock.stockout.alert" && (
                      <>可售天数 <b className="text-warn">{a.days_cover}</b> 天（日销 {a.daily_sales} · {a.warehouse}）→ 断货预警，联动紧急采购</>
                    )}
                    {ev.decision.action === "listing.image.block" && (
                      <>命中违禁词 <b className="text-warn">{a.blocked_word}</b> → 上架物理阻断（合规红线）</>
                    )}
                    {ev.decision.action === "pricing.fx.reprice.assess" && <>汇率波动触发<b className="text-go">全线重定价评估</b>（跨境店铺售价重算）</>}
                    {ev.decision.action === "inventory.sync.restore" && <>库存同步恢复，人工核验后<b className="text-go">重新上架</b></>}
                    {ev.decision.basis?.[0] ? <div className="mt-1 text-[11px]">{ev.decision.basis[0]}</div> : null}
                  </div>
                </div>
              );
            })}
          <SystemDivider time="连续调价流" summary="售价 = 围栏内的连续函数（R1 白班单日降幅 ≤10% auto / R17 夜班微调 ≤3% auto）" />
          {adjusts.slice(0, 10).map((ev) => {
            const b = ev.decision.before?.price;
            const a = ev.decision.after?.price;
            const pct = b && a ? (((a - b) / b) * 100).toFixed(1) : null;
            return (
              <div key={ev.event_id} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5">
                <span className="font-mono text-[11px] text-ink3">{fmtTime(ev.context.time)}</span>
                <span className="text-xs text-ink2">{ev.object.label ?? ev.object.id}</span>
                <span className="font-mono text-xs text-ink3">¥{b} → <b className="text-gold">¥{a}</b></span>
                {pct ? <span className="text-[11px] text-go">+{pct}%</span> : null}
                <span className="flex-1" />
                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink3">
                  {ruleOf(ev)}{ev.context.night_shift ? " · 夜班" : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Bridge>
  );
}
