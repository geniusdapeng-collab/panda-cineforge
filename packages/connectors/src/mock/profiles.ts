/**
 * profiles · 14 平台演示档案（熊猫优选集团口径）
 * 国内 8 平台：CNY / Asia/Shanghai；跨境 6 平台按主营站点给币种与时区。
 * 新增平台只需在此追加一条 profile，registry 自动产出 mock 连接器。
 */
import type { PlatformProfile } from "./mock-base.js";

export const PLATFORM_PROFILES: readonly PlatformProfile[] = [
  // ---------- 国内 ----------
  {
    platformId: "tmall",
    region: "domestic",
    code: "TM",
    demoShop: { shopId: "tmall-flagship-001", shopName: "熊猫优选旗舰店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "jd",
    region: "domestic",
    code: "JD",
    demoShop: { shopId: "jd-self-001", shopName: "熊猫优选京东自营店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "pdd",
    region: "domestic",
    code: "PDD",
    demoShop: { shopId: "pdd-official-001", shopName: "熊猫优选官方店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "douyin",
    region: "domestic",
    code: "DY",
    demoShop: { shopId: "douyin-shop-001", shopName: "熊猫优选抖音小店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "kuaishou",
    region: "domestic",
    code: "KS",
    demoShop: { shopId: "kuaishou-shop-001", shopName: "熊猫优选快手小店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "xiaohongshu",
    region: "domestic",
    code: "XHS",
    demoShop: { shopId: "xhs-shop-001", shopName: "熊猫优选红书店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "wechat-channels",
    region: "domestic",
    code: "WXC",
    demoShop: { shopId: "wxchannels-001", shopName: "熊猫优选视频号小店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  {
    platformId: "tmall-global",
    region: "domestic",
    code: "TMG",
    demoShop: { shopId: "tmall-global-001", shopName: "PandaChoice海外旗舰店", timezone: "Asia/Shanghai", currency: "CNY" },
  },
  // ---------- 跨境 ----------
  {
    platformId: "amazon",
    region: "crossborder",
    code: "AMZ",
    demoShop: { shopId: "amz-us-pandatech", shopName: "PandaTech Amazon US", timezone: "America/Los_Angeles", currency: "USD" },
  },
  {
    platformId: "temu",
    region: "crossborder",
    code: "TEMU",
    demoShop: { shopId: "temu-pandatech", shopName: "PandaTech Temu", timezone: "America/Los_Angeles", currency: "USD" },
  },
  {
    platformId: "tiktok-shop",
    region: "crossborder",
    code: "TTS",
    demoShop: { shopId: "tts-us-pandatech", shopName: "PandaTech TikTok US", timezone: "America/Los_Angeles", currency: "USD" },
  },
  {
    platformId: "shopee",
    region: "crossborder",
    code: "SHP",
    demoShop: { shopId: "shopee-sea-pandatech", shopName: "PandaTech SEA", timezone: "Asia/Singapore", currency: "SGD" },
  },
  {
    platformId: "aliexpress",
    region: "crossborder",
    code: "AE",
    demoShop: { shopId: "ae-pandatech", shopName: "PandaTech Global", timezone: "Asia/Shanghai", currency: "USD" },
  },
  {
    platformId: "shopify",
    region: "crossborder",
    code: "SFY",
    demoShop: { shopId: "shopify-pandatech-dtc", shopName: "PandaTech DTC 独立站", timezone: "America/New_York", currency: "USD" },
  },
];
