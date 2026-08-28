/**
 * 对账复核线（fast-scan SKILL.md 步骤 6）
 * 账单行与订单/广告后台逐笔勾稽，四个子项 + 差异率统计：
 *  1) 佣金错算：|实提比例 − 应提比例| > 0.5pp
 *  2) 退款未冲抵：订单已退款但账单无对应 refund 行
 *  3) 广告费与广告后台不符：账单 ad-deduction 合计 vs 广告后台同账期花费，相对差异 >1%
 *  4) 物流多收：账单 logistics 合计 vs 应计（订单数 × 单均物流费），相对差异 >1%
 *  5) 差异率统计：|总差异| / 订单总额，>0.3% 升级 P1（夜班对账红线同源）
 * 降级纪律：店铺缺 commissionRate → 子项 1 跳过；缺 logisticsFeePerOrder → 子项 4 跳过。
 */
import type { AuditSnapshot, Finding } from "../types.js";
import { makeFinding, round2, round4, type AnalyzerContext } from "./util.js";

/** 佣金错算阈值：0.5 个百分点（SKILL.md） */
export const COMMISSION_TOLERANCE_PP = 0.005;
/** 广告/物流勾稽相对差异阈值 */
export const REL_DIFF_TOLERANCE = 0.01;
/** 账单总差异率红线（与夜班对账 SOP 同源：0.3%） */
export const TOTAL_DIFF_RATE_REDLINE = 0.003;

export function analyzeRecon(snapshot: AuditSnapshot, ctx: AnalyzerContext): Finding[] {
  void ctx;
  const findings: Finding[] = [];
  const shopById = new Map(snapshot.shops.map((s) => [s.shopId, s]));
  const orderById = new Map(snapshot.orders.map((o) => [`${o.shopId}::${o.orderId}`, o]));

  for (const st of snapshot.statements) {
    const shop = shopById.get(st.shopId);
    // 该账单勾稽出的绝对差异累计（差异率统计用）
    let absDiffTotal = 0;
    let orderGrossTotal = 0;

    /* ---------- 子项 1：佣金错算 ---------- */
    if (shop?.commissionRate !== undefined) {
      for (const line of st.lines) {
        if (line.type !== "commission") continue;
        const order = orderById.get(`${st.shopId}::${line.refId}`);
        if (!order || order.amount <= 0) continue; // 订单不在快照窗口内 → 无法勾稽，跳过（覆盖度在报告层标注）
        const expected = order.amount * shop.commissionRate;
        const actual = Math.abs(line.amount);
        const diff = actual - expected;
        const pp = diff / order.amount;
        if (Math.abs(pp) > COMMISSION_TOLERANCE_PP) {
          absDiffTotal += Math.abs(diff);
          findings.push(
            makeFinding({
              line: "recon",
              severity: Math.abs(diff) > 1000 ? "P1" : "P2",
              shopId: st.shopId,
              title: `账单 ${st.statementId} 佣金错算：订单 ${line.refId} 多提 ${(round4(Math.abs(pp) * 100)).toFixed(2)}pp`,
              description: `订单金额 ${order.amount} ${line.currency}，应提 ${(shop.commissionRate * 100).toFixed(1)}% = ${round2(expected)}，实提 ${round2(actual)}，差异 ${round2(diff)}（${(round4(pp * 100)).toFixed(2)}pp > 0.5pp 容差）。`,
              suggestion: "向平台发起账单申诉追回差额；核对类目佣金协议是否被单方面调整。",
              evidence: [
                { kind: "statement-line", id: line.lineId, fields: { refId: line.refId, actual: round2(actual), expected: round2(expected) } },
                { kind: "order", id: line.refId, fields: { amount: order.amount } },
              ],
              calculation: {
                formula: "差异pp = (实提佣金 − 订单金额 × 应提比例) / 订单金额；|差异| > 0.5pp 告警",
                inputs: { orderId: line.refId, orderAmount: order.amount, commissionRate: shop.commissionRate, expected: round2(expected), actual: round2(actual) },
                result: `${(round4(pp * 100)).toFixed(2)}pp`,
              },
              estimatedImpact: {
                amount: round2(Math.abs(diff)),
                currency: line.currency,
                period: "one-off",
                confidence: "exact",
                basis: "逐笔勾稽差值（账单行 vs 订单 × 协议比例）",
              },
            }),
          );
        }
      }
    }

    /* ---------- 子项 2：退款未冲抵 ---------- */
    const refundRefs = new Set(st.lines.filter((l) => l.type === "refund").map((l) => l.refId));
    const orderRefsInStatement = new Set(st.lines.filter((l) => l.type === "order").map((l) => l.refId));
    for (const refId of orderRefsInStatement) {
      orderGrossTotal += orderById.get(`${st.shopId}::${refId}`)?.amount ?? 0;
      const order = orderById.get(`${st.shopId}::${refId}`);
      if (!order) continue;
      if ((order.status === "refunding" || order.status === "closed") && !refundRefs.has(refId)) {
        absDiffTotal += order.amount;
        findings.push(
          makeFinding({
            line: "recon",
            severity: "P1",
            shopId: st.shopId,
            title: `账单 ${st.statementId} 退款未冲抵：订单 ${refId}`,
            description: `订单 ${refId} 状态为 ${order.status === "refunding" ? "退款中" : "已关闭"}，金额 ${order.amount} ${order.currency}，但账单 ${st.period} 无对应退款冲抵行。`,
            suggestion: "向平台核对退款流水，要求补冲抵；逾期未补走申诉通道。",
            evidence: [
              { kind: "order", id: refId, fields: { status: order.status, amount: order.amount } },
              { kind: "statement", id: st.statementId, fields: { period: st.period } },
            ],
            calculation: {
              formula: "订单∈账单 且 状态∈{refunding, closed} 且 账单无 refund(refId=订单号)",
              inputs: { orderId: refId, status: order.status, amount: order.amount, period: st.period },
              result: "未冲抵",
            },
            estimatedImpact: {
              amount: order.amount,
              currency: order.currency,
              period: "one-off",
              confidence: "baseline",
              basis: "按订单全额估算（实际退款额可能部分），待平台流水确认后转 exact",
            },
          }),
        );
      }
    }

    /* ---------- 子项 3：广告费与广告后台不符 ---------- */
    const adDeductTotal = st.lines.filter((l) => l.type === "ad-deduction").reduce((s, l) => s + Math.abs(l.amount), 0);
    if (adDeductTotal > 0) {
      const backendTotal = snapshot.adsCampaigns
        .filter((c) => c.shopId === st.shopId)
        .flatMap((c) => c.daily)
        .filter((d) => d.date.startsWith(st.period))
        .reduce((s, d) => s + d.spend, 0);
      if (backendTotal > 0) {
        const diff = adDeductTotal - backendTotal;
        const rel = diff / backendTotal;
        if (Math.abs(rel) > REL_DIFF_TOLERANCE) {
          absDiffTotal += Math.abs(diff);
          findings.push(
            makeFinding({
              line: "recon",
              severity: "P1",
              shopId: st.shopId,
              title: `账单 ${st.statementId} 广告费与后台不符：多扣 ${round2(Math.abs(diff))}`,
              description: `账单广告扣款 ${round2(adDeductTotal)}，广告后台同账期花费 ${round2(backendTotal)}，相对差异 ${(round4(Math.abs(rel) * 100)).toFixed(2)}% > 1% 容差。`,
              suggestion: "导出后台消耗明细逐日比对，向平台提交差异申诉。",
              evidence: [{ kind: "statement", id: st.statementId, fields: { adDeductTotal: round2(adDeductTotal), backendTotal: round2(backendTotal) } }],
              calculation: {
                formula: "相对差异 = (账单广告扣款 − 后台花费) / 后台花费；|差异| > 1% 告警",
                inputs: { statementId: st.statementId, period: st.period, adDeductTotal: round2(adDeductTotal), backendTotal: round2(backendTotal) },
                result: `${(round4(rel * 100)).toFixed(2)}%`,
              },
              estimatedImpact: {
                amount: round2(Math.abs(diff)),
                currency: st.lines[0]?.currency ?? shop?.currency ?? "CNY",
                period: "one-off",
                confidence: "exact",
                basis: "账单扣款 − 后台花费（同账期同币种）",
              },
            }),
          );
        }
      }
    }

    /* ---------- 子项 4：物流多收 ---------- */
    if (shop?.logisticsFeePerOrder !== undefined) {
      const logisticsTotal = st.lines.filter((l) => l.type === "logistics").reduce((s, l) => s + Math.abs(l.amount), 0);
      const orderLineCount = st.lines.filter((l) => l.type === "order").length;
      const expected = orderLineCount * shop.logisticsFeePerOrder;
      if (logisticsTotal > 0 && expected > 0) {
        const diff = logisticsTotal - expected;
        const rel = diff / expected;
        if (rel > REL_DIFF_TOLERANCE) {
          absDiffTotal += Math.abs(diff);
          findings.push(
            makeFinding({
              line: "recon",
              severity: "P2",
              shopId: st.shopId,
              title: `账单 ${st.statementId} 物流多收：${round2(diff)}`,
              description: `账单物流费 ${round2(logisticsTotal)}，应计 ${orderLineCount} 单 × ${shop.logisticsFeePerOrder} = ${round2(expected)}，多收 ${(round4(rel * 100)).toFixed(2)}%。`,
              suggestion: "核对物流商账单与称重记录，走差异赔付流程。",
              evidence: [{ kind: "statement", id: st.statementId, fields: { logisticsTotal: round2(logisticsTotal), expected: round2(expected) } }],
              calculation: {
                formula: "多收 = 账单物流费 − 订单数 × 单均物流费；相对 >1% 告警",
                inputs: { statementId: st.statementId, logisticsTotal: round2(logisticsTotal), orderLineCount, feePerOrder: shop.logisticsFeePerOrder },
                result: `${(round4(rel * 100)).toFixed(2)}%`,
              },
              estimatedImpact: {
                amount: round2(diff),
                currency: st.lines[0]?.currency ?? shop.currency,
                period: "one-off",
                confidence: "baseline",
                basis: "按协议单均费口径估算（重货/偏远附加未建模）",
              },
            }),
          );
        }
      }
    }

    /* ---------- 子项 5：差异率统计（每账单一条，透明口径） ---------- */
    if (orderGrossTotal > 0) {
      const diffRate = absDiffTotal / orderGrossTotal;
      findings.push(
        makeFinding({
          line: "recon",
          severity: diffRate > TOTAL_DIFF_RATE_REDLINE ? "P1" : "P2",
          shopId: st.shopId,
          title: `账单 ${st.statementId}（${st.period}）勾稽差异率 ${(round4(diffRate * 100)).toFixed(3)}%`,
          description: `本账单订单总额 ${round2(orderGrossTotal)}，累计绝对差异 ${round2(absDiffTotal)}，差异率 ${(round4(diffRate * 100)).toFixed(3)}%${
            diffRate > TOTAL_DIFF_RATE_REDLINE ? " > 0.3% 红线" : "（0.3% 红线内）"
          }。`,
          suggestion: diffRate > TOTAL_DIFF_RATE_REDLINE ? "差异率越红线，建议整账单走平台复核流程。" : "差异率在红线内，留档观察。",
          evidence: [{ kind: "statement", id: st.statementId, fields: { orderGrossTotal: round2(orderGrossTotal), absDiffTotal: round2(absDiffTotal) } }],
          calculation: {
            formula: "差异率 = 累计绝对差异 / 订单总额",
            inputs: { statementId: st.statementId, orderGrossTotal: round2(orderGrossTotal), absDiffTotal: round2(absDiffTotal) },
            result: `${(round4(diffRate * 100)).toFixed(3)}%`,
          },
        }),
      );
    }
  }

  return findings;
}
