/**
 * @workloom/audit-engine · 核心类型
 * 质检模式（audit_only）「快速体检」的确定性检测引擎数据模型。
 * 方法论事实源：bundles/ecommerce/skills/fast-scan/SKILL.md（五线扫描）。
 *
 * 数据流：连接器只读快照 → AuditSnapshot（归一化数据集）→ 六个分析器 → Finding[] → AuditReport。
 * 全程只读：引擎不触碰任何平台写接口，只读快照进、发现/报告出。
 */

// ---------- 枚举 ----------

/** 五线 + 对账复核线（对账在 SKILL.md 中与口碑合轨叙述，工程上独立成线） */
export type AuditLine = "price" | "inventory" | "ads" | "reputation" | "compliance" | "recon";

/** 严重度：P0=立即止损/合规红线，P1=显著渗漏需本周处理，P2=优化项 */
export type Severity = "P0" | "P1" | "P2";

/** 估算置信度：exact=可逐笔勾稽的精确值；baseline=按店铺/类目基准估算；estimate=经验估计 */
export type Confidence = "exact" | "baseline" | "estimate";

/** 金额口径周期 */
export type ImpactPeriod = "one-off" | "monthly" | "yearly";

// ---------- 快照数据集（输入） ----------

/** 店铺档案 + 绩效指标（红线判定输入；缺省字段表示该指标未采集） */
export interface ShopInfo {
  shopId: string;
  platformId: string;
  shopName: string;
  /** ISO 4217 币种 */
  currency: string;
  timezone: string;
  /** 平台佣金应提比例（对账勾稽基准；缺失时该店佣金线降级） */
  commissionRate?: number;
  /** 物流费率（盈亏平衡 ACoS 参数之一） */
  logisticsRate?: number;
  /** 退货损耗率（盈亏平衡 ACoS 参数之一） */
  returnLossRate?: number;
  /** 单均物流费（物流多收勾稽基准；与店铺同币种） */
  logisticsFeePerOrder?: number;
  /** 绩效指标：ODR 订单缺陷率（红线 1%） */
  odr?: number;
  /** 迟发率（红线 4%） */
  lateShipmentRate?: number;
  /** 库存绩效指数 IPI（红线 400，低于越限） */
  ipi?: number;
}

/** SKU 成本主数据（毛利/周转/积压测算的分母） */
export interface SkuCost {
  sku: string;
  /** 货品成本（单件，币种以成本归属店铺为准；跨币种快照由上游先折算） */
  cost: number;
  currency: string;
}

/** 在售/已下架商品（价格健康线与合规线输入） */
export interface ListingRecord {
  shopId: string;
  listingId: string;
  sku: string;
  title: string;
  /** 详情正文（违禁词扫描面；未采集可省略） */
  detail?: string;
  price: number;
  currency: string;
  status: "on-sale" | "off-shelf" | "draft";
}

/** 订单（价保/勾稽输入；unitPrice 用于近 30 天最低成交价测算） */
export interface OrderRecord {
  shopId: string;
  orderId: string;
  sku?: string;
  /** 成交总额（含 qty） */
  amount: number;
  currency: string;
  /** 件数 */
  qty: number;
  status: "paid" | "shipped" | "completed" | "pending-payment" | "refunding" | "closed";
  createdAt: string; // ISO 8601
}

/** 广告计划（含逐日花费/GMV，用于连续越线判定与预算节奏） */
export interface CampaignRecord {
  shopId: string;
  campaignId: string;
  name: string;
  status: "running" | "paused" | "ended";
  dailyBudget: number;
  currency: string;
  /** 当日已花（预算节奏判定） */
  spendToday: number;
  /** 当日预算耗尽时刻（0-23 小时；未耗尽省略） */
  budgetExhaustedAtHour?: number;
  /** 近 30 天逐日报表 */
  daily: AdDayRow[];
}

export interface AdDayRow {
  date: string; // YYYY-MM-DD
  spend: number;
  gmv: number;
}

/** 关键词近 30 天汇总（烧钱词判定输入） */
export interface KeywordRecord {
  shopId: string;
  campaignId: string;
  keyword: string;
  spend: number;
  conversions: number;
  currency: string;
}

/** 库存记录（含库龄与动销参数） */
export interface InventoryRecord {
  sku: string;
  warehouseId: string;
  warehouseName: string;
  /** 仓型：海外仓库龄线只扫 overseas */
  warehouseType: "domestic" | "overseas";
  available: number;
  inTransit: number;
  /** 库龄（天）；未采集省略则库龄子项跳过 */
  ageDays?: number;
  /** 近 30 天日均销量（件/天；周转与可售天数测算的分母） */
  avgDailySales: number;
  currency: string;
}

/** 评价记录（口碑线输入） */
export interface ReviewRecord {
  shopId: string;
  reviewId: string;
  sku?: string;
  /** 1-5 星 */
  rating: number;
  createdAt: string; // ISO 8601
  /** 回复时间；未回复省略 */
  repliedAt?: string;
  content?: string;
}

/** 平台账单行（对账复核输入；type 对齐 connectors 的 StatementLineType） */
export interface StatementLineRecord {
  lineId: string;
  type: "order" | "refund" | "commission" | "ad-deduction" | "logistics";
  /** 关联单据号（订单号/退款单号） */
  refId: string;
  amount: number;
  currency: string;
}

export interface StatementRecord {
  shopId: string;
  statementId: string;
  /** 账期 YYYY-MM */
  period: string;
  lines: StatementLineRecord[];
}

/**
 * 快照数据集：一次体检的全部输入。
 * 各字段可为空数组——对应数据源缺失时该线标注「未覆盖」，引擎降级出部分报告（SKILL.md 四）。
 */
export interface AuditSnapshot {
  snapshotId: string;
  /** 快照生成时间（差评 48h、近 30 天窗口等均以 now 为锚） */
  generatedAt: string; // ISO 8601
  shops: ShopInfo[];
  skuCosts: SkuCost[];
  listings: ListingRecord[];
  orders: OrderRecord[];
  adsCampaigns: CampaignRecord[];
  adKeywords: KeywordRecord[];
  inventory: InventoryRecord[];
  reviews: ReviewRecord[];
  statements: StatementRecord[];
  /** 店铺自带违禁词（与内置词库并集扫描） */
  forbiddenWords: string[];
}

// ---------- 发现（输出） ----------

/** 证据记录引用：指向快照中的具体单据 */
export interface EvidenceRef {
  /** 证据类别：listing/order/campaign/keyword/inventory/review/statement/shop */
  kind: string;
  id: string;
  /** 关键字段快照（审计留痕，原样透传） */
  fields?: Record<string, string | number>;
}

/** 计算过程快照：公式 + 输入 + 结果，报告可复算（SKILL.md 回执=计算过程快照） */
export interface CalculationSnapshot {
  formula: string;
  inputs: Record<string, number | string>;
  result: number | string;
}

/** 估算挽回金额（禁止把估算说成确定值——confidence 必填） */
export interface EstimatedImpact {
  amount: number;
  currency: string;
  period: ImpactPeriod;
  confidence: Confidence;
  /** 计算口径说明（如"按近30天日均销量×价差"） */
  basis: string;
}

export interface Finding {
  /** 引擎内唯一编号：FND-<线>-<序号> */
  id: string;
  line: AuditLine;
  severity: Severity;
  shopId: string;
  title: string;
  /** 问题描述 + 建议动作 */
  description: string;
  suggestion: string;
  evidence: EvidenceRef[];
  calculation: CalculationSnapshot;
  estimatedImpact?: EstimatedImpact;
}

// ---------- 报告（输出） ----------

/** 单条线的覆盖度：covered=已扫描；partial=部分子项因数据缺失降级；not-covered=数据源缺失/超时未扫 */
export type LineCoverage = "covered" | "partial" | "not-covered";

/** 一店一份 */
export interface ShopReport {
  shopId: string;
  shopName: string;
  platformId: string;
  currency: string;
  findings: Finding[];
  /** 按严重度计数 */
  counts: Record<Severity, number>;
  /** 该店估算挽回合计（同币种相加；跨置信度并列展示，不混合口径到分） */
  totalRecoverable: number;
}

/** 集团总览 */
export interface GroupOverview {
  shopCount: number;
  findingCount: number;
  counts: Record<Severity, number>;
  /** 按币种分桶的估算挽回合计（跨币种不强行折算，报告层再按汇率口径处理） */
  totalRecoverableByCurrency: Record<string, number>;
}

export interface AuditReport {
  reportId: string;
  generatedAt: string;
  /** 快照引用（审计留痕） */
  snapshotId: string;
  /** 各线覆盖度（未覆盖的线在此标注，报告仍为有效部分报告） */
  coverage: Record<AuditLine, LineCoverage>;
  /** 覆盖度备注（如"订单源缺失，价保子项降级"） */
  coverageNotes: string[];
  shops: ShopReport[];
  overview: GroupOverview;
  /** 按挽回金额降序的 Top10 行动清单（集团视角） */
  top10: Finding[];
  /** 实际耗时（毫秒）与软预算（分钟），时间纪律留痕 */
  elapsedMs: number;
  timeBudgetMinutes: number;
}

/** runFastScan 选项 */
export interface FastScanOptions {
  /** 软时间预算（分钟），默认 30；超时后剩余线标注 not-covered 出部分报告 */
  timeBudgetMinutes?: number;
  /** 报告锚定时间（默认取 snapshot.generatedAt；测试可注入固定钟） */
  now?: Date;
  /** 烧钱词花费阈值（与关键词同币种），默认 500 */
  keywordSpendThreshold?: number;
}
