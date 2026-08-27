/**
 * PlanCompareCard 多方案对比卡（设计规范 P2-④；F3.7）
 * 结构：2–4 套候选并列（方案摘要 / 影响面 / 预估积分 / 命中围栏）
 * 铁律：采用动作写事件（F3.7）；越围栏方案强制双人确认（转 P4，不就地放行）
 */
export interface PlanOption {
  id: string;
  summary: string;
  impact: string;
  estCredits: number;
  fences: string[];
  /** 越围栏方案：采用须转 P4 双人确认（F3.7） */
  overFence?: boolean;
}

export function PlanCompareCard({
  plans,
  adoptedId,
  onAdopt,
}: {
  plans: PlanOption[];
  adoptedId?: string;
  onAdopt?: (p: PlanOption) => void;
}) {
  return (
    <div className="rounded-msg border border-line bg-card p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-h2 font-bold text-ink">方案对比</span>
        <span className="font-mono text-micro text-ink3">{plans.length} 套候选 · F3.7</span>
      </div>
      <div className={`grid gap-2.5`} style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, 1fr)` }}>
        {plans.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border p-3 ${
              adoptedId === p.id ? "border-gold/70 bg-gold/8" : p.overFence ? "border-warn/40" : "border-line bg-bg800/50"
            }`}
          >
            <div className="mb-1 text-body font-bold text-ink">{p.summary}</div>
            <div className="text-caption text-ink2">影响面：{p.impact}</div>
            <div className="mt-1 text-micro text-ink3">
              预估 <b className="font-orb text-gold">{p.estCredits}</b> 积分 · 命中{" "}
              {p.fences.map((f) => <span key={f} className="font-mono text-holo2">{f} </span>)}
            </div>
            {p.overFence && <div className="mt-1 text-micro text-warn">越围栏 · 采用须双人确认（转 P4）</div>}
            <div className="mt-2">
              {adoptedId === p.id ? (
                <span className="text-caption font-bold text-go">✓ 已采用（已写事件）</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdopt?.(p)}
                  className="cursor-pointer rounded-md border border-gline bg-gold/8 px-2.5 py-1 text-caption font-bold text-gold hover:bg-gold/15"
                >
                  采用 →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
