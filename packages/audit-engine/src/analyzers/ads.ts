/**
 * 广告健康线（fast-scan SKILL.md 步骤 4）
 * 四个子项：
 *  1) 盈亏平衡 ACoS = 1 − 货品成本率 − 佣金率 − 物流费率 − 退货损耗率；逐计划判定连续越线（≥3 天）
 *  2) 关键词花费 > 阈值且 0 转化（烧钱词）
 *  3) 日预算提前耗尽（14:00 前花完 ≥90%）
 *  4) 长期闲置（近 7 天消耗 < 预算的 10%）
 * 成本率口径：店铺在售 Listing 的 成本/售价 均值；缺成本主数据时按类目基准 0.5 估算并在发现中标注。
 */
import type { AuditSnapshot, Finding, ShopInfo } from "../types.js";
import { makeFinding, round2, round4, type AnalyzerContext } from "./util.js";

/** 连续越线天数阈值（SKILL.md：连续 ≥3 天） */
export const ACOS_CONSECUTIVE_DAYS = 3;
/** 日预算提前耗尽口径：14:00 前花完 ≥90%（SKILL.md） */
export const BUDGET_EXHAUST_HOUR = 14;
export const BUDGET_EXHAUST_RATIO = 0.9;
/** 长期闲置口径：近 7 天消耗 < 预算 10%（SKILL.md） */
export const IDLE_DAYS = 7;
export const IDLE_RATIO = 0.1;
/** 类目基准默认值（店铺档案缺失时使用，置信度降 baseline） */
export const DEFAULT_COST_RATE = 0.5;
export const DEFAULT_COMMISSION_RATE = 0.05;
export const DEFAULT_LOGISTICS_RATE = 0.08;
export const DEFAULT_RETURN_LOSS_RATE = 0.03;

/** 店铺级货品成本率：在售 Listing 的 cost/price 均值；无数据回退类目基准 */
function shopCostRate(snapshot: AuditSnapshot, shop: ShopInfo): { rate: number; source: "listing" | "baseline" } {
  const costBySku = new Map(snapshot.skuCosts.map((c) => [c.sku, c]));
  const rates: number[] = [];
  for (const l of snapshot.listings) {
    if (l.shopId !== shop.shopId || l.status !== "on-sale") continue;
    const c = costBySku.get(l.sku);
    if (c && c.currency === l.currency && l.price > 0) rates.push(c.cost / l.price);
  }
  if (rates.length === 0) return { rate: DEFAULT_COST_RATE, source: "baseline" };
  return { rate: rates.reduce((s, r) => s + r, 0) / rates.length, source: "listing" };
}

/** 盈亏平衡 ACoS（SKILL.md 公式原样） */
export function breakevenAcos(costRate: number, commissionRate: number, logisticsRate: number, returnLossRate: number): number {
  return round4(1 - costRate - commissionRate - logisticsRate - returnLossRate);
}

/** 最长连续越线窗口（每日 ACoS = spend/gmv，gmv≤0 视为越线） */
function longestBreachRun(daily: { date: string; spend: number; gmv: number }[], breakeven: number): { date: string; spend: number; gmv: number }[] {
  let best: { date: string; spend: number; gmv: number }[] = [];
  let cur: { date: string; spend: number; gmv: number }[] = [];
  for (const d of daily) {
    const acos = d.gmv > 0 ? d.spend / d.gmv : Number.POSITIVE_INFINITY;
    if (acos > breakeven && d.spend > 0) {
      cur.push(d);
      if (cur.length > best.length) best = cur;
    } else {
      cur = [];
    }
  }
  return best;
}

export function analyzeAds(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  const findings: Finding[] = [];
  const shopById = new Map(snapshot.shops.map((s) => [s.shopId, s]));

  /* ---------- 子项 1：逐计划 ACoS 连续越线 ---------- */
  for (const c of snapshot.adsCampaigns) {
    const shop = shopById.get(c.shopId);
    const cost = shop ? shopCostRate(snapshot, shop) : { rate: DEFAULT_COST_RATE, source: "baseline" as const };
    const commission = shop?.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const logistics = shop?.logisticsRate ?? DEFAULT_LOGISTICS_RATE;
    const returnLoss = shop?.returnLossRate ?? DEFAULT_RETURN_LOSS_RATE;
    const breakeven = breakevenAcos(cost.rate, commission, logistics, returnLoss);
    if (breakeven <= 0) continue; // 成本结构已不可能盈利，计划级判定无意义（价格线会兜住）
    const run = longestBreachRun(c.daily, breakeven);
    if (run.length >= ACOS_CONSECUTIVE_DAYS) {
      // 越线窗口实际超支 = Σ(spend − gmv × 盈亏线)，折算月度 = × 30/窗口天数
      const excess = round2(run.reduce((s, d) => s + (d.spend - d.gmv * breakeven), 0));
      const monthly = round2((excess / run.length) * 30);
      const worst = Math.max(...run.map((d) => (d.gmv > 0 ? d.spend / d.gmv : 99)));
      findings.push(
        makeFinding({
          line: "ads",
          severity: run.length >= 7 ? "P0" : "P1",
          shopId: c.shopId,
          title: `计划「${c.name}」ACoS 连续 ${run.length} 天越过盈亏平衡线`,
          description: `盈亏平衡 ACoS=${(breakeven * 100).toFixed(1)}%（成本率 ${(cost.rate * 100).toFixed(0)}%${
            cost.source === "baseline" ? "，按类目基准估算" : ""
          }/佣金 ${(commission * 100).toFixed(0)}%/物流 ${(logistics * 100).toFixed(0)}%/退货损耗 ${(returnLoss * 100).toFixed(0)}%），` +
            `${run[0]!.date} 起连续 ${run.length} 天越线，峰值 ${(worst * 100).toFixed(1)}%，窗口超支 ${excess} ${c.currency}。`,
          suggestion: "建议立即降预算 30% 并排查出价/人群；7 天无改善则暂停计划。",
          evidence: [{ kind: "campaign", id: c.campaignId, fields: { runDays: run.length, breakevenAcos: breakeven, worstAcos: round4(worst) } }],
          calculation: {
            formula: "盈亏平衡ACoS = 1 − 成本率 − 佣金率 − 物流费率 − 退货损耗率；日ACoS = spend/gmv；连续越线 ≥3 天",
            inputs: { campaignId: c.campaignId, costRate: round4(cost.rate), commissionRate: commission, logisticsRate: logistics, returnLossRate: returnLoss, breakeven, runStart: run[0]!.date, runDays: run.length },
            result: `连续 ${run.length} 天越线`,
          },
          estimatedImpact: {
            amount: monthly,
            currency: c.currency,
            period: "monthly",
            confidence: "baseline",
            basis: `越线窗口超支 ${excess} ÷ ${run.length} 天 × 30 天（月度折算）`,
          },
        }),
      );
    }
  }

  /* ---------- 子项 2：烧钱词（花费 > 阈值且 0 转化） ---------- */
  for (const k of snapshot.adKeywords) {
    if (k.spend > ctx.keywordSpendThreshold && k.conversions === 0) {
      findings.push(
        makeFinding({
          line: "ads",
          severity: k.spend > ctx.keywordSpendThreshold * 5 ? "P1" : "P2",
          shopId: k.shopId,
          title: `关键词「${k.keyword}」30 天花费 ${k.spend} 零转化（烧钱词）`,
          description: `近 30 天花费 ${k.spend} ${k.currency}，转化 0 单。`,
          suggestion: "建议暂停或降价至探测位；否定关键词同步到同店其他计划。",
          evidence: [{ kind: "keyword", id: `${k.campaignId}/${k.keyword}`, fields: { spend: k.spend, conversions: k.conversions } }],
          calculation: {
            formula: `spend > ${ctx.keywordSpendThreshold} 且 conversions = 0`,
            inputs: { keyword: k.keyword, spend: k.spend, conversions: k.conversions, threshold: ctx.keywordSpendThreshold },
            result: `${k.spend} > ${ctx.keywordSpendThreshold}, 0 转化`,
          },
          estimatedImpact: {
            amount: k.spend,
            currency: k.currency,
            period: "monthly",
            confidence: "exact",
            basis: "近 30 天实际花费（账单可勾稽）",
          },
        }),
      );
    }
  }

  /* ---------- 子项 3：日预算提前耗尽 / 子项 4：长期闲置 ---------- */
  for (const c of snapshot.adsCampaigns) {
    if (c.status !== "running") continue;
    if (
      c.budgetExhaustedAtHour !== undefined &&
      c.budgetExhaustedAtHour < BUDGET_EXHAUST_HOUR &&
      c.dailyBudget > 0 &&
      c.spendToday / c.dailyBudget >= BUDGET_EXHAUST_RATIO
    ) {
      findings.push(
        makeFinding({
          line: "ads",
          severity: "P2",
          shopId: c.shopId,
          title: `计划「${c.name}」预算节奏异常：${c.budgetExhaustedAtHour}:00 前耗尽 ${(round2((c.spendToday / c.dailyBudget) * 100))}%`,
          description: `日预算 ${c.dailyBudget} ${c.currency} 在 ${c.budgetExhaustedAtHour}:00 前已消耗 ${(round2((c.spendToday / c.dailyBudget) * 100))}%，晚高峰流量断供。`,
          suggestion: "建议提高日预算或开启分时折扣，把预算留到转化高峰时段。",
          evidence: [{ kind: "campaign", id: c.campaignId, fields: { dailyBudget: c.dailyBudget, spendToday: c.spendToday, exhaustedAtHour: c.budgetExhaustedAtHour } }],
          calculation: {
            formula: "耗尽时刻 <14:00 且 spendToday/dailyBudget ≥ 90%",
            inputs: { campaignId: c.campaignId, dailyBudget: c.dailyBudget, spendToday: c.spendToday, exhaustedAtHour: c.budgetExhaustedAtHour },
            result: `${round2((c.spendToday / c.dailyBudget) * 100)}% @ ${c.budgetExhaustedAtHour}:00`,
          },
        }),
      );
    }
    const recent7 = c.daily.slice(-IDLE_DAYS);
    if (recent7.length === IDLE_DAYS && c.dailyBudget > 0) {
      const spend7 = recent7.reduce((s, d) => s + d.spend, 0);
      if (spend7 < c.dailyBudget * IDLE_DAYS * IDLE_RATIO) {
        findings.push(
          makeFinding({
            line: "ads",
            severity: "P2",
            shopId: c.shopId,
            title: `计划「${c.name}」长期闲置：近 7 天仅消耗 ${round2(spend7)}（预算的 ${(round2((spend7 / (c.dailyBudget * IDLE_DAYS)) * 100))}%）`,
            description: `日预算 ${c.dailyBudget} ${c.currency}，近 7 天实际消耗不足 10%——出价过低或定向过窄，计划形同虚设。`,
            suggestion: "建议重启诊断：提价探测/放宽定向/更换素材；无改善则关停并释放预算。",
            evidence: [{ kind: "campaign", id: c.campaignId, fields: { dailyBudget: c.dailyBudget, spend7d: round2(spend7) } }],
            calculation: {
              formula: "近7天消耗 < 日预算 × 7 × 10%",
              inputs: { campaignId: c.campaignId, dailyBudget: c.dailyBudget, spend7d: round2(spend7), threshold: round2(c.dailyBudget * IDLE_DAYS * IDLE_RATIO) },
              result: `${round2(spend7)} < ${round2(c.dailyBudget * IDLE_DAYS * IDLE_RATIO)}`,
            },
          }),
        );
      }
    }
  }

  return findings;
}
