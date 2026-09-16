/**
 * P14 平台运营（B2：13 平台价格/库存/活动/图评一屏巡检 + 内容营销）
 * 关联来源：twin.archive（inspection 巡检快照/channels）+ twin.events（content.publish/competitor.fetch/price.publish）
 */
import { useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../../lib/trpc";
import { Bridge } from "../../../shell/Bridge";
import { Skeleton, SystemDivider } from "../../../components/hud";
import { Ev, fmtTime, HBar, Note, PageHead, Row, Tag } from "../Twin";
import { clientNodeText, clientStatusLabel, clientValueText } from "../display";

interface ArchiveShape {
  channels?: Array<{ name: string; kind: string; channel_new?: boolean }>;
  inspection?: { channels?: Array<{ channel: string; price: number; parity: boolean; status: string }> };
}

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-sm tracking-[.2em] text-ink3">平台治理</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-sm leading-relaxed text-ink3">倒挂与断货处置请查看商品价格矩阵；刊登与图评整改由刊登工厂产出。多平台「三失」（失控/失时/失准）在此收口。</div>
  </>
);

export default function P14() {
  const [ready, setReady] = useState(false);
  const [archive, setArchive] = useState<ArchiveShape | null>(null);
  const [contents, setContents] = useState<Ev[]>([]);
  const [competitor, setCompetitor] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      await ensureDemoLogin();
      const [a, evs] = await Promise.all([
        trpc.twin.archive.query() as unknown as Promise<{ archive: ArchiveShape } | null>,
        trpc.twin.events.query({ actions: ["content.publish", "competitor.fetch"], limit: 40 }) as unknown as Promise<Ev[]>,
      ]);
      if (stop) return;
      setArchive(a?.archive ?? null);
      setContents(evs.filter((e) => e.decision.action === "content.publish"));
      setCompetitor(evs.filter((e) => e.decision.action === "competitor.fetch"));
      setReady(true);
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const snap = archive?.inspection?.channels ?? [];
  const chanDefs = archive?.channels ?? [];

  return (
    <Bridge right={rightPanel}>
      <PageHead title="平台运营" tag="平台经营视图" extra={<Tag tone="holo">每 30 分钟自动巡检</Tag>} />
      {!ready ? (<><Skeleton count={2} height={44} /><Skeleton count={4} /></>) : (
        <div className="space-y-3">
          <SystemDivider time="平台巡检快照" summary="价格一致性 / 库存同步 / 在线状态（店铺档案 巡检数据输入）" />
          {snap.length === 0 ? (
            <div className="rounded-lg border border-line bg-card p-3 text-sm text-ink3">暂无巡检快照（档案 巡检配置未配置）。</div>
          ) : snap.map((c) => (
            <Row key={c.channel} right={<>
              <Tag tone={c.parity ? "go" : "warn"}>{c.parity ? "价格一致" : "价差异常"}</Tag>
              <Tag tone={c.status === "online" ? "holo" : "warn"}>{clientStatusLabel(c.status)}</Tag>
            </>}>
              <b className="min-w-0 break-words text-ink2">{clientNodeText(c.channel, "销售平台")}</b>
              <span className="ml-2 font-mono text-gold">¥{c.price}</span>
              {!c.parity ? <span className="ml-2 text-warn">· 低于其他平台，正在复核价格倒挂</span> : null}
            </Row>
          ))}

          <SystemDivider time="平台清单" summary={`${chanDefs.length} 个已接入平台（货架/直播/内容/跨境）`} />
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {chanDefs.map((c) => (
              <div key={c.name} className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm">
                <b className="min-w-0 break-words text-ink2">{clientNodeText(c.name, "销售平台")}</b>
                <span className="break-words text-ink3">{clientValueText(c.kind, "平台渠道")}</span>
                <span className="flex-1" />
                {c.channel_new ? <Tag tone="gold">新平台 · 首次发布需审核</Tag> : <Tag tone="ink">成熟平台</Tag>}
              </div>
            ))}
          </div>

          <SystemDivider time="内容营销" summary="小红书/抖音发布留痕（新平台与直播首次发布均需审核）" />
          {contents.slice(0, 8).map((ev) => (
            <Row key={ev.event_id} time={fmtTime(ev.context.time)} right={<Tag tone="go">已发布</Tag>}>
              <b className="min-w-0 break-words text-ink2">{clientValueText(ev.decision.after?.title, "内容发布")}</b>
              <span className="break-words text-ink3"> · {clientNodeText(ev.context.channel ?? ev.decision.params?.platform, "销售平台")}</span>
            </Row>
          ))}
          <HBar label="竞对价格卡采集（30 天）" pct={Math.min(100, competitor.length * 3)} value={`${competitor.length} 次`} tone="bg-gold" />
          <Note>多平台「三失」治理：价格倒挂预警与断货预警请查看商品价格矩阵；活动报名/图片卖点整改建议由 商品刊登技能产出。</Note>
        </div>
      )}
    </Bridge>
  );
}
