/**
 * executors/video-storyboard.ts —— video-batch-produce 执行体（P3：AI 内容板块真实化第一刀）
 *
 * 大卖视频里承认"AI 短视频板块还没加"——这是我们的超车点。
 * 执行体负责确定性部分：SKU 素材要素 → 结构化分镜脚本（六镜模板：钩子/痛点/卖点/证明/促销/CTA），
 * 产出 Storyboard JSON 供生成模型（图/视频）与 listing-factory 消费。
 * 口径：卖点排序按 sku-profit-ledger 毛利表现（赚钱 SKU 优先产内容）——内容产能跟着利润走。
 */
import { type ExecutorResult } from "./types.js";

export interface StoryboardInput {
  sku: string;
  title: string;
  sellingPoints: string[];     // 卖点（按优先级）
  priceText: string;           // 价格锚点文案（如 "$29.99"）
  audience?: string;           // 目标人群
  locale?: string;             // 语种（默认 zh；8 语种客服前台同源枚举）
}

export interface StoryboardShot {
  seq: number;
  role: "hook" | "pain" | "feature" | "proof" | "offer" | "cta";
  durationSec: number;
  visual: string;              // 画面描述（生成模型提示词素材）
  voiceover: string;           // 口播文案
  onscreenText: string;        // 屏幕字
}

export function buildStoryboard(input: StoryboardInput): StoryboardShot[] {
  const sp = input.sellingPoints;
  const main = sp[0] ?? "核心卖点";
  const second = sp[1] ?? main;
  const audience = input.audience ?? "目标买家";
  return [
    { seq: 1, role: "hook", durationSec: 3, visual: `强节奏开场：${input.title} 使用瞬间特写`, voiceover: `还在为这个烦恼？3 秒告诉你答案`, onscreenText: input.title.slice(0, 18) },
    { seq: 2, role: "pain", durationSec: 4, visual: `${audience} 的典型痛点场景还原`, voiceover: `${audience}最常见的坑，你中了几个？`, onscreenText: "你是不是也这样？" },
    { seq: 3, role: "feature", durationSec: 6, visual: `卖点演示：${main}`, voiceover: `${main}，${second}`, onscreenText: main.slice(0, 16) },
    { seq: 4, role: "proof", durationSec: 5, visual: "细节/材质/对比实测镜头", voiceover: "细节见真章，实测给你看", onscreenText: second.slice(0, 16) },
    { seq: 5, role: "offer", durationSec: 4, visual: "价格锚点 + 促销贴片", voiceover: `现在只要 ${input.priceText}`, onscreenText: input.priceText },
    { seq: 6, role: "cta", durationSec: 2, visual: "商品卡片 + 引导点击", voiceover: "点击下方，立即入手", onscreenText: "立即抢购 →" },
  ];
}

export function execVideoStoryboard(
  inputs: StoryboardInput[],
): ExecutorResult<{ boards: Array<{ sku: string; locale: string; shots: StoryboardShot[] }> }> {
  const boards = inputs.map((x) => ({ sku: x.sku, locale: x.locale ?? "zh", shots: buildStoryboard(x) }));
  return {
    skill: "video-batch-produce",
    generatedAt: new Date().toISOString(),
    headline: { label: "已生成分镜脚本", value: boards.length, unit: "count" },
    detail: { boards },
    traces: [{
      formula: "六镜模板：钩子3s/痛点4s/卖点6s/证明5s/促销4s/CTA2s（总长20s 短视频黄金结构）",
      inputs: { skus: inputs.length },
      result: `${boards.length} 个分镜脚本（每个 6 镜）`,
    }],
    narrativeHints: [
      "分镜脚本为确定性结构产物；画面与配音由生成模型按 visual/voiceover 字段执行",
      "卖点排序建议接 sku-profit-ledger：赚钱 SKU 优先排产（内容产能跟着利润走）",
    ],
    actions: [
      { label: "分镜进入生成队列（素材合规预检）", fenceRule: "R24", level: "review" },
      { label: "批量导出脚本供人工拍摄", level: "auto" },
    ],
  };
}
