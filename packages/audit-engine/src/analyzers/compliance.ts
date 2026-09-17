/**
 * 合规健康线（fast-scan SKILL.md 步骤 5 后半）
 * 两个子项：
 *  1) 在售 Listing 标题/详情命中违禁词库（极限词/医疗违禁/侵权词/诱导欺诈，内置 ≥50 词演示词库，
 *     与店铺自带 forbiddenWords 并集扫描）
 *  2) 店铺绩效指标越红线：ODR >1%、迟发率 >4%、IPI <400
 * 严重度口径：侵权/医疗/极限词 = P0（广告法与平台下架风险）；诱导欺诈 = P1；
 * ODR 越线 = P0（封号级）；迟发率/IPI 越线 = P1。
 */
import type { AuditSnapshot, Finding, Severity } from "../types.js";
import { makeFinding, round2, type AnalyzerContext } from "./util.js";

/** 绩效红线（SKILL.md：ODR>1%、迟发率>4%、IPI<400） */
export const ODR_REDLINE = 0.01;
export const LATE_SHIPMENT_REDLINE = 0.04;
export const IPI_REDLINE = 400;

export type ForbiddenCategory = "极限词" | "医疗违禁" | "侵权词" | "诱导欺诈";

/** 词 → 类目（类目决定严重度） */
const CATEGORY_SEVERITY: Record<ForbiddenCategory, Severity> = {
  极限词: "P0",
  医疗违禁: "P0",
  侵权词: "P0",
  诱导欺诈: "P1",
};

/**
 * 内置演示违禁词库（≥50 词；生产环境由行业知识库下发，此处保证离线可跑）。
 * 依据：《广告法》第九条极限词 / 医疗广告违禁表述 / 品牌侵权高危词 / 平台诱导欺诈词。
 */
export const BUILTIN_FORBIDDEN_WORDS: ReadonlyArray<{ word: string; category: ForbiddenCategory }> = [
  // ---- 极限词（广告法第九条高危） ----
  { word: "国家级", category: "极限词" },
  { word: "最高级", category: "极限词" },
  { word: "最佳", category: "极限词" },
  { word: "最好", category: "极限词" },
  { word: "第一", category: "极限词" },
  { word: "销量第一", category: "极限词" },
  { word: "全国第一", category: "极限词" },
  { word: "全网第一", category: "极限词" },
  { word: "全网最低价", category: "极限词" },
  { word: "全网最低", category: "极限词" },
  { word: "史上最低", category: "极限词" },
  { word: "最低价", category: "极限词" },
  { word: "顶级", category: "极限词" },
  { word: "顶尖", category: "极限词" },
  { word: "极致", category: "极限词" },
  { word: "首选", category: "极限词" },
  { word: "唯一", category: "极限词" },
  { word: "独家", category: "极限词" },
  { word: "万能", category: "极限词" },
  { word: "永久", category: "极限词" },
  { word: "无敌", category: "极限词" },
  { word: "100%", category: "极限词" },
  { word: "绝对", category: "极限词" },
  { word: "最先进", category: "极限词" },
  { word: "最优质", category: "极限词" },
  { word: "全球首发", category: "极限词" },
  { word: "世界领先", category: "极限词" },
  { word: "领导品牌", category: "极限词" },
  { word: "驰名商标", category: "极限词" },
  { word: "国家免检", category: "极限词" },
  { word: "央视上榜", category: "极限词" },
  { word: "国家认证", category: "极限词" },
  // ---- 医疗违禁（普通商品不得宣称疗效） ----
  { word: "特效", category: "医疗违禁" },
  { word: "高效", category: "医疗违禁" },
  { word: "速效", category: "医疗违禁" },
  { word: "神效", category: "医疗违禁" },
  { word: "根治", category: "医疗违禁" },
  { word: "治愈", category: "医疗违禁" },
  { word: "包治百病", category: "医疗违禁" },
  { word: "抗癌", category: "医疗违禁" },
  { word: "防癌", category: "医疗违禁" },
  { word: "壮阳", category: "医疗违禁" },
  { word: "补肾", category: "医疗违禁" },
  { word: "减肥神器", category: "医疗违禁" },
  { word: "降血压", category: "医疗违禁" },
  { word: "消炎", category: "医疗违禁" },
  // ---- 侵权高危词（无授权使用他人品牌） ----
  { word: "迪士尼同款", category: "侵权词" },
  { word: "苹果同款", category: "侵权词" },
  { word: "华为代工", category: "侵权词" },
  { word: "耐克原厂", category: "侵权词" },
  { word: "阿迪同款", category: "侵权词" },
  { word: "LV同款", category: "侵权词" },
  { word: "GUCCI同款", category: "侵权词" },
  { word: "香奈儿平替", category: "侵权词" },
  { word: "原厂尾单", category: "侵权词" },
  // ---- 诱导欺诈 ----
  { word: "稳赚不赔", category: "诱导欺诈" },
  { word: "保本", category: "诱导欺诈" },
  { word: "无风险", category: "诱导欺诈" },
  { word: "零风险", category: "诱导欺诈" },
  { word: "一夜暴富", category: "诱导欺诈" },
  { word: "点击领奖", category: "诱导欺诈" },
  { word: "最后一天", category: "诱导欺诈" },
];

export function analyzeCompliance(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  void ctx;
  const findings: Finding[] = [];
  const shopById = new Map(snapshot.shops.map((s) => [s.shopId, s]));

  /* ---------- 子项 1：在售 Listing 违禁词扫描（内置词库 ∪ 店铺词库） ---------- */
  const builtin = new Map(BUILTIN_FORBIDDEN_WORDS.map((w) => [w.word, w.category]));
  const shopWords = new Set(snapshot.forbiddenWords);
  for (const l of snapshot.listings) {
    if (l.status !== "on-sale") continue; // 只扫在售面（下架品无即时风险）
    const text = `${l.title}\n${l.detail ?? ""}`;
    const hits: { word: string; category: ForbiddenCategory | "店铺自定义" }[] = [];
    for (const [word, category] of builtin) {
      if (text.includes(word)) hits.push({ word, category });
    }
    for (const word of shopWords) {
      if (word && text.includes(word) && !builtin.has(word)) hits.push({ word, category: "店铺自定义" });
    }
    if (hits.length === 0) continue;
    // 取命中词中最高严重度
    const severity = hits.reduce<Severity>((acc, h) => {
      const sev = h.category === "店铺自定义" ? "P1" : CATEGORY_SEVERITY[h.category];
      const rank = { P0: 0, P1: 1, P2: 2 };
      return rank[sev] < rank[acc] ? sev : acc;
    }, "P2");
    findings.push(
      makeFinding({
        line: "compliance",
        severity,
        shopId: l.shopId,
        title: `Listing「${l.title.slice(0, 24)}…」命中 ${hits.length} 个违禁词（${shopById.get(l.shopId)?.shopName ?? l.shopId}）`,
        description: `命中词：${hits.map((h) => `「${h.word}」(${h.category})`).join("、")}。在售状态下面临广告法处罚与平台强制下架风险。`,
        suggestion: "立即替换为合规表述（功效词改场景词、删除绝对化用语）；替换前建议先下架止血。",
        evidence: [{ kind: "listing", id: l.listingId, fields: { sku: l.sku, hitWords: hits.map((h) => h.word).join("/") } }],
        calculation: {
          formula: "在售 Listing 标题∪详情 包含任一违禁词（内置词库 ∪ 店铺词库）",
          inputs: { listingId: l.listingId, hitCount: hits.length, words: hits.map((h) => h.word).join("/") },
          result: `${hits.length} 处命中`,
        },
      }),
    );
  }

  /* ---------- 子项 2：店铺绩效红线 ---------- */
  for (const s of snapshot.shops) {
    if (s.odr !== undefined && s.odr > ODR_REDLINE) {
      findings.push(
        makeFinding({
          line: "compliance",
          severity: "P0",
          shopId: s.shopId,
          title: `店铺 ODR ${(round2(s.odr * 100))}% 越过 1% 红线（${s.shopName}）`,
          description: `订单缺陷率 ${(round2(s.odr * 100))}% > 1%，已触发平台账号健康警报，存在限流/封号风险。`,
          suggestion: "立即盘点缺陷订单构成（差评/纠纷/拒付），逐单补救；必要时下架问题 SKU。",
          evidence: [{ kind: "shop", id: s.shopId, fields: { odr: round2(s.odr * 100) + "%" } }],
          calculation: { formula: "ODR > 1%", inputs: { shopId: s.shopId, odr: s.odr }, result: `${round2(s.odr * 100)}% > 1%` },
        }),
      );
    }
    if (s.lateShipmentRate !== undefined && s.lateShipmentRate > LATE_SHIPMENT_REDLINE) {
      findings.push(
        makeFinding({
          line: "compliance",
          severity: "P1",
          shopId: s.shopId,
          title: `店铺迟发率 ${(round2(s.lateShipmentRate * 100))}% 越过 4% 红线（${s.shopName}）`,
          description: `迟发率 ${(round2(s.lateShipmentRate * 100))}% > 4%，影响店铺权重与活动报名资格。`,
          suggestion: "排查揽收链路瓶颈；大促前调整承诺时效缓冲。",
          evidence: [{ kind: "shop", id: s.shopId, fields: { lateShipmentRate: round2(s.lateShipmentRate * 100) + "%" } }],
          calculation: { formula: "迟发率 > 4%", inputs: { shopId: s.shopId, lateShipmentRate: s.lateShipmentRate }, result: `${round2(s.lateShipmentRate * 100)}% > 4%` },
        }),
      );
    }
    if (s.ipi !== undefined && s.ipi < IPI_REDLINE) {
      findings.push(
        makeFinding({
          line: "compliance",
          severity: "P1",
          shopId: s.shopId,
          title: `店铺 IPI ${s.ipi} 低于 400 红线（${s.shopName}）`,
          description: `库存绩效指数 ${s.ipi} < 400，将面临仓储限容与超龄库存附加费。`,
          suggestion: "清理超龄库存（联动库存线库龄发现）、提升动销与补货节奏。",
          evidence: [{ kind: "shop", id: s.shopId, fields: { ipi: s.ipi } }],
          calculation: { formula: "IPI < 400", inputs: { shopId: s.shopId, ipi: s.ipi }, result: `${s.ipi} < 400` },
        }),
      );
    }
  }

  return findings;
}
