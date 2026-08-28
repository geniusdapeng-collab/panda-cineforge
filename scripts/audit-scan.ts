/**
 * audit-scan · 快速体检 CLI（pnpm audit:scan）
 * 流程：mock 连接器只读拉取 → 组装 AuditSnapshot → runFastScan →
 *       控制台输出《快速体检报告》摘要 → 写事件库（五元事件，actor=audit-engine，只读动作）。
 * 纪律：
 *  - 全程只读：只调连接器 L1 只读方法；唯一写入是系统事件库（gateway 通道，F1.2）；
 *  - 确定性：mock 连接器 + 确定性富化（FNV 哈希），同环境多次运行结果一致；
 *  - DB 不可用时降级为「仅控制台报告」（事件写失败不阻塞报告交付，打印告警）。
 */
import { createMockConnector, PLATFORM_PROFILES, type PlatformProfile } from "@workloom/connectors/mock";
import type { ShopRef } from "@workloom/connectors";
import { appendEvent } from "@workloom/base/workdata";
import { closeAllPools, getGatewayPool } from "@workloom/db";
import { runFastScan, type AuditSnapshot, type Finding } from "@workloom/audit-engine";

/** 演示 SKU 成本主数据（与 mock SKU_POOL 同源四款） */
const SKU_COSTS = [
  { sku: "PD-BAMBOO-FIBER-01", cost: 18 },
  { sku: "PD-THERMAL-CUP-02", cost: 40 },
  { sku: "PD-PANDA-PLUSH-03", cost: 55 },
  { sku: "PD-TEA-GIFT-04", cost: 66 },
] as const;

/** FNV-1a 稳定散列：确定性富化的唯一随机源（与 mock 连接器同纪律，禁止 Math.random） */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 报告锚定时间（与 mock 回执口径同日） */
const NOW = new Date("2026-08-27T10:30:00+08:00");
const PERIOD = "2026-08";

/** 单店快照组装：连接器只读拉取 + 确定性富化（库龄/动销/绩效/关键词/评价 mock 未覆盖字段） */
async function collectShop(profile: PlatformProfile, snapshot: AuditSnapshot): Promise<void> {
  const connector = createMockConnector(profile);
  const shop: ShopRef = { platformId: profile.platformId, ...profile.demoShop };
  const seed = hash(`${profile.platformId}:${shop.shopId}`);

  // 店铺档案 + 绩效指标（确定性富化：多数健康、少数越线，演示差异化）
  snapshot.shops.push({
    shopId: shop.shopId,
    platformId: profile.platformId,
    shopName: profile.demoShop.shopName ?? shop.shopId,
    currency: shop.currency,
    timezone: shop.timezone,
    commissionRate: 0.05,
    logisticsRate: 0.08,
    returnLossRate: 0.03,
    logisticsFeePerOrder: 8,
    odr: 0.004 + (seed % 9) / 1000, // 0.4%–1.2%
    lateShipmentRate: 0.02 + (seed % 5) / 100, // 2%–6%
    ipi: 380 + (seed % 180), // 380–559
  });

  // 订单（L1 只读）
  const orders = await connector.listOrders(shop, { pageSize: 50 });
  for (const o of orders.data.items) {
    snapshot.orders.push({
      shopId: shop.shopId,
      orderId: o.orderId,
      sku: SKU_COSTS[seed % SKU_COSTS.length]!.sku,
      amount: o.amount.amount,
      currency: o.amount.currency,
      qty: o.itemCount,
      status: o.status,
      createdAt: o.createdAt,
    });
  }

  // 商品（mock 无列表接口：按 mock-base 确定性编号 L-6601..6604 逐只拉取）
  for (let i = 0; i < SKU_COSTS.length; i += 1) {
    const r = await connector.getListing(shop, `${profile.code}-L-${6601 + i}`);
    const l = r.data;
    snapshot.listings.push({
      shopId: shop.shopId,
      listingId: l.listingId,
      sku: l.sku,
      title: l.title,
      price: l.price.amount,
      currency: l.price.currency,
      status: l.status,
    });
  }

  // 广告计划 + 逐日报表（mock 单日报表 → 确定性展开为近 30 天序列）
  const campaigns = await connector.listCampaigns(shop, { pageSize: 50 });
  for (const c of campaigns.data.items) {
    const rep = await connector.getAdReport(shop, { campaignId: c.campaignId, startDate: "2026-08-26", endDate: "2026-08-26" });
    const row = rep.data.items[0];
    const daily = Array.from({ length: 30 }, (_, d) => {
      const day = 28 - d; // 2026-07-29 ~ 2026-08-27
      const date = new Date(Date.UTC(2026, 6, 29 + d)).toISOString().slice(0, 10);
      const wobble = ((seed + d * 13) % 40) / 100; // ±20% 确定性波动
      const spend = Math.max(0, (row?.spend.amount ?? 100) * (0.8 + wobble));
      const gmv = Math.max(0, (row?.gmv.amount ?? 400) * (0.8 + wobble));
      void day;
      return { date, spend: Math.round(spend * 100) / 100, gmv: Math.round(gmv * 100) / 100 };
    });
    snapshot.adsCampaigns.push({
      shopId: shop.shopId,
      campaignId: c.campaignId,
      name: c.name,
      status: c.status,
      dailyBudget: c.dailyBudget.amount,
      currency: c.dailyBudget.currency,
      spendToday: c.spendToday.amount,
      ...(c.spendToday.amount / c.dailyBudget.amount >= 0.9 ? { budgetExhaustedAtHour: 11 + (seed % 6) } : {}),
      daily,
    });
    // 关键词（mock 未覆盖 → 确定性富化两条/计划）
    const words = [`熊猫${profile.code}大词`, `${c.name.slice(0, 6)}长尾词`];
    words.forEach((keyword, k) => {
      snapshot.adKeywords.push({
        shopId: shop.shopId,
        campaignId: c.campaignId,
        keyword,
        spend: Math.round((200 + ((seed + k * 97) % 1200)) * 100) / 100,
        conversions: (seed + k) % 4 === 0 ? 0 : 1 + ((seed + k) % 5),
        currency: c.dailyBudget.currency,
      });
    });
  }

  // 库存（L1 只读 + 库龄/动销确定性富化）
  const inv = await connector.getInventory(shop);
  for (const item of inv.data.items) {
    snapshot.inventory.push({
      sku: item.sku,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouseName,
      warehouseType: profile.region === "crossborder" ? "overseas" : "domestic",
      available: item.available,
      inTransit: item.inTransit,
      ageDays: 20 + ((seed + hash(item.sku)) % 100), // 20–119 天
      avgDailySales: 1 + ((seed + hash(item.sku)) % 8), // 1–8 件/天
      currency: shop.currency,
    });
  }

  // 评价（mock 未覆盖 → 由会话流确定性富化：每店 3 条，含未回复差评样例）
  const convs = await connector.listConversations(shop, { pageSize: 10 });
  convs.data.items.slice(0, 3).forEach((cv, i) => {
    const rating = (seed + i) % 3 === 0 ? 1 : 3 + ((seed + i) % 3);
    const createdHoursAgo = 12 + ((seed + i * 31) % 90); // 12–101h 前
    snapshot.reviews.push({
      shopId: shop.shopId,
      reviewId: `${cv.conversationId}-RV`,
      sku: SKU_COSTS[(seed + i) % SKU_COSTS.length]!.sku,
      rating,
      createdAt: new Date(NOW.getTime() - createdHoursAgo * 3_600_000).toISOString(),
      ...(rating <= 2 && createdHoursAgo > 48 ? {} : { repliedAt: new Date(NOW.getTime() - (createdHoursAgo - 2) * 3_600_000).toISOString() }),
      content: cv.lastMessage,
    });
  });

  // 账单：mock 明细行为随机演示值、与广告流水口径脱节——按协议口径自建勾稽基准账单
  // （订单行 → 佣金=5%、退款冲抵、广告扣款=后台月耗、物流=单数×8），并对部分店铺埋确定性偏差，
  // 使对账复核线的勾稽真实可算（演示数据含：佣金多提 0.8pp / 退款未冲抵 / 广告多扣 3% / 物流多收 6%）。
  const stmts = await connector.listStatements(shop, { pageSize: 5 });
  const latest = stmts.data.items[0];
  if (latest) {
    type Line = { lineId: string; type: "order" | "refund" | "commission" | "ad-deduction" | "logistics"; refId: string; amount: number; currency: string };
    const lines: Line[] = [];
    const cur = shop.currency;
    const commissionOver = seed % 7 === 0 ? 0.008 : 0; // 埋点：多提 0.8pp
    const skipRefund = seed % 4 === 0; // 埋点：退款未冲抵
    const adOvercharge = seed % 5 === 0 ? 1.03 : 1; // 埋点：广告多扣 3%
    const logisticsOvercharge = seed % 6 === 0 ? 1.06 : 1; // 埋点：物流多收 6%
    let orderCount = 0;
    let n = 0;
    const push = (type: Line["type"], refId: string, amount: number): void => {
      n += 1;
      lines.push({ lineId: `${latest.statementId}-LN-${n}`, type, refId, amount: Math.round(amount * 100) / 100, currency: cur });
    };
    for (const o of orders.data.items) {
      if (o.status === "pending-payment") continue;
      orderCount += 1;
      push("order", o.orderId, o.amount.amount);
      push("commission", o.orderId, o.amount.amount * (0.05 + commissionOver));
      if ((o.status === "refunding" || o.status === "closed") && !skipRefund) push("refund", o.orderId, -o.amount.amount);
    }
    const adMonth = snapshot.adsCampaigns
      .filter((c) => c.shopId === shop.shopId)
      .flatMap((c) => c.daily)
      .filter((d) => d.date.startsWith(PERIOD))
      .reduce((s, d) => s + d.spend, 0);
    if (adMonth > 0) push("ad-deduction", `${profile.code}-ADS-${PERIOD}`, adMonth * adOvercharge);
    if (orderCount > 0) push("logistics", `${profile.code}-LOG-${PERIOD}`, orderCount * 8 * logisticsOvercharge);
    snapshot.statements.push({ shopId: shop.shopId, statementId: latest.statementId, period: PERIOD, lines });
  }
}

/** 控制台报告摘要 */
function printReport(snapshot: AuditSnapshot, report: ReturnType<typeof runFastScan>, eventId?: string): void {
  const line = "─".repeat(64);
  console.log(line);
  console.log(`《快速体检报告》 ${report.reportId} · 生成于 ${report.generatedAt}`);
  console.log(`快照 ${snapshot.snapshotId} · 店铺 ${report.overview.shopCount} 家 · 数据源覆盖：${
    Object.entries(report.coverage).map(([k, v]) => `${k}=${v === "covered" ? "✓" : v === "partial" ? "△" : "✗"}`).join(" ")
  }`);
  if (report.coverageNotes.length > 0) console.log(`降级说明：${report.coverageNotes.join("；")}`);
  console.log(line);
  const { counts, findingCount, totalRecoverableByCurrency } = report.overview;
  console.log(`发现 ${findingCount} 条（P0=${counts.P0} / P1=${counts.P1} / P2=${counts.P2}）`);
  const totals = Object.entries(totalRecoverableByCurrency).map(([c, a]) => `${a.toLocaleString()} ${c}`).join(" + ");
  console.log(`估算挽回空间：${totals || "—"}（分币种口径，详见各发现 confidence/basis 标注）`);
  console.log(line);
  console.log("Top 行动清单（按挽回金额降序，最多 10 条）：");
  report.top10.forEach((f: Finding, i: number) => {
    const impact = f.estimatedImpact ? `${f.estimatedImpact.amount.toLocaleString()} ${f.estimatedImpact.currency}/${f.estimatedImpact.period} [${f.estimatedImpact.confidence}]` : "—";
    // 仓库维度发现（shopId=warehouseId）显示其报告归集店，避免读者误解
    const owner = report.shops.find((s) => s.findings.some((x) => x.id === f.id));
    const where = owner && owner.shopId !== f.shopId ? `仓=${f.shopId}（归集:${owner.shopName}）` : `店=${owner?.shopName ?? f.shopId}`;
    console.log(` ${String(i + 1).padStart(2)}. [${f.severity}] ${f.title}`);
    console.log(`     ${where} · 挽回≈${impact}`);
    console.log(`     建议：${f.suggestion}`);
  });
  console.log(line);
  console.log(`耗时 ${report.elapsedMs}ms（软预算 ${report.timeBudgetMinutes} 分钟）· 全程只读`);
  if (eventId) console.log(`报告事件已入库：${eventId}（actor=audit-engine，action=audit.fast-scan.report）`);
}

async function main(): Promise<void> {
  const snapshot: AuditSnapshot = {
    snapshotId: `SNAP-${NOW.toISOString().slice(0, 10)}`,
    generatedAt: NOW.toISOString(),
    shops: [],
    skuCosts: SKU_COSTS.map((c) => ({ ...c, currency: "CNY" })),
    listings: [],
    orders: [],
    adsCampaigns: [],
    adKeywords: [],
    inventory: [],
    reviews: [],
    statements: [],
    forbiddenWords: [],
  };

  console.log(`[audit-scan] 开始只读拉取 ${PLATFORM_PROFILES.length} 个平台店铺快照…`);
  for (const profile of PLATFORM_PROFILES) {
    await collectShop(profile, snapshot);
  }
  console.log(`[audit-scan] 快照就绪：shops=${snapshot.shops.length} listings=${snapshot.listings.length} orders=${snapshot.orders.length} campaigns=${snapshot.adsCampaigns.length} inventory=${snapshot.inventory.length} reviews=${snapshot.reviews.length} statements=${snapshot.statements.length}`);

  const report = runFastScan(snapshot, { now: NOW, timeBudgetMinutes: 30 });

  // 写事件库（五元事件；DB 不可达时降级为仅控制台报告，不阻塞交付）
  let eventId: string | undefined;
  try {
    const gateway = getGatewayPool();
    const r = await appendEvent(
      gateway,
      { tenantId: "tenant-demo", workspaceId: "ws-panda" },
      {
        event: {
          who: { type: "agent", id: "audit-engine", version: "0.1.0" },
          context: { tenant_id: "tenant-demo", workspace_id: "ws-panda", time: NOW.toISOString(), channel: "cli", stage: "audit" },
          object: { type: "audit-report", id: report.reportId },
          decision: {
            action: "audit.fast-scan.report",
            after: {
              findingCount: report.overview.findingCount,
              counts: report.overview.counts,
              totalRecoverableByCurrency: report.overview.totalRecoverableByCurrency,
              coverage: report.coverage,
              top10: report.top10.map((f) => ({ id: f.id, line: f.line, severity: f.severity, title: f.title, impact: f.estimatedImpact })),
            },
            basis: ["fast-scan 五线扫描（bundles/ecommerce/skills/fast-scan）", "全程只读：未调用任何平台写接口"],
          },
          rule_impact: [{ rule_id: "audit-only-readonly", version: "v1", result: "pass" }],
        },
      },
    );
    eventId = r.eventId;
    await closeAllPools();
  } catch (err) {
    console.warn(`[audit-scan] 事件库写入失败（降级为仅控制台报告）：${err instanceof Error ? err.message : String(err)}`);
  }

  printReport(snapshot, report, eventId);
}

await main();
