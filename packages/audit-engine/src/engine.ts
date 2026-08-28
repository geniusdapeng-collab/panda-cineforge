/**
 * 引擎编排：runFastScan
 * 纪律（fast-scan SKILL.md 四）：
 *  - 时间纪律：软预算默认 30 分钟，逐线检查耗时，超时后剩余线标注 not-covered 出部分报告；
 *  - 降级纪律：某数据源缺失 → 该线标注 not-covered / partial，不阻塞整体；
 *  - 估算透明：所有 Finding 金额必须带 confidence 与计算口径（分析器层已强制）。
 * 输出：一店一份 + 集团总览 + 按挽回金额降序 Top10。
 */
import { analyzeAds } from "./analyzers/ads.js";
import { analyzeCompliance } from "./analyzers/compliance.js";
import { analyzeInventory } from "./analyzers/inventory.js";
import { analyzePrice } from "./analyzers/price.js";
import { analyzeRecon } from "./analyzers/recon.js";
import { analyzeReputation } from "./analyzers/reputation.js";
import type { AnalyzerContext } from "./analyzers/util.js";
import type {
  AuditLine,
  AuditReport,
  AuditSnapshot,
  FastScanOptions,
  Finding,
  LineCoverage,
  Severity,
  ShopReport,
} from "./types.js";

/** 线的执行顺序（对齐 SKILL.md 步骤 2→6；对账线依赖广告后台数据故放最后） */
const LINE_ORDER: readonly AuditLine[] = ["price", "inventory", "ads", "reputation", "compliance", "recon"];

const ANALYZERS: Record<AuditLine, (s: AuditSnapshot, ctx: AnalyzerContext) => Finding[]> = {
  price: analyzePrice,
  inventory: analyzeInventory,
  ads: analyzeAds,
  reputation: analyzeReputation,
  compliance: analyzeCompliance,
  recon: analyzeRecon,
};

/**
 * 数据源覆盖度预判：某线所需数据集全空 → not-covered；关键子集缺失 → partial。
 * 返回 null 表示 fully covered。
 */
function precheckLine(line: AuditLine, s: AuditSnapshot): { coverage: LineCoverage; note?: string } {
  switch (line) {
    case "price": {
      if (s.listings.length === 0) return { coverage: "not-covered", note: "商品源缺失，价格健康线未覆盖" };
      if (s.skuCosts.length === 0) return { coverage: "partial", note: "SKU 成本主数据缺失，毛利红线子项降级" };
      if (s.orders.length === 0) return { coverage: "partial", note: "订单源缺失，价保子项降级" };
      return { coverage: "covered" };
    }
    case "inventory": {
      if (s.inventory.length === 0) return { coverage: "not-covered", note: "库存源缺失，库存健康线未覆盖" };
      if (s.skuCosts.length === 0) return { coverage: "partial", note: "SKU 成本主数据缺失，占用资金子项降级" };
      if (s.inventory.every((i) => i.ageDays === undefined)) return { coverage: "partial", note: "库龄字段未采集，海外仓库龄子项降级" };
      return { coverage: "covered" };
    }
    case "ads": {
      if (s.adsCampaigns.length === 0 && s.adKeywords.length === 0) return { coverage: "not-covered", note: "广告源缺失，广告健康线未覆盖" };
      if (s.adsCampaigns.length === 0) return { coverage: "partial", note: "计划级报表缺失，ACoS 子项降级" };
      if (s.adsCampaigns.every((c) => c.daily.length === 0)) return { coverage: "partial", note: "广告逐日报表缺失，ACoS 连续越线子项降级" };
      return { coverage: "covered" };
    }
    case "reputation": {
      if (s.reviews.length === 0) return { coverage: "not-covered", note: "评价源缺失，口碑健康线未覆盖" };
      return { coverage: "covered" };
    }
    case "compliance": {
      if (s.listings.length === 0 && s.shops.every((x) => x.odr === undefined && x.lateShipmentRate === undefined && x.ipi === undefined))
        return { coverage: "not-covered", note: "商品源与绩效指标均缺失，合规健康线未覆盖" };
      if (s.listings.length === 0) return { coverage: "partial", note: "商品源缺失，违禁词扫描子项降级" };
      return { coverage: "covered" };
    }
    case "recon": {
      if (s.statements.length === 0) return { coverage: "not-covered", note: "账单源缺失，对账复核线未覆盖" };
      if (s.shops.every((x) => x.commissionRate === undefined)) return { coverage: "partial", note: "店铺佣金协议比例缺失，佣金勾稽子项降级" };
      return { coverage: "covered" };
    }
  }
}

/** 严重度计数器 */
function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const c: Record<Severity, number> = { P0: 0, P1: 0, P2: 0 };
  for (const f of findings) c[f.severity] += 1;
  return c;
}

/**
 * 归属店铺口径：库存线发现以 warehouseId 暂挂——演示数据一仓服务特定店群，
 * 报告层把仓库挂到快照首店（单仓多店时集团口径不受影响，仅店级归集近似）。
 */
function resolveShopId(f: Finding, snapshot: AuditSnapshot): string {
  if (snapshot.shops.some((s) => s.shopId === f.shopId)) return f.shopId;
  // 仓库维度发现：归到快照首店（无店铺时保持原样，进"未归属"桶）
  return snapshot.shops[0]?.shopId ?? f.shopId;
}

/**
 * 快速体检主入口：快照 → 五线 + 对账 → 报告。
 * 纯函数（除耗时计量）：同一快照 + 同一 now 必得同一报告正文。
 */
export function runFastScan(snapshot: AuditSnapshot, opts: FastScanOptions = {}): AuditReport {
  const startedAt = Date.now();
  const budgetMs = (opts.timeBudgetMinutes ?? 30) * 60_000;
  const ctx: AnalyzerContext = {
    now: opts.now ?? new Date(snapshot.generatedAt),
    keywordSpendThreshold: opts.keywordSpendThreshold ?? 500,
  };

  const coverage = {} as Record<AuditLine, LineCoverage>;
  const coverageNotes: string[] = [];
  const allFindings: Finding[] = [];

  for (const line of LINE_ORDER) {
    // 时间纪律：逐线检查软预算，超时后剩余线 not-covered（部分报告仍是有效交付）
    if (Date.now() - startedAt > budgetMs) {
      coverage[line] = "not-covered";
      coverageNotes.push(`时间预算耗尽（${opts.timeBudgetMinutes ?? 30} 分钟），${line} 线未执行`);
      continue;
    }
    const pre = precheckLine(line, snapshot);
    coverage[line] = pre.coverage;
    if (pre.note) coverageNotes.push(pre.note);
    if (pre.coverage === "not-covered") continue;
    const findings = ANALYZERS[line](snapshot, ctx);
    // 统一编号：FND-<LINE>-<全局序号>（报告可回溯）
    for (const f of findings) {
      f.id = `FND-${line.toUpperCase()}-${String(allFindings.length + 1).padStart(3, "0")}`;
      allFindings.push(f);
    }
  }

  /* ---------- 一店一份 ---------- */
  const byShop = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const shopId = resolveShopId(f, snapshot);
    const arr = byShop.get(shopId) ?? [];
    arr.push(f);
    byShop.set(shopId, arr);
  }
  const severityRank: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };
  const shops: ShopReport[] = snapshot.shops.map((s) => {
    const findings = (byShop.get(s.shopId) ?? []).sort(
      (a, b) => severityRank[a.severity] - severityRank[b.severity] || (b.estimatedImpact?.amount ?? 0) - (a.estimatedImpact?.amount ?? 0),
    );
    return {
      shopId: s.shopId,
      shopName: s.shopName,
      platformId: s.platformId,
      currency: s.currency,
      findings,
      counts: countBySeverity(findings),
      // 同店同币种，直接求和；无金额的发现不计入
      totalRecoverable: Math.round(findings.reduce((sum, f) => sum + (f.estimatedImpact?.amount ?? 0), 0) * 100) / 100,
    };
  });
  // 有发现但店铺不在快照 shops 里的兜底桶（防御性；正常快照不会触发）
  for (const [shopId, findings] of byShop) {
    if (shops.some((s) => s.shopId === shopId)) continue;
    shops.push({
      shopId,
      shopName: shopId,
      platformId: "unknown",
      currency: findings[0]?.estimatedImpact?.currency ?? "CNY",
      findings,
      counts: countBySeverity(findings),
      totalRecoverable: Math.round(findings.reduce((sum, f) => sum + (f.estimatedImpact?.amount ?? 0), 0) * 100) / 100,
    });
  }

  /* ---------- 集团总览 + Top10 ---------- */
  const totalByCurrency: Record<string, number> = {};
  for (const f of allFindings) {
    if (!f.estimatedImpact) continue;
    const cur = f.estimatedImpact.currency;
    totalByCurrency[cur] = Math.round(((totalByCurrency[cur] ?? 0) + f.estimatedImpact.amount) * 100) / 100;
  }
  const top10 = [...allFindings]
    .filter((f) => f.estimatedImpact)
    .sort((a, b) => (b.estimatedImpact?.amount ?? 0) - (a.estimatedImpact?.amount ?? 0))
    .slice(0, 10);

  return {
    reportId: `RPT-${snapshot.snapshotId}`,
    generatedAt: ctx.now.toISOString(),
    snapshotId: snapshot.snapshotId,
    coverage,
    coverageNotes,
    shops,
    overview: {
      shopCount: snapshot.shops.length,
      findingCount: allFindings.length,
      counts: countBySeverity(allFindings),
      totalRecoverableByCurrency: totalByCurrency,
    },
    top10,
    elapsedMs: Date.now() - startedAt,
    timeBudgetMinutes: opts.timeBudgetMinutes ?? 30,
  };
}
