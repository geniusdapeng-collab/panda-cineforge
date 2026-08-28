/**
 * 口碑健康线（fast-scan SKILL.md 步骤 5 前半）
 * 三个子项：
 *  1) 差评（≤2 星）>48h 未回复（>72h 升级 P0——SLA 已严重违约）
 *  2) SKU 评分 <4.0 且评论 ≥20 条（样本量足够才有统计意义）
 *  3) 差评聚集 SKU：7 天内差评 ≥3 条（危机聚集，需当天处置）
 */
import type { AuditSnapshot, Finding } from "../types.js";
import { hoursSince, makeFinding, round2, windowStart, type AnalyzerContext } from "./util.js";

/** 差评星级口径（≤2 星） */
export const BAD_RATING_MAX = 2;
/** 未回复时长红线（SKILL.md：>48h） */
export const UNREPLIED_HOURS = 48;
/** 升级 P0 的时长（72h，SLA 严重违约） */
export const UNREPLIED_HOURS_P0 = 72;
/** 低评分 SKU 口径：评分 <4.0 且评论 ≥20（SKILL.md） */
export const LOW_RATING = 4.0;
export const LOW_RATING_MIN_REVIEWS = 20;
/** 差评聚集口径：7 天内 ≥3 条（SKILL.md） */
export const CLUSTER_DAYS = 7;
export const CLUSTER_MIN_BAD = 3;

export function analyzeReputation(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  const findings: Finding[] = [];
  const shopById = new Map(snapshot.shops.map((s) => [s.shopId, s]));

  /* ---------- 子项 1：差评 >48h 未回复 ---------- */
  for (const r of snapshot.reviews) {
    if (r.rating > BAD_RATING_MAX || r.repliedAt !== undefined) continue;
    const hours = hoursSince(ctx.now, r.createdAt);
    if (hours > UNREPLIED_HOURS) {
      findings.push(
        makeFinding({
          line: "reputation",
          severity: hours > UNREPLIED_HOURS_P0 ? "P0" : "P1",
          shopId: r.shopId,
          title: `${r.rating} 星差评 ${Math.floor(hours)}h 未回复（${shopById.get(r.shopId)?.shopName ?? r.shopId}）`,
          description: `差评发布于 ${r.createdAt}，已超 48h 响应红线${hours > UNREPLIED_HOURS_P0 ? "且超 72h，舆情发酵风险高" : ""}。`,
          suggestion: "立即按 SOP 回复（致歉→核实→措施→承诺），不承诺档案外补偿。",
          evidence: [{ kind: "review", id: r.reviewId, fields: { rating: r.rating, hoursUnreplied: Math.floor(hours), ...(r.sku ? { sku: r.sku } : {}) } }],
          calculation: {
            formula: "rating ≤ 2 且 未回复 且 now − createdAt > 48h",
            inputs: { reviewId: r.reviewId, rating: r.rating, hoursUnreplied: round2(hours) },
            result: `${Math.floor(hours)}h > 48h`,
          },
        }),
      );
    }
  }

  /* ---------- 子项 2：SKU 评分 <4.0 且评论 ≥20 ---------- */
  const bySkuShop = new Map<string, { shopId: string; sku: string; ratings: number[] }>();
  for (const r of snapshot.reviews) {
    if (!r.sku) continue;
    const key = `${r.shopId}::${r.sku}`;
    const entry = bySkuShop.get(key) ?? { shopId: r.shopId, sku: r.sku, ratings: [] };
    entry.ratings.push(r.rating);
    bySkuShop.set(key, entry);
  }
  for (const { shopId, sku, ratings } of bySkuShop.values()) {
    if (ratings.length < LOW_RATING_MIN_REVIEWS) continue;
    const avg = ratings.reduce((s, x) => s + x, 0) / ratings.length;
    if (avg < LOW_RATING) {
      findings.push(
        makeFinding({
          line: "reputation",
          severity: avg < 3.5 ? "P0" : "P1",
          shopId,
          title: `SKU ${sku} 评分 ${round2(avg)}（${ratings.length} 条评论）低于 4.0`,
          description: `样本量 ${ratings.length} 条已达统计意义，均分 ${round2(avg)} 拉低转化并拖累店铺权重。`,
          suggestion: "排查差评集中原因（质量/物流/描述不符）；评估翻新款或下架整改。",
          evidence: [{ kind: "review-sku", id: `${shopId}/${sku}`, fields: { avgRating: round2(avg), reviewCount: ratings.length } }],
          calculation: {
            formula: "avg(rating) < 4.0 且 评论数 ≥ 20",
            inputs: { sku, avgRating: round2(avg), reviewCount: ratings.length },
            result: `${round2(avg)} < 4.0`,
          },
        }),
      );
    }
  }

  /* ---------- 子项 3：差评聚集 SKU（7 天内差评 ≥3） ---------- */
  const cluster = new Map<string, { shopId: string; sku: string; bad: { id: string; rating: number }[] }>();
  for (const r of snapshot.reviews) {
    if (!r.sku || r.rating > BAD_RATING_MAX) continue;
    if (Date.parse(r.createdAt) < windowStart(ctx.now, CLUSTER_DAYS)) continue;
    const key = `${r.shopId}::${r.sku}`;
    const entry = cluster.get(key) ?? { shopId: r.shopId, sku: r.sku, bad: [] };
    entry.bad.push({ id: r.reviewId, rating: r.rating });
    cluster.set(key, entry);
  }
  for (const { shopId, sku, bad } of cluster.values()) {
    if (bad.length >= CLUSTER_MIN_BAD) {
      findings.push(
        makeFinding({
          line: "reputation",
          severity: "P0",
          shopId,
          title: `SKU ${sku} 差评聚集：7 天内 ${bad.length} 条差评（危机信号）`,
          description: `${CLUSTER_DAYS} 天窗口内差评 ${bad.length} 条 ≥ ${CLUSTER_MIN_BAD} 条，疑似批次质量/物流事故，正在滚雪球。`,
          suggestion: "当天处置：下架或限量 → 排查批次 → 主动售后召回；直播/投放同步降量。",
          evidence: bad.map((b) => ({ kind: "review", id: b.id, fields: { rating: b.rating, sku } })),
          calculation: {
            formula: "7 天内 rating ≤ 2 的评论数 ≥ 3",
            inputs: { sku, badCount7d: bad.length, windowDays: CLUSTER_DAYS },
            result: `${bad.length} ≥ ${CLUSTER_MIN_BAD}`,
          },
        }),
      );
    }
  }

  return findings;
}
