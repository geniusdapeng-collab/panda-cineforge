/**
 * 经营态页面共享 UI 套件（P10–P20 通用）：统计卡 / 列表行 / 标签 / 条形 / 事件类型
 * 视觉口径与 Bridge/tokens 一致（bg-card · border-line · text-ink2/3 · gold/go/warn/holo）
 */
import type { ReactNode } from "react";

/** 五元事件通用形态（页面侧宽松视图；字段以 payload 实际为准） */
export interface Ev {
  event_id: string;
  who?: { type: string; id: string };
  context: { time: string; channel?: string; night_shift?: boolean };
  object: { type: string; id?: string; label?: string };
  decision: {
    action: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    params?: Record<string, unknown>;
    basis?: string[];
  };
  rule_impact?: Array<{ rule_id: string; result: string }>;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PageHead({ title, tag, extra }: { title: string; tag: string; extra?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-h1 font-black tracking-wider">{title}</h2>
      <span className="text-[11px] tracking-[.2em] text-ink3">{tag}</span>
      <span className="flex-1" />
      {extra}
    </div>
  );
}

export function Stat({ label, value, tone = "text-gold", hint }: { label: string; value: ReactNode; tone?: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3">
      <div className="text-[11px] text-ink3">{label}</div>
      <div className={`mt-1 text-h1 font-black ${tone}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-ink3">{hint}</div> : null}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3">
      {title ? <div className="mb-2 text-[11px] tracking-[.15em] text-ink3">{title}</div> : null}
      {children}
    </div>
  );
}

export function Row({ time, children, right }: { time?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5">
      {time ? <span className="w-[76px] shrink-0 font-mono text-[11px] text-ink3">{time}</span> : null}
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink2">{children}</div>
      {right}
    </div>
  );
}

export function Tag({ tone, children }: { tone: "go" | "warn" | "holo" | "gold" | "ink"; children: ReactNode }) {
  const cls = { go: "border-go/40 text-go", warn: "border-warn/40 text-warn", holo: "border-holo/40 text-holo", gold: "border-gline text-gold", ink: "border-line text-ink3" }[tone];
  return <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10.5px] ${cls}`}>{children}</span>;
}

export function HBar({ label, pct, tone = "bg-holo", value }: { label: string; pct: number; tone?: string; value?: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] text-ink3">
        <span>{label}</span>
        <span className="font-mono">{value ?? `${pct}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-bg950">
        <div className={`h-full rounded ${tone}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">{children}</div>;
}

export const num = (v: unknown, d = 0) => (typeof v === "number" ? v : Number(v ?? d));
export const pctText = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");
