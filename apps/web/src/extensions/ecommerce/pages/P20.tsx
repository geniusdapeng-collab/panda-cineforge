/**
 * P20 店铺档案全景（槽①：五类字段组——数字员工生成内容前必读三要素之一 L3.7；一店一档 ×14 店铺）
 * 关联来源：twin.archive（profiles.archive 全量 + forbidden 硬约束独立列）
 */
import { useEffect, useState } from "react";
import { ensureDemoLogin, trpc } from "../../../lib/trpc";
import { Bridge } from "../../../shell/Bridge";
import { EmptyState, Skeleton } from "../../../components/hud";
import { Note, PageHead, EcomTag } from "../Twin";
import { clientValueText, fieldText } from "../display";

type Archive = Record<string, unknown>;

/** 字段组展示分节（五类口径与 schemas/archive.schema.json 对齐） */
const SECTIONS: Array<{ title: string; keys: string[] }> = [
  { title: "基础类", keys: ["property", "brand_guideline", "product_matrix"] },
  { title: "业务类", keys: ["business", "competitors", "channels", "promo_calendar", "goals", "audience", "history_curve", "account_health"] },
  { title: "运营类", keys: ["operations", "staffing", "suppliers", "warehouses", "logistics", "incident_profile", "faq_kb", "inspection", "shops"] },
  { title: "治理类", keys: ["sop", "forbidden", "approval_matrix", "compensation_policy"] },
  { title: "记忆类", keys: ["memory"] },
];

function renderValue(v: unknown, depth = 0): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-ink3">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return <span className="break-words text-ink2">{clientValueText(v, "已配置")}</span>;
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return <span className="break-words text-ink2">{v.map((x) => clientValueText(x, "已配置")).join("、")}</span>;
    return (
      <div className="mt-1 space-y-1">
        {v.slice(0, 6).map((x, i) => (
          <div key={i} className="rounded border border-line bg-bg950 px-2 py-1">{renderValue(x, depth + 1)}</div>
        ))}
        {v.length > 6 ? <div className="text-sm text-ink3">…共 {v.length} 项</div> : null}
      </div>
    );
  }
  const entries = Object.entries(v as Record<string, unknown>);
  return (
    <div className={`grid min-w-0 grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)] ${depth > 0 ? "text-sm" : "text-sm"}`}>
      {entries.slice(0, 12).map(([k, val]) => (
        <div key={k} className="contents">
          <span className="break-words text-ink3">{fieldText(k)}</span>
          <span className="min-w-0">{renderValue(val, depth + 1)}</span>
        </div>
      ))}
      {entries.length > 12 ? <div className="col-span-2 text-sm text-ink3">…共 {entries.length} 字段</div> : null}
    </div>
  );
}

const rightPanel = (
  <>
    <div className="mb-2 px-1 text-sm tracking-[.2em] text-ink3">档案即配置</div>
    <div className="rounded-lg border border-gline bg-card p-3 text-sm leading-relaxed text-ink3">改档案即改系统行为边界：毛利红线、审批矩阵与断货预警线均来自同一配置源。</div>
  </>
);

export default function P20() {
  const [ready, setReady] = useState(false);
  const [archive, setArchive] = useState<Archive | null>(null);

  useEffect(() => {
    void (async () => {
      await ensureDemoLogin();
      const r = (await trpc.twin.archive.query()) as unknown as { archive: Archive } | null;
      setArchive(r?.archive ?? null);
      setReady(true);
    })();
  }, []);

  return (
    <Bridge right={rightPanel}>
      <PageHead title="店铺档案" tag="店铺档案" extra={<EcomTag tone="gold">一店一档 ×14</EcomTag>} />
      {!ready ? (<><Skeleton count={2} height={44} /><Skeleton count={4} /></>) : !archive ? (
        <EmptyState icon="🗂️" title="档案未建立" hint="店铺档案是 数字员工生成内容前的必读三要素之一。" />
      ) : (
        <div className="space-y-3">
          {SECTIONS.map((sec) => {
            const present = sec.keys.filter((k) => archive[k] !== undefined);
            if (present.length === 0) return null;
            return (
              <div key={sec.title} className="rounded-lg border border-line bg-card p-3">
                <div className="mb-2 text-sm tracking-[.15em] text-gold">{sec.title}</div>
                <div className="space-y-2.5">
                  {present.map((k) => (
                    <div key={k}>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="break-words text-sm text-holo">{fieldText(k)}</span>
                        {k === "forbidden" ? <EcomTag tone="warn">硬约束 · 双重留痕</EcomTag> : null}
                        {k === "goals" ? <EcomTag tone="gold">经营目标关联来源</EcomTag> : null}
                        {k === "faq_kb" ? <EcomTag tone="go">服务知识关联来源</EcomTag> : null}
                      </div>
                      {renderValue(archive[k])}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <Note>档案即配置：毛利红线、审批矩阵与断货预警线均来自同一配置源——改档案即改系统行为边界，所有数字员工读取同一事实源。</Note>
        </div>
      )}
    </Bridge>
  );
}
