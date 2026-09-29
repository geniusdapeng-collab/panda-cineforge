# M6 独立环境复验报告（panda-cineforge · T-2026-0929-0004）

> 复验环境：独立工作树 `/Users/mac/WorkLoom-fleet/.wt-mcd-verify`（detached `8653448`）·
> 独立库 `workloom_verify`（127.0.0.1:5471，与修复者的 `workloom` 隔离，全新 `db:migrate` + `db:seed` ×2 + `db:verify-chain`）·
> 独立端口 8931/8932/8933（修复者用 8891/8892/8896）
> 复验时间：2026-09-30

## 独立性声明（先说清边界）

- **环境层独立达成**：独立工作树、独立数据库、独立端口、全新迁移与种子，未复用修复者的库/端口/产物。
- **角色层未分离**：原指定的独立会话 `/root/m6_verifier` 运行约 20 分钟未产出任何命令或结论（多次 `wait_agent` 超时、`send_message`/`interrupt_agent` 后仍无回复），
  因此本轮复验由**修复者本人**在独立环境执行。这是 MCD 纪律 7 的**未完全满足**项，已在台账写入 `waiver`（见文末）。
  **建议人工抽查**：`scripts/suite.ts` 的工作区/夹具本地化 + MC-008 的电商宪章阈值（产品语义）。

## 逐项结果（7/7 项已复跑）

| # | 复核项 | 命令 | 结果 |
|---|---|---|---|
| 1 | 必需门禁（原 P0 红） | `node scripts/verify-client-foundation-consumer.mjs --repo .` | ✅ 「受管文件指纹零漂移」，exit 0 |
| 2 | packages/base 单测（原 4 文件 / 6 例红） | `pnpm -C packages/base test` | ✅ `Test Files 48 passed | 3 skipped`，`Tests 661 passed | 130 skipped` |
| 3 | 客服意图路由（原 3 例红） | `pnpm -C apps/server exec vitest run src/service/dialog.test.ts` | ✅ 13 passed |
| 4 | 应用层 E2E（原 96 条失效） | `E2E_SERVER_PORT=8933 pnpm -C apps/server exec vitest run src/service/e2e.test.ts` | ✅ 96 passed |
| 5 | 全场景套件（原服务层 318/418 + E2E 崩溃） | `SUITE_STUB_PORT=8932 SUITE_SERVER_PORT=8931 pnpm suite` | 服务层 **408/418**、HTTP E2E **45/45**、总 **453/463**，失败仅 R 域 10 条（=MC-008） |
| 6 | 套件不污染演示工作区 | 跑完套件后 `select id,name,industry from workspaces` | ✅ `ws-panda | 熊猫优选集团 | ecommerce`（未变成 云栖酒店/hotel） |
| 7 | 交付面 | `pnpm typecheck` / `pnpm product:verify` / `pnpm oss:check` / 三端 build / `verify-ui-consumer` | ✅ 全绿（见修复者环境 `evidence/verification.log`，独立环境同命令同结果） |

### 偶发项观测（用于 MC-014 定级）

- 独立环境共跑 5 次全场景套件：第 1 次 452/463（其中 1 条 E2E 用例红，未落日志到用例名），后 4 次均 453/463 且 `H-17` 全绿。
- 修复者环境 5 次中 1 次 `H-17` 红（`期望 19，实际 18`）。
- 合计 **2/10 观测到非 R 域偶发红**，其中 1 次定位到 H-17 计数断言 → MC-014 维持 P2/open，回归方式：连跑 5 次取 H-17 结果。

## 反事实检查（2 项，均完成）

### A. 把受管文件摘要改回旧值 → 门禁是否重新判红？

```text
$ python3 -c '…tokens.css sha256 -> b621ef3227d7f00aa7676e844b68bc93b986953b014ecbc0118bf9f3e9cd3c59…'
digest reset -> b621ef…
$ node scripts/verify-client-foundation-consumer.mjs --repo .
❌ 三端客户端基座消费门禁失败（1 项）
  · 受管客户端文件指纹漂移：apps/webc/src/styles/tokens.css
$ git checkout -- .workloom-client-foundation.json
$ node scripts/verify-client-foundation-consumer.mjs --repo .
✅ PC/B移动/C移动均来自客户端基座 0.1.14；受管文件指纹零漂移
```

**结论**：该门禁确实能抓住漂移，MC-104 不是"把闸门关掉"，而是把 state 对齐到已交付内容。

### B. 把套件回退到审计基线（2aae441 版本）→ 问题是否复现？

```text
$ git show 2aae441:scripts/suite.ts > scripts/suite-audit-baseline.mts
$ SUITE_STUB_PORT=8932 SUITE_SERVER_PORT=8931 pnpm exec tsx scripts/suite-audit-baseline.mts
════════ 服务层用例：315/418 通过（1866ms）════════
Error: 断言失败：loginAs MEM-001 签发          # HTTP E2E 段在登录处整段崩掉
✗ 计数：103
✗ threads/night_runs/triggers/agents/skill_dist_*_workspace_id_fkey：48
✗ Cannot read properties of undefined (reading 'archive')：22
```

**结论**：在同一干净库、同一端口、同一提交内容下，只有"套件工作区口径"这一处差异就复现了 103 条红与 E2E 崩溃，
与 issue #62 记录的 103 条完全吻合——MC-001/002/003/103 的修复效果不是环境漂移带来的假绿。

## 假修复检查（"改测试就绿"的排除）

| 修复卡 | 实现层证据（非测试自证） |
|---|---|
| MC-101/102 | 套件首段现在按 `workspaces.is_example=true` 解析工作区与 slug；把基线套件放回同一库立刻复现 103 红（反事实 B） |
| MC-104 | 反事实 A：摘要回退即判红，说明断言未被削弱 |
| MC-106 | 客服意图路由的对照是 **产品契约**（`dialog.test.ts` 9 条意图表 + `ticketKindOf` 售后类型），不是断言自身；修复后 13 例全绿且疑问句仍走 KB（「退款多久到账」→`kb_qa`） |
| MC-107 | 端口从常量改为环境变量；在端口被占用时表现为明确失败，而不是静默连到他人服务 |
| MC-105 | 四个测试文件的断言改为与本仓 bundle/工作区/文案同源；`fence-engine.test.ts` 的 DB 集成段改指 `ws-panda` 与 `ecom-baseline/v1` |

## 未闭环清单（复验视角）

1. MC-008 R 域 10 条 —— 与修复者结论一致（酒店宪章阈值/KPI 口径），需产品确认电商自治阈值。
2. MC-009 PG 集成 31–32 条 —— 未在本轮复验范围内（需 `RUN_DB_TESTS=1` 且逐文件本地化）。
3. MC-010 行业语义未登记 `extraExclude` —— 机制风险，复验环境未实跑 fanout（`--dry-run` 未执行，属未验证）。
4. MC-011 鉴权边界 4 条 —— 独立环境同结果（apps/server 2 files / 4 tests red）。
5. MC-012/MC-013/MC-014 —— 观察项，回归命令见台账。

## waiver（纪律 7 例外声明）

```json
{
  "rule": "修复者不自验（MCD §5 纪律 7）",
  "waiver": {
    "reason": "指定的独立会话 /root/m6_verifier 运行 20 分钟未产出任何命令与结论（wait_agent 超时、send_message 与 interrupt_agent 后仍无回复），无法充当验收方；改用独立环境（独立工作树/库/端口 + 2 项反事实检查）复跑，独立性仅在环境层成立",
    "approved_by": "待人工复核确认（本报告即提交人工抽查的输入）",
    "compensating_controls": [
      "独立工作树 .wt-mcd-verify（detached 8653448）",
      "独立数据库 workloom_verify（未复用修复者库/端口）",
      "2 项反事实检查（门禁回退判红、基线套件复现 103 红）",
      "全部断言命令与输出原文落盘 evidence/"
    ]
  }
}
```

## 自检表

- [是] 我在独立环境（独立库、独立工作树、独立端口）复跑，而非复用修复者的库？
- [否→已声明] 独立性在**角色层**未达成（同一修复者执行）——已按 MCD 纪律 7 写 waiver 并给出补偿控制。
- [是] 我的每个结论都有命令与输出支撑（原文见本文件与 `evidence/`）？
- [是] 我做了 2 项反事实检查（回退摘要→门禁判红；回退套件→103 红复现）？
- [是] 我没有修改被验收代码（反事实 A 用 `git checkout --` 恢复；反事实 B 用临时文件 `scripts/suite-audit-baseline.mts`，已删除）。
