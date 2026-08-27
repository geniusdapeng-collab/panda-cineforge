/**
 * 版本切换演示（F12 权限态：社区版/Pro/Teams/VPC 实切实测 F7.2 能力矩阵）
 * 顶栏胶囊显当前版本；点击展开四版本菜单；切换=auth.setPlan（owner 专属，留痕 plan.switch）
 * → 重签 JWT → 整页重载，各页权限态即时生效（隐藏非置灰 E2.6；越版调用 403+升级提示 H-10）
 */
import { useEffect, useRef, useState } from "react";
import { ensureDemoLogin, setToken, trpc } from "../lib/trpc";

const PLAN_LABEL: Record<string, string> = {
  community: "社区版", pro: "Pro", teams: "Teams", vpc: "VPC",
};
const PLAN_ORDER = ["community", "pro", "teams", "vpc"] as const;

export function PlanSwitcher({ onPlan }: { onPlan?: (plan: string) => void }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      await ensureDemoLogin();
      const me = await trpc.members.me.query() as { identity: { plan: string } };
      setPlan(me.identity.plan);
      onPlan?.(me.identity.plan);
    })();
  }, [onPlan]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const switchPlan = async (p: string) => {
    if (p === plan) { setOpen(false); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await trpc.auth.setPlan.mutate({ plan: p as "community" | "pro" | "teams" | "vpc" });
      setToken(r.token); // 重签 JWT 后整页重载：权限态全端一致（F5.6）
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  if (!plan) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="版本能力矩阵演示（F7.2）：点击切换版本，权限态即时生效"
        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
          plan === "community"
            ? "border-line text-ink3 hover:border-gline"
            : "border-gold/50 bg-gold/8 text-goldhi hover:border-gold"
        }`}
      >
        {PLAN_LABEL[plan] ?? plan} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-line bg-bg950/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.6)] backdrop-blur-md">
          <div className="px-2 pb-1 pt-1 text-[10px] tracking-[.15em] text-ink3">版本切换演示 · F7.2</div>
          {PLAN_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => void switchPlan(p)}
              className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-card ${
                p === plan ? "font-bold text-goldhi" : "text-ink2"
              }`}
            >
              <span>{PLAN_LABEL[p]}</span>
              <span className="text-[10px] text-ink3">
                {p === "community" ? "无夜班/巡检/Quest" : p === "pro" ? "完整夜班+巡检" : p === "teams" ? "+集团共享记忆" : "+内网 seam"}
              </span>
            </button>
          ))}
          {err && <div className="px-2 py-1 text-[10px] text-alert">✗ {err}</div>}
        </div>
      )}
    </div>
  );
}
