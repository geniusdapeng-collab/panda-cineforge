# @workloom/connectors —— 电商平台连接器层

统一抽象国内 8 平台（天猫/京东/拼多多/抖音/快手/小红书/视频号/天猫国际）与跨境 6 平台
（亚马逊/Temu/TikTokShop/Shopee/速卖通/Shopify）的读写接口，供 `bundles/ecommerce`
的 Agent preset 调用。任务口径称"13 平台"，清单实列 14 个，本层以清单为准全部覆盖。

## 六族接口（src/interface.ts）

| 族 | read | write |
| --- | --- | --- |
| orders 订单 | listOrders | updateOrderNote |
| listings 商品 | getListing | updatePrice / updateStock / publishListing |
| ads 广告 | listCampaigns / getAdReport | adjustBudget / adjustBid |
| warehouse 仓储 | getInventory | createTransfer |
| settlement 结算 | listStatements / getStatementDetail | —（只读族） |
| messages 消息 | listConversations | sendMessage / sendMultimodalMessage |

所有方法返回 `Promise<Receipt<T>>`：`verified` 表示平台侧已核实生效、`raw` 保存原始
证据快照。对齐底座纪律：**无回执 = 未核实，未核实不得转完成（L3.6/E3.7）**。

## 执行面 L1-L5 落地策略

- **L1 只读采集**：所有 read 方法。官方开放平台只读接口，免审批。
- **L2 低风险写**：备注、纯文本客服消息。官方 API 直写 + 回读核实。
- **L3 确定性适配器写**：库存、调拨。幂等键防重，失败显式抛错。
- **L4 中风险写**：调预算/出价、多模态消息。优先官方 API；无 API 时降级为
  AI 浏览器剧本，须审批后方可执行。
- **L5 高危写**：改价、上架发布。强审批 + 回读核实双确认。

## 新增平台适配器

1. `src/types.ts` 的 `PLATFORM_IDS` 追加平台 ID。
2. `src/mock/profiles.ts` 追加一条 `PlatformProfile`（演示店铺/时区/币种/单据前缀）。
3. mock 连接器由 registry 自动生成，无需额外代码；typecheck 会驱动你把联合类型补全。

## 生产接入指引（三级替换路径）

1. **官方 API 适配器**：实现 `PlatformConnector`，经 `registerConnector(platformId, impl)`
   覆盖注册表中的 mock 位。write 方法必须回读平台确认后才置 `verified: true`。
2. **确定性适配器**：无公开 API 的写操作（如部分平台库存），用签名请求 + 幂等键
   封装为确定性调用，禁止依赖页面结构。
3. **AI 浏览器剧本**：既无 API 又无法确定性调用的操作（L4），走
   `packages/base/computer-use` 浏览器剧本，全程录屏留证，强制人工审批。

## 使用

```ts
import { getConnector } from "@workloom/connectors";

const conn = getConnector("tmall");
const shop = { platformId: "tmall", shopId: "tmall-flagship-001", timezone: "Asia/Shanghai", currency: "CNY" } as const;
const receipt = await conn.listOrders(shop, { pageSize: 5 });
if (!receipt.verified) throw new Error("未核实，禁止转完成");
```
