/**
 * P29 利润驾驶舱（P2：对标大卖实战系统「利润分析 + 财务中心」板块）
 *  - 回款率仪表（真实锚点：平台结算实际到账 / 账期销售额；健康线 70%，cost-ledger.yml 同源）
 *  - 店铺利润瀑布：回款净额 − 采购 − 头程 − 仓储 − 广告 − 平台费 − 罚款 = 净利（全口径）
 *  - 罚款榜（单列，不并入平台费）/ 应付账期（资金占用）
 *  - SKU 损益瀑布账（sku-profit-ledger★ 执行体；毛利率 <10% 一票否决）
 * 数据源：trpc.ecom.finance.cockpit / trpc.ecom.finance.skuLedger（金额全部 SQL 出数）
 */
import { useCallback, useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { EmptyState, SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";

interface WaterfallRow {
  shop_id: string; period: string; currency: string;
  gross_amount: string; fee_amount: string; refund_amount: string; payout_net: string;
  cost_purchase: string; cost_freight: string; cost_storage: string;
  cost_ads: string; cost_platform_fee: string; cost_penalty: string;
  cost_total: string; net_profit: string; net_margin_pct: string | null;
}
interface PayoutCard { currency: string; gross: string; net: string; payout_rate_pct: string | null }
interface PenaltyRow { shop_id: string; kind: string; currency: string; amount: string; cnt: string }
interface PayableRow { supplier: string; currency: string; outstanding: string; nearest_due: string; overdue_cnt: string }
interface SkuRow {
  sku: string; shopId: string; revenue: number; netProfit: number; marginPct: number; veto: boolean;
  costs: { purchase: number; freight: number; storage: number; ads: number; platformFee: number; penalty: number };
}

const svc = () => trpc.ecom as unknown as {
  finance: {
    cockpit: { query: (i: { period?: string }) => Promise<{
      period: string; waterfall: WaterfallRow[]; payoutCards: PayoutCard[];
      penalties: PenaltyRow[]; payables: PayableRow[];
    }> };
    skuLedger: { query: (i: { period?: string; topN?: number }) => Promise<{ detail: { rows: SkuRow[]; vetoed: string[] } }> };
  };
};

const n = (v: string | number | null | undefined): number => Number(v ?? 0);
const money = (v: number): string => `¥${Math.round(v).toLocaleString()}`;
const pctCls = (v: number): string => (v >= 15 ? "text-go" : v >= 0 ? "text-warn" : "text-alert");

export default function P29() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [ready, setReady] = useState(false);
  const [waterfall, setWaterfall] = useState<WaterfallRow[]>([]);
  const [payoutCards, setPayoutCards] = useState<PayoutCard[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  const [vetoed, setVetoed] = useState<string[]>([]);

  const load = useCallback(async () => {
    await ensureDemoLogin();
    const [c, s] = await Promise.all([
      svc().finance.cockpit.query({ period }),
      svc().finance.skuLedger.query({ period, topN: 30 }),
    ]);
    setWaterfall(c.waterfall); setPayoutCards(c.payoutCards);
    setPenalties(c.penalties); setPayables(c.payables);
    setSkuRows(s.detail.rows); setVetoed(s.detail.vetoed);
    setReady(true);
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const totalNet = waterfall.reduce((s, x) => s + n(x.net_profit), 0);
  const totalPayout = waterfall.reduce((s, x) => s + n(x.payout_net), 0);
  const totalCost = waterfall.reduce((s, x) => s + n(x.cost_total), 0);

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">{period} 集团口径</div>
      {[
        { label: "真实回款净额", n: money(totalPayout), cls: "text-holo" },
        { label: "全口径成本", n: money(totalCost), cls: "text-warn" },
        { label: "净利润", n: money(totalNet), cls: totalNet >= 0 ? "text-go" : "text-alert" },
        { label: "罚款支出（单列）", n: money(penalties.reduce((s, x) => s + n(x.amount), 0)), cls: "text-alert" },
        { label: "应付未付（资金占用）", n: money(payables.reduce((s, x) => s + n(x.outstanding), 0)), cls: "text-ink2" },
        { label: "毛利率否决 SKU", n: vetoed.length, cls: vetoed.length > 0 ? "text-alert" : "text-go" },
      ].map((s) => (
        <div key={s.label} className="mb-2 flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-xs">
          <span className="text-ink2">{s.label}</span>
          <b className={`font-mono ${s.cls}`}>{s.n}</b>
        </div>
      ))}
      <div className="mt-3 rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        金额铁律：本页所有数字来自 shop_profit_waterfall / sku_cost_ledger 视图 SQL 直算，
        口径参数化于 cost-ledger.yml——以您真实核算表格为准，AI 不自造口径。
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P29" />} right={right}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-h1 font-black tracking-wider">利润驾驶舱</h2>
        <span className="text-[11px] tracking-[.2em] text-ink3">P29 · 全口径利润 / 财务中心</span>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
          className="ml-auto rounded border border-line bg-bg900 px-2 py-1 font-mono text-xs text-ink2" />
      </div>

      {!ready ? (
        <><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={5} /></>
      ) : (
        <div className="space-y-3">
          <SystemDivider time="回款率" summary="实际到账 / 账期销售额 · 健康线 70%（大卖实战水位 72%）" />
          {payoutCards.length === 0 ? (
            <EmptyState icon="💰" title="暂无回款数据" hint="到 P28 数据源接入中心登记店铺授权或导入真实回款表。" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {payoutCards.map((p) => {
                const rate = n(p.payout_rate_pct);
                return (
                  <div key={p.currency} className="rounded-lg border border-line bg-card p-3">
                    <div className="text-[11px] text-ink3">{p.currency} 账期</div>
                    <div className={`mt-1 font-mono text-2xl font-black ${rate >= 70 ? "text-go" : "text-alert"}`}>
                      {rate.toFixed(1)}%
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-ink3">
                      回款 {money(n(p.net))} / 销售 {money(n(p.gross))}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-bg900">
                      <div className={`h-full ${rate >= 70 ? "bg-go" : "bg-alert"}`} style={{ width: `${Math.min(100, rate)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <SystemDivider time="店铺利润瀑布" summary="回款净额 − 采购 − 头程 − 仓储 − 广告 − 平台费 − 罚款 = 净利" />
          {waterfall.length === 0 ? (
            <EmptyState icon="📉" title="暂无利润瀑布数据" hint="导入成本项与回款表后自动生成。" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-bg900 text-left text-[11px] text-ink3">
                    {["店铺", "回款净额", "采购", "头程", "仓储", "广告", "平台费", "罚款", "净利", "净利率"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waterfall.map((w) => (
                    <tr key={w.shop_id} className="border-b border-line/50 font-mono">
                      <td className="px-2 py-2 font-sans font-semibold text-ink2">{w.shop_id}</td>
                      <td className="px-2 py-2 text-holo">{money(n(w.payout_net))}</td>
                      <td className="px-2 py-2 text-ink3">{money(n(w.cost_purchase))}</td>
                      <td className="px-2 py-2 text-ink3">{money(n(w.cost_freight))}</td>
                      <td className="px-2 py-2 text-ink3">{money(n(w.cost_storage))}</td>
                      <td className="px-2 py-2 text-ink3">{money(n(w.cost_ads))}</td>
                      <td className="px-2 py-2 text-ink3">{money(n(w.cost_platform_fee))}</td>
                      <td className={`px-2 py-2 ${n(w.cost_penalty) > 0 ? "text-alert" : "text-ink3"}`}>{money(n(w.cost_penalty))}</td>
                      <td className={`px-2 py-2 font-bold ${n(w.net_profit) >= 0 ? "text-go" : "text-alert"}`}>{money(n(w.net_profit))}</td>
                      <td className={`px-2 py-2 ${pctCls(n(w.net_margin_pct))}`}>{w.net_margin_pct ?? "—"}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SystemDivider time="罚款榜" summary="罚款单列（大卖实战口径：不并入平台费；可申诉 48h 内发起）" />
          {penalties.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {penalties.slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-xs">
                  <span className="text-ink2">{p.shop_id} · <span className="text-alert">{p.kind}</span> ×{p.cnt}</span>
                  <b className="font-mono text-alert">{money(n(p.amount))}</b>
                </div>
              ))}
            </div>
          )}

          <SystemDivider time="应付账期" summary="供应商未付余额与最近到期（资金占用）" />
          {payables.length > 0 && (
            <div className="space-y-1.5">
              {payables.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 text-xs">
                  <span className="text-ink2">{p.supplier}</span>
                  {n(p.overdue_cnt) > 0 && <span className="rounded border border-alert/40 px-1.5 py-0.5 text-[11px] text-alert">逾期 ×{p.overdue_cnt}</span>}
                  <span className="ml-auto font-mono text-[11px] text-ink3">最近到期 {p.nearest_due ? new Date(p.nearest_due).toLocaleDateString("zh-CN") : "—"}</span>
                  <b className="font-mono text-warn">{money(n(p.outstanding))}</b>
                </div>
              ))}
            </div>
          )}

          <SystemDivider time="SKU 损益瀑布账" summary="sku-profit-ledger★ · 毛利率 <10% 一票否决（selection-ledger 红线）" />
          {skuRows.length === 0 ? (
            <EmptyState icon="🏷️" title="暂无 SKU 成本账" hint="导入 SKU 级成本表后自动生成。" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-bg900 text-left text-[11px] text-ink3">
                    {["SKU", "店铺", "收入(分摊)", "成本合计", "净利", "毛利率", "判定"].map((h) => (
                      <th key={h} className="px-2 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skuRows.map((s) => (
                    <tr key={`${s.shopId}-${s.sku}`} className="border-b border-line/50 font-mono">
                      <td className="px-2 py-2 text-ink2">{s.sku}</td>
                      <td className="px-2 py-2 text-ink3">{s.shopId}</td>
                      <td className="px-2 py-2 text-holo">{money(s.revenue)}</td>
                      <td className="px-2 py-2 text-ink3">{money(Object.values(s.costs).reduce((a, b) => a + b, 0))}</td>
                      <td className={`px-2 py-2 font-bold ${s.netProfit >= 0 ? "text-go" : "text-alert"}`}>{money(s.netProfit)}</td>
                      <td className={`px-2 py-2 ${pctCls(s.marginPct)}`}>{s.marginPct}%</td>
                      <td className="px-2 py-2">
                        {s.veto
                          ? <span className="rounded border border-alert/40 px-1.5 py-0.5 text-[11px] text-alert">一票否决</span>
                          : <span className="rounded border border-go/40 px-1.5 py-0.5 text-[11px] text-go">健康</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Bridge>
  );
}
