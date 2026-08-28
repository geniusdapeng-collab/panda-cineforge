/**
 * P18 多店驾驶舱（A4：owner-cockpit —— 一屏管 14 店铺，管理半径数倍放大）
 * 数据源：twin.stores（同租户各工作区最新 store.daily.summary + night.package.deliver，逐工作区 RLS 轮询）
 */
import { useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../lib/trpc";
import { Bridge } from "../../shell/Bridge";
import { SkeletonBlock, SystemDivider } from "../../components/hud";
import { PageNav } from "../../components/PageNav";
import { HBar, Note, PageHead, Tag } from "../../components/Twin";

interface StoreRow {
  workspaceId: string; name: string; eventCount: number;
  daily: { context?: { time?: string }; decision?: { after?: { gmv?: number; orders?: number; margin_rate?: number; acos?: number } } } | null;
  nightPackage: { decision?: { after?: { done?: number; pending?: number; escalate?: number; fence_snapshot?: string } } } | null;
}

export default function P18() {
  const [ready, setReady] = useState(false);
  const [stores, setStores] = useState<StoreRow[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.stores.query()) as unknown as StoreRow[];
      if (stop) return;
      setStores(r); setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  return (
    <Bridge left={<PageNav current="P18" />}>
      <PageHead title="多店驾驶舱" tag="P18 · 多店驾驶舱" extra={<Tag tone="gold">一人管 14 店</Tag>} />
      {!ready ? (<><SkeletonBlock lines={2} h={44} /><SkeletonBlock lines={4} /></>) : (
        <div className="space-y-3">
          <SystemDivider time="全店经营快照" summary="各店最新日报（GMV/订单/毛利率）+ 昨夜决策包三栏 + 事件规模" />
          {stores.map((s) => {
            const a = s.daily?.decision?.after ?? {};
            const pkg = s.nightPackage?.decision?.after ?? {};
            return (
              <div key={s.workspaceId} className="rounded-lg border border-line bg-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <b className="text-body text-ink2">{s.name}</b>
                  <span className="font-mono text-[11px] text-ink3">{s.workspaceId}</span>
                  <span className="flex-1" />
                  <Tag tone="holo">事件 {s.eventCount.toLocaleString()} 条</Tag>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-3">
                  <HBar label="GMV 达成" pct={Math.min(100, Math.round(Number(a.gmv ?? 0) / 1e6))} value={a.gmv ? `¥${(Number(a.gmv) / 10000).toFixed(0)}万` : "—"} tone="bg-holo" />
                  <HBar label="毛利率" pct={Math.round(Number(a.margin_rate ?? 0) * 100)} value={a.margin_rate ? `${(Number(a.margin_rate) * 100).toFixed(1)}%` : "—"} tone="bg-gold" />
                  <HBar label="ACoS" pct={Math.round(Number(a.acos ?? 0) * 100)} value={a.acos ? `${(Number(a.acos) * 100).toFixed(0)}%` : "—"} tone="bg-go" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-ink3">昨夜决策包：</span>
                  <Tag tone="go">✓ 已完成 {pkg.done ?? "—"}</Tag>
                  <Tag tone={pkg.pending ? "warn" : "ink"}>◆ 待审批 {pkg.pending ?? 0}</Tag>
                  <Tag tone={pkg.escalate ? "warn" : "ink"}>▲ 需介入 {pkg.escalate ?? 0}</Tag>
                  <span className="flex-1" />
                  <span className="font-mono text-[10.5px] text-ink3">快照 {pkg.fence_snapshot ?? "—"}</span>
                </div>
              </div>
            );
          })}
          <Note>告警收敛 + 跨店待审批收件箱 + 断点率排名：老板每天 5 分钟看完全部店铺。单平台多店/国内多平台/跨境集团三种客群一套系统，扩张零边际系统成本。</Note>
        </div>
      )}
    </Bridge>
  );
}
