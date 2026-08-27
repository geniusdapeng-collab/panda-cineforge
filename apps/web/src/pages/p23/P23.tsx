/**
 * P23 多平台店铺矩阵看板（A8 电商专属页：14 店铺 × 13 平台一屏总览）
 *  - 店铺卡片：平台 / 年 GMV / 日均订单 / 评分 / 告警数（国内军·跨境军两军分区）
 *  - 纯前端演示组件（熊猫优选集团口径：14 店铺 / 8,600 SKU / 13 平台；数据为本页演示常量）
 */
import { useMemo, useState } from "react";
import { Bridge } from "../../shell/Bridge";
import { PageNav } from "../../components/PageNav";
import { HBar, Note, PageHead, Stat, Tag } from "../../components/Twin";

interface ShopCard {
  id: number;
  name: string;
  platform: string;
  category: string;
  gmvYearYi: number;      // 年 GMV（亿）
  currency: "CNY" | "USD";
  dailyOrders: number;    // 日均订单
  rating: number;         // 店铺评分（5 分制）
  alerts: number;         // 当前告警数
  army: "domestic" | "cross";
}

/** 熊猫优选集团 14 店铺矩阵（升级改造计划 §4.1 口径） */
const SHOPS: ShopCard[] = [
  { id: 1, name: "熊猫优选天猫旗舰店", platform: "天猫", category: "3C数码配件", gmvYearYi: 28, currency: "CNY", dailyOrders: 21500, rating: 4.8, alerts: 0, army: "domestic" },
  { id: 2, name: "熊猫优选京东自营店", platform: "京东", category: "3C数码配件", gmvYearYi: 19, currency: "CNY", dailyOrders: 14200, rating: 4.9, alerts: 0, army: "domestic" },
  { id: 3, name: "熊猫智选拼多多店", platform: "拼多多", category: "家居日用", gmvYearYi: 11, currency: "CNY", dailyOrders: 12800, rating: 4.6, alerts: 2, army: "domestic" },
  { id: 4, name: "熊猫严选抖音店", platform: "抖音电商", category: "3C+家居（直播）", gmvYearYi: 16, currency: "CNY", dailyOrders: 9600, rating: 4.7, alerts: 1, army: "domestic" },
  { id: 5, name: "熊猫生活快手店", platform: "快手", category: "家居日用", gmvYearYi: 6, currency: "CNY", dailyOrders: 4800, rating: 4.6, alerts: 0, army: "domestic" },
  { id: 6, name: "熊猫美学小红书店", platform: "小红书", category: "设计家居", gmvYearYi: 4, currency: "CNY", dailyOrders: 2200, rating: 4.8, alerts: 0, army: "domestic" },
  { id: 7, name: "熊猫优选视频号小店", platform: "视频号", category: "全品类", gmvYearYi: 3, currency: "CNY", dailyOrders: 1900, rating: 4.5, alerts: 0, army: "domestic" },
  { id: 8, name: "PandaHome 天猫国际店", platform: "天猫国际", category: "进口家居", gmvYearYi: 15, currency: "CNY", dailyOrders: 5100, rating: 4.8, alerts: 1, army: "domestic" },
  { id: 9, name: "PandaTech", platform: "亚马逊(美/欧/日)", category: "3C配件", gmvYearYi: 21, currency: "USD", dailyOrders: 8600, rating: 4.7, alerts: 3, army: "cross" },
  { id: 10, name: "PandaHome", platform: "Temu 半托管", category: "家居", gmvYearYi: 9, currency: "USD", dailyOrders: 7400, rating: 4.5, alerts: 1, army: "cross" },
  { id: 11, name: "PandaLife", platform: "TikTok Shop(美+东南亚)", category: "家居好物", gmvYearYi: 8, currency: "USD", dailyOrders: 5800, rating: 4.6, alerts: 0, army: "cross" },
  { id: 12, name: "PandaSelect", platform: "Shopee/Lazada", category: "3C+家居", gmvYearYi: 6, currency: "USD", dailyOrders: 4600, rating: 4.6, alerts: 0, army: "cross" },
  { id: 13, name: "PandaGlobal", platform: "速卖通+SHEIN供货", category: "全品类", gmvYearYi: 5, currency: "USD", dailyOrders: 3100, rating: 4.4, alerts: 1, army: "cross" },
  { id: 14, name: "panda-home.com", platform: "Shopify 独立站", category: "品牌站", gmvYearYi: 4, currency: "USD", dailyOrders: 1300, rating: 4.9, alerts: 0, army: "cross" },
];

const gmvText = (s: ShopCard) => (s.currency === "CNY" ? `¥${s.gmvYearYi}亿` : `$${s.gmvYearYi}亿`);

function ShopCardView({ s }: { s: ShopCard }) {
  return (
    <div className="rounded-lg border border-line bg-card p-3.5 transition-colors hover:border-gline">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink3">#{s.id}</span>
        <b className="text-body text-ink2">{s.name}</b>
        <span className="flex-1" />
        <Tag tone={s.alerts > 0 ? "warn" : "go"}>{s.alerts > 0 ? `告警 ${s.alerts}` : "健康"}</Tag>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink3">
        <Tag tone="holo">{s.platform}</Tag>
        <span>{s.category}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-orb text-h2 font-bold text-gold">{gmvText(s)}</div>
          <div className="text-[10px] text-ink3">年 GMV</div>
        </div>
        <div>
          <div className="font-orb text-h2 font-bold text-ink2">{s.dailyOrders.toLocaleString()}</div>
          <div className="text-[10px] text-ink3">日均订单</div>
        </div>
        <div>
          <div className="font-orb text-h2 font-bold text-go">{s.rating}</div>
          <div className="text-[10px] text-ink3">店铺评分</div>
        </div>
      </div>
      <div className="mt-2.5">
        <HBar label="GMV 占比" pct={Math.round((s.gmvYearYi / 28) * 100)} tone={s.army === "domestic" ? "bg-gold" : "bg-holo"} />
      </div>
    </div>
  );
}

export default function P23() {
  const [army, setArmy] = useState<"all" | "domestic" | "cross">("all");

  const list = useMemo(() => SHOPS.filter((s) => army === "all" || s.army === army), [army]);
  const totalAlerts = SHOPS.reduce((n, s) => n + s.alerts, 0);
  const totalDailyOrders = SHOPS.reduce((n, s) => n + s.dailyOrders, 0);
  const avgRating = (SHOPS.reduce((n, s) => n + s.rating, 0) / SHOPS.length).toFixed(2);

  const right = (
    <>
      <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">集团口径 · MATRIX</div>
      <div className="rounded-lg border border-gline bg-card p-3 text-xs leading-relaxed text-ink3">
        14 店铺横跨国内外 13 个平台、在架 SKU 8,600+；店长对店铺 GMV 负责，向作战军负责人汇报、再向集团CEO——三级汇报线。
      </div>
      <div className="mt-3 rounded-lg border border-line bg-card p-3 text-xs leading-relaxed text-ink3">
        告警构成：拼多多价格倒挂 ×2 · 抖音差评 SLA ×1 · 天猫国际断货预警 ×1 · 亚马逊 ACoS 爆表 ×3 · Temu 核价待裁 ×1 · 速卖通跟卖 ×1。
      </div>
    </>
  );

  return (
    <Bridge left={<PageNav current="P23" />} right={right}>
      <PageHead title="店铺矩阵看板" tag="P23 · SHOP MATRIX" extra={<Tag tone="gold">14 店铺 · 13 平台</Tag>} />

      <div className="mb-3 grid grid-cols-4 gap-3">
        <Stat label="店铺总数" value={SHOPS.length} hint="国内军 8 · 跨境军 6" />
        <Stat label="日均订单" value={`${(totalDailyOrders / 10000).toFixed(1)}万`} tone="text-holo" hint="大促峰值 180 万单/日" />
        <Stat label="平均评分" value={avgRating} tone="text-go" hint="全平台加权" />
        <Stat label="当前告警" value={totalAlerts} tone="text-warn" hint="点击卡片查看明细 → P11/P15" />
      </div>

      <div className="mb-3 flex gap-2">
        {([["all", "全部战区"], ["domestic", "国内战区（8）"], ["cross", "跨境战区（6）"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setArmy(k)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${army === k ? "border-gline bg-card text-gold" : "border-line bg-card text-ink3 hover:border-gline"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {list.map((s) => <ShopCardView key={s.id} s={s} />)}
      </div>

      <div className="mt-3">
        <Note>演示口径：熊猫优选集团年 GMV ¥102亿 + $53亿。卡片告警与 P11 商品价格矩阵、P15 评价防御、P17 海外仓地图同源联动；本页为纯前端演示组件。</Note>
      </div>
    </Bridge>
  );
}
