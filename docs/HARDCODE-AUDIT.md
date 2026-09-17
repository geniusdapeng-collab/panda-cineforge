# 硬编码排查报告（panda-cineforge / 熊猫电商运营系统）

> 排查日期：2026-08-29 · 方法：六类维度自动扫描（`scripts/hardcode-scan.mjs`）→ 白名单过滤 → 逐条语义复核
> 范围：apps/（server+web+webc）、packages/（base/runtime/shared/db/connectors/audit-engine）、scripts/、.github/
> 结果：候选 885 条 → 白名单豁免 701 条 → 疑似 184 条逐条复核 → **真问题 8 项（已全部修复）+ 测试魔法数 2 处（已一并治理）**

## 一、复核结论总表

| 类别 | 疑似数 | 真问题 | 判定 |
|---|---|---|---|
| A 环境配置 | 25 | 0 | 全部为 CI 连接串、本地开发脚本默认值（有 env 兜底）、第三方官方端点（微信/LLM 预设）、dsh-gate 本机配置——标准实践，豁免 |
| B 身份演示 | 18 | **3** | trpc.ts 演示登录写死 slug（P1）、P7 草稿写死 MEM-001（P1）、P1 页写死演示身份号码（P2→顺手修） |
| C 密钥凭据 | 0 | 0 | 全仓无明文密钥（jwtVerify 走配置、publish.ts 为敏感词扫描器本体） |
| D 行业泄漏 | 2 | **1** | audit-core 注释列举具体行业名（D18 纪律，中性化） |
| E 规则外溢 | 9 | **1** | charter.ts 自治额度默认值 5000/2000 为酒店时代量级（P1）；E8.3 校准系数×2 为有注释依据的产品逻辑常量（豁免） |
| F 文案展示 | 62 | **2** | "Agent ID" 未中文化（P2→顺手修）；其余为 display.ts 字典本体与 GMV/API Key 通用术语（豁免）；decision.ts 注释不精确（顺手修） |

## 二、修复清单（7+2 项，全部完成）

| # | 级别 | 位置 | 问题 | 修法 |
|---|---|---|---|---|
| 1 | P1 | `apps/web/src/lib/trpc.ts` | 演示登录写死 `workspaceSlug: "panda-group"` + `MEM-001`——客户自建工作区时演示登录即坏 | 抽为 `VITE_DEMO_WORKSPACE` / `VITE_DEMO_MEMBER` env 可配（保留默认值兜底） |
| 2 | P1 | `apps/web/src/pages/p7/P7.tsx` | 技能发布草稿 `ownerMemberNo: "MEM-001"` 写死 | 默认空，页面加载时以当前登录身份 `members.me.identity.memberNo` 填充 |
| 3 | P1 | `packages/base/captain/charter.ts` | 数字 CEO 自治额度默认值 `procurement_cap: 5000 / campaign_cap: 2000`——酒店时代量级，与电商种子（100000/50000）不一致 | 默认值调整为 100_000/50_000，与 seed 对齐 |
| 4 | P2 | `apps/web/src/pages/p1/P1.tsx` | 文案写死"演示身份 MEM-001" | 去除写死号码，显示实际身份名 |
| 5 | P2 | `packages/base/audit-core/types.ts` `index.ts` | 注释列举"电商/酒店/社媒/获客"具体行业（底座 D18 行业无关纪律） | 改为"各行业仓/各行业包"中性表述（同步基座与三仓 vendored 副本） |
| 6 | P2 | `apps/web/src/pages/p8/P8.tsx` | "Agent ID" 英文直出 | 中文化"员工编号" |
| 7 | P2 | `packages/base/captain/decision.ts:183` | 注释"1.3 倍宽限"与代码 0.85/1.15 不对称放宽表述不精确 | 注释精确化（下限≈0.72、上限≈1.32） |
| 8 | 治理 | `packages/base/captain/captain.test.ts` | 断言绑死默认值魔法数（5000/2500/3000…）——默认值调整即破，属测试硬编码 | 引入 `CAP = defaultCharter().autonomy.procurement_cap`，断言全部动态化 |
| 9 | 治理 | `packages/base/captain/captain-v2.test.ts` | 同上 | 同上 |
| 10 | P2 | `scripts/suite.ts`（7 处） | NLU 意图分类用例夹具残留酒店句式（OCC/房价/满房/保底价） | 替换为电商句式（GMV/售价/断货/毛利红线），测试语义不变 |

## 三、豁免判定摘录（代表性）

- **CI 连接串**（.github/workflows/ci.yml）：CI 环境 postgres service 标准做法
- **本地开发脚本**（reset.sh/preview-all.sh/dev-note.js 等）：localhost 提示与默认值，均有 env 兜底
- **第三方官方端点**（api.weixin.qq.com、api.deepseek.com 等 LLM 预设）：产品预设，非硬编码缺陷
- **dsh-gate 127.0.0.1:8799**：local-first 架构的本机 gate 地址，有意设计
- **E8.3 校准系数 ×2**：驳回降权的产品逻辑常量，有注释依据
- **display.ts**：显示字典本体（扫描器误报源，已入白名单）
- **GMV / API Key**：行业通用术语（中文化口径中明确保留）

## 四、验证

- `pnpm -C packages/base test`：**385/385 全绿**（含 captain 动态化断言）
- `pnpm typecheck`：8 包全绿
- `pnpm suite`：443/443 全绿（见提交记录）

## 五、后续纪律

- `scripts/hardcode-scan.mjs` 已入仓——六类维度一键复扫，可作为 CI 防回归门禁（`node scripts/hardcode-scan.mjs .`）
- 默认值调整时**禁止**在测试中写死具体数值——一律动态引用（CAP 模式）
