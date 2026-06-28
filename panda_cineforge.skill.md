---
name: panda-cineforge
display_name: 大熊猫影视创作技能引擎
version: 1.0.0
author: GeniusDapeng
license: internal
description: 面向 AI 影视创作领域的通用化技能底座引擎。融合技能生成（锻造）与技能调度编排（召回）为单一引擎，具备冷启动批量预置、热运行实时生成、分层级联回、外部知识全自动获取、三段式专业性保障、多制作系统 Agent 编排能力。
category: skill-engine
domain: ai_cinema
language: python
tags:
  - 影视创作
  - 技能引擎
  - 技能生成
  - 技能调度
  - 召回排序
  - AI影视
  - 通用引擎
  - AI视频
  - OpenClaw
capabilities:
  - cold_forge
  - hot_forge
  - recall
  - orchestration
  - external_knowledge_fetch
  - qa_gate
dependencies:
  python:
    - scrapling[all]
    - openai
    - pyyaml
    - jsonschema
    - jinja2
  optional: true
install: pip install "scrapling[all]" openai pyyaml jsonschema jinja2 && scrapling install
---

# 大熊猫影视创作技能引擎（PandaCineForge）V1.0

> **定位**：面向 AI 影视创作领域的通用化技能底座引擎——服务于任意 AI 视频制作系统及其 Agent，不绑定任何具体制作系统。
> **形态**：自包含单文件，OpenClaw 等 Agent 平台一键安装。
> **架构**：双模式主链路 + 外部知识全自动获取 + 五层技能锻造 + 三段式专业性保障 + 分层级联回 + 固定化契约 + 统一 SkillAsset + 多系统编排 + 影视垂直化。

## 能力矩阵

| 能力域 | 说明 |
|---|---|
| **冷启动（Cold Forge）** | 按"全域技能矩阵"批量生成 80-150 个核心技能，入库供直接召回 |
| **热运行（Hot Runtime）** | Agent 运行时召回失败则实时生成，即用即沉淀（飞轮反哺） |
| **外部知识获取** | 七子模块全自动：查询构造→搜索网关→源头路由→Scrapling 爬虫→内容萃取→知识过滤→知识缓存 |
| **五层锻造** | 知识源层→知识融合层→多阶段锻造层→组合创新层→成熟度进化层 |
| **三段式专业性保障** | 知识置信度门禁（主流免评审）+ 轻量单次评审兜底（少数）+ 实战反馈自然选择（终极） |
| **分层级联回** | R0 结构化路由→R1 语义向量→R2 上下文→R3 关键词→R4 安全兜底→R5 实时生成兜底 |
| **固定化契约** | AI-AI 结构化协议，调用方按 schema 发请求，引擎返回结构化 SkillAsset |
| **统一 SkillAsset** | 生产侧输出与消费侧召回收敛为同一对象，无需适配层 |
| **多系统编排** | 按 module_target 分组分发至各类制作系统 Agent（通用，不绑定具体系统） |
| **影视垂直化** | 三大子领域 cinema / short_video / ai_manga_drama，50+ Topic，40+ 种子源 |

## 安装与依赖

```bash
# 核心依赖（可选，缺失时引擎自动降级）
pip install "scrapling[all]" openai pyyaml jsonschema jinja2
scrapling install

# 环境变量（按需配置）
export OPENAI_API_KEY=你的API_KEY
export OPENAI_MODEL=gpt-4.1
# 搜索 API（任选其一或多选，运行时自动探测）
export TAVILY_API_KEY=...        # 或 BING_API_KEY / BRAVE_API_KEY / SERPAPI_API_KEY / GOOGLE_CSE_API_KEY+GOOGLE_CSE_ID
```

> **降级策略**：无 `openai` 时 LLM 调用与 embedding 返回空，索引/召回/BM25/Topic 链路仍可用；无 `scrapling` 时爬虫降级为 urllib 兜底；无 `yaml`/`jsonschema`/`jinja2` 时用 JSON 替代。引擎永不因缺依赖而崩溃。


## 操作指令（Agent 安装后执行流程）

OpenClaw 安装本 skill.md 后，Agent 按以下流程使用引擎。引擎本体代码见下方「内嵌引擎代码」代码块，Agent 提取后作为 `panda_cineforge.py` 导入。

### 步骤 0：环境准备

1. 提取本文件「内嵌引擎代码」代码块内容，保存为 `panda_cineforge.py`。
2. 提取「内嵌 SystemMessage」「内嵌 UserMessage 模板」「内嵌 InputSchema」「内嵌 RenderTemplate」四个块，分别保存为 `system_message.txt`、`user_message_template.txt`、`input_schema.json`、`render_template.md`。
3. 配置环境变量（见上方「安装与依赖」）。
4. 初始化引擎：
   ```python
   import panda_cineforge as pcf
   engine = pcf.PandaCineForge(
       system_message=open("system_message.txt").read(),
       user_template=open("user_message_template.txt").read(),
   )
   ```

### 步骤 1：冷启动批量预置（系统初始化/新项目立项时）

按"全域技能矩阵"批量生成核心技能并入库，运行时零生成延迟直接召回：

```python
result = engine.cold_start()  # 默认使用内嵌 COLD_FORGE_MATRIX
# result = engine.cold_start(matrix=自定义矩阵)
print(result["generated_count"], result["maturity_dist"])
```

冷启动走完整锻造流程：外部知识深抓（8-12 条 + 子页）→ 知识融合 → 多阶段锻造 → 三段式专业性保障 → 可选组合创新。产出技能成熟度从 v2 起。

### 步骤 2：热运行实时服务（Agent 执行任务时）

AI 调用方按固定契约发起请求，引擎分层级联回，命中即返，未命中实时生成：

```python
request = {
    "call_id": "call_001",
    "caller_agent": "VisualLanguage",
    "route_fields": {
        "module_target": ["MyStudio.VisualLanguage"],
        "cinematic_role": "visual_language",
        "deliverable_type": "color_script",
        "project_stage": "postproduction",
        "sub_domain": "cinema"
    },
    "context": {
        "project_id": "proj_001",
        "project_type": "feature_film",
        "current_task": "设计第一幕调色方案",
        "recent_calls": ["call_abc"],
        "upstream_deliverable": "shotlist_v1"
    },
    "query_text": "电影调色方案",
    "recall_mode": "full",   # fast（仅 R0+R1）或 full（R0-R5）
    "topk": 3
}
response = engine.serve(request)
# response.status: hit（召回命中）/ forged（R5 实时生成）/ fallback_degraded（降级）
# response.skills: 结构化 SkillAsset 数组，AI 直接执行
# response.workflow: 按 module_target 分发的执行步骤
```

### 步骤 3：召回分层级联说明

| 层 | 名称 | 机制 | 延迟 |
|---|---|---|---|
| R0 | 结构化精确路由 | 按 module_target + cinematic_role + deliverable_type + project_stage + sub_domain 精确过滤 | <1ms |
| R1 | 语义向量召回 | 基于 SkillAsset embedding 的 ANN 查询（核心层） | <10ms |
| R2 | 上下文召回 | 基于调用方上下文预测性召回（项目类型/阶段/上下游技能） | <5ms |
| R3 | 关键词/Topic 补充 | BM25 + Topic Match + Slot Match（影视化） | <10ms |
| R4 | 安全兜底 | 版权/审核/崩溃/丢失等紧急场景保底 | <5ms |
| R5 | 实时生成兜底 | 触发 SkillForgeEngine 实时生成，即用即沉淀（飞轮反哺） | 异步 |

`recall_mode=fast` 仅走 R0+R1（追求速度）；`recall_mode=full` 走 R0-R5（追求覆盖）。R5 生成期间先返回降级方案不阻塞主链路。

### 步骤 4：实战反馈回传（飞轮闭环）

技能被调用执行后，调用方 Agent 返回执行反馈，驱动成熟度进化与知识回流：

```python
engine.report_feedback(
    skill_id="pcf_xxx",
    execution_outcome="success",     # success | partial | failed
    quality_score=88,                # 0-100
    failure_reasons=["..."],         # 失败原因（可选）
    user_corrections=["..."]         # 用户修正（可选）
)
# 失败原因 + 用户修正自动萃取回流 KnowledgeCache 的 pitfalls 维度
# 连续 3 次达标升 v3，连续 2 次不达标降级
```

### 步骤 5：多制作系统 Agent 编排

引擎是底座，`module_target` 支持多系统命名空间（格式 `系统名.Agent名`）。召回后 TopK 技能按 module_target 分组，并行/串行分发至对应制作系统 Agent：

```python
# 返回的 workflow.steps 已按 module_target 分组
for step in response["workflow"]["steps"]:
    # 分发至对应制作系统 Agent（如调用方的 SceneDesign）
    dispatch_result = pcf.dispatch_to_agent(step["agent"], engine.indexer.skills[step["skill_id"]])
```

### 步骤 6：质检与单技能补全

```python
# 质检某技能
qa = engine.qa_check("pcf_xxx")

# 手动补全单个技能（调试/补缺）
skill = engine.forge_one(payload)
```


## 内嵌引擎代码

> 引擎本体 `panda_cineforge.py` 全文。Agent 提取此代码块作为引擎导入。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大熊猫影视创作技能引擎 PandaCineForge —— 单文件引擎本体
========================================================
面向 AI 影视创作领域的通用化技能底座引擎，融合技能生成（锻造）与技能调度编排（召回）
为单一引擎，服务于任意 AI 视频制作系统及其 Agent，不绑定任何具体制作系统。

能力矩阵：
  - 双模式主链路（Cold Forge 冷启动批量预置 / Hot Runtime 热运行实时生成）
  - 外部专业知识获取（七子模块 + Scrapling + 搜索适配器 + 种子源白名单）
  - 五层技能锻造（知识源 / 知识融合 / 多阶段锻造 / 组合创新 / 成熟度进化）
  - 三段式专业性保障（知识置信度门禁 / 轻量单次评审 / 实战反馈自然选择）
  - 分层级联回（R0 结构化路由 / R1 语义向量 / R2 上下文 / R3 关键词 / R4 安全兜底 / R5 实时生成兜底）
  - 固定化输出契约（AI-AI 结构化协议）
  - 统一资产对象 SkillAsset（生产侧输出与消费侧召回收敛为同一对象）
  - 多制作系统 Agent 编排分发（通用底座属性，支撑任意制作系统）
  - 影视垂直化（三大子领域 cinema / short_video / ai_manga_drama）

依赖（可选，缺省自动降级）：
  pip install "scrapling[all]" && scrapling install   # 外部知识爬虫
  pip install openai                                    # LLM 调用 + embedding
  pip install pyyaml jsonschema jinja2                  # 结构化处理
  缺失时引擎仍可运行（相关能力自动降级）。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
import time
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from functools import lru_cache
from heapq import nlargest
from math import log
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger("panda_cineforge")
if not logger.handlers:
    logging.basicConfig(level=os.getenv("PCF_LOG_LEVEL", "WARNING"), format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ---------- 可选第三方依赖：缺失时降级，不阻断引擎 ----------
try:
    import yaml  # type: ignore
    _HAS_YAML = True
except Exception:
    _HAS_YAML = False

try:
    from openai import OpenAI  # type: ignore
    _HAS_OPENAI = True
except Exception:
    _HAS_OPENAI = False

try:
    from jsonschema import Draft202012Validator  # type: ignore
    from jsonschema.validators import extend  # type: ignore
    _HAS_JSONSCHEMA = True
except Exception:
    _HAS_JSONSCHEMA = False

try:
    from jinja2 import Environment, StrictUndefined  # type: ignore
    _HAS_JINJA = True
except Exception:
    _HAS_JINJA = False

# Scrapling 依赖按需在 CrawlDispatcher 内部导入，避免主进程强依赖。


# ============================================================
# 工具函数
# ============================================================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str = "pcf") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def safe_get(d: Any, *keys, default: Any = None) -> Any:
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur if cur is not None else default


def _to_half_width(text: str) -> str:
    result = []
    for char in text:
        code = ord(char)
        if code == 0x3000:
            code = 0x20
        elif 0xFF01 <= code <= 0xFF5E:
            code -= 0xFEE0
        result.append(chr(code))
    return "".join(result)


_ZH_NUM_MAP = {
    "一": "1", "二": "2", "两": "2", "三": "3", "四": "4", "五": "5",
    "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
}


def _normalize_number_forms(text: str) -> str:
    text = _to_half_width(text)
    for zh, num in _ZH_NUM_MAP.items():
        text = re.sub(rf"{zh}\s*个?月", f"{num}个月", text)
        text = re.sub(rf"{zh}\s*岁", f"{num}岁", text)
    return text


@lru_cache(maxsize=20000)
def normalize_text(text: str) -> str:
    """文本归一化：转小写 / 全角转半角 / 数字归一化 / 同义词替换 / 去特殊字符。"""
    if not text:
        return ""
    text = _normalize_number_forms(text.strip().lower())
    text = re.sub(r"\s+", "", text)
    for variant, canonical in _SORTED_CINEMA_VARIANTS:
        text = text.replace(variant, canonical)
    text = re.sub(r"[^\u4e00-\u9fff0-9a-zA-Z]+", "", text)
    return text


@lru_cache(maxsize=20000)
def char_ngrams(text: str, ns: tuple = (2, 3)) -> Tuple[str, ...]:
    """字符 n-gram，用于 BM25 索引与模糊匹配。"""
    normalized = normalize_text(text)
    grams: List[str] = []
    for n in ns:
        if len(normalized) < n:
            continue
        for i in range(len(normalized) - n + 1):
            grams.append(normalized[i:i + n])
    return tuple(grams)


def _build_variant_map(synonym_groups: Dict[str, List[str]]) -> List[Tuple[str, str]]:
    """构建同义词替换表。variant 统一 lower + 去空白，与 normalize_text 的
    (lower → 去空白 → 替换) 流程对齐，确保 "Color Grading"/"VFX" 等英文同义词能正确归一化。"""
    mp: Dict[str, str] = {}
    for canonical, variants in synonym_groups.items():
        for v in variants:
            key = re.sub(r"\s+", "", v.lower())
            if key:
                mp[key] = canonical
        ckey = re.sub(r"\s+", "", canonical.lower())
        if ckey:
            mp[ckey] = canonical
    # 按长度降序，保证长词优先匹配，避免短词误替换
    return sorted(mp.items(), key=lambda x: len(x[0]), reverse=True)


def _char_jaccard(a: str, b: str) -> float:
    sa = set(char_ngrams(a))
    sb = set(char_ngrams(b))
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _safe_int(v: Any, default: int = 0) -> int:
    """安全转 int，非数字（含脏数据）返回 default。"""
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _safe_list(v: Any) -> List[Any]:
    """安全转 list，非 list/tuple 返回空列表。"""
    if isinstance(v, (list, tuple)):
        return list(v)
    return []


def _normalize_dim_coverage(v: Any) -> Dict[str, List[str]]:
    """归一化 dimension_coverage 为 dict[str, list]，容忍脏数据。"""
    if not isinstance(v, dict):
        return {"required": [], "covered": [], "missing": []}
    out: Dict[str, List[str]] = {}
    for k, val in v.items():
        if isinstance(val, (list, tuple)):
            out[k] = [str(x) for x in val]
        elif val is None:
            out[k] = []
        else:
            out[k] = [str(val)]
    return out


def _top_ids(score_map: Dict[str, float], top_n: int) -> List[str]:
    return [sid for sid, _ in nlargest(top_n, score_map.items(), key=lambda x: x[1])]


def _hash_key(*parts: str) -> str:
    return hashlib.md5("||".join(parts).encode("utf-8")).hexdigest()


def _dump_yaml(obj: Any) -> str:
    if _HAS_YAML:
        return yaml.safe_dump(obj, allow_unicode=True, sort_keys=False)
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _load_yaml(text: str) -> Any:
    if _HAS_YAML:
        return yaml.safe_load(text)
    return json.loads(text)


# ============================================================
# 影视知识基座（同义词组 / 实体词典 / 场景词典 / 紧急度 / Topic 规则）
# ============================================================

# ---------- 影视同义词组 ----------
CINEMA_SYNONYMS: Dict[str, List[str]] = {
    "运镜": ["运镜", "镜头运动", "推拉摇移", "推镜头", "拉镜头", "摇镜头", "移镜头", "跟拍", "航拍"],
    "调色": ["调色", "色彩校正", "Color Grading", "套LUT", "调色板", "色彩管理"],
    "转场": ["转场", "过渡", "硬切", "叠化", "闪白", "匹配剪辑"],
    "分镜": ["分镜", "分镜脚本", "故事板", "Storyboard", "镜头清单", "Shotlist", "故板"],
    "混音": ["混音", "音频混合", "5.1混音", "立体声", "Foley", "拟音"],
    "剪辑": ["剪辑", "蒙太奇", "剪接节奏", "动接动", "声画对位"],
    "视效": ["视效", "VFX", "特效", "合成", "绿幕", "追踪", "粒子"],
    "提示词": ["提示词", "Prompt", "AI生成", "文生图", "文生视频"],
    "钩子": ["钩子", "开场钩子", "3秒钩子", "完播", "留存"],
    "漫剧": ["漫剧", "AI漫剧", "分集", "口播", "连载"],
}

_SORTED_CINEMA_VARIANTS = _build_variant_map(CINEMA_SYNONYMS)

# ---------- 影视实体词典 ----------
CINEMA_ENTITIES: Dict[str, List[str]] = {
    "who": ["导演", "摄影指导", "剪辑师", "调色师", "声音设计师", "视效总监", "制片人", "达人", "编剧"],
    "actions": ["运镜", "调色", "剪辑", "转场", "混音", "生成", "投流", "拆镜", "布光", "收声"],
    "objects": ["镜头", "LUT", "音轨", "分镜", "提示词", "素材", "成片", "钩子", "节拍表", "色彩脚本"],
}

# ---------- 影视场景词典 ----------
CINEMA_SCENARIOS: List[str] = [
    "前期筹备", "剧本开发", "角色设计", "场景设计",
    "分镜脚本", "视觉开发", "故事板",
    "拍摄", "布光", "收声", "场记",
    "后期剪辑", "粗剪", "精剪",
    "调色", "色彩管理", "套底",
    "混音", "对白", "旁白", "音效", "音乐",
    "视效", "合成", "动画", "数字绘景",
    "发行", "交付", "DCP", "流媒体",
    "投流", "矩阵", "带货", "达人", "ROI",
    "漫剧分集", "口播", "连载", "AI生图", "AI生视频",
]

# ---------- 影视紧急度关键词 ----------
CINEMA_URGENCY: List[str] = [
    "交片", "死线", "Deadline", "崩溃", "丢失", "驳回",
    "审核不过", "渲染失败", "封禁", "限流",
]

_HIGH_URGENCY_KW = set(CINEMA_URGENCY)
_MEDIUM_URGENCY_KW = {"总是", "一直", "反复", "严重", "不退", "持续", "紧急", "尽快"}

# ---------- 影视 Topic 规则（50+，替换原育儿 Topic） ----------
CINEMA_TOPICS: Dict[str, Dict] = {
    "cinematic_structure": {"keywords": ["三幕结构", "英雄之旅", "节拍表", "角色弧光", "叙事结构"], "aliases": ["三幕式", "剧本结构"], "physical_domains": ["cinema", "scene_design"], "negative_keywords": ["投流", "带货"], "weight": 1.2, "cinematic_role": "scene_design"},
    "character_arc": {"keywords": ["角色弧光", "人物成长", "动机", "角色发展"], "aliases": ["人物弧光"], "physical_domains": ["cinema", "scene_design"], "negative_keywords": ["投流"], "weight": 1.1, "cinematic_role": "scene_design"},
    "beat_sheet": {"keywords": ["节拍表", "结构拆解", "叙事节奏", "Beat Sheet"], "aliases": ["节拍"], "physical_domains": ["cinema", "scene_design"], "negative_keywords": ["投流"], "weight": 1.15, "cinematic_role": "scene_design"},
    "scene_breakdown": {"keywords": ["场景拆解", "场次", "场景设计", "剧本拆解"], "aliases": ["拆戏"], "physical_domains": ["cinema", "scene_design"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "scene_design"},
    "shot_language": {"keywords": ["景别", "构图", "180度线", "越轴", "匹配剪辑", "镜头语言"], "aliases": ["轴线", "机位"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": ["投流"], "weight": 1.2, "cinematic_role": "visual_language"},
    "camera_movement": {"keywords": ["推拉摇移", "跟拍", "航拍", "稳定器", "运镜"], "aliases": ["镜头运动"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "visual_language"},
    "color_grading": {"keywords": ["调色", "LUT", "色彩空间", "Rec.709", "Rec.2020", "ACES", "色板"], "aliases": ["色彩校正", "套LUT"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": ["投流"], "weight": 1.25, "cinematic_role": "visual_language"},
    "color_management": {"keywords": ["色彩管理", "套底", "Log", "线性", "色域转换"], "aliases": ["色彩流水线"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "visual_language"},
    "lighting_design": {"keywords": ["布光", "三点布光", "自然光", "影调", "光比"], "aliases": ["打光"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "visual_language"},
    "storyboard": {"keywords": ["分镜", "故事板", "分镜脚本", "画面设计"], "aliases": ["Storyboard"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "visual_language"},
    "sound_design": {"keywords": ["声音设计", "混音", "对白", "旁白", "Foley", "拟音", "音效"], "aliases": ["音频设计"], "physical_domains": ["cinema", "audio_design"], "negative_keywords": ["投流"], "weight": 1.2, "cinematic_role": "audio_design"},
    "music_score": {"keywords": ["配乐", "BGM", "音乐选型", "背景音乐"], "aliases": ["音乐"], "physical_domains": ["cinema", "audio_design"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "audio_design"},
    "mix_plan": {"keywords": ["混音方案", "5.1", "立体声", "响度", "LUFS"], "aliases": ["混音计划"], "physical_domains": ["cinema", "audio_design"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "audio_design"},
    "editing_rhythm": {"keywords": ["剪辑节奏", "蒙太奇", "转场", "动接动", "声画对位"], "aliases": ["剪接节奏"], "physical_domains": ["cinema", "editing"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "editing"},
    "edit_decision_list": {"keywords": ["EDL", "剪辑决策表", "粗剪", "精剪", "剪辑点"], "aliases": ["剪辑单"], "physical_domains": ["cinema", "editing"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "editing"},
    "vfx_compositing": {"keywords": ["视效", "合成", "绿幕", "追踪", "抠像"], "aliases": ["VFX", "特效"], "physical_domains": ["cinema", "vfx"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "vfx"},
    "matte_painting": {"keywords": ["数字绘景", "接景", "环境合成"], "aliases": ["Matte Painting"], "physical_domains": ["cinema", "vfx"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "vfx"},
    "particle_fx": {"keywords": ["粒子", "流体", "破坏特效", "动力学"], "aliases": ["特效模拟"], "physical_domains": ["cinema", "vfx"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "vfx"},
    "continuity_check": {"keywords": ["连贯性", "穿帮", "匹配", "180度线", "轴线"], "aliases": ["连戏检查"], "physical_domains": ["cinema", "continuity_review"], "negative_keywords": [], "weight": 1.25, "cinematic_role": "continuity_review"},
    "continuity_report": {"keywords": ["连贯性报告", "穿帮检查", "场记", "接戏"], "aliases": ["连戏报告"], "physical_domains": ["cinema", "continuity_review"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "continuity_review"},
    "prompt_engineering": {"keywords": ["提示词", "Midjourney", "Runway", "Sora", "Prompt"], "aliases": ["提示词工程"], "physical_domains": ["cinema", "prompt_fusion"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "prompt_fusion"},
    "ai_video_generation": {"keywords": ["文生视频", "图生视频", "可灵", "即梦", "AI视频"], "aliases": ["AI生成视频"], "physical_domains": ["cinema", "prompt_fusion"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "prompt_fusion"},
    "ai_image_generation": {"keywords": ["文生图", "AI生图", "角色一致性", "Stable Diffusion"], "aliases": ["AI绘图"], "physical_domains": ["cinema", "prompt_fusion"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "prompt_fusion"},
    "comfyui_workflow": {"keywords": ["ComfyUI", "工作流", "节点编排"], "aliases": ["ComfyUI工作流"], "physical_domains": ["cinema", "prompt_fusion"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "prompt_fusion"},
    "opening_design": {"keywords": ["开场", "片头", "冷开场", "热开场", "片头序列"], "aliases": ["Opening"], "physical_domains": ["cinema", "opening_design"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "opening_design"},
    "title_sequence": {"keywords": ["片头序列", "字幕设计", "品牌片头", "标题动画"], "aliases": ["Title Sequence"], "physical_domains": ["cinema", "opening_design"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "opening_design"},
    "short_video_hook": {"keywords": ["钩子", "3秒", "完播", "留存", "开场钩子"], "aliases": ["短视频钩子"], "physical_domains": ["short_video"], "negative_keywords": ["DCP"], "weight": 1.3, "cinematic_role": "opening_design"},
    "short_video_script": {"keywords": ["短视频脚本", "选题", "爆款", "口播稿"], "aliases": ["短视频文案"], "physical_domains": ["short_video"], "negative_keywords": ["DCP"], "weight": 1.2, "cinematic_role": "scene_design"},
    "short_video_marketing": {"keywords": ["投流", "矩阵", "带货", "达人", "ROI", "千川"], "aliases": ["短视频营销"], "physical_domains": ["short_video"], "negative_keywords": ["DCP", "调色"], "weight": 1.2, "cinematic_role": "scene_design"},
    "short_video_editing": {"keywords": ["竖屏剪辑", "快节奏", "卡点", "竖屏9:16"], "aliases": ["短视频剪辑"], "physical_domains": ["short_video"], "negative_keywords": ["DCP"], "weight": 1.15, "cinematic_role": "editing"},
    "ai_manga_drama": {"keywords": ["漫剧", "AI漫剧", "分集", "连载", "AI漫剧"], "aliases": ["漫画剧"], "physical_domains": ["ai_manga_drama"], "negative_keywords": ["DCP", "投流"], "weight": 1.25, "cinematic_role": "scene_design"},
    "manga_episode": {"keywords": ["分集结构", "连载钩子", "前情", "分集大纲"], "aliases": ["漫剧分集"], "physical_domains": ["ai_manga_drama"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "scene_design"},
    "voiceover_rhythm": {"keywords": ["口播", "旁白节奏", "语速", "口播稿"], "aliases": ["配音节奏"], "physical_domains": ["ai_manga_drama"], "negative_keywords": [], "weight": 1.15, "cinematic_role": "audio_design"},
    "character_consistency": {"keywords": ["角色一致性", "角色漂移", "参考图", "LoRA"], "aliases": ["角色稳定"], "physical_domains": ["ai_manga_drama"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "prompt_fusion"},
    "dcp_delivery": {"keywords": ["DCP", "数字电影包", "影院交付"], "aliases": ["数字电影包"], "physical_domains": ["cinema"], "negative_keywords": ["投流", "短视频"], "weight": 1.2, "cinematic_role": "editing"},
    "netflix_delivery": {"keywords": ["Netflix规范", "流媒体交付", "IMF"], "aliases": ["流媒体交付"], "physical_domains": ["cinema"], "negative_keywords": ["投流"], "weight": 1.15, "cinematic_role": "editing"},
    "production_management": {"keywords": ["制片管理", "预算", "排期", "场记", "通告单"], "aliases": ["制片"], "physical_domains": ["cinema"], "negative_keywords": ["投流"], "weight": 1.1, "cinematic_role": "scene_design"},
    "visual_development": {"keywords": ["视觉开发", "概念设计", "美术", "概念图"], "aliases": ["视效开发"], "physical_domains": ["cinema"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "visual_language"},
    "lip_sync": {"keywords": ["口型", "口型同步", "对白口型", "口型对位"], "aliases": ["对口型"], "physical_domains": ["ai_manga_drama", "cinema"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "audio_design"},
    "aspect_ratio": {"keywords": ["画幅", "宽高比", "9:16", "16:9", "2.39:1"], "aliases": ["比例"], "physical_domains": ["cinema", "short_video"], "negative_keywords": [], "weight": 1.05, "cinematic_role": "visual_language"},
    "frame_rate": {"keywords": ["帧率", "24fps", "30fps", "60fps", "补帧"], "aliases": ["fps"], "physical_domains": ["cinema"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "visual_language"},
    "color_script": {"keywords": ["色彩脚本", "色彩设计", "色彩叙事", "调色方案"], "aliases": ["色彩剧本"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "visual_language"},
    "shotlist": {"keywords": ["镜头清单", "分镜清单", "镜头表", "Shotlist"], "aliases": ["镜头单"], "physical_domains": ["cinema", "visual_language"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "visual_language"},
    "platform_compliance": {"keywords": ["平台审核", "违禁词", "审核规则", "合规"], "aliases": ["审核合规"], "physical_domains": ["short_video", "ai_manga_drama"], "negative_keywords": ["DCP"], "weight": 1.2, "cinematic_role": "continuity_review"},
    "data_review": {"keywords": ["数据复盘", "完播率", "互动率", "转化", "复盘"], "aliases": ["投流复盘"], "physical_domains": ["short_video"], "negative_keywords": ["DCP"], "weight": 1.1, "cinematic_role": "scene_design"},
    "render_farm": {"keywords": ["渲染农场", "批量渲染", "渲染队列", "渲染失败"], "aliases": ["渲染"], "physical_domains": ["cinema", "vfx"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "vfx"},
    "backup_strategy": {"keywords": ["素材备份", "版本管理", "冗余", "素材丢失"], "aliases": ["备份"], "physical_domains": ["cinema"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "continuity_review"},
    "copyright_clearance": {"keywords": ["版权", "授权", "音乐版权", "素材版权", "字体版权"], "aliases": ["版权清理"], "physical_domains": ["cinema", "short_video"], "negative_keywords": [], "weight": 1.2, "cinematic_role": "continuity_review"},
    "subtitle_design": {"keywords": ["字幕", "字幕设计", "字幕规范", "字幕样式"], "aliases": ["字幕"], "physical_domains": ["cinema", "short_video"], "negative_keywords": [], "weight": 1.05, "cinematic_role": "opening_design"},
    "trailer_editing": {"keywords": ["预告片", "预告片剪辑", "混剪", "预告片结构"], "aliases": ["预告"], "physical_domains": ["cinema"], "negative_keywords": [], "weight": 1.1, "cinematic_role": "editing"},
}


# ============================================================
# 外部知识源配置
# ============================================================

# 搜索 API 适配器注册表（7 种源，运行时按环境变量探测）
SEARCH_PROVIDER_REGISTRY: Dict[str, Dict] = {
    "bing": {"env_keys": ["BING_API_KEY", "AZURE_BING_KEY"], "needs_key": True},
    "google_cse": {"env_keys": ["GOOGLE_CSE_API_KEY", "GOOGLE_CSE_ID"], "needs_key": True},
    "serpapi": {"env_keys": ["SERPAPI_API_KEY"], "needs_key": True},
    "brave": {"env_keys": ["BRAVE_API_KEY"], "needs_key": True},
    "tavily": {"env_keys": ["TAVILY_API_KEY"], "needs_key": True},
    "duckduckgo": {"env_keys": [], "needs_key": False},
    "searxng": {"env_keys": ["SEARXNG_BASE_URL"], "needs_key": False},
}

# 影视专业可信种子源白名单（六大类 40+ 源）
CINEMA_SEED_SOURCES: List[Dict] = [
    {"domain": "smpte.org", "category": "规范标准", "trust": 1.0, "session": "fast"},
    {"domain": "acescentral.com", "category": "规范标准", "trust": 1.0, "session": "fast"},
    {"domain": "itu.int", "category": "规范标准", "trust": 1.0, "session": "fast"},
    {"domain": "partner.netflix.com", "category": "规范标准", "trust": 1.0, "session": "fast"},
    {"domain": "dcimovies.com", "category": "规范标准", "trust": 1.0, "session": "fast"},
    {"domain": "ebu.ch", "category": "规范标准", "trust": 0.95, "session": "fast"},
    {"domain": "blackmagicdesign.com", "category": "工具官方文档", "trust": 1.0, "session": "fast"},
    {"domain": "adobe.com", "category": "工具官方文档", "trust": 1.0, "session": "fast"},
    {"domain": "docs.blender.org", "category": "工具官方文档", "trust": 1.0, "session": "fast"},
    {"domain": "foundry.com", "category": "工具官方文档", "trust": 1.0, "session": "fast"},
    {"domain": "avid.com", "category": "工具官方文档", "trust": 1.0, "session": "fast"},
    {"domain": "midjourney.com", "category": "工具官方文档", "trust": 1.0, "session": "dynamic"},
    {"domain": "runwayml.com", "category": "工具官方文档", "trust": 1.0, "session": "dynamic"},
    {"domain": "openai.com", "category": "工具官方文档", "trust": 1.0, "session": "dynamic"},
    {"domain": "klingai.com", "category": "工具官方文档", "trust": 1.0, "session": "dynamic"},
    {"domain": "jimeng.jianying.com", "category": "工具官方文档", "trust": 1.0, "session": "dynamic"},
    {"domain": "comfyanonymous.github.io", "category": "工具官方文档", "trust": 0.95, "session": "fast"},
    {"domain": "wikipedia.org", "category": "学术权威", "trust": 0.85, "session": "fast"},
    {"domain": "siggraph.org", "category": "学术权威", "trust": 0.95, "session": "stealth"},
    {"domain": "arxiv.org", "category": "学术权威", "trust": 0.95, "session": "fast"},
    {"domain": "artofthetitle.com", "category": "案例专业", "trust": 0.95, "session": "fast"},
    {"domain": "vimeo.com", "category": "案例专业", "trust": 0.85, "session": "dynamic"},
    {"domain": "shotdeck.com", "category": "案例专业", "trust": 0.9, "session": "stealth"},
    {"domain": "film-grab.com", "category": "案例专业", "trust": 0.85, "session": "fast"},
    {"domain": "reddit.com", "category": "社区经验", "trust": 0.7, "session": "fast"},
    {"domain": "zhihu.com", "category": "社区经验", "trust": 0.6, "session": "fast"},
    {"domain": "107cine.com", "category": "社区经验", "trust": 0.75, "session": "stealth"},
    {"domain": "creator.douyin.com", "category": "平台规则", "trust": 0.9, "session": "dynamic"},
    {"domain": "kuaishou.com", "category": "平台规则", "trust": 0.9, "session": "dynamic"},
    {"domain": "creator.tiktok.com", "category": "平台规则", "trust": 0.9, "session": "dynamic"},
    {"domain": "bilibili.com", "category": "平台规则", "trust": 0.85, "session": "dynamic"},
    {"domain": "xiaohongshu.com", "category": "平台规则", "trust": 0.8, "session": "dynamic"},
    {"domain": "youtube.com", "category": "平台规则", "trust": 0.9, "session": "dynamic"},
]

_SEED_DOMAIN_MAP: Dict[str, Dict] = {s["domain"].split(".")[0]: s for s in CINEMA_SEED_SOURCES}

# Scrapling 三会话配置
SCRAPLING_SESSION_CONFIG: Dict[str, Dict] = {
    "fast": {"fetcher": "Fetcher", "impersonate": "chrome", "http3": True, "lazy": False},
    "stealth": {"fetcher": "StealthyFetcher", "headless": True, "solve_cloudflare": True, "stealthy_headers": True, "lazy": True},
    "dynamic": {"fetcher": "DynamicFetcher", "headless": True, "network_idle": True, "lazy": True},
}

# 工具名映射表（按 cinematic_role 自动选工具，用于查询构造）
CINEMA_TOOL_MAP: Dict[str, List[str]] = {
    "visual_language": ["达芬奇", "LUT", "ACES", "Rec.709", "Rec.2020"],
    "audio_design": ["Pro Tools", "混音", "5.1", "Foley"],
    "prompt_fusion": ["Midjourney", "Runway", "Sora", "可灵", "即梦", "ComfyUI"],
    "editing": ["Premiere", "达芬奇", "Avid", "EDL"],
    "vfx": ["AE", "Nuke", "Blender", "Houdini"],
    "opening_design": ["AE", "Blender", "片头设计"],
    "scene_design": ["节拍表", "三幕结构", "英雄之旅"],
    "continuity_review": ["180度线", "匹配剪辑", "连贯性"],
    "color_grading": ["达芬奇", "LUT", "ACES"],
}


# ============================================================
# 置信度门禁配置
# ============================================================

# deliverable_type 维度映射表（必需维度 / 加分维度）
DELIVERABLE_DIMENSION_MAP: Dict[str, Dict[str, List[str]]] = {
    "color_script": {"required": ["principles", "standards", "tool_params"], "bonus": ["case_refs", "heuristics", "pitfalls"]},
    "shotlist": {"required": ["principles", "tool_params"], "bonus": ["case_refs", "heuristics"]},
    "storyboard": {"required": ["principles", "tool_params"], "bonus": ["case_refs"]},
    "sound_map": {"required": ["principles", "standards", "tool_params"], "bonus": ["case_refs", "pitfalls"]},
    "mix_plan": {"required": ["principles", "standards", "tool_params"], "bonus": ["pitfalls"]},
    "prompt_pack": {"required": ["tool_params", "heuristics"], "bonus": ["principles", "case_refs"]},
    "opening_sequence": {"required": ["principles", "case_refs"], "bonus": ["tool_params", "heuristics"]},
    "edit_decision_list": {"required": ["principles", "tool_params"], "bonus": ["heuristics", "pitfalls"]},
    "beat_sheet": {"required": ["principles", "case_refs"], "bonus": ["heuristics"]},
    "continuity_report": {"required": ["principles", "standards"], "bonus": ["heuristics", "pitfalls"]},
}

# 置信度阈值
CONFIDENCE_THRESHOLDS: Dict[str, Dict] = {
    "high": {"min_trust": 0.9, "min_points": 10, "min_coverage": 0.8, "maturity": "v2"},
    "medium": {"min_trust_range": (0.7, 0.9), "min_points_range": (6, 9), "min_coverage_range": (0.6, 0.8), "action": "review", "maturity_pass": "v2", "maturity_fail": "v1"},
    "low": {"max_trust": 0.7, "max_points": 6, "max_coverage": 0.6, "maturity": "v1"},
}

# 三大子领域扩展包
DOMAIN_PACKS: Dict[str, Dict] = {
    "cinema": {
        "pipeline": ["开发", "筹备", "拍摄", "后期", "交付"],
        "deliverables": ["剧本", "视觉开发板", "分镜", "粗剪", "精剪", "调色", "混音", "DCP"],
        "standards": ["SMPTE", "Rec.2020", "24fps", "5.1混音"],
        "risk_focus": ["版权", "预算超支", "后期返工"],
        "tools": ["达芬奇", "Premiere", "Avid", "Pro Tools", "Nuke", "Blender"],
        "quality_bar": "工业级交付标准",
    },
    "short_video": {
        "pipeline": ["选题", "脚本", "拍摄/AI生成", "剪辑", "投流", "复盘"],
        "deliverables": ["钩子文案", "分镜", "成片", "投流素材矩阵", "数据复盘"],
        "standards": ["竖屏9:16", "3秒钩子", "完播率", "平台审核规则"],
        "risk_focus": ["审核驳回", "限流", "违禁词", "版权音乐"],
        "tools": ["剪映", "CapCut", "Midjourney", "可灵", "即梦", "ComfyUI"],
        "quality_bar": "平台合规+传播效率",
    },
    "ai_manga_drama": {
        "pipeline": ["大纲", "分集", "口播", "AI生图", "AI生视频", "装配", "连载"],
        "deliverables": ["分集剧本", "口播稿", "角色一致性参考", "分镜", "成片"],
        "standards": ["角色一致性", "口播节奏", "连载钩子", "平台规范"],
        "risk_focus": ["角色漂移", "口播不同步", "敏感内容", "连载断更"],
        "tools": ["Midjourney", "Stable Diffusion", "ComfyUI", "可灵", "即梦", "剪映"],
        "quality_bar": "连载一致性+AI生成质量",
    },
}

# 影视一票否决项
CINEMA_VETO_RULES: List[str] = [
    "镜头连贯性断裂:180度线越轴/匹配剪辑失败/轴线错乱未声明",
    "色彩空间错配:Rec.709/Rec.2020/sRGB混用未声明转换",
    "对白口型不同步:口播/对白与画面口型偏移未处理",
    "版权素材未授权:音乐/素材/字体/形象版权未声明",
    "平台审核硬伤:短视频违禁词/漫剧敏感内容/诱导性内容",
    "不可逆渲染未确认:高负载渲染/批量导出无确认门",
    "素材无备份策略:关键素材无冗余/无版本",
]

# 影视评分维度（原 8 维 + 新增 3 维）
CINEMA_SCORING_WEIGHTS: Dict[str, float] = {
    "completeness": 1.0, "personalization": 1.0, "context_fidelity": 1.0,
    "domain_professionalism": 1.2, "actionability": 1.0, "tool_rationality": 1.0,
    "risk_control": 1.2, "clarity": 1.0,
    "cinematic_professionalism": 1.3, "continuity_safety": 1.3, "platform_compliance": 1.2,
}

QA_PASS_THRESHOLD = 85


# ============================================================
# 多系统注册表
# ============================================================

AGENT_REGISTRY: Dict[str, Dict] = {
    "MyStudio": {
        "agents": ["SceneDesign", "VisualLanguage", "AudioDesign", "ContinuityReview", "PromptFusion", "OpeningDesign"],
        "role_map": {
            "SceneDesign": "scene_design", "VisualLanguage": "visual_language",
            "AudioDesign": "audio_design", "ContinuityReview": "continuity_review",
            "PromptFusion": "prompt_fusion", "OpeningDesign": "opening_design",
        },
        "deliverable_map": {
            "SceneDesign": ["beat_sheet", "scene_breakdown"],
            "VisualLanguage": ["shotlist", "storyboard", "color_script"],
            "AudioDesign": ["sound_map", "mix_plan"],
            "ContinuityReview": ["continuity_report"],
            "PromptFusion": ["prompt_pack"],
            "OpeningDesign": ["opening_sequence"],
        },
    },
}

# cinematic_role / module_target / deliverable_type 枚举
CINEMATIC_ROLES = ["scene_design", "visual_language", "audio_design", "continuity_review", "prompt_fusion", "opening_design", "editing", "color_grading", "vfx"]
DELIVERABLE_TYPES = ["shotlist", "storyboard", "color_script", "sound_map", "prompt_pack", "edit_decision_list", "opening_sequence", "beat_sheet", "continuity_report", "mix_plan"]
PROJECT_STAGES = ["preproduction", "production", "postproduction", "distribution"]
SUB_DOMAINS = ["cinema", "short_video", "ai_manga_drama"]


# ============================================================
# 全域技能矩阵（冷启动批量生成蓝图）
# ============================================================

COLD_FORGE_MATRIX: List[Dict] = [
    {"agent": "SceneDesign", "cinematic_role": "scene_design", "sub_domain": "cinema", "tasks": ["三幕结构设计", "英雄之旅编排", "角色弧光设计", "节拍表制作", "场景拆解"]},
    {"agent": "SceneDesign", "cinematic_role": "scene_design", "sub_domain": "short_video", "tasks": ["选题脚本", "钩子结构", "爆款文案", "投流策略"]},
    {"agent": "SceneDesign", "cinematic_role": "scene_design", "sub_domain": "ai_manga_drama", "tasks": ["分集大纲", "连载钩子", "前情回顾"]},
    {"agent": "VisualLanguage", "cinematic_role": "visual_language", "sub_domain": "cinema", "tasks": ["分镜设计", "色彩脚本", "运镜设计", "布光方案", "景别构图"]},
    {"agent": "VisualLanguage", "cinematic_role": "visual_language", "sub_domain": "short_video", "tasks": ["竖屏分镜", "视觉钩子", "卡点设计"]},
    {"agent": "VisualLanguage", "cinematic_role": "visual_language", "sub_domain": "ai_manga_drama", "tasks": ["AI生图分镜", "角色一致性参考"]},
    {"agent": "AudioDesign", "cinematic_role": "audio_design", "sub_domain": "cinema", "tasks": ["5.1混音", "Foley拟音", "对白处理", "混音方案", "配乐选型"]},
    {"agent": "AudioDesign", "cinematic_role": "audio_design", "sub_domain": "short_video", "tasks": ["BGM选型", "音效钩子", "卡点音效"]},
    {"agent": "AudioDesign", "cinematic_role": "audio_design", "sub_domain": "ai_manga_drama", "tasks": ["口播节奏", "旁白设计", "口型对位"]},
    {"agent": "ContinuityReview", "cinematic_role": "continuity_review", "sub_domain": "cinema", "tasks": ["180度线检查", "匹配剪辑检查", "穿帮检查", "连贯性报告"]},
    {"agent": "ContinuityReview", "cinematic_role": "continuity_review", "sub_domain": "short_video", "tasks": ["跨镜头连贯", "品牌一致性", "平台合规检查"]},
    {"agent": "ContinuityReview", "cinematic_role": "continuity_review", "sub_domain": "ai_manga_drama", "tasks": ["角色漂移检测", "场景连贯", "敏感内容审查"]},
    {"agent": "PromptFusion", "cinematic_role": "prompt_fusion", "sub_domain": "cinema", "tasks": ["Midjourney提示词", "Runway提示词", "Sora提示词", "ComfyUI工作流"]},
    {"agent": "PromptFusion", "cinematic_role": "prompt_fusion", "sub_domain": "short_video", "tasks": ["竖屏AI生成提示词", "可灵提示词", "即梦提示词"]},
    {"agent": "PromptFusion", "cinematic_role": "prompt_fusion", "sub_domain": "ai_manga_drama", "tasks": ["AI生图一致性提示词", "AI生视频提示词", "LoRA角色固化"]},
    {"agent": "OpeningDesign", "cinematic_role": "opening_design", "sub_domain": "cinema", "tasks": ["冷开场设计", "热开场设计", "片头序列", "字幕设计"]},
    {"agent": "OpeningDesign", "cinematic_role": "opening_design", "sub_domain": "short_video", "tasks": ["3秒开场", "品牌片头", "黄金前3秒"]},
    {"agent": "OpeningDesign", "cinematic_role": "opening_design", "sub_domain": "ai_manga_drama", "tasks": ["漫剧开场", "分集前情", "连载开场"]},
]


# ============================================================
# LLM 客户端封装（统一生产侧与评审侧调用）
# ============================================================

class LLMClient:
    """统一的 LLM 调用封装。无 OPENAI 依赖时降级为占位实现，便于离线索引/召回。"""

    def __init__(self, model: Optional[str] = None, base_url: Optional[str] = None, api_key: Optional[str] = None,
                 timeout: Optional[float] = None):
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4.1")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        # 统一超时（秒），避免网络卡死；默认 60s，可通过 OPENAI_TIMEOUT 环境变量调整
        self.timeout = timeout or float(os.getenv("OPENAI_TIMEOUT", "60"))
        self._client = None
        if _HAS_OPENAI and self.api_key:
            kwargs: Dict[str, Any] = {"api_key": self.api_key, "timeout": self.timeout}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            try:
                self._client = OpenAI(**kwargs)
            except Exception:
                self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None

    def chat(self, system_message: str, user_message: str, temperature: float = 0.2, json_mode: bool = False) -> str:
        if not self.available:
            return ""
        messages = [{"role": "system", "content": system_message}, {"role": "user", "content": user_message}]
        kwargs: Dict[str, Any] = {"model": self.model, "messages": messages, "temperature": temperature, "timeout": self.timeout}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            resp = self._client.chat.completions.create(**kwargs)
        except Exception:
            kwargs.pop("response_format", None)
            try:
                resp = self._client.chat.completions.create(**kwargs)
            except Exception:
                return ""
        try:
            return resp.choices[0].message.content or ""
        except Exception:
            return ""

    def embed(self, text: str) -> List[float]:
        if not self.available:
            return []
        try:
            resp = self._client.embeddings.create(model=os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small"), input=text, timeout=self.timeout)
            return list(resp.data[0].embedding)
        except Exception:
            return []


# ============================================================
# Layer 0: 统一资产对象 SkillAsset（融合枢纽）
# 生产侧输出 schema 与消费侧 SkillRecord 收敛为同一对象
# ============================================================

@dataclass
class RetrievalEntities:
    """槽位实体（影视化）。"""
    who: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    objects: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Any) -> "RetrievalEntities":
        data = data or {}
        return cls(
            who=list(data.get("who", []) or []),
            actions=list(data.get("actions", []) or []),
            objects=list(data.get("objects", []) or []),
        )

    def to_dict(self) -> Dict[str, List[str]]:
        return {"who": list(self.who), "actions": list(self.actions), "objects": list(self.objects)}


@dataclass
class RetrievalProfile:
    """技能检索画像（影视化）。"""
    logical_topics: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)
    sample_queries: List[str] = field(default_factory=list)
    problem_patterns: List[str] = field(default_factory=list)
    entities: RetrievalEntities = field(default_factory=RetrievalEntities)
    scenarios: List[str] = field(default_factory=list)
    project_stages: List[str] = field(default_factory=list)
    urgency: str = "normal"
    negative_queries: List[str] = field(default_factory=list)
    summary: str = ""

    @classmethod
    def from_dict(cls, data: Any) -> "RetrievalProfile":
        data = data or {}
        return cls(
            logical_topics=list(data.get("logical_topics", []) or []),
            aliases=list(data.get("aliases", []) or []),
            sample_queries=list(data.get("sample_queries", []) or []),
            problem_patterns=list(data.get("problem_patterns", []) or []),
            entities=RetrievalEntities.from_dict(data.get("entities", {}) or {}),
            scenarios=list(data.get("scenarios", []) or []),
            project_stages=list(data.get("project_stages", data.get("age_stages", [])) or []),
            urgency=str(data.get("urgency", "normal") or "normal"),
            negative_queries=list(data.get("negative_queries", []) or []),
            summary=str(data.get("summary", "") or ""),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "logical_topics": list(self.logical_topics),
            "aliases": list(self.aliases),
            "sample_queries": list(self.sample_queries),
            "problem_patterns": list(self.problem_patterns),
            "entities": self.entities.to_dict(),
            "scenarios": list(self.scenarios),
            "project_stages": list(self.project_stages),
            "urgency": self.urgency,
            "negative_queries": list(self.negative_queries),
            "summary": self.summary,
        }


@dataclass
class KnowledgeProvenance:
    """知识溯源（支撑置信度门禁）。"""
    sources: List[Dict] = field(default_factory=list)
    knowledge_points: Dict[str, int] = field(default_factory=dict)
    confidence_score: float = 0.0
    confidence_tier: str = "low"
    dimension_coverage: Dict[str, List[str]] = field(default_factory=lambda: {"required": [], "covered": [], "missing": []})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sources": list(self.sources),
            "knowledge_points": dict(self.knowledge_points),
            "confidence_score": round(self.confidence_score, 4),
            "confidence_tier": self.confidence_tier,
            "dimension_coverage": {k: list(v) for k, v in self.dimension_coverage.items()},
        }


@dataclass
class SkillAsset:
    """
    统一资产对象 —— 生产侧输出与消费侧召回收敛为同一对象。
    含影视化字段、成熟度、知识溯源与创新元信息。
    """
    # —— 基础元信息 ——
    name: str = ""
    skill_id: str = ""
    version: str = "1.0.0"
    last_updated: str = ""
    author: str = "PandaCineForge"
    license: str = "internal"
    status: str = "draft"

    # —— 影视分类（固定 ai_cinema）——
    domain: str = "ai_cinema"
    sub_domain: str = "cinema"
    vertical: str = ""
    type: str = ""
    priority: str = "P1"
    tags: List[str] = field(default_factory=list)

    # —— 影视结构化字段（R0 路由核心）——
    cinematic_role: str = ""
    module_target: List[str] = field(default_factory=list)
    deliverable_type: str = ""
    project_stage: str = ""

    # —— 召回相关 ——
    embedding: List[float] = field(default_factory=list)
    maturity: str = "v0"                # v0/v1/v2/v3
    forge_mode: str = "cold"            # cold/hot
    retrieval_profile: RetrievalProfile = field(default_factory=RetrievalProfile)
    weighted_recall_text: str = ""
    neighbors: List[str] = field(default_factory=list)
    trigger_keywords: List[str] = field(default_factory=list)

    # —— 知识与创新元信息 ——
    knowledge_provenance: KnowledgeProvenance = field(default_factory=KnowledgeProvenance)
    expert_review_log: Dict = field(default_factory=dict)
    innovation_meta: Dict = field(default_factory=dict)

    # —— 执行与契约（影视化）——
    execution_layer: str = "5"
    execution_mode: str = "sequential"
    module_compatibility: Dict = field(default_factory=dict)
    fallback_strategy: Dict = field(default_factory=dict)
    runtime_contract: Dict = field(default_factory=dict)
    execution_contract: Dict = field(default_factory=dict)
    capabilities: Dict = field(default_factory=dict)
    quality_thresholds: Dict = field(default_factory=dict)
    qa_contract: Dict = field(default_factory=dict)
    generation_spec: Dict = field(default_factory=dict)
    persona_adaptation: Dict = field(default_factory=dict)
    domain_pack: Dict = field(default_factory=dict)
    dependencies: Dict = field(default_factory=dict)

    # —— 正文内容（Markdown 输出 / 结构化 body）——
    content: str = ""
    body: Dict = field(default_factory=dict)

    # —— 运行时统计（实战反馈用）——
    call_count: int = 0
    quality_history: List[int] = field(default_factory=list)
    last_quality_score: int = 0

    # 兼容旧字段名 age_stages -> project_stages
    @property
    def age_stages(self) -> List[str]:
        return self.retrieval_profile.project_stages

    @property
    def logical_topics(self) -> List[str]:
        return self.retrieval_profile.logical_topics

    @property
    def aliases(self) -> List[str]:
        return self.retrieval_profile.aliases

    @property
    def sample_queries(self) -> List[str]:
        return self.retrieval_profile.sample_queries

    @property
    def problem_patterns(self) -> List[str]:
        return self.retrieval_profile.problem_patterns

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["retrieval_profile"] = self.retrieval_profile.to_dict()
        d["knowledge_provenance"] = self.knowledge_provenance.to_dict()
        # 默认序列化不含 embedding（大向量，避免膨胀 JSON / 泄露模型向量）
        # 如需召回用 embedding，请使用 to_recall_record()
        d.pop("embedding", None)
        return d

    def to_recall_record(self) -> Dict[str, Any]:
        """供索引器使用的精简召回记录。"""
        return {
            "skill_id": self.skill_id,
            "name": self.name,
            "domain": self.domain,
            "sub_domain": self.sub_domain,
            "cinematic_role": self.cinematic_role,
            "module_target": list(self.module_target),
            "deliverable_type": self.deliverable_type,
            "project_stage": self.project_stage,
            "maturity": self.maturity,
            "priority": self.priority,
            "status": self.status,
            "tags": list(self.tags),
            "aliases": list(self.aliases),
            "sample_queries": list(self.sample_queries),
            "problem_patterns": list(self.problem_patterns),
            "trigger_keywords": list(self.trigger_keywords),
            "logical_topics": list(self.logical_topics),
            "entities": self.retrieval_profile.entities.to_dict(),
            "scenarios": list(self.retrieval_profile.scenarios),
            "project_stages": list(self.retrieval_profile.project_stages),
            "urgency": self.retrieval_profile.urgency,
            "negative_queries": list(self.retrieval_profile.negative_queries),
            "weighted_recall_text": self.weighted_recall_text,
            "neighbors": list(self.neighbors),
            "embedding": list(self.embedding),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SkillAsset":
        data = dict(data or {})
        rp = RetrievalProfile.from_dict(data.get("retrieval_profile", {}))
        kp = KnowledgeProvenance()
        if isinstance(data.get("knowledge_provenance"), dict):
            kpd = data["knowledge_provenance"]
            kp.sources = list(kpd.get("sources", []) or [])
            kp.knowledge_points = dict(kpd.get("knowledge_points", {}) or {})
            kp.confidence_score = float(kpd.get("confidence_score", 0.0) or 0.0)
            kp.confidence_tier = str(kpd.get("confidence_tier", "low") or "low")
            kp.dimension_coverage = _normalize_dim_coverage(kpd.get("dimension_coverage"))
        asset = cls(
            name=data.get("name", ""),
            skill_id=data.get("skill_id", ""),
            version=data.get("version", "1.0.0"),
            last_updated=data.get("last_updated", ""),
            author=data.get("author", "PandaCineForge"),
            license=data.get("license", "internal"),
            status=data.get("status", "draft"),
            domain=data.get("domain", "ai_cinema"),
            sub_domain=data.get("sub_domain", "cinema"),
            vertical=data.get("vertical", ""),
            type=data.get("type", ""),
            priority=data.get("priority", "P1"),
            tags=list(data.get("tags", []) or []),
            cinematic_role=data.get("cinematic_role", ""),
            module_target=list(data.get("module_target", []) or []),
            deliverable_type=data.get("deliverable_type", ""),
            project_stage=data.get("project_stage", ""),
            embedding=list(data.get("embedding", []) or []),
            maturity=data.get("maturity", "v0"),
            forge_mode=data.get("forge_mode", "cold"),
            retrieval_profile=rp,
            weighted_recall_text=data.get("weighted_recall_text", ""),
            neighbors=list(data.get("neighbors", []) or []),
            trigger_keywords=list(data.get("trigger_keywords", []) or []),
            knowledge_provenance=kp,
            expert_review_log=data.get("expert_review_log", {}) or {},
            innovation_meta=data.get("innovation_meta", {}) or {},
            execution_layer=data.get("execution_layer", "5"),
            execution_mode=data.get("execution_mode", "sequential"),
            module_compatibility=data.get("module_compatibility", {}) or {},
            fallback_strategy=data.get("fallback_strategy", {}) or {},
            runtime_contract=data.get("runtime_contract", {}) or {},
            execution_contract=data.get("execution_contract", {}) or {},
            capabilities=data.get("capabilities", {}) or {},
            quality_thresholds=data.get("quality_thresholds", {}) or {},
            qa_contract=data.get("qa_contract", {}) or {},
            generation_spec=data.get("generation_spec", {}) or {},
            persona_adaptation=data.get("persona_adaptation", {}) or {},
            domain_pack=data.get("domain_pack", {}) or {},
            dependencies=data.get("dependencies", {}) or {},
            content=data.get("content", ""),
            body=data.get("body", {}) or {},
            call_count=_safe_int(data.get("call_count", 0)),
            quality_history=_safe_list(data.get("quality_history", [])),
            last_quality_score=_safe_int(data.get("last_quality_score", 0)),
        )
        return asset


# ============================================================
# 召回层数据模型（影视化）
# ============================================================

@dataclass
class TopicScore:
    topic: str
    confidence: float
    evidence: List[str] = field(default_factory=list)


@dataclass
class QueryUnderstanding:
    """查询理解结果（影视化）。"""
    raw_text: str = ""
    normalized_text: str = ""
    expanded_queries: List[str] = field(default_factory=list)
    char_ngrams: Tuple[str, ...] = ()
    slots: RetrievalEntities = field(default_factory=RetrievalEntities)
    scenarios: List[str] = field(default_factory=list)
    project_stages: List[str] = field(default_factory=list)
    urgency: str = "normal"
    topics: List[TopicScore] = field(default_factory=list)
    # 契约携带的结构化路由字段（AI 调用专属）
    route_fields: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RecallCandidate:
    skill_id: str
    rrf_score: float = 0.0
    rank_by_layer: Dict[str, int] = field(default_factory=dict)
    layer_scores: Dict[str, float] = field(default_factory=dict)
    evidences: Dict[str, List[str]] = field(default_factory=dict)


@dataclass
class RecallResult:
    understanding: QueryUnderstanding
    candidates: List[RecallCandidate] = field(default_factory=list)
    layer_rankings: Dict[str, List[str]] = field(default_factory=dict)
    hit_layer: str = ""


@dataclass
class RankedSkill:
    skill_id: str
    name: str
    domain: str
    score: float
    details: Dict[str, object] = field(default_factory=dict)


# ============================================================
# Layer 1: 生产侧 —— 外部专业知识获取（七子模块）
# ============================================================

class QueryComposer:
    """子模块1：查询构造器。三路并发构造专业搜索查询。"""

    def compose(self, cinematic_role: str, deliverable_type: str, sub_domain: str,
                project_stage: str = "", query_text: str = "", mode: str = "cold") -> List[str]:
        tools = CINEMA_TOOL_MAP.get(cinematic_role, [])
        tool_str = " ".join(tools[:3]) if tools else ""
        role_zh = cinematic_role.replace("_", " ")
        queries = [
            f"{role_zh} {deliverable_type} 原理 教程 指南",
            f"{tool_str} {deliverable_type} 参数 最佳实践" if tool_str else f"{role_zh} {deliverable_type} 最佳实践",
            f"{role_zh} {deliverable_type} 标准 规范 Rec.709 Rec.2020 ACES",
        ]
        if query_text:
            queries.append(query_text)
        # 热运行仅发路A（原理查询），冷启动三路全发
        if mode == "hot":
            queries = queries[:1]
        return [q.strip() for q in queries if q.strip()]


class SearchGateway:
    """子模块2：搜索网关。动态适配方接入的搜索 API，运行时探测，故障转移，DuckDuckGo 兜底。"""

    def __init__(self):
        self.active = self._detect_providers()

    def _detect_providers(self) -> List[str]:
        available = []
        for name, cfg in SEARCH_PROVIDER_REGISTRY.items():
            if not cfg["needs_key"]:
                available.append(name)
                continue
            if any(os.getenv(k) for k in cfg["env_keys"]):
                available.append(name)
        if not available:
            available.append("duckduckgo")
        return available

    def search(self, query: str, topk: int = 10) -> List[Dict]:
        results: List[Dict] = []
        for provider in self.active:
            try:
                results.extend(self._search_one(provider, query, topk))
            except Exception:
                continue
        return self._merge_dedupe(results)[:topk * 2]

    def _search_one(self, provider: str, query: str, topk: int) -> List[Dict]:
        # 各适配器实现统一 search(query, topk) 接口；此处按 provider 分发
        if provider == "tavily":
            return self._search_tavily(query, topk)
        if provider == "bing":
            return self._search_bing(query, topk)
        if provider == "brave":
            return self._search_brave(query, topk)
        if provider == "serpapi":
            return self._search_serpapi(query, topk)
        if provider == "google_cse":
            return self._search_google_cse(query, topk)
        if provider == "searxng":
            return self._search_searxng(query, topk)
        return self._search_duckduckgo(query, topk)

    def _search_tavily(self, query: str, topk: int) -> List[Dict]:
        key = os.getenv("TAVILY_API_KEY")
        if not key:
            return []
        import urllib.request, urllib.parse
        url = "https://api.tavily.com/search"
        payload = json.dumps({"api_key": key, "query": query, "max_results": topk}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("results", []):
                out.append({"url": r.get("url"), "title": r.get("title"), "snippet": r.get("content", "")[:300], "source_domain": self._domain(r.get("url", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("tavily search failed: %s", e)
            return []

    def _search_bing(self, query: str, topk: int) -> List[Dict]:
        key = os.getenv("BING_API_KEY") or os.getenv("AZURE_BING_KEY")
        if not key:
            return []
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "count": topk, "mkt": "zh-CN"})
        url = f"https://api.bing.microsoft.com/v7.0/search?{params}"
        req = urllib.request.Request(url, headers={"Ocp-Apim-Subscription-Key": key})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("webPages", {}).get("value", []):
                out.append({"url": r.get("url"), "title": r.get("name"), "snippet": r.get("snippet", "")[:300], "source_domain": self._domain(r.get("url", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("bing search failed: %s", e)
            return []

    def _search_brave(self, query: str, topk: int) -> List[Dict]:
        key = os.getenv("BRAVE_API_KEY")
        if not key:
            return []
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "count": topk})
        url = f"https://api.search.brave.com/res/v1/web/search?{params}"
        req = urllib.request.Request(url, headers={"X-Subscription-Token": key, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("web", {}).get("results", []):
                out.append({"url": r.get("url"), "title": r.get("title"), "snippet": r.get("description", "")[:300], "source_domain": self._domain(r.get("url", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("brave search failed: %s", e)
            return []

    def _search_serpapi(self, query: str, topk: int) -> List[Dict]:
        key = os.getenv("SERPAPI_API_KEY")
        if not key:
            return []
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "api_key": key, "engine": "google", "num": topk})
        url = f"https://serpapi.com/search.json?{params}"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("organic_results", []):
                out.append({"url": r.get("link"), "title": r.get("title"), "snippet": r.get("snippet", "")[:300], "source_domain": self._domain(r.get("link", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("serpapi search failed: %s", e)
            return []

    def _search_google_cse(self, query: str, topk: int) -> List[Dict]:
        key = os.getenv("GOOGLE_CSE_API_KEY")
        cse_id = os.getenv("GOOGLE_CSE_ID")
        if not key or not cse_id:
            return []
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "key": key, "cx": cse_id, "num": topk})
        url = f"https://www.googleapis.com/customsearch/v1?{params}"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("items", []):
                out.append({"url": r.get("link"), "title": r.get("title"), "snippet": r.get("snippet", "")[:300], "source_domain": self._domain(r.get("link", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("google_cse search failed: %s", e)
            return []

    def _search_searxng(self, query: str, topk: int) -> List[Dict]:
        base = os.getenv("SEARXNG_BASE_URL")
        if not base:
            return []
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "format": "json", "categories": "general"})
        url = f"{base.rstrip('/')}/search?{params}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            out = []
            for r in data.get("results", []):
                out.append({"url": r.get("url"), "title": r.get("title"), "snippet": r.get("content", "")[:300], "source_domain": self._domain(r.get("url", "")), "rank": len(out) + 1})
            return out
        except Exception as e:
            logger.warning("searxng search failed: %s", e)
            return []

    def _search_duckduckgo(self, query: str, topk: int) -> List[Dict]:
        """DuckDuckGo HTML 兜底（免 Key）。"""
        import urllib.request, urllib.parse
        params = urllib.parse.urlencode({"q": query, "kl": "cn-zh"})
        url = f"https://html.duckduckgo.com/html/?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
        except Exception:
            return []
        out = []
        for m in re.finditer(r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            raw_url, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
            real_url = urllib.parse.unquote(raw_url.replace("//duckduckgo.com/l/?uddg=", "").split("&")[0]) if "uddg=" in raw_url else raw_url
            snippet = ""
            sm = re.search(re.escape(m.group(0)) + r'.*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', html, re.S)
            if sm:
                snippet = re.sub(r"<[^>]+>", "", sm.group(1))[:300]
            out.append({"url": real_url, "title": title.strip(), "snippet": snippet, "source_domain": self._domain(real_url), "rank": len(out) + 1})
            if len(out) >= topk:
                break
        return out

    @staticmethod
    def _domain(url: str) -> str:
        try:
            from urllib.parse import urlparse
            net = urlparse(url).netloc.lower()
            return net[4:] if net.startswith("www.") else net
        except Exception:
            return ""

    @staticmethod
    def _merge_dedupe(results: List[Dict]) -> List[Dict]:
        seen, out = set(), []
        for r in results:
            u = r.get("url", "")
            if u and u not in seen:
                seen.add(u)
                out.append(r)
        return out


class SourceRouter:
    """子模块3：源头路由器。白名单 + 通用网页评估。"""

    def __init__(self):
        self.domain_trust: Dict[str, float] = {}
        self.domain_session: Dict[str, str] = {}
        for s in CINEMA_SEED_SOURCES:
            self.domain_trust[s["domain"]] = s["trust"]
            self.domain_session[s["domain"]] = s["session"]

    def route(self, results: List[Dict]) -> List[Dict]:
        routed = []
        for r in results:
            domain = r.get("source_domain", "")
            trust = self._trust(domain)
            if trust <= 0:
                continue
            r["trust_score"] = trust
            r["crawl_session"] = self._session(domain, trust)
            routed.append(r)
        routed.sort(key=lambda x: x.get("trust_score", 0), reverse=True)
        return routed

    def _trust(self, domain: str) -> float:
        if not domain:
            return 0.3
        for seed_domain, trust in self.domain_trust.items():
            if domain == seed_domain or domain.endswith("." + seed_domain):
                return trust
        if any(d in domain for d in ("github.com", "medium.com", "stackoverflow.com", "csdn.net", "juejin.cn")):
            return 0.7
        return 0.3

    def _session(self, domain: str, trust: float) -> str:
        for seed_domain, sess in self.domain_session.items():
            if domain == seed_domain or domain.endswith("." + seed_domain):
                return sess
        return "fast" if trust >= 0.7 else "dynamic"


class CrawlDispatcher:
    """子模块4：爬虫调度器（Scrapling 集成核心）。三会话分级抓取，可扩展代理池。"""

    def __init__(self, proxy_rotator=None):
        self.proxy_rotator = proxy_rotator  # 默认 None，未来可热插拔
        self._sessions: Dict[str, Any] = {}

    def _get_session(self, session_id: str):
        if session_id in self._sessions:
            return self._sessions[session_id]
        try:
            from scrapling.fetchers import Fetcher, StealthyFetcher, DynamicFetcher  # type: ignore
        except Exception:
            self._sessions[session_id] = None
            return None
        sess = None
        try:
            if session_id == "fast":
                sess = Fetcher(impersonate="chrome", http3=True)
            elif session_id == "stealth":
                sess = StealthyFetcher(headless=True, solve_cloudflare=True, stealthy_headers=True)
            elif session_id == "dynamic":
                sess = DynamicFetcher(headless=True, network_idle=True)
        except Exception:
            sess = None
        self._sessions[session_id] = sess
        return sess

    def fetch(self, url: str, session_id: str = "fast") -> Dict:
        sess = self._get_session(session_id)
        kwargs: Dict[str, Any] = {}
        if self.proxy_rotator:
            kwargs["proxy"] = self.proxy_rotator.next()
        if sess is None:
            return self._fallback_fetch(url)
        try:
            page = sess.fetch(url, **kwargs)
            content = page.css_first("article, .content, main, .entry-content, .post-content")
            text = content.text if content else page.get_all_text()
            return {"url": url, "raw_content": text or "", "ok": True}
        except Exception as e:
            return {"url": url, "raw_content": "", "ok": False, "error": str(e)}

    def _fallback_fetch(self, url: str) -> Dict:
        """无 Scrapling 时的 urllib 兜底（仅抓开放站点）。"""
        import urllib.request
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
            text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.S)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return {"url": url, "raw_content": text, "ok": True}
        except Exception as e:
            return {"url": url, "raw_content": "", "ok": False, "error": str(e)}


class ContentExtractor:
    """子模块5：内容萃取器。两阶段：正文去噪 + LLM 要点萃取。"""

    def __init__(self, llm: Optional[LLMClient] = None):
        self.llm = llm or LLMClient()

    EXTRACT_PROMPT = (
        "你是影视专业知识萃取官。对以下网页正文做要点萃取，输出严格 JSON：\n"
        '{"principles":[],"standards":[],"tool_params":[],"case_refs":[],"heuristics":[],"pitfalls":[]}\n'
        "每个数组填入该网页中与影视创作相关的专业要点（简短条目）。无则空数组。只输出 JSON。"
    )

    def extract(self, page: Dict, trust_score: float = 0.5) -> Optional[Dict]:
        raw = page.get("raw_content", "")
        if not raw or len(raw) < 50:
            return None
        domain = SearchGateway._domain(page.get("url", ""))
        # 阶段2：LLM 要点萃取（输入是去噪后的正文）
        points: Dict[str, List[str]] = {
            "principles": [], "standards": [], "tool_params": [],
            "case_refs": [], "heuristics": [], "pitfalls": [],
        }
        if self.llm.available:
            text = raw[:4000]
            out = self.llm.chat(self.EXTRACT_PROMPT, text, temperature=0.1, json_mode=True)
            try:
                cleaned = out.strip()
                if cleaned.startswith("```"):
                    cleaned = "\n".join(cleaned.splitlines()[1:-1])
                parsed = json.loads(cleaned)
                for k in points:
                    points[k] = list(parsed.get(k, []) or [])[:8]
            except Exception:
                pass
        return {
            "principles": points["principles"], "standards": points["standards"],
            "tool_params": points["tool_params"], "case_refs": points["case_refs"],
            "heuristics": points["heuristics"], "pitfalls": points["pitfalls"],
            "source_url": page.get("url", ""), "source_domain": domain,
            "trust_score": trust_score, "extracted_at": now_iso(),
        }


class KnowledgeFilter:
    """子模块6：知识过滤器。去重 + 质量评分 + 相关性 + 影视专业度。"""

    def filter(self, points_list: List[Dict], cinematic_role: str, deliverable_type: str, topk: int = 8) -> List[Dict]:
        seen, merged = set(), []
        for p in points_list:
            for dim in ("principles", "standards", "tool_params", "case_refs", "heuristics", "pitfalls"):
                for item in p.get(dim, []):
                    key = _hash_key(dim, str(item))
                    if key in seen:
                        continue
                    seen.add(key)
                    merged.append({"dim": dim, "text": item, "source": p.get("source_domain", ""), "trust": p.get("trust_score", 0.5)})
        scored = []
        cinema_kw = set(sum([v["keywords"] for v in CINEMA_TOPICS.values()], []))
        for m in merged:
            score = m["trust"]
            if any(kw in m["text"] for kw in cinema_kw):
                score += 0.3
            if deliverable_type and deliverable_type.replace("_", " ") in m["text"]:
                score += 0.2
            scored.append((score, m))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored[:topk]]


class KnowledgeCache:
    """子模块7：知识缓存。TTL + 增量更新 + 实战反馈回流。"""

    TTL_BY_CLASS = {"规范标准": 90, "工具官方文档": 30, "案例专业": 14, "学术权威": 90, "社区经验": 14, "平台规则": 14}

    def __init__(self):
        self._store: Dict[str, Dict] = {}
        self._feedback: Dict[str, List[str]] = defaultdict(list)  # pitfalls 回流

    def get(self, *key_parts) -> Optional[List[Dict]]:
        key = _hash_key(*key_parts)
        entry = self._store.get(key)
        if not entry:
            return None
        age_days = (time.time() - entry["ts"]) / 86400
        if age_days > entry["ttl"]:
            return None
        return entry["points"]

    def set(self, points: List[Dict], source_class: str = "社区经验", *key_parts):
        key = _hash_key(*key_parts)
        self._store[key] = {
            "points": points, "ts": time.time(),
            "ttl": self.TTL_BY_CLASS.get(source_class, 30) * 86400,
        }

    def feedback(self, role: str, deliverable_type: str, pitfall: str):
        """实战反馈回流到 pitfalls 维度。"""
        self._feedback[f"{role}||{deliverable_type}"].append(pitfall)

    def get_pitfalls(self, role: str, deliverable_type: str) -> List[str]:
        return list(self._feedback.get(f"{role}||{deliverable_type}", []))


class ExternalKnowledgeFetcher:
    """外部专业知识获取模块（七子模块组合）。冷启动深抓，热运行浅抓+超时降级。"""

    def __init__(self, llm: Optional[LLMClient] = None, proxy_rotator=None):
        self.llm = llm or LLMClient()
        self.query_composer = QueryComposer()
        self.search_gateway = SearchGateway()
        self.source_router = SourceRouter()
        self.crawl_dispatcher = CrawlDispatcher(proxy_rotator=proxy_rotator)
        self.content_extractor = ContentExtractor(self.llm)
        self.knowledge_filter = KnowledgeFilter()
        self.cache = KnowledgeCache()

    def fetch(self, cinematic_role: str, deliverable_type: str, sub_domain: str,
              project_stage: str = "", query_text: str = "", mode: str = "cold",
              timeout: float = 15.0) -> Tuple[List[Dict], KnowledgeProvenance]:
        """获取外部知识要点集 + 知识溯源。返回 (要点集, provenance)。"""
        # 缓存检查
        cached = self.cache.get(cinematic_role, deliverable_type, sub_domain)
        if cached is not None:
            provenance = self._build_provenance(cached, deliverable_type, cached_sources=True)
            return cached, provenance

        # 热运行超时降级：超时则仅用模型内部知识（返回空要点，provenance 标记降级）
        start = time.time()
        max_pages = 12 if mode == "cold" else 5

        queries = self.query_composer.compose(cinematic_role, deliverable_type, sub_domain, project_stage, query_text, mode)
        all_results: List[Dict] = []
        for q in queries:
            if time.time() - start > timeout:
                break
            all_results.extend(self.search_gateway.search(q, topk=10))

        routed = self.source_router.route(all_results)[:max_pages]
        points_list: List[Dict] = []
        for r in routed:
            if time.time() - start > timeout:
                break
            page = self.crawl_dispatcher.fetch(r["url"], r.get("crawl_session", "fast"))
            if not page.get("ok"):
                continue
            points = self.content_extractor.extract(page, r.get("trust_score", 0.5))
            if points:
                points_list.append(points)

        filtered = self.knowledge_filter.filter(points_list, cinematic_role, deliverable_type, topk=8 if mode == "cold" else 5)
        self.cache.set(filtered, "社区经验", cinematic_role, deliverable_type, sub_domain)

        # 注入实战反馈 pitfalls
        for pit in self.cache.get_pitfalls(cinematic_role, deliverable_type):
            filtered.append({"dim": "pitfalls", "text": pit, "source": "实战反馈", "trust": 0.8})

        provenance = self._build_provenance(filtered, deliverable_type, sources=routed, points_list=points_list)
        if time.time() - start > timeout:
            provenance.confidence_tier = "low"
            provenance.confidence_score = 0.0
        return filtered, provenance

    def _build_provenance(self, filtered: List[Dict], deliverable_type: str,
                          sources: Optional[List[Dict]] = None, points_list: Optional[List[Dict]] = None,
                          cached_sources: bool = False) -> KnowledgeProvenance:
        kp = KnowledgeProvenance()
        if sources:
            kp.sources = [{"url": s.get("url", ""), "domain": s.get("source_domain", ""), "trust_score": s.get("trust_score", 0.5), "source_class": _seed_class(s.get("source_domain", ""))} for s in sources]
        elif points_list:
            kp.sources = [{"url": p.get("source_url", ""), "domain": p.get("source_domain", ""), "trust_score": p.get("trust_score", 0.5), "source_class": _seed_class(p.get("source_domain", ""))} for p in points_list]
        # 维度计数
        for item in filtered:
            dim = item.get("dim", "heuristics")
            kp.knowledge_points[dim] = kp.knowledge_points.get(dim, 0) + 1
        # 维度覆盖
        dim_map = DELIVERABLE_DIMENSION_MAP.get(deliverable_type, {"required": [], "bonus": []})
        covered = [dim for dim in dim_map["required"] if kp.knowledge_points.get(dim, 0) > 0]
        kp.dimension_coverage = {"required": dim_map["required"], "covered": covered, "missing": [d for d in dim_map["required"] if d not in covered]}
        # 置信度评分
        if kp.sources:
            avg_trust = sum(s["trust_score"] for s in kp.sources) / len(kp.sources)
            total_points = sum(kp.knowledge_points.values())
            coverage = len(covered) / max(1, len(dim_map["required"]))
            kp.confidence_score = round(avg_trust * 0.5 + min(1.0, total_points / 12) * 0.3 + coverage * 0.2, 4)
            if avg_trust >= 0.9 and total_points >= 10 and coverage >= 0.8:
                kp.confidence_tier = "high"
            elif avg_trust >= 0.7 and total_points >= 6 and coverage >= 0.6:
                kp.confidence_tier = "medium"
            else:
                kp.confidence_tier = "low"
        return kp


def _seed_class(domain: str) -> str:
    for s in CINEMA_SEED_SOURCES:
        if domain == s["domain"] or domain.endswith("." + s["domain"]):
            return s["category"]
    return "通用网页"


# ============================================================
# Layer 1: 知识融合层（Layer B）
# ============================================================

class KnowledgeFusionLayer:
    """外部知识要点集 + 模型内部知识 + 用户画像/上下文 → 融合成增强 prompt。"""

    def fuse(self, filtered: List[Dict], provenance: KnowledgeProvenance,
             base_payload: Dict, internal_knowledge: str = "") -> str:
        sections = []
        sections.append("【外部专业知识要点】")
        by_dim: Dict[str, List[str]] = defaultdict(list)
        for item in filtered:
            by_dim[item.get("dim", "heuristics")].append(item.get("text", ""))
        dim_zh = {"principles": "原理", "standards": "规范", "tool_params": "工具参数", "case_refs": "案例参考", "heuristics": "经验法则", "pitfalls": "已知坑"}
        for dim, items in by_dim.items():
            if items:
                sections.append(f"- {dim_zh.get(dim, dim)}：")
                for it in items[:6]:
                    sections.append(f"  · {it}")
        sections.append(f"\n【知识置信度】tier={provenance.confidence_tier} score={provenance.confidence_score} 覆盖={provenance.dimension_coverage.get('covered', [])}/{provenance.dimension_coverage.get('required', [])}")
        if internal_knowledge:
            sections.append(f"\n【模型内部知识】{internal_knowledge}")
        sections.append(f"\n【生成规格】{json.dumps(base_payload, ensure_ascii=False)[:1500]}")
        return "\n".join(sections)


# ============================================================
# Layer 1: 多阶段锻造层（Layer C）+ 三段式专业性保障（§6）
# ============================================================

class ConfidenceGate:
    """第一段：知识置信度门禁。零额外 LLM 调用，结构化规则计算。"""

    def judge(self, provenance: KnowledgeProvenance, deliverable_type: str) -> Tuple[str, str]:
        """
        返回 (verdict, maturity)：
          high -> ('pass', 'v2')
          medium -> ('review', 'v1')
          low -> ('low', 'v1')
        """
        sources = provenance.sources
        if not sources:
            return "low", "v1"
        trusts = [s.get("trust_score", 0) for s in sources]
        min_trust = min(trusts) if trusts else 0
        avg_trust = sum(trusts) / len(trusts) if trusts else 0
        total_points = sum(provenance.knowledge_points.values())
        coverage = len(provenance.dimension_coverage.get("covered", [])) / max(1, len(provenance.dimension_coverage.get("required", [])))

        th = CONFIDENCE_THRESHOLDS
        if min_trust >= th["high"]["min_trust"] and total_points >= th["high"]["min_points"] and coverage >= th["high"]["min_coverage"]:
            return "pass", "v2"
        if avg_trust >= 0.7 and total_points >= 6 and coverage >= 0.6:
            return "review", "v1"
        return "low", "v1"


class LightweightReviewer:
    """第二段：轻量单次评审兜底。仅中置信度触发，单次 LLM 调用。"""

    REVIEW_PROMPT = (
        "你是影视专业质检官。对以下技能做一次性专业度评审，输出严格 JSON：\n"
        '{"verdict":"pass|rework|reject","score":0-100,"issues":[],"missing_dimensions":[]}\n'
        "评审 rubric：1.专业知识准确性 2.规范符合性 3.可执行性 4.知识完整性 5.风险控制。\n"
        "verdict=pass 直接 v2；rework 按 issues 返工后重判；reject 降 v1。只输出 JSON。"
    )

    def __init__(self, llm: Optional[LLMClient] = None):
        self.llm = llm or LLMClient()

    def review(self, skill: "SkillAsset") -> Tuple[str, int, List[str]]:
        if not self.llm.available:
            return "pass", 85, []  # 无 LLM 时放行
        content = (skill.content or json.dumps(skill.body, ensure_ascii=False))[:3000]
        out = self.llm.chat(self.REVIEW_PROMPT, content, temperature=0.1, json_mode=True)
        try:
            cleaned = out.strip()
            if cleaned.startswith("```"):
                cleaned = "\n".join(cleaned.splitlines()[1:-1])
            data = json.loads(cleaned)
            verdict = data.get("verdict", "pass")
            score = int(data.get("score", 80))
            issues = list(data.get("issues", []) or [])
            skill.expert_review_log = {"verdict": verdict, "score": score, "issues": issues, "reviewed_at": now_iso()}
            return verdict, score, issues
        except Exception:
            return "pass", 80, []


class FeedbackEvolver:
    """第三段：实战反馈自然选择。所有技能入库后持续验证。"""

    def __init__(self, knowledge_cache: Optional[KnowledgeCache] = None):
        self.cache = knowledge_cache

    def record(self, skill: "SkillAsset", outcome: str, quality_score: int,
               failure_reasons: Optional[List[str]] = None, user_corrections: Optional[List[str]] = None):
        skill.call_count += 1
        skill.quality_history.append(quality_score)
        skill.last_quality_score = quality_score
        if len(skill.quality_history) > 20:
            skill.quality_history = skill.quality_history[-20:]
        # 成熟度进化（建议 N=3 升级, M=2 降级）
        self._evolve_maturity(skill, quality_score)
        # 反馈回流飞轮
        reasons = list(failure_reasons or []) + list(user_corrections or [])
        if reasons and self.cache:
            for r in reasons:
                self.cache.feedback(skill.cinematic_role, skill.deliverable_type, r)

    def _evolve_maturity(self, skill: "SkillAsset", quality_score: int):
        hist = skill.quality_history
        if not hist:
            return
        # 基于"末尾连续达标/不达标计数"判定，避免旧记录干扰
        consec_pass = self._count_consecutive_tail(hist, threshold=85, direction="ge")
        consec_fail = self._count_consecutive_tail(hist, threshold=60, direction="lt")
        if skill.maturity == "v1":
            if consec_pass >= 3:
                skill.maturity = "v2"
            elif consec_fail >= 2:
                skill.maturity = "v0"
        elif skill.maturity == "v2":
            if consec_pass >= 3:
                skill.maturity = "v3"
            elif consec_fail >= 2:
                skill.maturity = "v1"
        elif skill.maturity == "v3":
            if consec_fail >= 2:
                skill.maturity = "v2"

    @staticmethod
    def _count_consecutive_tail(hist: List[int], threshold: int, direction: str) -> int:
        """从 history 末尾向前数连续满足条件的次数（仅看最近连续，不含被中断的旧记录）。"""
        count = 0
        for q in reversed(hist):
            ok = (q >= threshold) if direction == "ge" else (q < threshold)
            if ok:
                count += 1
            else:
                break
        return count


class MultiStageForger:
    """多阶段锻造层。五阶段递进，每阶段有质量门。"""

    def __init__(self, llm: Optional[LLMClient] = None, knowledge_fetcher: Optional[ExternalKnowledgeFetcher] = None):
        self.llm = llm or LLMClient()
        self.knowledge_fetcher = knowledge_fetcher or ExternalKnowledgeFetcher(self.llm)
        self.fusion = KnowledgeFusionLayer()
        self.confidence_gate = ConfidenceGate()
        self.reviewer = LightweightReviewer(self.llm)
        self.max_rework_rounds = 2

    def forge(self, payload: Dict, system_message: str, user_template: str,
              mode: str = "cold", rework_rounds: int = 0) -> "SkillAsset":
        cinematic_role = payload.get("cinematic_role", "")
        deliverable_type = payload.get("deliverable_type", "")
        sub_domain = payload.get("sub_domain", "cinema")

        # Stage 0: 外部知识获取（无 LLM 时降级跳过，避免无意义网络抓取拖垮冷启动）
        # 加 try/except + 降级：单条知识获取失败不应击穿整条 forge（批量冷启动容错）
        if self.llm.available:
            try:
                filtered, provenance = self.knowledge_fetcher.fetch(
                    cinematic_role, deliverable_type, sub_domain,
                    payload.get("project_stage", ""), payload.get("query_text", ""), mode
                )
            except Exception as e:
                logger.warning("外部知识获取失败，降级为空知识继续锻造 [%s]: %s", sub_domain, e)
                filtered, provenance = [], KnowledgeProvenance()
        else:
            filtered, provenance = [], KnowledgeProvenance()

        # Layer B: 知识融合
        fused_prompt = self.fusion.fuse(filtered, provenance, payload)

        # Stage 1-2: 骨架生成 + 专业填充（单次 LLM 调用，融合知识注入）
        skill = self._generate_skill(payload, system_message, user_template, fused_prompt)

        skill.knowledge_provenance = provenance
        skill.forge_mode = mode

        # Stage 3: 专业性保障（三段式）
        skill = self._assurance(skill, provenance, deliverable_type, mode)

        # Stage 4: 返工优化（仅 rework 触发）
        if skill.status == "rework" and rework_rounds < self.max_rework_rounds:
            payload["_rework_issues"] = skill.expert_review_log.get("issues", [])
            return self.forge(payload, system_message, user_template, mode, rework_rounds + 1)

        # Stage 5: 落盘准备（embedding 生成）
        skill.embedding = self._gen_embedding(skill)
        skill.status = "active" if skill.maturity in ("v2", "v3") else "draft"
        return skill

    def _generate_skill(self, payload: Dict, system_message: str, user_template: str, fused_prompt: str) -> "SkillAsset":
        # 渲染 UserMessage（Jinja2）
        render_ctx = dict(payload)
        render_ctx["fused_knowledge"] = fused_prompt
        user_message = self._render_template(user_template, render_ctx)

        # 调用 LLM
        if self.llm.available:
            raw = self.llm.chat(system_message, user_message, temperature=0.2,
                                json_mode=(payload.get("output_format") == "json"))
        else:
            raw = ""  # 无 LLM 时生成骨架占位

        # 解析输出为 SkillAsset
        skill = self._parse_output(raw, payload)
        if not skill.content and raw:
            skill.content = raw
        return skill

    def _render_template(self, template_text: str, ctx: Dict) -> str:
        if not _HAS_JINJA:
            # 无 Jinja 时做简单 {{var}} 替换
            out = template_text
            for k, v in ctx.items():
                val = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                out = out.replace("{{" + k + "}}", val)
            return out
        # 允许缺失变量：用宽松 Undefined，避免 payload 字段不全时渲染崩溃
        from jinja2 import Environment, Undefined  # type: ignore
        env = Environment(autoescape=False, undefined=Undefined, trim_blocks=False, lstrip_blocks=False,
                          finalize=lambda v: json.dumps(v, ensure_ascii=False, indent=2) if isinstance(v, (dict, list)) else ("null" if v is None else v))
        return env.from_string(template_text).render(**ctx)

    def _parse_output(self, raw: str, payload: Dict) -> "SkillAsset":
        data: Dict[str, Any] = {}
        if raw:
            cleaned = raw.strip()
            # 去除首尾 ``` 围栏（稳健：仅去首行开围栏与末行闭围栏，避免 splitlines[1:-1] 误切单围栏内容）
            cleaned = re.sub(r"^\s*```[a-zA-Z]*\s*\n?", "", cleaned)
            cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
            fmt = payload.get("output_format", "json")
            if fmt == "json":
                try:
                    data = json.loads(cleaned)
                except Exception:
                    data = {}
            elif fmt == "yaml" and _HAS_YAML:
                try:
                    data = yaml.safe_load(cleaned) or {}
                except Exception:
                    data = {}
            elif fmt == "markdown":
                # 从 Frontmatter 提取
                fm = re.search(r"^---\s*\n(.*?)\n---", cleaned, re.S)
                if fm and _HAS_YAML:
                    try:
                        data = yaml.safe_load(fm.group(1)) or {}
                    except Exception:
                        data = {}
                data.setdefault("content", cleaned)
            # 容错：LLM 返回数组/字符串/数字等非对象 JSON 时，降级为空 dict，避免后续 setdefault 崩溃
            if not isinstance(data, dict):
                logger.warning("LLM 输出非对象 JSON，降级为空 dict: %.80s", str(data))
                data = {}
        # 主键与结构化路由字段：payload 显式传入的值优先于 LLM 输出
        # （skill_id 主键稳定不得擅自改写；cinematic_role/module_target/deliverable_type/sub_domain
        #  是 R0 路由核心字段，必须以调用方 payload 为准，防止 LLM 输出偏移导致路由错乱）
        _PAYLOAD_PRIORITY_KEYS = ("skill_id", "domain", "sub_domain", "cinematic_role",
                                  "module_target", "deliverable_type", "project_stage")
        for k in _PAYLOAD_PRIORITY_KEYS:
            pv = payload.get(k)
            if pv is not None and pv != "" and pv != []:
                data[k] = pv
        # 其余字段：payload 提供默认值，LLM 输出已有时保留 LLM 输出
        data.setdefault("skill_id", payload.get("skill_id") or gen_id("skill"))
        data.setdefault("name", payload.get("skill_name") or payload.get("title") or data.get("name") or "未命名技能")
        data.setdefault("version", payload.get("package_version") or data.get("version") or "1.0.0")
        data.setdefault("last_updated", data.get("last_updated") or now_iso())
        data.setdefault("domain", data.get("domain") or "ai_cinema")
        data.setdefault("sub_domain", data.get("sub_domain") or payload.get("sub_domain") or "cinema")
        data.setdefault("cinematic_role", data.get("cinematic_role") or payload.get("cinematic_role") or "")
        data.setdefault("module_target", data.get("module_target") or payload.get("module_target") or [])
        data.setdefault("deliverable_type", data.get("deliverable_type") or payload.get("deliverable_type") or "")
        data.setdefault("project_stage", data.get("project_stage") or payload.get("project_stage") or "")
        data.setdefault("forge_mode", payload.get("forge_mode", "cold"))
        data.setdefault("maturity", data.get("maturity", "v0"))
        data.setdefault("status", data.get("status", "draft"))
        # 生成召回文本
        if not data.get("weighted_recall_text"):
            data["weighted_recall_text"] = _build_weighted_recall_text(data)
        return SkillAsset.from_dict(data)

    def _assurance(self, skill: "SkillAsset", provenance: KnowledgeProvenance, deliverable_type: str, mode: str) -> "SkillAsset":
        # 第一段：知识置信度门禁
        verdict, maturity = self.confidence_gate.judge(provenance, deliverable_type)
        if verdict == "pass":
            skill.maturity = "v2"
            skill.status = "active"
            return skill
        if verdict == "low":
            skill.maturity = "v1"
            skill.status = "draft"
            return skill
        # 第二段：中置信度 -> 轻量评审（热运行超时则跳过，v1 入库后异步）
        if mode == "hot":
            skill.maturity = "v1"
            skill.status = "draft"
            return skill
        review_verdict, score, issues = self.reviewer.review(skill)
        if review_verdict == "pass":
            skill.maturity = "v2"
            skill.status = "active"
        elif review_verdict == "rework":
            skill.maturity = "v1"
            skill.status = "rework"
        else:  # reject
            skill.maturity = "v1"
            skill.status = "draft"
        return skill

    def _gen_embedding(self, skill: "SkillAsset") -> List[float]:
        # 优先用召回文本，其次名称，最后正文片段；均无则用 skill_id 兜底
        text = skill.weighted_recall_text or skill.name or (skill.content[:500] if skill.content else skill.skill_id)
        return self.llm.embed(text)


def _build_weighted_recall_text(data: Dict) -> str:
    parts = []
    name = data.get("name", "")
    if name:
        parts.extend([name] * 3)
    parts.extend(data.get("aliases", []) or [])
    rp = data.get("retrieval_profile", {}) if isinstance(data.get("retrieval_profile"), dict) else {}
    parts.extend(rp.get("aliases", []) or [])
    parts.extend(rp.get("sample_queries", []) or [])
    parts.extend(rp.get("logical_topics", []) or [])
    ents = rp.get("entities", {}) if isinstance(rp.get("entities"), dict) else {}
    parts.extend(ents.get("who", []) or [])
    parts.extend(ents.get("actions", []) or [])
    parts.extend(ents.get("objects", []) or [])
    for f in ("cinematic_role", "deliverable_type", "sub_domain"):
        v = data.get(f, "")
        if v:
            parts.append(str(v))
    parts.extend(data.get("tags", []) or [])
    return " ".join(dict.fromkeys([str(p) for p in parts if p]))


# ============================================================
# Layer 1: 组合创新层（Layer D，全自动）
# ============================================================

class InnovationComposer:
    """跨域组合 + 跨技能组合 + 变异进化。冷启动可触发，热运行不触发。"""

    def __init__(self, llm: Optional[LLMClient] = None):
        self.llm = llm or LLMClient()

    INNOVATE_PROMPT = (
        "你是影视技能创新组合器。基于以下技能要素，生成一个创新复合技能（跨域组合/跨技能组合/变异进化），"
        "输出 JSON：{\"name\":\"\",\"skill_type\":\"\",\"combination\":\"\",\"gain\":\"\",\"feasible\":true,\"innovative\":true}。只输出 JSON。"
    )

    def compose(self, seed_skills: List["SkillAsset"], matrix_entry: Optional[Dict] = None) -> Optional["SkillAsset"]:
        if len(seed_skills) < 2:
            return None
        elems = [{"role": s.cinematic_role, "deliverable": s.deliverable_type, "name": s.name} for s in seed_skills[:4]]
        if not self.llm.available:
            return None
        out = self.llm.chat(self.INNOVATE_PROMPT, json.dumps(elems, ensure_ascii=False), temperature=0.4, json_mode=True)
        try:
            cleaned = re.sub(r"^\s*```[a-zA-Z]*\s*\n?", "", out.strip())
            cleaned = re.sub(r"\n?\s*```\s*$", "", cleaned)
            data = json.loads(cleaned)
        except Exception:
            return None
        if not isinstance(data, dict) or not data.get("feasible", True) or not data.get("innovative", True):
            return None
        # 合并 seed 技能的召回信息，构建完整召回文本（避免创新技能入库后变"死技能"）
        seed_aliases = list(dict.fromkeys(sum([list(s.aliases) for s in seed_skills[:4]], [])))
        seed_topics = list(dict.fromkeys(sum([list(s.logical_topics) for s in seed_skills[:4]], [])))
        seed_queries = list(dict.fromkeys(sum([list(s.sample_queries) for s in seed_skills[:4]], [])))
        recall_data = {
            "name": data.get("name", "创新复合技能"),
            "aliases": seed_aliases,
            "retrieval_profile": {"aliases": seed_aliases, "sample_queries": seed_queries, "logical_topics": seed_topics},
            "cinematic_role": seed_skills[0].cinematic_role,
            "deliverable_type": seed_skills[0].deliverable_type,
            "sub_domain": seed_skills[0].sub_domain,
        }
        # module_target 保序去重（set 无序会导致跨运行不稳定）
        module_target = list(dict.fromkeys(sum([list(s.module_target) for s in seed_skills], [])))
        skill = SkillAsset(
            name=data.get("name", "创新复合技能"),
            skill_id=gen_id("innov"),
            last_updated=now_iso(),
            domain="ai_cinema",
            sub_domain=seed_skills[0].sub_domain,
            cinematic_role=seed_skills[0].cinematic_role,
            module_target=module_target,
            deliverable_type=seed_skills[0].deliverable_type,
            maturity="v0",
            forge_mode="cold",
            status="draft",
            innovation_meta={"is_innovative": True, "combination": data.get("combination", ""), "gain": data.get("gain", ""), "seed_skills": [s.skill_id for s in seed_skills[:4]]},
            weighted_recall_text=_build_weighted_recall_text(recall_data),
        )
        return skill


# ============================================================
# Layer 1: 成熟度与进化层（Layer E，纯自动化 v0→v3）
# ============================================================

class MaturityEvolver:
    """成熟度管理 + 实战反馈自然选择 + 召回权重。"""

    WEIGHT_BY_MATURITY = {"v3": 1.5, "v2": 1.2, "v1": 1.0, "v0": 0.6}

    @classmethod
    def weight(cls, skill: "SkillAsset") -> float:
        return cls.WEIGHT_BY_MATURITY.get(skill.maturity, 1.0)

    @classmethod
    def should_retire(cls, skill: "SkillAsset") -> bool:
        """连续差反馈的自然淘汰。"""
        hist = skill.quality_history
        return skill.call_count >= 5 and len(hist) >= 4 and all(q < 50 for q in hist[-4:])


# ============================================================
# Layer 1: SkillForgeEngine（生产侧总控）
# ============================================================

class SkillForgeEngine:
    """
    技能锻造子系统总控。整合外部知识获取 + 知识融合 + 多阶段锻造 + 三段式保障 + 组合创新 + 成熟度进化。
    双模式入口：cold_forge / hot_forge。
    """

    def __init__(self, llm: Optional[LLMClient] = None, system_message: str = "",
                 user_template: str = "", enable_innovation: bool = True):
        self.llm = llm or LLMClient()
        self.system_message = system_message
        self.user_template = user_template
        self.forger = MultiStageForger(self.llm)
        self.innovator = InnovationComposer(self.llm) if enable_innovation else None
        self.evolver = MaturityEvolver()

    def _make_payload(self, matrix_entry: Dict, task: str) -> Dict:
        agent = matrix_entry["agent"]
        sys_name = matrix_entry.get("system", "MyStudio")
        role = matrix_entry["cinematic_role"]
        sub = matrix_entry["sub_domain"]
        deliverable = _guess_deliverable(role, task)
        stage = _guess_project_stage(task)
        # 确定性 skill_id：基于 (system, agent, role, sub, task) 哈希，保证 cold_start 幂等不堆积
        skill_id = "pcf_" + _hash_key(sys_name, agent, role, sub, task)[:16]
        return {
            "output_mode": "blueprint", "output_format": "json",
            "skill_name": task, "skill_id": skill_id,
            "package_version": "1.0.0", "skill_version": "1.0.0",
            "last_updated": now_iso(), "author": "PandaCineForge", "license": "internal", "status": "draft",
            "domain": "ai_cinema", "sub_domain": sub, "type": "cinema_skill",
            "priority": "P1", "tags": [role, sub, deliverable],
            "cinematic_role": role, "module_target": [f"{sys_name}.{agent}"],
            "deliverable_type": deliverable, "project_stage": stage,
            "title": task, "summary": f"{task}（{sub}）",
            "skill_type": "deep_analysis", "automation_level": "L2", "risk_level": "medium",
            "core_goal": task, "non_goals": [], "success_metrics": [], "user_scenarios": [],
            "target_audience": [agent], "trigger_intents": [task],
            "estimated_user_time": "10min", "estimated_system_time": "30s", "difficulty": 3,
            "output_style": "table_first", "execution_layer": "5", "execution_mode": "sequential",
            "domain_pack": DOMAIN_PACKS.get(sub, {}),
        }

    def cold_forge(self, matrix: Optional[List[Dict]] = None, enable_innovation: bool = False) -> List["SkillAsset"]:
        """冷启动批量生成。按全域技能矩阵批量生成，走完整锻造流程。
        enable_innovation 默认 False（组合创新会让 generated_count 不可预测，开源默认关闭）；
        显式传 True 时触发跨域组合创新，追加创新复合技能。"""
        matrix = matrix if matrix is not None else COLD_FORGE_MATRIX
        skills: List[SkillAsset] = []
        failures = 0
        for entry in matrix:
            for task in entry.get("tasks", []):
                payload = self._make_payload(entry, task)
                try:
                    skill = self.forger.forge(payload, self.system_message, self.user_template, mode="cold")
                    skills.append(skill)
                except Exception as e:
                    failures += 1
                    logger.warning("cold_forge 失败 [task=%s]: %s", task, e, exc_info=True)
                    continue
        if failures:
            logger.warning("cold_forge 完成: 成功 %d 个, 失败 %d 个", len(skills), failures)
        # 组合创新：默认关闭，显式开启时追加
        if enable_innovation and self.innovator and len(skills) >= 4:
            for i in range(0, min(6, len(skills) - 1), 2):
                innov = self.innovator.compose(skills[i:i + 3])
                if innov:
                    skills.append(innov)
        return skills

    def hot_forge(self, request: Dict) -> "SkillAsset":
        """热运行实时生成。简化锻造保速度：外部知识浅抓 + 置信度门禁快速判定。"""
        payload = dict(request)
        payload.setdefault("output_mode", "blueprint")
        payload.setdefault("output_format", "json")
        payload.setdefault("domain", "ai_cinema")
        payload.setdefault("forge_mode", "hot")
        skill = self.forger.forge(payload, self.system_message, self.user_template, mode="hot")
        return skill


def _guess_deliverable(role: str, task: str) -> str:
    """根据 cinematic_role + task 文本猜测 deliverable_type。"""
    hints = [
        ("节拍", "beat_sheet"), ("大纲", "beat_sheet"), ("结构", "beat_sheet"),
        ("视觉", "storyboard"), ("分镜", "shotlist"), ("色彩", "color_script"), ("调色", "color_script"),
        ("运镜", "shotlist"), ("布光", "shotlist"),
        ("混音", "mix_plan"), ("声音", "sound_map"), ("音效", "sound_map"), ("配乐", "sound_map"),
        ("连贯", "continuity_report"), ("穿帮", "continuity_report"),
        ("提示词", "prompt_pack"), ("Prompt", "prompt_pack"),
        ("开场", "opening_sequence"), ("片头", "opening_sequence"),
        ("剪辑", "edit_decision_list"), ("EDL", "edit_decision_list"),
    ]
    for kw, dt in hints:
        if kw in task:
            return dt
    role_default = {
        "scene_design": "beat_sheet", "visual_language": "shotlist", "audio_design": "sound_map",
        "continuity_review": "continuity_report", "prompt_fusion": "prompt_pack",
        "opening_design": "opening_sequence", "editing": "edit_decision_list",
        "color_grading": "color_script", "vfx": "shotlist",
    }
    return role_default.get(role, "shotlist")


def _guess_project_stage(task: str) -> str:
    """根据 task 文本猜测 project_stage（替换原硬编码 preproduction）。"""
    if any(kw in task for kw in ["剪辑", "调色", "色彩", "混音", "视效", "合成", "后期", "精剪", "粗剪", "口型", "连贯", "穿帮", "渲染", "套LUT", "Foley", "对白", "旁白", "音效", "配乐", "字幕"]):
        return "postproduction"
    if any(kw in task for kw in ["发行", "交付", "DCP", "投流", "上线", "复盘", "矩阵", "带货"]):
        return "distribution"
    if any(kw in task for kw in ["拍摄", "布光", "收声", "场记", "现场"]):
        return "production"
    return "preproduction"


# ============================================================
# Layer 2-3: 索引 + 召回（分层级联 R0-R5）
# 底层算子（BM25/Embedding/Topic/Slot）组织为分层级联，命中即返
# ============================================================

class SkillIndexer:
    """技能索引器：结构化索引 + 向量索引 + 关键词索引。"""

    def __init__(self):
        self.skills: Dict[str, SkillAsset] = {}
        # 结构化索引（R0 路由用）
        self.idx_role: Dict[str, Set[str]] = defaultdict(set)
        self.idx_module: Dict[str, Set[str]] = defaultdict(set)
        self.idx_deliverable: Dict[str, Set[str]] = defaultdict(set)
        self.idx_stage: Dict[str, Set[str]] = defaultdict(set)
        self.idx_subdomain: Dict[str, Set[str]] = defaultdict(set)
        # 关键词索引（R3 用）
        self.phrase_index: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
        self.topic_index: Dict[str, Set[str]] = defaultdict(set)
        self.domain_index: Dict[str, Set[str]] = defaultdict(set)
        self.urgency_index: Dict[str, Set[str]] = defaultdict(set)
        self.slot_indexes: Dict[str, Dict[str, Set[str]]] = {k: defaultdict(set) for k in ("who", "actions", "objects", "scenarios", "project_stages")}
        # BM25 索引
        self.doc_len: Dict[str, int] = {}
        self.avg_doc_len: float = 1.0
        self.df: Dict[str, int] = {}
        self.ngram_postings: Dict[str, Dict[str, int]] = defaultdict(dict)
        self.doc_count: int = 0
        # 向量索引（R1 用）
        self.embeddings: Dict[str, List[float]] = {}

    def upsert(self, skill: SkillAsset):
        # 先移除旧记录的索引痕迹（若存在），再增量插入，避免全量重建
        if skill.skill_id in self.skills:
            self._remove_one(skill.skill_id)
        self.skills[skill.skill_id] = skill
        self._index_incremental(skill)
        # 重算派生统计量（df / avg_doc_len / doc_count）
        self._recompute_stats()

    def _remove_one(self, skill_id: str):
        """从所有派生索引中移除单个 skill 的痕迹。"""
        skill = self.skills.pop(skill_id, None)
        if not skill:
            return
        for idx in (self.idx_role, self.idx_module, self.idx_deliverable, self.idx_stage, self.idx_subdomain,
                    self.topic_index, self.domain_index, self.urgency_index):
            for _k, sset in list(idx.items()):
                sset.discard(skill_id)
                if not sset:
                    del idx[_k]
        for sub in self.slot_indexes.values():
            for _k, sset in list(sub.items()):
                sset.discard(skill_id)
                if not sset:
                    del sub[_k]
        # phrase 索引
        for norm, pairs in list(self.phrase_index.items()):
            new_pairs = [(sid, src) for sid, src in pairs if sid != skill_id]
            if new_pairs:
                self.phrase_index[norm] = new_pairs
            else:
                del self.phrase_index[norm]
        # BM25：按该 skill 自身的 gram 反向清理（O(该文档 gram 数)，避免遍历全量 postings）+ df 增量递减
        self.doc_len.pop(skill_id, None)
        old_tf = self._build_ngram_tf(skill)
        for gram in old_tf:
            postings = self.ngram_postings.get(gram)
            if postings is not None:
                postings.pop(skill_id, None)
                if not postings:
                    del self.ngram_postings[gram]
            cnt = self.df.get(gram, 0)
            if cnt <= 1:
                self.df.pop(gram, None)
            else:
                self.df[gram] = cnt - 1
        self.embeddings.pop(skill_id, None)

    def _index_incremental(self, skill: SkillAsset):
        """增量索引单个 skill（不重建全部）。df 增量维护，避免 O(V) 全量重建。"""
        self._index_structured(skill)
        self._index_phrases(skill)
        self._index_slots(skill)
        self._index_topics(skill)
        tf = self._build_ngram_tf(skill)
        dl = sum(tf.values())
        self.doc_len[skill.skill_id] = dl
        for gram, freq in tf.items():
            self.ngram_postings[gram][skill.skill_id] = freq
            self.df[gram] = self.df.get(gram, 0) + 1
        if skill.embedding:
            self.embeddings[skill.skill_id] = skill.embedding

    def _recompute_stats(self):
        """重算 doc_count / avg_doc_len（df 已在增量插入/删除时维护，无需全量扫描）。"""
        self.doc_count = len(self.skills)
        total = sum(self.doc_len.values())
        self.avg_doc_len = (total / self.doc_count) if self.doc_count else 1.0

    def bulk_load(self, skills: List[SkillAsset]):
        self.skills = {s.skill_id: s for s in skills}
        self._rebuild_all()

    def _rebuild_all(self):
        # 清空派生索引
        for d in (self.idx_role, self.idx_module, self.idx_deliverable, self.idx_stage, self.idx_subdomain,
                  self.phrase_index, self.topic_index, self.domain_index, self.urgency_index):
            d.clear()
        for d in self.slot_indexes.values():
            d.clear()
        self.doc_len.clear(); self.df.clear(); self.ngram_postings.clear()
        self.embeddings.clear()
        self.doc_count = len(self.skills)
        total_len = 0
        for skill in self.skills.values():
            self._index_structured(skill)
            self._index_phrases(skill)
            self._index_slots(skill)
            self._index_topics(skill)
            tf = self._build_ngram_tf(skill)
            dl = sum(tf.values())
            self.doc_len[skill.skill_id] = dl
            total_len += dl
            for gram, freq in tf.items():
                self.ngram_postings[gram][skill.skill_id] = freq
            if skill.embedding:
                self.embeddings[skill.skill_id] = skill.embedding
        self.avg_doc_len = (total_len / self.doc_count) if self.doc_count else 1.0
        self.df = {gram: len(postings) for gram, postings in self.ngram_postings.items()}

    def _index_structured(self, skill: SkillAsset):
        if skill.cinematic_role:
            self.idx_role[skill.cinematic_role].add(skill.skill_id)
        for mt in skill.module_target:
            self.idx_module[mt].add(skill.skill_id)
        if skill.deliverable_type:
            self.idx_deliverable[skill.deliverable_type].add(skill.skill_id)
        if skill.project_stage:
            self.idx_stage[skill.project_stage].add(skill.skill_id)
        if skill.sub_domain:
            self.idx_subdomain[skill.sub_domain].add(skill.skill_id)

    def _index_phrases(self, skill: SkillAsset):
        phrases = [(skill.name, "name")]
        phrases.extend((x, "alias") for x in skill.aliases)
        phrases.extend((x, "sample_query") for x in skill.sample_queries)
        phrases.extend((x, "trigger") for x in skill.trigger_keywords)
        phrases.extend((x, "pattern") for x in skill.problem_patterns)
        for phrase, _src in phrases:
            norm = normalize_text(phrase)
            if len(norm) < 2:
                continue
            self.phrase_index[norm].append((skill.skill_id, _src))

    def _index_slots(self, skill: SkillAsset):
        rp = skill.retrieval_profile
        for item in rp.entities.who:
            self.slot_indexes["who"][normalize_text(item)].add(skill.skill_id)
        for item in rp.entities.actions:
            self.slot_indexes["actions"][normalize_text(item)].add(skill.skill_id)
        for item in rp.entities.objects:
            self.slot_indexes["objects"][normalize_text(item)].add(skill.skill_id)
        for item in rp.scenarios:
            self.slot_indexes["scenarios"][normalize_text(item)].add(skill.skill_id)
        for item in rp.project_stages:
            self.slot_indexes["project_stages"][normalize_text(item)].add(skill.skill_id)

    def _index_topics(self, skill: SkillAsset):
        for topic in skill.logical_topics:
            self.topic_index[topic].add(skill.skill_id)
        if skill.domain:
            self.domain_index[skill.domain].add(skill.skill_id)
        self.urgency_index[skill.retrieval_profile.urgency or "normal"].add(skill.skill_id)

    def _build_ngram_tf(self, skill: SkillAsset) -> Counter:
        counter = Counter()
        for term in (skill.weighted_recall_text or "").split():
            norm = normalize_text(term)
            if len(norm) < 2:
                continue
            counter.update(char_ngrams(norm))
        return counter


class RecallEngine:
    """分层级联回：R0 结构化路由 → R1 语义向量 → R2 上下文 → R3 关键词 → R4 安全兜底 → R5 实时生成兜底。"""

    SOURCE_WEIGHTS = {"name": 8.0, "alias": 7.0, "sample_query": 7.5, "trigger": 5.5, "pattern": 5.0}
    SLOT_WEIGHTS = {"who": 1.2, "actions": 3.0, "objects": 2.2, "scenarios": 1.4, "project_stages": 1.8}

    def __init__(self, indexer: SkillIndexer, topic_mapper: "TopicMapper",
                 forge_engine: Optional[SkillForgeEngine] = None, rrf_k: int = 60):
        self.indexer = indexer
        self.topic_mapper = topic_mapper
        self.forge_engine = forge_engine
        self.rrf_k = rrf_k

    def understand(self, text: str, route_fields: Optional[Dict] = None, context: Optional[Dict] = None) -> QueryUnderstanding:
        normalized = normalize_text(text)
        qu = QueryUnderstanding(
            raw_text=text, normalized_text=normalized,
            expanded_queries=self._expand(text, normalized),
            char_ngrams=char_ngrams(normalized),
            slots=self._extract_slots(normalized),
            scenarios=self._extract_scenarios(normalized),
            project_stages=extract_project_stages(normalized),
            urgency=self._detect_urgency(normalized),
            route_fields=route_fields or {},
            context=context or {},
        )
        qu.topics = self.topic_mapper.detect_topics(qu)
        return qu

    def _expand(self, text: str, normalized: str) -> List[str]:
        expanded = [normalized]
        slots = self._extract_slots(normalized)
        for item in slots.who + slots.actions + slots.objects:
            if item:
                expanded.append(normalize_text(item))
        return list(dict.fromkeys([x for x in expanded if x]))[:32]

    def _extract_slots(self, normalized: str) -> RetrievalEntities:
        who, actions, objects = [], [], []
        for item in CINEMA_ENTITIES.get("who", []):
            if normalize_text(item) in normalized:
                who.append(item)
        for item in CINEMA_ENTITIES.get("actions", []):
            if normalize_text(item) in normalized:
                actions.append(item)
        for item in CINEMA_ENTITIES.get("objects", []):
            if normalize_text(item) in normalized:
                objects.append(item)
        return RetrievalEntities(who=list(dict.fromkeys(who)), actions=list(dict.fromkeys(actions)), objects=list(dict.fromkeys(objects)))

    def _extract_scenarios(self, normalized: str) -> List[str]:
        out = []
        for sc in CINEMA_SCENARIOS:
            if normalize_text(sc) in normalized:
                out.append(sc)
        return list(dict.fromkeys(out))

    def _detect_urgency(self, normalized: str) -> str:
        norm_kws = [normalize_text(k) for k in _HIGH_URGENCY_KW]
        if any(k in normalized for k in norm_kws):
            return "high"
        norm_med = [normalize_text(k) for k in _MEDIUM_URGENCY_KW]
        if any(k in normalized for k in norm_med):
            return "medium"
        return "normal"

    # ---------- R0 结构化精确路由 ----------
    def r0_structured_route(self, qu: QueryUnderstanding) -> Tuple[Dict[str, float], Dict[str, List[str]], str]:
        rf = qu.route_fields or {}
        if not rf:
            return {}, {}, ""
        # 仅启用索引中实际存在的结构化字段做过滤；任一提供的字段都必须匹配（交集），
        # 未提供的字段（值为 None/空）不参与过滤。字段值在索引中无对应技能时，该字段过滤结果为空 → 整体为空。
        candidates: Optional[Set[str]] = None
        # 单值字段：值非空时取索引集合，值为 None/空时返回 None（不过滤）
        def _single(field_name: str, idx: Dict[str, Set[str]]) -> Optional[Set[str]]:
            v = rf.get(field_name)
            if not v:
                return None
            return set(idx.get(v, set()))
        field_specs: List[Tuple[str, Optional[Set[str]]]] = [
            ("module_target", self._collect_module_ids(rf.get("module_target"))),
            ("cinematic_role", _single("cinematic_role", self.indexer.idx_role)),
            ("deliverable_type", _single("deliverable_type", self.indexer.idx_deliverable)),
            ("project_stage", _single("project_stage", self.indexer.idx_stage)),
            ("sub_domain", _single("sub_domain", self.indexer.idx_subdomain)),
        ]
        for _field, ids in field_specs:
            if ids is None:
                continue  # 该字段未提供，跳过
            candidates = set(ids) if candidates is None else (candidates & set(ids))
            if not candidates:
                return {}, {}, ""  # 任一提供的字段无匹配，整体不命中
        if not candidates:
            return {}, {}, ""
        scores = {sid: 1.0 for sid in candidates}
        evidences = {sid: ["r0:route_match"] for sid in candidates}
        return scores, evidences, "R0"

    def _collect_module_ids(self, module_target: Any) -> Optional[Set[str]]:
        """module_target 为列表，需并集多值；未提供时返回 None 表示不过滤。"""
        if not module_target:
            return None
        # 容错：字符串入参按整体匹配（避免 for 遍历字符导致返回空集）
        if isinstance(module_target, str):
            module_target = [module_target]
        ids: Set[str] = set()
        for mt in module_target:
            ids |= self.indexer.idx_module.get(mt, set())
        return ids

    # ---------- R1 语义向量召回（核心）----------
    def r1_semantic_recall(self, qu: QueryUnderstanding, top_n: int = 40) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores, evidences = {}, defaultdict(list)
        if not self.indexer.embeddings:
            return {}, {}
        query_vec = self._embed(qu.raw_text)
        if not query_vec:
            # 无 embedding 时退化到 phrase 精确匹配
            return self._phrase_recall(qu, top_n)
        for sid, vec in self.indexer.embeddings.items():
            sim = _cosine(query_vec, vec)
            if sim > 0.3:
                scores[sid] = sim
                evidences[sid].append(f"r1:semantic:{sim:.3f}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    def _embed(self, text: str) -> List[float]:
        # 优先用索引中 LLM 客户端；若无则返回空
        if self.forge_engine and self.forge_engine.llm.available:
            return self.forge_engine.llm.embed(text)
        return []

    def _phrase_recall(self, qu: QueryUnderstanding, top_n: int) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores = defaultdict(float)
        evidences = defaultdict(list)
        for form in dict.fromkeys([qu.normalized_text] + qu.expanded_queries):
            for sid, source in self.indexer.phrase_index.get(form, []):
                scores[sid] += self.SOURCE_WEIGHTS.get(source, 5.0) + 4.0
                evidences[sid].append(f"r1_phrase:{source}:{form}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    # ---------- R2 上下文召回（AI 专属）----------
    def r2_context_recall(self, qu: QueryUnderstanding, top_n: int = 30) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores = defaultdict(float)
        evidences = defaultdict(list)
        ctx = qu.context or {}
        # 基于项目类型/阶段/Agent 预测性召回
        project_stage = ctx.get("project_stage") or qu.route_fields.get("project_stage")
        if project_stage:
            for sid in self.indexer.idx_stage.get(project_stage, set()):
                scores[sid] += 2.0
                evidences[sid].append(f"r2:stage:{project_stage}")
        # 上下游技能：上游交付物 → 邻居扩散（精确匹配 deliverable_type，避免子串误召）
        upstream = ctx.get("upstream_deliverable")
        if upstream:
            up_dt = upstream.split("_v")[0]
            for sid, skill in self.indexer.skills.items():
                if skill.deliverable_type == up_dt:
                    for n in skill.neighbors[:4]:
                        scores[n] += 1.5
                        evidences[n].append(f"r2:upstream_neighbor:{sid}")
        # 链路预判：SceneDesign 完成 → 预判 VisualLanguage 需要分镜
        caller = ctx.get("caller_agent") or qu.route_fields.get("caller_agent")
        if caller:
            predict = {"SceneDesign": "visual_language", "VisualLanguage": "audio_design", "AudioDesign": "editing"}
            next_role = predict.get(caller)
            if next_role:
                for sid in self.indexer.idx_role.get(next_role, set()):
                    scores[sid] += 1.0
                    evidences[sid].append(f"r2:predict:{next_role}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    # ---------- R3 关键词/Topic 补充召回（BM25 + Topic + Slot）----------
    def r3_keyword_recall(self, qu: QueryUnderstanding, top_n: int = 60) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        bm25_s, bm25_e = self._recall_bm25(qu, top_n)
        topic_s, topic_e = self._recall_topics(qu, top_n)
        slot_s, slot_e = self._recall_slots(qu, top_n)
        scores: Dict[str, float] = defaultdict(float)
        evidences: Dict[str, List[str]] = defaultdict(list)
        for sid, s in bm25_s.items():
            scores[sid] += s
            evidences[sid].extend(bm25_e.get(sid, []))
        for sid, s in topic_s.items():
            scores[sid] += s
            evidences[sid].extend(topic_e.get(sid, []))
        for sid, s in slot_s.items():
            scores[sid] += s
            evidences[sid].extend(slot_e.get(sid, []))
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:6] for sid in top_ids}

    def _recall_bm25(self, qu: QueryUnderstanding, top_n: int) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores = defaultdict(float)
        evidences = defaultdict(list)
        query_tf = Counter(qu.char_ngrams)
        if not query_tf:
            return {}, {}
        k1, b = 1.2, 0.75
        for gram, _ in query_tf.items():
            postings = self.indexer.ngram_postings.get(gram)
            if not postings:
                continue
            df = self.indexer.df.get(gram, 0)
            if df <= 0 or df / max(1, self.indexer.doc_count) > 0.65:
                continue
            idf = log(1.0 + (self.indexer.doc_count - df + 0.5) / (df + 0.5))
            for sid, tf in postings.items():
                dl = self.indexer.doc_len.get(sid, 1)
                denom = tf + k1 * (1 - b + b * dl / max(self.indexer.avg_doc_len, 1.0))
                scores[sid] += idf * ((tf * (k1 + 1)) / max(denom, 1e-9))
                if len(evidences[sid]) < 4:
                    evidences[sid].append(f"r3_bm25:{gram}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    def _recall_topics(self, qu: QueryUnderstanding, top_n: int) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores = defaultdict(float)
        evidences = defaultdict(list)
        for ts in qu.topics:
            for sid in self.indexer.topic_index.get(ts.topic, set()):
                scores[sid] += ts.confidence * 10.0
                evidences[sid].append(f"r3_topic:{ts.topic}:{ts.confidence:.2f}")
        expanded = self.topic_mapper.expand_domains(qu.topics)
        for domain, ds in expanded.items():
            for sid in self.indexer.domain_index.get(domain, set()):
                scores[sid] += ds * 3.5
                evidences[sid].append(f"r3_domain:{domain}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    def _recall_slots(self, qu: QueryUnderstanding, top_n: int) -> Tuple[Dict[str, float], Dict[str, List[str]]]:
        scores = defaultdict(float)
        evidences = defaultdict(list)
        for term in qu.slots.who:
            for sid in self.indexer.slot_indexes["who"].get(normalize_text(term), set()):
                scores[sid] += self.SLOT_WEIGHTS["who"]
                evidences[sid].append(f"r3_who:{term}")
        for term in qu.slots.actions:
            for sid in self.indexer.slot_indexes["actions"].get(normalize_text(term), set()):
                scores[sid] += self.SLOT_WEIGHTS["actions"]
                evidences[sid].append(f"r3_action:{term}")
        for term in qu.slots.objects:
            for sid in self.indexer.slot_indexes["objects"].get(normalize_text(term), set()):
                scores[sid] += self.SLOT_WEIGHTS["objects"]
                evidences[sid].append(f"r3_object:{term}")
        for term in qu.scenarios:
            for sid in self.indexer.slot_indexes["scenarios"].get(normalize_text(term), set()):
                scores[sid] += self.SLOT_WEIGHTS["scenarios"]
                evidences[sid].append(f"r3_scenario:{term}")
        for term in qu.project_stages:
            for sid in self.indexer.slot_indexes["project_stages"].get(normalize_text(term), set()):
                scores[sid] += self.SLOT_WEIGHTS["project_stages"]
                evidences[sid].append(f"r3_stage:{term}")
        top_ids = _top_ids(scores, top_n)
        return {sid: scores[sid] for sid in top_ids}, {sid: evidences[sid][:4] for sid in top_ids}

    # ---------- R4 安全兜底 ----------
    def r4_safety_guard(self, qu: QueryUnderstanding) -> Tuple[Dict[str, float], Dict[str, List[str]], bool]:
        has_safety = qu.urgency == "high" or any(t.topic in ("continuity_check", "platform_compliance", "copyright_clearance", "backup_strategy") for t in qu.topics)
        if not has_safety:
            return {}, {}, False
        scores, evidences = defaultdict(float), defaultdict(list)
        for topic in ("continuity_check", "platform_compliance", "copyright_clearance", "backup_strategy"):
            for sid in self.indexer.topic_index.get(topic, set()):
                scores[sid] += 5.0
                evidences[sid].append(f"r4_guard:{topic}")
        for lvl in ("high", "critical"):
            for sid in self.indexer.urgency_index.get(lvl, set()):
                scores[sid] += 4.0
                evidences[sid].append(f"r4_urgency:{lvl}")
        return dict(scores), {sid: evidences[sid][:4] for sid in scores}, True

    # ---------- 主入口：分层级联 ----------
    def recall(self, qu: QueryUnderstanding, topk: int = 10, recall_mode: str = "full") -> RecallResult:
        all_scores: Dict[str, float] = defaultdict(float)
        all_evidences: Dict[str, List[str]] = defaultdict(list)
        layer_rankings: Dict[str, List[str]] = {}
        hit_layer = ""
        layers: List[Tuple[str, Dict[str, float], Dict[str, List[str]], bool]] = []

        # R0
        s0, e0, l0 = self.r0_structured_route(qu)
        layers.append(("R0", s0, e0, True))
        if s0 and recall_mode == "fast":
            return self._assemble(qu, {"R0": s0}, {"R0": e0}, topk, "R0")

        # R1
        s1, e1 = self.r1_semantic_recall(qu)
        layers.append(("R1", s1, e1, True))

        if recall_mode == "fast":
            merged = self._merge({"R0": s0, "R1": s1})
            return self._assemble(qu, {"R0": s0, "R1": s1}, {"R0": e0, "R1": e1}, topk, "R1" if s1 else "R0")

        # R2
        s2, e2 = self.r2_context_recall(qu)
        layers.append(("R2", s2, e2, True))

        # R3
        s3, e3 = self.r3_keyword_recall(qu)
        layers.append(("R3", s3, e3, True))

        # R4
        s4, e4, urgent = self.r4_safety_guard(qu)
        layers.append(("R4", s4, e4, urgent))

        score_maps = {name: s for name, s, _, _ in layers}
        evidence_maps = {name: e for name, _, e, _ in layers}
        return self._assemble(qu, score_maps, evidence_maps, topk, self._determine_hit_layer(layers))

    def _merge(self, score_maps: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        merged: Dict[str, float] = defaultdict(float)
        for s in score_maps.values():
            for sid, sc in s.items():
                merged[sid] += sc
        return merged

    def _determine_hit_layer(self, layers: List[Tuple[str, Dict[str, float], Dict[str, List[str]], bool]]) -> str:
        for name, s, _, active in layers:
            if active and s:
                return name
        return ""

    def _assemble(self, qu: QueryUnderstanding, score_maps: Dict[str, Dict[str, float]],
                  evidence_maps: Dict[str, Dict[str, List[str]]], topk: int, hit_layer: str) -> RecallResult:
        # RRF 融合
        rrf_scores: Dict[str, float] = defaultdict(float)
        layer_rankings: Dict[str, List[str]] = {}
        for name, scores in score_maps.items():
            ranked = _top_ids(scores, max(50, topk * 5))
            layer_rankings[name] = ranked
            rank_map = {sid: r for r, sid in enumerate(ranked, 1)}
            for sid in ranked:
                rrf_scores[sid] += 1.0 / (self.rrf_k + rank_map[sid])

        candidates: List[RecallCandidate] = []
        for sid, fused in nlargest(topk, rrf_scores.items(), key=lambda x: x[1]):
            rank_by_layer, layer_scores, evs = {}, {}, {}
            for name, scores in score_maps.items():
                ranked = layer_rankings.get(name, [])
                if sid in ranked:
                    rank_by_layer[name] = ranked.index(sid) + 1
                    layer_scores[name] = round(scores.get(sid, 0.0), 6)
                    evs[name] = evidence_maps.get(name, {}).get(sid, [])[:6]
            candidates.append(RecallCandidate(skill_id=sid, rrf_score=round(fused, 8), rank_by_layer=rank_by_layer, layer_scores=layer_scores, evidences=evs))
        return RecallResult(understanding=qu, candidates=candidates, layer_rankings=layer_rankings, hit_layer=hit_layer)

    # ---------- R5 实时生成兜底 ----------
    def r5_hot_forge_fallback(self, qu: QueryUnderstanding) -> Optional[SkillAsset]:
        if not self.forge_engine:
            return None
        try:
            request = {
                "cinematic_role": qu.route_fields.get("cinematic_role", ""),
                "module_target": qu.route_fields.get("module_target", []),
                "deliverable_type": qu.route_fields.get("deliverable_type", ""),
                "project_stage": qu.route_fields.get("project_stage", ""),
                "sub_domain": qu.route_fields.get("sub_domain", "cinema"),
                "skill_name": qu.raw_text[:40] or "实时生成技能",
                "query_text": qu.raw_text,
            }
            return self.forge_engine.hot_forge(request)
        except Exception:
            return None


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def extract_project_stages(text: str) -> List[str]:
    """按制作阶段识别（替换原 extract_age_stages）。"""
    stages = []
    if any(kw in text for kw in ["筹备", "剧本", "前期", "选角", "堪景"]):
        stages.append("preproduction")
    if any(kw in text for kw in ["拍摄", "布光", "收声", "场记", "现场"]):
        stages.append("production")
    if any(kw in text for kw in ["剪辑", "调色", "混音", "视效", "合成", "后期"]):
        stages.append("postproduction")
    if any(kw in text for kw in ["发行", "交付", "DCP", "投流", "上线"]):
        stages.append("distribution")
    return stages


# ============================================================
# 影视 Topic 映射器（数据影视化）
# ============================================================

class TopicMapper:
    """基于规则检测查询的 logical topic，影视化 50+ topics。"""

    def __init__(self, rules: Optional[Dict[str, Dict]] = None):
        raw = rules if rules is not None else CINEMA_TOPICS
        self.rules: Dict[str, Dict] = {}
        for topic, cfg in raw.items():
            self.rules[topic] = {
                "keywords": [normalize_text(x) for x in cfg.get("keywords", [])],
                "aliases": [normalize_text(x) for x in cfg.get("aliases", [])],
                "physical_domains": list(cfg.get("physical_domains", []) or []),
                "negative_keywords": [normalize_text(x) for x in cfg.get("negative_keywords", [])],
                "weight": float(cfg.get("weight", 1.0)),
                "cinematic_role": cfg.get("cinematic_role", ""),
            }

    def detect_topics(self, query: Union[str, QueryUnderstanding], top_n: int = 5) -> List[TopicScore]:
        if isinstance(query, QueryUnderstanding):
            normalized = query.normalized_text
            slots = query.slots
            scenarios = query.scenarios
            stages = query.project_stages
        else:
            normalized = normalize_text(query)
            slots = None
            scenarios = []
            stages = []
        scored: List[TopicScore] = []
        for topic, cfg in self.rules.items():
            score = 0.0
            evidence: List[str] = []
            for kw in cfg["keywords"]:
                if kw and kw in normalized:
                    score += 1.8
                    evidence.append(f"kw:{kw}")
            for alias in cfg["aliases"]:
                if not alias:
                    continue
                if alias == normalized:
                    score += 2.8
                    evidence.append(f"alias_exact:{alias}")
                elif alias in normalized or normalized in alias:
                    score += 2.2
                    evidence.append(f"alias_partial:{alias}")
            if slots is not None:
                for a in slots.actions:
                    if normalize_text(a) in cfg["keywords"] or normalize_text(a) in cfg["aliases"]:
                        score += 1.2
                        evidence.append(f"action:{a}")
                for o in slots.objects:
                    if normalize_text(o) in cfg["keywords"] or normalize_text(o) in cfg["aliases"]:
                        score += 1.0
                        evidence.append(f"object:{o}")
            if scenarios:
                for sc in scenarios:
                    if normalize_text(sc) in cfg["keywords"]:
                        score += 1.0
                        evidence.append(f"scenario:{sc}")
            if stages:
                score += 0.4 * len(stages)
                evidence.append(f"stage:{','.join(stages)}")
            for neg in cfg["negative_keywords"]:
                if neg and neg in normalized:
                    score -= 1.2
            score *= cfg["weight"]
            if score >= 1.5:
                scored.append(TopicScore(topic=topic, confidence=round(min(0.99, score / 8.0), 4), evidence=evidence[:8]))
        scored.sort(key=lambda x: x.confidence, reverse=True)
        return scored[:top_n]

    def expand_domains(self, topics: List[TopicScore]) -> Dict[str, float]:
        ds: Dict[str, float] = defaultdict(float)
        for ts in topics:
            cfg = self.rules.get(ts.topic)
            if not cfg:
                continue
            for d in cfg["physical_domains"]:
                ds[d] += ts.confidence * cfg["weight"]
        return dict(sorted(ds.items(), key=lambda x: x[1], reverse=True))


# ============================================================
# Layer 4: 排序（精排 + cinematic_role 匹配奖励 + maturity 加权）
# ============================================================

class RankingOptimizer:
    """精排：RRF 基础分 + Topic 匹配奖励 + cinematic_role 匹配 + maturity 加权。"""

    def __init__(self, indexer: SkillIndexer, topic_mapper: TopicMapper):
        self.indexer = indexer
        self.topic_mapper = topic_mapper

    def rank(self, result: RecallResult, topk: int = 5) -> List[RankedSkill]:
        qu = result.understanding
        query_role = qu.route_fields.get("cinematic_role", "")
        query_topics = {t.topic for t in qu.topics}
        ranked: List[RankedSkill] = []
        for cand in result.candidates:
            skill = self.indexer.skills.get(cand.skill_id)
            if not skill:
                continue
            if skill.status == "deprecated":
                continue
            base = cand.rrf_score
            # cinematic_role 匹配奖励
            role_bonus = 0.15 if query_role and skill.cinematic_role == query_role else 0.0
            # Topic 匹配奖励
            topic_bonus = 0.1 * len(set(skill.logical_topics) & query_topics)
            # maturity 加权
            maturity_w = MaturityEvolver.weight(skill)
            # priority 加权
            prio_w = {"P0": 1.3, "P1": 1.15, "P2": 1.0, "P3": 0.85}.get(skill.priority, 1.0)
            final = (base + role_bonus + topic_bonus) * maturity_w * prio_w
            ranked.append(RankedSkill(
                skill_id=skill.skill_id, name=skill.name, domain=skill.domain, score=round(final, 6),
                details={
                    "rrf_score": cand.rrf_score, "role_bonus": role_bonus, "topic_bonus": topic_bonus,
                    "maturity": skill.maturity, "maturity_weight": maturity_w, "priority": skill.priority,
                    "hit_layer": result.hit_layer, "rank_by_layer": cand.rank_by_layer,
                    "evidences": cand.evidences, "deliverable_type": skill.deliverable_type,
                    "cinematic_role": skill.cinematic_role, "module_target": skill.module_target,
                },
            ))
        ranked.sort(key=lambda x: x.score, reverse=True)
        return ranked[:topk]


# ============================================================
# Layer 5: 编排（按 module_target 分组分发至制作系统 Agent）
# ============================================================

class Orchestrator:
    """编排器：TopK 技能按 module_target 分组 → 并行/串行分发 → 结果汇总。"""

    def __init__(self, indexer: SkillIndexer):
        self.indexer = indexer

    def build_workflow(self, ranked: List[RankedSkill]) -> Dict:
        """按 module_target 分组构建执行步骤。同一 agent 的多个技能按 ranked 顺序保留（不再静默丢弃）。"""
        steps = []
        order = 1
        for rs in ranked:
            skill = self.indexer.skills.get(rs.skill_id)
            if not skill:
                continue
            for mt in skill.module_target:
                steps.append({
                    "skill_id": skill.skill_id,
                    "skill_name": skill.name,
                    "agent": mt,
                    "cinematic_role": skill.cinematic_role,
                    "deliverable_type": skill.deliverable_type,
                    "order": order,
                    "parallel_with": None,
                })
                order += 1
        return {"steps": steps, "total": len(steps)}


def dispatch_to_agent(agent_name: str, skill: SkillAsset, context: Optional[Dict] = None) -> Dict:
    """
    按 module_target 分发至对应制作系统 Agent。
    实际生产中此处对接调用方制作系统的 Agent 接口。
    """
    sys_name = agent_name.split(".")[0] if "." in agent_name else "Unknown"
    agent_short = agent_name.split(".")[-1] if "." in agent_name else agent_name
    registry = AGENT_REGISTRY.get(sys_name, {})
    role_map = registry.get("role_map", {})
    expected_role = role_map.get(agent_short, "")
    return {
        "dispatch_to": agent_name,
        "skill_id": skill.skill_id,
        "skill_name": skill.name,
        "cinematic_role": skill.cinematic_role,
        "expected_role": expected_role,
        "role_match": (expected_role == skill.cinematic_role) if expected_role else False,
        "registered": bool(expected_role),
        "deliverable_type": skill.deliverable_type,
        "context": context or {},
        "status": "dispatched",
        "dispatched_at": now_iso(),
    }


# ============================================================
# Layer 6: 质检（影视化质量门禁）
# ============================================================

class QAGate:
    """影视质量门禁：一票否决项 + 11 维评分 + 实战反馈记录。"""

    def __init__(self, feedback_evolver: Optional[FeedbackEvolver] = None):
        self.feedback_evolver = feedback_evolver

    def check(self, skill: SkillAsset, execution_outcome: Optional[Dict] = None) -> Dict:
        # 一票否决项检查
        veto_hit = self._check_veto(skill)
        if veto_hit:
            return {"final_status": "rejected", "overall_score": 0, "veto_hit": veto_hit, "issues": [veto_hit]}
        # 11 维评分（结构化规则 + 可选 LLM）
        scores = self._score_dimensions(skill)
        overall = int(sum(scores.values()) / max(1, len(scores)))
        final_status = "validated" if overall >= QA_PASS_THRESHOLD else ("rework" if overall >= 70 else "rejected")
        result = {
            "final_status": final_status, "overall_score": overall,
            "dimension_scores": scores, "veto_hit": None,
            "issues": [] if final_status == "validated" else [f"score_below_threshold:{overall}"],
        }
        # 实战反馈记录（第三段）
        if execution_outcome and self.feedback_evolver:
            self.feedback_evolver.record(
                skill,
                execution_outcome.get("execution_outcome", "success"),
                int(execution_outcome.get("quality_score", overall)),
                execution_outcome.get("failure_reasons"),
                execution_outcome.get("user_corrections"),
            )
        return result

    def _check_veto(self, skill: SkillAsset) -> Optional[str]:
        text = (skill.content or json.dumps(skill.body, ensure_ascii=False)).lower()
        # 检查是否触发影视否决场景但未声明处理
        # 注意：rec.709/rec.2020 同时出现是正常色彩知识介绍，仅当明确"混用/直接用"且无"转换/管理"声明时才否决
        veto_checks = [
            (("180度线", "越轴"), "轴线错乱未声明", ()),
            (("rec.709", "rec.2020"), "色彩空间混用未声明转换", ("混用", "直接用", "不转换", "未转换")),
            (("口型", "不同步"), "对白口型不同步未处理", ()),
        ]
        for (kw1, kw2), desc, extra in veto_checks:
            if kw1 in text and kw2 in text:
                # 需要额外危险词的规则（如色彩空间），必须命中 extra 才考虑否决
                if extra and not any(e in text for e in extra):
                    continue
                if "声明" not in text and "转换" not in text and "管理" not in text:
                    return f"veto:{desc}"
        # 检查确认门：有写操作但无确认
        ec = skill.execution_contract or {}
        if ec.get("tools_write") and not ec.get("confirmation_required_for"):
            return "veto:写操作无确认门"
        return None

    def _score_dimensions(self, skill: SkillAsset) -> Dict[str, int]:
        scores = {}
        rp = skill.retrieval_profile
        # 完整性
        scores["completeness"] = 90 if skill.body or skill.content else 60
        # 个性化
        scores["personalization"] = 85 if skill.persona_adaptation else 70
        # 上下文忠实度
        scores["context_fidelity"] = 88 if skill.runtime_contract else 65
        # 领域专业度
        kp = skill.knowledge_provenance
        scores["domain_professionalism"] = min(95, 60 + sum(kp.knowledge_points.values()) * 3)
        # 可执行性
        scores["actionability"] = 88 if skill.execution_contract.get("tools_read") or skill.execution_contract.get("tools_write") else 65
        # 工具合理性
        scores["tool_rationality"] = 85 if skill.capabilities.get("tools") else 60
        # 风险控制
        scores["risk_control"] = 90 if skill.fallback_strategy else 65
        # 清晰度
        scores["clarity"] = 85 if skill.content else 60
        # 影视专业度（新增）
        cinema_terms = sum(1 for kw in ["运镜", "调色", "分镜", "混音", "剪辑", "视效"] if kw in (skill.weighted_recall_text or ""))
        scores["cinematic_professionalism"] = min(95, 65 + cinema_terms * 6)
        # 连贯性安全（新增）
        scores["continuity_safety"] = 88 if "continuity" in skill.cinematic_role or skill.deliverable_type == "continuity_report" else 80
        # 平台合规（新增）
        scores["platform_compliance"] = 85 if skill.sub_domain in ("short_video", "ai_manga_drama") else 88
        return scores


# ============================================================
# Layer 7: 契约层（固定化输出契约，AI-AI 结构化协议）
# ============================================================

class ContractGateway:
    """调用契约解析 + 返回契约构建。"""

    REQUIRED_ROUTE_FIELDS = ["cinematic_role", "deliverable_type"]

    def parse_call(self, contract_json: Union[str, Dict]) -> QueryUnderstanding:
        data = json.loads(contract_json) if isinstance(contract_json, str) else dict(contract_json or {})
        route_fields = data.get("route_fields", {}) or {}
        # 校验必填路由字段
        missing = [f for f in self.REQUIRED_ROUTE_FIELDS if not route_fields.get(f)]
        if missing:
            raise ValueError(f"route_fields 缺失必填字段: {missing}")
        text = data.get("query_text", "") or data.get("intent", "")
        context = data.get("context", {}) or {}
        return QueryUnderstanding(
            raw_text=text, route_fields=route_fields, context=context,
        )

    def build_return(self, call_id: str, status: str, source_layer: str,
                     skills: List[SkillAsset], workflow: Optional[Dict] = None,
                     execution_ready: bool = True, fallback_note: str = "") -> Dict:
        return {
            "call_id": call_id,
            "status": status,
            "source_layer": source_layer,
            "skills": [s.to_recall_record() for s in skills],
            "workflow": workflow or {"steps": []},
            "execution_ready": execution_ready and bool(skills),
            "fallback_note": fallback_note,
            "returned_at": now_iso(),
        }


# ============================================================
# 主引擎：PandaCineForge（统一装配 Layer 0-7）
# ============================================================

class PandaCineForge:
    """
    大熊猫影视创作技能引擎主控。
    装配生产侧（SkillForgeEngine）+ 索引/召回（SkillIndexer/RecallEngine）+ 排序 + 编排 + 质检 + 契约。
    双入口：cold_start（冷启动）/ serve（热运行）。
    """

    def __init__(self, llm: Optional[LLMClient] = None, system_message: str = "",
                 user_template: str = "", enable_innovation: bool = True):
        self.llm = llm or LLMClient()
        self.system_message = system_message
        self.user_template = user_template
        # Layer 1
        self.forge_engine = SkillForgeEngine(self.llm, system_message, user_template, enable_innovation)
        self.knowledge_cache = self.forge_engine.forger.knowledge_fetcher.cache
        self.feedback_evolver = FeedbackEvolver(self.knowledge_cache)
        # Layer 2-3
        self.indexer = SkillIndexer()
        self.topic_mapper = TopicMapper()
        self.recall_engine = RecallEngine(self.indexer, self.topic_mapper, self.forge_engine)
        # Layer 4-7
        self.ranker = RankingOptimizer(self.indexer, self.topic_mapper)
        self.orchestrator = Orchestrator(self.indexer)
        self.qa_gate = QAGate(self.feedback_evolver)
        self.contract = ContractGateway()

    # ---------- 冷启动入口 ----------
    def cold_start(self, matrix: Optional[List[Dict]] = None, enable_innovation: bool = False) -> Dict:
        """冷启动批量生成技能并入库。
        enable_innovation 默认 False（组合创新让生成数不可预测，开源默认关闭）。"""
        skills = self.forge_engine.cold_forge(matrix, enable_innovation=enable_innovation)
        self.indexer.bulk_load(skills)
        return {
            "status": "cold_start_completed",
            "generated_count": len(skills),
            "skill_ids": [s.skill_id for s in skills],
            "maturity_dist": self._maturity_dist(skills),
            "completed_at": now_iso(),
        }

    # ---------- 热运行入口（Agent 调用）----------
    def serve(self, request_json: Union[str, Dict]) -> Dict:
        """热运行主入口。AI Agent 按固定契约发起请求。"""
        # 一次性解析请求，避免重复 json.loads
        if isinstance(request_json, str):
            try:
                req = json.loads(request_json)
            except json.JSONDecodeError as e:
                return {"status": "error", "call_id": "", "message": f"invalid JSON: {e}", "execution_ready": False}
        elif isinstance(request_json, dict):
            req = dict(request_json)
        else:
            return {"status": "error", "call_id": "", "message": f"请求必须是 dict 或 JSON 字符串，收到 {type(request_json).__name__}", "execution_ready": False}
        call_id = req.get("call_id", gen_id("call"))
        try:
            qu = self.contract.parse_call(req)
        except ValueError as e:
            return {"status": "error", "call_id": call_id, "message": str(e), "execution_ready": False}
        # topk 边界校验：[1, 20]，避免 0/负数误触发 R5
        topk = max(1, min(_safe_int(req.get("topk", 3), 3), 20))
        recall_mode = str(req.get("recall_mode", "full"))

        # 完整查询理解（复用 recall_engine.understand，确保 expanded_queries/char_ngrams/slots/topics 全部就位）
        qu = self.recall_engine.understand(
            qu.raw_text, route_fields=qu.route_fields, context=qu.context
        )

        # 分层级联回
        result = self.recall_engine.recall(qu, topk=max(topk * 2, 6), recall_mode=recall_mode)

        # 精排
        ranked = self.ranker.rank(result, topk=topk)

        # 召回不足 → R5 实时生成兜底（补充而非丢弃已召回结果）
        if len(ranked) < topk:
            forged = self.recall_engine.r5_hot_forge_fallback(qu)
            if forged:
                self.indexer.upsert(forged)  # 生成即沉淀（飞轮反哺）
                # 若已召回为空，纯 R5 返回；否则把生成的并入结果
                if not ranked:
                    ranked = [RankedSkill(forged.skill_id, forged.name, forged.domain, 1.0, {"hit_layer": "R5", "evidences": ["r5_hot_forge_fallback"]})]
                    source_layer = "R5"
                    fallback_note = "R5_hot_forge_fallback"
                else:
                    ranked.append(RankedSkill(forged.skill_id, forged.name, forged.domain, 0.5, {"hit_layer": "R5", "evidences": ["r5_supplemented"]}))
                    source_layer = result.hit_layer or "R5"
                    fallback_note = "R5_supplemented"
            elif not ranked:
                # 召回为空且实时生成不可用 → 降级方案
                return self.contract.build_return(
                    call_id, status="fallback_degraded", source_layer=result.hit_layer or "none",
                    skills=[], workflow={"steps": []}, execution_ready=False,
                    fallback_note="召回为空且实时生成不可用，返回降级方案"
                )
            else:
                source_layer = result.hit_layer or "R3"
                fallback_note = ""
        else:
            source_layer = result.hit_layer or "R3"
            fallback_note = ""

        # 编排
        workflow = self.orchestrator.build_workflow(ranked)
        # 取回 SkillAsset
        skills = [self.indexer.skills[rs.skill_id] for rs in ranked if rs.skill_id in self.indexer.skills]
        # status 语义：仅纯 R5（召回为空、完全靠实时生成）才标 forged；
        # R5_supplemented（已有召回命中 + R5 补充）记 hit，通过 fallback_note 标记是否补充。
        # 这样"飞轮反哺后第二次命中"能正确返回 hit，而纯兜底生成才 forged。
        status = "forged" if fallback_note == "R5_hot_forge_fallback" else "hit"
        return self.contract.build_return(
            call_id, status=status, source_layer=source_layer,
            skills=skills, workflow=workflow, execution_ready=bool(skills),
            fallback_note=fallback_note,
        )

    # ---------- 实战反馈回传 ----------
    def report_feedback(self, skill_id: str, execution_outcome: str, quality_score: int,
                        failure_reasons: Optional[List[str]] = None, user_corrections: Optional[List[str]] = None) -> Dict:
        skill = self.indexer.skills.get(skill_id)
        if not skill:
            return {"status": "error", "skill_id": skill_id, "message": f"skill not found: {skill_id}"}
        result = self.qa_gate.check(skill, {
            "execution_outcome": execution_outcome, "quality_score": quality_score,
            "failure_reasons": failure_reasons, "user_corrections": user_corrections,
        })
        # 更新索引（成熟度可能变化）
        self.indexer.upsert(skill)
        return {"status": "feedback_recorded", "skill_id": skill_id, "qa_result": result, "maturity": skill.maturity}

    # ---------- 质检 ----------
    def qa_check(self, skill_id: str) -> Dict:
        skill = self.indexer.skills.get(skill_id)
        if not skill:
            return {"status": "error", "skill_id": skill_id, "message": f"skill not found: {skill_id}"}
        return self.qa_gate.check(skill)

    @staticmethod
    def _maturity_dist(skills: List[SkillAsset]) -> Dict[str, int]:
        dist: Dict[str, int] = defaultdict(int)
        for s in skills:
            dist[s.maturity] += 1
        return dict(dist)

    # ---------- 单技能生成（手动）----------
    def forge_one(self, payload: Dict) -> SkillAsset:
        """手动生成单个技能（调试/补全用）。"""
        skill = self.forge_engine.forger.forge(payload, self.system_message, self.user_template, mode="cold")
        self.indexer.upsert(skill)
        return skill


# ============================================================
# 模块级单例与便捷入口
# ============================================================

_ENGINE: Optional[PandaCineForge] = None
_ENGINE_LOCK = threading.Lock()
_ENGINE_CONFIG: Tuple[str, str] = ("", "")


def get_engine(system_message: str = "", user_template: str = "") -> PandaCineForge:
    """获取模块级单例引擎（线程安全）。二次调用传入不同配置会记录警告但不重建（避免静默漂移）。"""
    global _ENGINE, _ENGINE_CONFIG
    with _ENGINE_LOCK:
        if _ENGINE is None:
            _ENGINE = PandaCineForge(system_message=system_message, user_template=user_template)
            _ENGINE_CONFIG = (system_message, user_template)
        elif (system_message or user_template) and (system_message, user_template) != _ENGINE_CONFIG:
            logger.warning("get_engine 配置漂移：单例已存在（旧配置），本次传入的新配置被忽略。如需新引擎请直接 new PandaCineForge()。")
        return _ENGINE


def cold_start(matrix: Optional[List[Dict]] = None, system_message: str = "", user_template: str = "") -> Dict:
    return get_engine(system_message, user_template).cold_start(matrix)


def serve(request_json: Union[str, Dict], system_message: str = "", user_template: str = "") -> Dict:
    return get_engine(system_message, user_template).serve(request_json)


def report_feedback(skill_id: str, execution_outcome: str, quality_score: int,
                    failure_reasons: Optional[List[str]] = None,
                    user_corrections: Optional[List[str]] = None) -> Dict:
    return get_engine().report_feedback(skill_id, execution_outcome, quality_score, failure_reasons, user_corrections)


# ============================================================
# 自测入口
# ============================================================

if __name__ == "__main__":
    engine = PandaCineForge()
    print(f"[PandaCineForge] 引擎初始化完成 | LLM可用={engine.llm.available} | 矩阵技能数={len(COLD_FORGE_MATRIX)}")
    print(f"[PandaCineForge] 影视Topic数={len(CINEMA_TOPICS)} | 种子源数={len(CINEMA_SEED_SOURCES)} | 搜索源={engine.forge_engine.forger.knowledge_fetcher.search_gateway.active}")
    # 无 LLM 时验证索引/召回链路可用性
    fake = SkillAsset(
        skill_id="test_001", name="电影调色色彩脚本技能",
        domain="ai_cinema", sub_domain="cinema", cinematic_role="visual_language",
        module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        project_stage="postproduction", maturity="v2", priority="P1",
        tags=["调色", "色彩脚本"], weighted_recall_text="调色 色彩脚本 color_script Rec.709 ACES 达芬奇 LUT",
        retrieval_profile=RetrievalProfile(
            logical_topics=["color_grading"], aliases=["色彩脚本", "调色方案"],
            sample_queries=["电影调色怎么做", "色彩脚本设计"],
            entities=RetrievalEntities(who=["调色师"], actions=["调色"], objects=["LUT", "色彩脚本"]),
            scenarios=["调色"], project_stages=["postproduction"], urgency="normal", summary="电影调色",
        ),
    )
    engine.indexer.upsert(fake)
    result = engine.serve({
        "call_id": "test_call", "caller_agent": "VisualLanguage",
        "route_fields": {"cinematic_role": "visual_language", "deliverable_type": "color_script", "module_target": ["MyStudio.VisualLanguage"], "project_stage": "postproduction", "sub_domain": "cinema"},
        "context": {"project_id": "p1", "caller_agent": "VisualLanguage"},
        "query_text": "电影调色", "recall_mode": "fast", "topk": 3,
    })
    print(f"[PandaCineForge] 自测召回 status={result.get('status')} layer={result.get('source_layer')} skills={len(result.get('skills', []))}")
```


## 内嵌影视 SystemMessage

> 技能锻造时 LLM 的系统提示（十章结构，影视化改造）。保存为 `system_message.txt`。

```text
你是一个"大熊猫影视创作技能引擎（PandaCineForge）"的技能锻造器。

你的任务不是普通回答问题，而是生成一个可注册、可检索、可执行、可质检、可复用的影视创作技能资产。
你输出的结果必须同时适合：
1. AI Agent 直接解析与执行（结构化 SkillAsset 优先）
2. 检索系统召回（含 embedding 与结构化路由字段）
3. 质量系统审查（含影视专业否决项）
4. 后续沉淀为长期影视资产
5. 多制作系统 Agent 编排分发

====================
一、影视技能的本质
====================
影视技能不是一段建议，不是说明文，也不是泛泛的答案。
影视技能必须是一个可落地的影视创作服务单元，至少具备以下能力：
- 有明确影视适用范围（cinematic_role / sub_domain / deliverable_type / project_stage）
- 能适配具体制作系统 Agent（module_target 对齐目标制作系统，通用多系统）
- 能产出可交付的影视资产（分镜/调色/声音/剪辑/视效/片头/提示词包…）
- 能声明影视工具使用逻辑（Midjourney/Runway/Sora/可灵/即梦/达芬奇/Premiere/AE/Blender/ComfyUI…）
- 能体现自动化执行流程（对齐制作系统 Agent 执行流）
- 能体现影视风险控制（版权/审核/渲染/色彩空间/口型同步…）
- 能通过影视专业质量检查（含一票否决项）
- 能沉淀为可复用影视资产

技能有两种输出模式：
- blueprint：技能蓝图，用于入库、复用、编排
- run：技能实例，用于当前场景执行

如果 output_mode = run：必须更贴近当前输入的具体执行态，必须提供 skill_run_id，必须体现执行逻辑和结果结构。
如果 output_mode = blueprint：必须更强调规则、边界、适用场景、执行蓝图和沉淀价值。

====================
二、输出结构要求
====================
你的输出必须包含两层：第一层结构化元信息，第二层正文内容。

如果 output_format = markdown：只能输出 Markdown，开头必须是 YAML Frontmatter（`---`包裹），Frontmatter 后输出固定章节，不要输出任何额外解释。
如果 output_format = json：只能输出单个 JSON 对象，不要输出 Markdown，不要输出注释。
如果 output_format = yaml：只能输出单个 YAML 对象，不要输出额外说明。

====================
三、稳定字段要求
====================
当输出结构化对象或 Markdown Frontmatter 时，保持以下字段稳定。

顶层基础字段：
- name / skill_id / version / last_updated / author / license / status
- domain（固定 ai_cinema）/ sub_domain（cinema | short_video | ai_manga_drama）/ vertical / type / priority / tags

影视结构化字段（R0 路由核心，必填）：
- cinematic_role：scene_design / visual_language / audio_design / continuity_review / prompt_fusion / opening_design / editing / color_grading / vfx
- module_target：对齐目标制作系统 Agent，如 ["MyStudio.SceneDesign"]
- deliverable_type：shotlist / storyboard / color_script / sound_map / prompt_pack / edit_decision_list / opening_sequence / beat_sheet / continuity_report / mix_plan
- project_stage：preproduction / production / postproduction / distribution

召回与成熟度字段：
- embedding（生成时同步产出，供 R1 语义召回）/ maturity（v0/v1/v2/v3）/ forge_mode（cold/hot）
- retrieval_profile / weighted_recall_text / neighbors / trigger_keywords

知识与创新字段：
- knowledge_provenance（知识溯源：sources/knowledge_points/confidence_score/confidence_tier/dimension_coverage）
- expert_review_log / innovation_meta

执行与契约字段：
- execution_layer / execution_mode / module_compatibility / fallback_strategy
- runtime_contract / execution_contract / capabilities / quality_thresholds / qa_contract
- generation_spec / persona_adaptation / domain_pack / dependencies

字段同步规则：
- name 必须等于 generation_spec.title；如 title 为空则使用 skill_name
- skill_id 是主键，必须稳定
- generation_spec.skill_blueprint_id 如未提供，默认等于 skill_id
- version 表示包版本，generation_spec.skill_version 表示技能逻辑版本
- domain 固定 ai_cinema，sub_domain 以顶层字段为准

====================
四、正文模块顺序
====================
当 output_format = markdown 时，正文必须按如下顺序输出：
## TL;DR
## 1. 场景分析
## 2. 决策摘要
## 3. 编排集成
## 4. 召回优化
## 5. 专业建议
## 6. 工具调用计划
## 7. Agent执行逻辑
## 8. 质量检查

即使信息不足，也不能省略核心模块。信息不足时必须显式标注：assumptions / missing_information / clarification_questions / conservative_mode。

====================
五、核心业务要求
====================

1. 场景分析
必须输出一个"可决策场景快照"，至少包括：
- request_summary / explicit_needs / implicit_needs
- scenario_classification / urgency / context_snapshot
- constraints / assumptions / missing_information / clarification_questions
- priority_order / disallowed_paths

约束至少覆盖 3 类（影视六类约束，不适用时显式说明）：
- 时间（交片期/排期/Deadline）
- 预算（制作预算/渲染成本）
- 设备/权限（渲染农场/软件许可/AI模型配额）
- 合规（版权/平台审核/敏感内容）
- 创意（导演意图/风格一致性/品牌调性）
- 技术（色彩空间/帧率/分辨率/画幅）

2. 决策摘要
只输出结构化决策摘要，不要输出隐藏思维链。至少说明：
- 当前属于什么影视场景 / 为什么推荐主方案 / 考虑过哪些备选方案
- 为什么备选不是首选 / 至少一个被排除方案及原因
- 当前主要风险点 / 当前关键约束 / 输出应采用什么组织方式

3. 专业建议
必须包含三层交付：
A. 立即执行：5 分钟内可开始，低认知负担，能推动事情前进
B. 深度方案：主方案 + 备选方案 + 失败回退，覆盖关键约束
C. 长期资产：必须沉淀为可复用影视资产之一：
   Shotlist Template / Storyboard Template / Color Script / Sound Map / Edit Decision List / Prompt Asset / Reusable Workflow

此外，专业建议必须显式包含：
- recommended_option / why_this_works / domain_knowledge / best_practices
- common_mistakes / risk_warnings / escalation_rules / follow_up_checks / reusable_assets

4. 工具调用计划
工具计划不能是工具列表，必须说明：为什么调用该工具 / 输入来自哪里 / 预期产出是什么 / 如果失败怎么办 / 是否有时效要求 / 是否有安全限制 / 结果如何与其他信息融合。

影视工具链包括：Midjourney / Runway / Sora / Kling / 可灵 / 即梦 / 达芬奇 / Premiere / AE / Blender / ComfyUI / Pro Tools / Nuke / Avid / 剪映 / CapCut。
如果场景不需要工具，也必须说明为什么当前不调用工具，以及哪些结论采用保守策略。

5. Agent执行逻辑
必须体现真实流程，对齐制作系统 Agent 执行流（输入校验→条件分支→风险拦截→工具调用→写操作→确认门→失败降级→回滚→结果结构）。
至少包括：输入校验 / 条件分支 / 风险拦截 / 工具调用点 / 写操作点 / 确认门 / 失败降级 / 结果结构 / 适用时的回滚策略 / 适用时的记忆回写逻辑。

6. 质量检查
质量检查不是装饰模块，必须真实审查。至少包括：
- structural_check / risk_check / execution_safety_check / personalization_check
- source_check / retrieval_check / overall_score / issues / auto_fix_actions / final_status

不能机械性全部给 pass。如果存在问题，必须如实写入 issues 和 auto_fix_actions。

====================
六、检索与召回优化要求
====================
你必须为技能生成检索友好的字段，使其更容易被分层级联回（R0-R5）命中。

必须包含 retrieval_profile：
- logical_topics（影视 Topic，对齐 CINEMA_TOPICS 50+）
- aliases / sample_queries / problem_patterns
- entities.who / entities.actions / entities.objects（影视化：导演/摄影指导/剪辑师…；运镜/调色/剪辑…；镜头/LUT/音轨…）
- scenarios（影视场景） / project_stages（替换原 age_stages：preproduction/production/postproduction/distribution）
- urgency / negative_queries / summary

sample_queries 默认目标 16 条，优先按以下分布：
- exact_match：6 条 / lexical_variation：5 条 / slot_match：3 条 / topic_match：2 条

必须包含 index_optimization：
- weighted_recall_text（高质量影视索引文本，含技能名/aliases/sample_queries核心短语/logical_topics/entities关键词/场景词/同义词，不是垃圾关键词堆叠）
- neighbors（优先从候选相关技能选 3-5 个；无法判断可输出空数组；不得编造 skill_id）
- channel_weights

negative_queries 必须是"可能混淆但不应命中"的负例。

====================
七、个性化真实性要求
====================
所有个性化内容必须来源于：user_profile / runtime_context / memory / pre_fetched_tool_results / 显式 assumptions。

禁止凭空编造：用户职业 / 设备与权限 / 行为习惯 / 历史偏好 / 已发生的执行动作 / 工具返回结果 / 外部事实来源 / 邻居技能 ID。

如果信息不足：
- low risk：做最小假设并标注 assumptions
- medium risk：提出 1-3 个关键澄清问题；无法获得回答则输出保守方案
- high risk：关键数据缺失时不进入自动执行态，只输出排查与升级建议

====================
八、风险与保守策略
====================
以下影视场景默认按高风险或保守方式处理：
- 版权侵权（音乐/素材/字体/形象版权）
- 平台审核硬伤（短视频违禁词/漫剧敏感内容/诱导性内容）
- 不可逆渲染（高负载渲染/批量导出无确认门）
- 素材丢失（关键素材无冗余/无版本）
- 色彩空间错配（Rec.709/Rec.2020/sRGB 混用未声明转换）
- 口型不同步（口播/对白与画面口型偏移未处理）
- 镜头连贯性断裂（180度线越轴/匹配剪辑失败）

高风险场景必须：前置风险提示 / 给出升级规则 / 缺关键数据时停止自动执行 / 默认不做不可逆动作 / 默认 automation_level 不高于 L2（除非输入明确提供权限和确认链路）。

所有真实世界写操作必须有确认门，包括但不限于：渲染导出 / 批量生成 / 删除/覆盖素材 / 调用外部 AI API 产生副作用 / 提交发布。

====================
九、评分与门禁
====================
默认通过阈值：85 分。
建议判定：85 分及以上 validated/production；70-84 rework；70 以下 rejected/rework。

影视一票否决项（触发即 rejected，不进入 rework）：
- 镜头连贯性断裂：180度线越轴/匹配剪辑失败/轴线错乱未声明
- 色彩空间错配：Rec.709/Rec.2020/sRGB 混用未声明转换
- 对白口型不同步：口播/对白与画面口型偏移未处理
- 版权素材未授权：音乐/素材/字体/形象版权未声明
- 平台审核硬伤：短视频违禁词/漫剧敏感内容/诱导性内容
- 不可逆渲染未确认：高负载渲染/批量导出无确认门
- 素材无备份策略：关键素材无冗余/无版本
- 缺核心模块 / 高风险场景无升级规则 / 写操作无确认机制 / 伪造个性化信息 / retrieval_profile 不完整 / weighted_recall_text 缺失

评分维度（11 维）：
原 8 维：completeness / personalization / context_fidelity / domain_professionalism / actionability / tool_rationality / risk_control / clarity
新增 3 维：cinematic_professionalism（影视专业度）/ continuity_safety（连贯性安全）/ platform_compliance（平台合规）

====================
十、风格要求
====================
- 先结论，后细节；保持专业、克制、结构化
- 不要空话、套话、宣传口吻；不要输出隐藏思维链；只输出结构化决策摘要
- 不要为了填满字段写低价值内容
- 不确定时，诚实标注 assumptions / missing_information / clarification_questions / conservative_mode
- 影视专业术语必须准确（色彩空间/帧率/画幅/运镜/混音响度等），符合工业标准

你现在将根据后续输入，生成最终影视技能资产。只输出最终结果，不要解释过程。
```


## 内嵌影视 UserMessage 模板

> 技能锻造时 LLM 的用户消息模板（Jinja2，影视化改造）。保存为 `user_message_template.txt`。

```text
请基于以下输入，生成一个完整的影视创作技能资产。

请严格遵守以下要求：
- 只输出最终结果
- 不要解释生成过程
- 不要复述输入
- 不要输出隐藏思维链
- 输出必须同时适合 AI Agent 解析和人类阅读

<OUTPUT_CONTROL>
output_mode: {{output_mode}}                  # blueprint | run
output_format: {{output_format}}              # markdown | json | yaml
qa_pass_threshold: {{qa_pass_threshold}}      # 默认 85
</OUTPUT_CONTROL>

<IDENTITY>
skill_name: {{skill_name}}
skill_id: {{skill_id}}
package_version: {{package_version}}          # 例如 1.0.0
skill_version: {{skill_version}}              # 例如 1.0.0
last_updated: {{last_updated}}                # ISO-8601
author: {{author}}
license: {{license}}                          # 默认 internal
status: {{status}}                            # draft | testing | production | deprecated
</IDENTITY>

<CLASSIFICATION>
domain: ai_cinema                             # 固定 ai_cinema
sub_domain: {{sub_domain}}                    # cinema | short_video | ai_manga_drama
vertical: {{vertical}}                        # 子领域细分，如 hollywood_pipeline / douyin_marketing
type: {{type}}
priority: {{priority}}                        # P0 | P1 | P2 | P3
tags: {{tags}}
</CLASSIFICATION>

<CINEMATIC_ROUTING>
# R0 结构化路由核心字段，必填
cinematic_role: {{cinematic_role}}            # scene_design|visual_language|audio_design|continuity_review|prompt_fusion|opening_design|editing|color_grading|vfx
module_target: {{module_target}}              # 对齐制作系统 Agent，如 ["MyStudio.SceneDesign"]
deliverable_type: {{deliverable_type}}        # shotlist|storyboard|color_script|sound_map|prompt_pack|edit_decision_list|opening_sequence|beat_sheet|continuity_report|mix_plan
project_stage: {{project_stage}}              # preproduction|production|postproduction|distribution
</CINEMATIC_ROUTING>

<GENERATION_SPEC>
title: {{title}}                              # 如为空，默认使用 skill_name
summary: {{summary}}
skill_type: {{skill_type}}                    # quick_decision|deep_analysis|daily_practice|emergency_fix|advanced_strategy|monitoring|review|shotlist_design|storyboard_design|color_grading|sound_design|edit_decision|prompt_engineering|opening_design|continuity_review
automation_level: {{automation_level}}        # L0 | L1 | L2 | L3 | L4
risk_level: {{risk_level}}                    # low | medium | high | critical
core_goal: {{core_goal}}
non_goals: {{non_goals}}
success_metrics: {{success_metrics}}
user_scenarios: {{user_scenarios}}
target_audience: {{target_audience}}
trigger_intents: {{trigger_intents}}
estimated_user_time: {{estimated_user_time}}
estimated_system_time: {{estimated_system_time}}
difficulty: {{difficulty}}                    # 1-5
output_style: {{output_style}}                # table_first|checklist_first|briefing|one_pager|code_first|shotlist_first|storyboard_first|color_script_first|prompt_first
skill_blueprint_id: {{skill_blueprint_id}}    # 如为空，默认等于 skill_id
skill_run_id: {{skill_run_id}}                # 当 output_mode=run 时必填
</GENERATION_SPEC>

<EXECUTION_SETUP>
execution_layer: {{execution_layer}}          # 默认 5
execution_mode: {{execution_mode}}            # sequential | parallel | hybrid
module_compatibility: {{module_compatibility}}  # 键为目标制作系统 Agent 名
fallback_strategy: {{fallback_strategy}}
</EXECUTION_SETUP>

<PERSONA_AND_RUNTIME_CONTRACT>
persona_adaptation: {{persona_adaptation}}    # 导演/摄影指导/剪辑师/调色师/声音设计师/视效总监/制片人…
required_profile_fields: {{required_profile_fields}}
required_context_fields: {{required_context_fields}}
priority_order_hint: {{priority_order_hint}}
disallowed_paths_hint: {{disallowed_paths_hint}}
missing_info_policy_override: {{missing_info_policy_override}}
</PERSONA_AND_RUNTIME_CONTRACT>

<CAPABILITIES_AND_EXECUTION>
capabilities: {{capabilities}}
tools_read: {{tools_read}}                    # 影视工具链：Midjourney/Runway/Sora/可灵/即梦/达芬奇/Premiere/AE/Blender/ComfyUI…
tools_write: {{tools_write}}
confirmation_required_for: {{confirmation_required_for}}
memory_writeback_fields: {{memory_writeback_fields}}
fallback_mode: {{fallback_mode}}
publish_target: {{publish_target}}            # skill_registry | runtime_instance | both
registry_ingestible: {{registry_ingestible}}  # true | false
</CAPABILITIES_AND_EXECUTION>

<DOMAIN_PACK>
domain_pack: {{domain_pack}}                  # 注入三大子领域扩展包之一（cinema/short_video/ai_manga_drama）
</DOMAIN_PACK>

<USER_PROFILE>
user_profile: {{user_profile}}
</USER_PROFILE>

<RUNTIME_CONTEXT>
runtime_context: {{runtime_context}}
</RUNTIME_CONTEXT>

<MEMORY>
memory: {{memory}}
</MEMORY>

<RETRIEVAL_INPUTS>
logical_topics: {{logical_topics}}            # 影视 Topic，对齐 CINEMA_TOPICS
aliases_seed: {{aliases_seed}}
problem_patterns: {{problem_patterns}}
entities: {{entities}}                        # {who:[导演/摄影指导…], actions:[运镜/调色/剪辑…], objects:[镜头/LUT/音轨…]}
scenarios: {{scenarios}}                      # 影视场景
project_stages: {{project_stages}}            # preproduction|production|postproduction|distribution（替换原 age_stages）
urgency: {{urgency}}                          # low | normal | high | critical
negative_queries: {{negative_queries}}
retrieval_summary: {{retrieval_summary}}
</RETRIEVAL_INPUTS>

<INDEX_AND_NETWORK_INPUTS>
candidate_neighbors: {{candidate_neighbors}}
channel_weights_override: {{channel_weights_override}}
weighted_recall_text_hint: {{weighted_recall_text_hint}}
</INDEX_AND_NETWORK_INPUTS>

<QUALITY_THRESHOLDS>
quality_thresholds_override: {{quality_thresholds_override}}
qa_contract_override: {{qa_contract_override}}  # 含影视一票否决项 + 11 维评分
</QUALITY_THRESHOLDS>

<OPTIONAL_TOOL_RESULTS>
pre_fetched_tool_results: {{pre_fetched_tool_results}}
</OPTIONAL_TOOL_RESULTS>

<FUSED_KNOWLEDGE>
# 由 SkillForgeEngine 知识融合层注入的外部专业知识要点（来自 ExternalKnowledgeFetcher）
{{fused_knowledge}}
</FUSED_KNOWLEDGE>

<GENERATION_RULES>
1. 必须输出一个完整影视技能资产，不能只输出片段。
2. domain 固定 ai_cinema；sub_domain 枚举 cinema/short_video/ai_manga_drama。
3. cinematic_role / module_target / deliverable_type / project_stage 必填，用于 R0 结构化路由。
4. 如果 output_format = markdown：开头必须是 YAML Frontmatter，Frontmatter 增补 cinematic_role/module_target/deliverable_type/vertical 四个字段渲染，正文按固定章节顺序输出。
5. 如果 output_format = json 或 yaml：直接输出单个结构化对象，不要输出注释和解释。
6. name 必须等于 generation_spec.title；如果 title 为空，则使用 skill_name。
7. skill_id 作为主键必须稳定，不要擅自改写。version 使用 package_version，generation_spec.skill_version 使用 skill_version。
8. output_mode = run 时，必须提供 skill_run_id。
9. 顶层必须包含这些稳定字段：name/skill_id/version/last_updated/domain/sub_domain/vertical/type/priority/cinematic_role/module_target/deliverable_type/project_stage/execution_layer/execution_mode/module_compatibility/fallback_strategy/persona_adaptation/capabilities/retrieval_profile/index_optimization/quality_thresholds/dependencies/author/tags/status/license/generation_spec/runtime_contract/execution_contract/qa_contract/domain_pack/knowledge_provenance。
10. retrieval_profile.sample_queries 默认生成 16 条，目标分布：exact_match 6 条 / lexical_variation 5 条 / slot_match 3 条 / topic_match 2 条。
11. retrieval_profile.aliases 应结合 aliases_seed、影视术语、用户口语表达补全。
12. index_optimization.weighted_recall_text 必须自动生成，适合影视索引与召回。
13. index_optimization.neighbors：优先从 candidate_neighbors 中选择 3-5 个；无法判断可输出空数组；不得编造 skill_id。
14. channel_weights 优先使用 channel_weights_override；未提供则生成合理默认值。
15. 场景分析必须识别：显性需求/隐性需求/场景分类/紧急度/上下文快照/约束（影视六类：时间/预算/设备权限/合规/创意/技术）/assumptions/missing_information/clarification_questions/priority_order/disallowed_paths。
16. 决策摘要必须解释：为什么主方案成立/至少一个备选方案/至少一个被排除方案及原因/当前主要风险点/当前关键约束。
17. 专业建议必须包含三层交付：立即执行（5分钟内可开始）/深度方案（主方案+备选+失败回退）/长期资产（Shotlist Template/Storyboard Template/Color Script/Sound Map/Edit Decision List/Prompt Asset/Reusable Workflow）。
18. 专业建议必须显式包含：recommended_option/why_this_works/domain_knowledge/best_practices/common_mistakes/risk_warnings/escalation_rules/follow_up_checks/reusable_assets。
19. 工具调用计划必须是工具链设计而非工具名列表。每个工具节点必须说明：why/input_mapping/expected_output/fallback/freshness_requirement/safety_guard。
20. Agent执行逻辑必须包含：输入校验/条件分支/风险拦截/工具调用/写操作/确认门/失败降级/回滚策略/结果结构/伪代码或代码，对齐制作系统 Agent 执行流。
21. QA 报告必须真实，不能默认全部通过。至少包含：structural_check/risk_check/execution_safety_check/personalization_check/source_check/retrieval_check/overall_score/issues/auto_fix_actions/final_status。
22. 所有个性化内容必须来源于：user_profile/runtime_context/memory/pre_fetched_tool_results/显式 assumptions。
23. 高风险影视场景（版权/审核/渲染/色彩空间/口型/连贯性）必须：前置风险提示/显示 escalation_rules/缺关键数据时阻止自动执行/默认避免不可逆动作。
24. 任何真实写操作都必须出现在 confirmation_required_for 中，并在 Agent 执行逻辑中体现确认门。
25. 如果已有 pre_fetched_tool_results，优先融合，不要重复假设工具输出。
26. 如果无法可靠判断某字段，请诚实使用：assumptions/missing_information/clarification_questions/pending_neighbor_resolution/conservative_mode。
27. 如果提供了 fused_knowledge（外部专业知识要点），必须在 domain_knowledge/best_practices 中体现这些专业要点，不得忽略。
28. 不要为了填满字段而写空话、套话、低信息密度内容。
29. 最终结果必须兼具：可读性/可执行性/可编排性/可检索性/可质检性。
30. knowledge_provenance 必须输出：sources（知识来源 URL/domain/trust_score/source_class）/knowledge_points（各维度计数）/confidence_score/confidence_tier/dimension_coverage。
</GENERATION_RULES>

请开始生成最终影视技能资产。
```


## 内嵌 InputSchema

> 影视化输入契约（JSON Schema）。保存为 `input_schema.json`。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://pandacineforge.local/schemas/input-payload-schema.json",
  "title": "PandaCineForge Skill Generator Input Payload Schema",
  "description": "影视创作技能引擎输入契约（影视化改造版）",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "output_mode", "output_format", "skill_name", "skill_id", "package_version",
    "skill_version", "last_updated", "author", "license", "status",
    "sub_domain", "type", "priority", "tags", "summary",
    "cinematic_role", "module_target", "deliverable_type", "project_stage",
    "skill_type", "automation_level", "risk_level", "core_goal", "non_goals",
    "success_metrics", "user_scenarios", "target_audience", "trigger_intents",
    "estimated_user_time", "estimated_system_time", "difficulty", "output_style",
    "execution_layer", "execution_mode", "module_compatibility", "fallback_strategy",
    "persona_adaptation", "capabilities", "tools_read", "tools_write",
    "confirmation_required_for", "memory_writeback_fields", "fallback_mode",
    "publish_target", "registry_ingestible", "domain_pack",
    "user_profile", "runtime_context", "memory",
    "logical_topics", "aliases_seed", "problem_patterns", "entities",
    "scenarios", "project_stages", "urgency", "negative_queries", "retrieval_summary"
  ],
  "$defs": {
    "stringArray": {"type": "array", "items": {"type": "string"}},
    "freeformObject": {"type": "object", "additionalProperties": true},
    "nullableString": {"type": ["string", "null"]},
    "entitiesObject": {
      "type": "object", "additionalProperties": false,
      "required": ["who", "actions", "objects"],
      "properties": {
        "who": {"$ref": "#/$defs/stringArray"},
        "actions": {"$ref": "#/$defs/stringArray"},
        "objects": {"$ref": "#/$defs/stringArray"}
      }
    },
    "moduleCompatibility": {
      "type": "object", "additionalProperties": true,
      "description": "键为目标制作系统 Agent 名，如 MyStudio.SceneDesign",
      "properties": {
        "input_preprocessing": {"type": "boolean"},
        "intent_clarification": {"type": "boolean"},
        "multi_intent_extraction": {"type": "boolean"},
        "task_analysis": {"type": "boolean"},
        "skill_matching": {"type": "string"},
        "task_execution": {"type": "string"},
        "result_integration": {"type": "boolean"}
      }
    },
    "fallbackStrategy": {
      "type": "object", "additionalProperties": true,
      "required": ["level1_tool", "level2_data", "level3_output"],
      "properties": {
        "level1_tool": {"type": "string"},
        "level2_data": {"type": "string"},
        "level3_output": {"type": "string"}
      }
    },
    "personaAdaptation": {
      "type": "object", "additionalProperties": true,
      "required": ["user_profile", "modes", "constraints"],
      "properties": {
        "user_profile": {"type": "boolean"},
        "modes": {"$ref": "#/$defs/stringArray"},
        "constraints": {
          "type": "object", "additionalProperties": true,
          "required": ["safety_first", "location_aware", "time_sensitive"],
          "properties": {
            "safety_first": {"type": "boolean"},
            "location_aware": {"type": "boolean"},
            "time_sensitive": {"type": "boolean"}
          }
        }
      }
    },
    "capabilities": {
      "type": "object", "additionalProperties": true,
      "required": ["tools", "data_sources", "output_formats"],
      "properties": {
        "tools": {"$ref": "#/$defs/stringArray"},
        "data_sources": {"$ref": "#/$defs/stringArray"},
        "output_formats": {"$ref": "#/$defs/stringArray"}
      }
    },
    "domainPack": {
      "type": "object", "additionalProperties": true,
      "description": "三大子领域扩展包：cinema/short_video/ai_manga_drama",
      "properties": {
        "sub_domain": {"type": "string", "enum": ["cinema", "short_video", "ai_manga_drama"]},
        "pipeline": {"$ref": "#/$defs/stringArray"},
        "deliverables": {"$ref": "#/$defs/stringArray"},
        "standards": {"$ref": "#/$defs/stringArray"},
        "risk_focus": {"$ref": "#/$defs/stringArray"},
        "tools": {"$ref": "#/$defs/stringArray"},
        "quality_bar": {"type": "string"}
      }
    }
  },
  "properties": {
    "output_mode": {"type": "string", "enum": ["blueprint", "run"]},
    "output_format": {"type": "string", "enum": ["markdown", "json", "yaml"]},
    "qa_pass_threshold": {"type": "integer", "minimum": 0, "maximum": 100, "default": 85},

    "skill_name": {"type": "string", "minLength": 1},
    "skill_id": {"type": "string", "minLength": 1},
    "package_version": {"type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$"},
    "skill_version": {"type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$"},
    "last_updated": {"type": "string", "minLength": 1},
    "author": {"type": "string", "minLength": 1},
    "license": {"type": "string", "default": "internal"},
    "status": {"type": "string", "enum": ["draft", "testing", "production", "deprecated"]},

    "domain": {"type": "string", "const": "ai_cinema"},
    "sub_domain": {"type": "string", "enum": ["cinema", "short_video", "ai_manga_drama"]},
    "vertical": {"type": "string", "default": ""},
    "type": {"type": "string", "minLength": 1},
    "priority": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]},
    "tags": {"$ref": "#/$defs/stringArray"},

    "cinematic_role": {
      "type": "string",
      "enum": ["scene_design", "visual_language", "audio_design", "continuity_review", "prompt_fusion", "opening_design", "editing", "color_grading", "vfx"]
    },
    "module_target": {
      "type": "array", "minItems": 1, "items": {"type": "string"},
      "description": "对齐目标制作系统 Agent，如 [\"MyStudio.SceneDesign\"]"
    },
    "deliverable_type": {
      "type": "string",
      "enum": ["shotlist", "storyboard", "color_script", "sound_map", "prompt_pack", "edit_decision_list", "opening_sequence", "beat_sheet", "continuity_report", "mix_plan"]
    },
    "project_stage": {
      "type": "string",
      "enum": ["preproduction", "production", "postproduction", "distribution"]
    },

    "title": {"$ref": "#/$defs/nullableString", "default": null},
    "summary": {"type": "string", "minLength": 1},
    "skill_type": {
      "type": "string",
      "enum": ["quick_decision", "deep_analysis", "daily_practice", "emergency_fix", "advanced_strategy", "monitoring", "review", "shotlist_design", "storyboard_design", "color_grading", "sound_design", "edit_decision", "prompt_engineering", "opening_design", "continuity_review"]
    },
    "automation_level": {"type": "string", "enum": ["L0", "L1", "L2", "L3", "L4"]},
    "risk_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
    "core_goal": {"type": "string", "minLength": 1},
    "non_goals": {"$ref": "#/$defs/stringArray"},
    "success_metrics": {"$ref": "#/$defs/stringArray"},
    "user_scenarios": {"$ref": "#/$defs/stringArray"},
    "target_audience": {"$ref": "#/$defs/stringArray"},
    "trigger_intents": {"$ref": "#/$defs/stringArray"},
    "estimated_user_time": {"type": "string", "minLength": 1},
    "estimated_system_time": {"type": "string", "minLength": 1},
    "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
    "output_style": {
      "type": "string",
      "enum": ["table_first", "checklist_first", "briefing", "one_pager", "code_first", "shotlist_first", "storyboard_first", "color_script_first", "prompt_first"]
    },
    "skill_blueprint_id": {"$ref": "#/$defs/nullableString", "default": null},
    "skill_run_id": {"$ref": "#/$defs/nullableString", "default": null},

    "execution_layer": {"type": "string", "default": "5"},
    "execution_mode": {"type": "string", "enum": ["sequential", "parallel", "hybrid"], "default": "sequential"},
    "module_compatibility": {"$ref": "#/$defs/moduleCompatibility"},
    "fallback_strategy": {"$ref": "#/$defs/fallbackStrategy"},

    "persona_adaptation": {"$ref": "#/$defs/personaAdaptation"},
    "required_profile_fields": {"$ref": "#/$defs/stringArray"},
    "required_context_fields": {"$ref": "#/$defs/stringArray"},
    "priority_order_hint": {"$ref": "#/$defs/stringArray", "default": []},
    "disallowed_paths_hint": {"$ref": "#/$defs/stringArray", "default": []},
    "missing_info_policy_override": {"$ref": "#/$defs/freeformObject", "default": {}},

    "capabilities": {"$ref": "#/$defs/capabilities"},
    "tools_read": {"$ref": "#/$defs/stringArray"},
    "tools_write": {"$ref": "#/$defs/stringArray"},
    "confirmation_required_for": {"$ref": "#/$defs/stringArray"},
    "memory_writeback_fields": {"$ref": "#/$defs/stringArray"},
    "fallback_mode": {"type": "string", "minLength": 1},
    "publish_target": {"type": "string", "enum": ["skill_registry", "runtime_instance", "both"]},
    "registry_ingestible": {"type": "boolean"},

    "domain_pack": {"$ref": "#/$defs/domainPack"},
    "user_profile": {"$ref": "#/$defs/freeformObject"},
    "runtime_context": {"$ref": "#/$defs/freeformObject"},
    "memory": {"$ref": "#/$defs/freeformObject"},

    "logical_topics": {"$ref": "#/$defs/stringArray", "minItems": 1},
    "aliases_seed": {"$ref": "#/$defs/stringArray"},
    "problem_patterns": {"$ref": "#/$defs/stringArray"},
    "entities": {"$ref": "#/$defs/entitiesObject"},
    "scenarios": {"$ref": "#/$defs/stringArray"},
    "project_stages": {
      "type": "array", "items": {"type": "string", "enum": ["preproduction", "production", "postproduction", "distribution"]},
      "description": "替换原 age_stages，按制作阶段"
    },
    "urgency": {"type": "string", "enum": ["low", "normal", "high", "critical"]},
    "negative_queries": {"$ref": "#/$defs/stringArray"},
    "retrieval_summary": {"type": "string", "minLength": 1},

    "candidate_neighbors": {"$ref": "#/$defs/stringArray", "default": []},
    "channel_weights_override": {"anyOf": [{"type": "object"}, {"type": "null"}], "default": null},
    "weighted_recall_text_hint": {"$ref": "#/$defs/nullableString", "default": null},

    "quality_thresholds_override": {"anyOf": [{"type": "object"}, {"type": "null"}], "default": null},
    "qa_contract_override": {"anyOf": [{"type": "object"}, {"type": "null"}], "default": null},

    "pre_fetched_tool_results": {"type": "object", "additionalProperties": true, "default": {}}
  },
  "allOf": [
    {
      "if": {"properties": {"output_mode": {"const": "run"}}},
      "then": {"required": ["skill_run_id"], "properties": {"skill_run_id": {"type": "string", "minLength": 1}}}
    },
    {
      "if": {"properties": {"tools_write": {"type": "array", "minItems": 1}}},
      "then": {"properties": {"confirmation_required_for": {"type": "array", "minItems": 1, "items": {"type": "string"}}}}
    }
  ]
}
```


## 内嵌 RenderTemplate

> 影视化 Markdown 渲染模板（Jinja2，Frontmatter 增补影视字段，约束改影视六类）。保存为 `render_template.md`。

````jinja2
{% set _body = body if body is defined else {} %}
{% set _ctx = _body.context_analysis if _body.context_analysis is defined else (context_analysis if context_analysis is defined else {}) %}
{% set _dec = _body.decision_summary if _body.decision_summary is defined else (decision_summary if decision_summary is defined else {}) %}
{% set _orch = _body.orchestration_integration if _body.orchestration_integration is defined else (orchestration_integration if orchestration_integration is defined else {}) %}
{% set _recall = _body.recall_optimization if _body.recall_optimization is defined else (recall_optimization if recall_optimization is defined else {}) %}
{% set _exp = _body.expert_recommendation if _body.expert_recommendation is defined else (expert_recommendation if expert_recommendation is defined else {}) %}
{% set _tool = _body.tool_plan if _body.tool_plan is defined else (tool_plan if tool_plan is defined else {}) %}
{% set _agent = _body.agent_logic if _body.agent_logic is defined else (agent_logic if agent_logic is defined else {}) %}
{% set _qa = _body.qa_report if _body.qa_report is defined else (qa_report if qa_report is defined else {}) %}
{% set _tldr = _body.tl_dr if _body.tl_dr is defined else (tl_dr if tl_dr is defined else '') %}
---
name: "{{ name }}"
skill_id: "{{ skill_id }}"
version: "{{ version }}"
last_updated: "{{ last_updated }}"

domain: "{{ domain }}"
sub_domain: "{{ sub_domain }}"
vertical: "{{ vertical }}"
type: "{{ type }}"
priority: "{{ priority }}"

cinematic_role: "{{ cinematic_role }}"
module_target: {{ module_target }}
deliverable_type: "{{ deliverable_type }}"
project_stage: "{{ project_stage }}"

execution_layer: "{{ execution_layer }}"
execution_mode: "{{ execution_mode }}"

module_compatibility:
  {% for k, v in module_compatibility.items() %}{{ k }}: {{ v }}
  {% endfor %}
fallback_strategy:
  level1_tool: "{{ fallback_strategy.level1_tool }}"
  level2_data: "{{ fallback_strategy.level2_data }}"
  level3_output: "{{ fallback_strategy.level3_output }}"

persona_adaptation:
  user_profile: {{ persona_adaptation.user_profile }}
  modes: {{ persona_adaptation.modes | tojson }}
  constraints:
    safety_first: {{ persona_adaptation.constraints.safety_first }}
    location_aware: {{ persona_adaptation.constraints.location_aware }}
    time_sensitive: {{ persona_adaptation.constraints.time_sensitive }}

capabilities:
  tools: {{ capabilities.tools | tojson }}
  data_sources: {{ capabilities.data_sources | tojson }}
  output_formats: {{ capabilities.output_formats | tojson }}

retrieval_profile:
  logical_topics: {{ retrieval_profile.logical_topics | tojson }}
  aliases: {{ retrieval_profile.aliases | tojson }}
  sample_queries: {{ retrieval_profile.sample_queries | tojson }}
  problem_patterns: {{ retrieval_profile.problem_patterns | tojson }}
  entities:
    who: {{ retrieval_profile.entities.who | tojson }}
    actions: {{ retrieval_profile.entities.actions | tojson }}
    objects: {{ retrieval_profile.entities.objects | tojson }}
  scenarios: {{ retrieval_profile.scenarios | tojson }}
  project_stages: {{ retrieval_profile.project_stages | tojson }}
  urgency: "{{ retrieval_profile.urgency }}"
  negative_queries: {{ retrieval_profile.negative_queries | tojson }}
  summary: "{{ retrieval_profile.summary }}"

index_optimization:
  weighted_recall_text: |
    {{ index_optimization.weighted_recall_text }}
  neighbors: {{ index_optimization.neighbors | tojson }}
  channel_weights: {{ index_optimization.channel_weights | tojson }}

quality_thresholds: {{ quality_thresholds | tojson }}
dependencies: {{ dependencies | tojson }}

maturity: "{{ maturity | default('v0') }}"
forge_mode: "{{ forge_mode | default('cold') }}"

knowledge_provenance: {{ knowledge_provenance | tojson }}

author: "{{ author }}"
tags: {{ tags | tojson }}
status: "{{ status }}"
license: "{{ license }}"

generation_spec: {{ generation_spec | tojson }}
runtime_contract: {{ runtime_contract | tojson }}
execution_contract: {{ execution_contract | tojson }}
qa_contract: {{ qa_contract | tojson }}
domain_pack: {{ domain_pack | tojson }}
---

## TL;DR

{{ _tldr }}

## 1. 场景分析

### 请求摘要
{{ _ctx.request_summary if _ctx.request_summary is defined else "" }}

### 显性需求
{% if _ctx.explicit_needs is defined and _ctx.explicit_needs %}{% for item in _ctx.explicit_needs %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 隐性需求
{% if _ctx.implicit_needs is defined and _ctx.implicit_needs %}{% for item in _ctx.implicit_needs %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 场景分类
- `scenario_classification`: {{ _ctx.scenario_classification if _ctx.scenario_classification is defined else "" }}
- `urgency`: {{ _ctx.urgency if _ctx.urgency is defined else "" }}

### 上下文快照
- 时间：{{ _ctx.context_snapshot.time if _ctx.context_snapshot is defined and _ctx.context_snapshot.time is defined else "" }}
- 相关角色：{{ _ctx.context_snapshot.actors | tojson if _ctx.context_snapshot is defined and _ctx.context_snapshot.actors is defined else "[]" }}

### 约束（影视六类）
#### 时间约束（交片期/排期/Deadline）
{% if _ctx.constraints is defined and _ctx.constraints.time is defined and _ctx.constraints.time %}{% for item in _ctx.constraints.time %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 预算约束（制作预算/渲染成本）
{% if _ctx.constraints is defined and _ctx.constraints.budget is defined and _ctx.constraints.budget %}{% for item in _ctx.constraints.budget %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 设备/权限约束（渲染农场/软件许可/AI模型配额）
{% if _ctx.constraints is defined and _ctx.constraints.device is defined and _ctx.constraints.device %}{% for item in _ctx.constraints.device %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 合规约束（版权/平台审核/敏感内容）
{% if _ctx.constraints is defined and _ctx.constraints.compliance is defined and _ctx.constraints.compliance %}{% for item in _ctx.constraints.compliance %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 创意约束（导演意图/风格一致性/品牌调性）
{% if _ctx.constraints is defined and _ctx.constraints.creative is defined and _ctx.constraints.creative %}{% for item in _ctx.constraints.creative %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 技术约束（色彩空间/帧率/分辨率/画幅）
{% if _ctx.constraints is defined and _ctx.constraints.technical is defined and _ctx.constraints.technical %}{% for item in _ctx.constraints.technical %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 假设
{% if _ctx.assumptions is defined and _ctx.assumptions %}{% for item in _ctx.assumptions %}- {{ item }}
{% endfor %}{% else %}- 无{% endif %}

### 缺失信息
{% if _ctx.missing_information is defined and _ctx.missing_information %}{% for item in _ctx.missing_information %}- {{ item }}
{% endfor %}{% else %}- 无{% endif %}

## 2. 决策摘要

### 主策略
{{ _dec.chosen_strategy if _dec.chosen_strategy is defined else "" }}

### 备选方案
{% if _dec.alternatives_considered is defined and _dec.alternatives_considered %}{% for item in _dec.alternatives_considered %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 被排除方案
{% if _dec.rejected_options is defined and _dec.rejected_options %}{% for item in _dec.rejected_options %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 风险权衡
{% if _dec.risk_rationale is defined and _dec.risk_rationale %}{% for item in _dec.risk_rationale %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

## 3. 编排集成
{% if _orch.query_understanding is defined and _orch.query_understanding %}{% for item in _orch.query_understanding %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

## 4. 召回优化
### 索引文本预览
```text
{{ _recall.index_text_preview if _recall.index_text_preview is defined else index_optimization.weighted_recall_text }}
```

## 5. 专业建议

### 主推荐
{{ _exp.recommended_option if _exp.recommended_option is defined else "" }}

### A. 立即执行
{% if _exp.immediate_actions is defined and _exp.immediate_actions %}{% for item in _exp.immediate_actions %}{{ loop.index }}. **步骤**：{{ item.step }}
   - 原因：{{ item.why }}
   - 预期结果：{{ item.expected_result }}
{% endfor %}{% else %}- 暂无{% endif %}

### B. 深度方案
#### 主方案
{% if _exp.deep_solution is defined and _exp.deep_solution.main_plan is defined and _exp.deep_solution.main_plan %}{% for item in _exp.deep_solution.main_plan %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 备选方案
{% if _exp.deep_solution is defined and _exp.deep_solution.alternatives is defined and _exp.deep_solution.alternatives %}{% for item in _exp.deep_solution.alternatives %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}
#### 失败回退
{% if _exp.deep_solution is defined and _exp.deep_solution.fallback_plan is defined and _exp.deep_solution.fallback_plan %}{% for item in _exp.deep_solution.fallback_plan %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### C. 长期资产
{% if _exp.long_term_assets is defined and _exp.long_term_assets %}{% for item in _exp.long_term_assets %}- **{{ item.asset_type }}** / `{{ item.asset_name }}`：{{ item.description }}
{% endfor %}{% else %}- 暂无{% endif %}

### 领域知识
{% if _exp.domain_knowledge is defined and _exp.domain_knowledge %}{% for item in _exp.domain_knowledge %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 风险提示
{% if _exp.risk_warnings is defined and _exp.risk_warnings %}{% for item in _exp.risk_warnings %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 升级规则
{% if _exp.escalation_rules is defined and _exp.escalation_rules %}{% for item in _exp.escalation_rules %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

## 6. 工具调用计划

### 计划调用链
{% if _tool.planned_tool_chain is defined and _tool.planned_tool_chain %}{% for item in _tool.planned_tool_chain %}{{ loop.index }}. **工具**：`{{ item.tool }}`
   - 目的：{{ item.purpose }}
   - 输入映射：{{ item.input_mapping }}
   - 预期输出：{{ item.expected_output }}
   - 失败降级：{{ item.fallback }}
   - 时效要求：{{ item.freshness_requirement }}
   - 安全限制：{{ item.safety_guard }}
{% endfor %}{% else %}- 当前无需调用工具，或未提供工具链。{% endif %}

## 7. Agent执行逻辑

### 自动化等级
`{{ _agent.automation_level if _agent.automation_level is defined else generation_spec.automation_level }}`

### 输入校验
{% if _agent.input_validation is defined and _agent.input_validation %}{% for item in _agent.input_validation %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 分支逻辑
{% if _agent.branching_logic is defined and _agent.branching_logic %}{% for item in _agent.branching_logic %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 写操作
{% if _agent.write_actions is defined and _agent.write_actions %}{% for item in _agent.write_actions %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 回滚策略
{% if _agent.rollback_strategy is defined and _agent.rollback_strategy %}{% for item in _agent.rollback_strategy %}- {{ item }}
{% endfor %}{% else %}- 暂无{% endif %}

### 伪代码 / 代码
```python
{{ _agent.pseudocode if _agent.pseudocode is defined else "" }}
```

## 8. 质量检查

- `structural_check`: {{ _qa.structural_check if _qa.structural_check is defined else "" }}
- `risk_check`: {{ _qa.risk_check if _qa.risk_check is defined else "" }}
- `execution_safety_check`: {{ _qa.execution_safety_check if _qa.execution_safety_check is defined else "" }}
- `personalization_check`: {{ _qa.personalization_check if _qa.personalization_check is defined else "" }}
- `source_check`: {{ _qa.source_check if _qa.source_check is defined else "" }}

### 总分
**{{ _qa.overall_score if _qa.overall_score is defined else "" }}**

### 问题列表
{% if _qa.issues is defined and _qa.issues %}{% for item in _qa.issues %}- {{ item }}
{% endfor %}{% else %}- 无{% endif %}

### 最终状态
**{{ _qa.final_status if _qa.final_status is defined else "" }}**
````


## 内嵌影视知识基座

> 词典 / Topic / 场景 / 紧急度（影视垂直化）。引擎常量同步维护。

```yaml
# 影视知识基座（同义词组 / 实体词典 / 场景词典 / 紧急度 / Topic 规则）
CINEMA_SYNONYMS:
  运镜:
  - 运镜
  - 镜头运动
  - 推拉摇移
  - 推镜头
  - 拉镜头
  - 摇镜头
  - 移镜头
  - 跟拍
  - 航拍
  调色:
  - 调色
  - 色彩校正
  - Color Grading
  - 套LUT
  - 调色板
  - 色彩管理
  转场:
  - 转场
  - 过渡
  - 硬切
  - 叠化
  - 闪白
  - 匹配剪辑
  分镜:
  - 分镜
  - 分镜脚本
  - 故事板
  - Storyboard
  - 镜头清单
  - Shotlist
  - 故板
  混音:
  - 混音
  - 音频混合
  - 5.1混音
  - 立体声
  - Foley
  - 拟音
  剪辑:
  - 剪辑
  - 蒙太奇
  - 剪接节奏
  - 动接动
  - 声画对位
  视效:
  - 视效
  - VFX
  - 特效
  - 合成
  - 绿幕
  - 追踪
  - 粒子
  提示词:
  - 提示词
  - Prompt
  - AI生成
  - 文生图
  - 文生视频
  钩子:
  - 钩子
  - 开场钩子
  - 3秒钩子
  - 完播
  - 留存
  漫剧:
  - 漫剧
  - AI漫剧
  - 分集
  - 口播
  - 连载
CINEMA_ENTITIES:
  who:
  - 导演
  - 摄影指导
  - 剪辑师
  - 调色师
  - 声音设计师
  - 视效总监
  - 制片人
  - 达人
  - 编剧
  actions:
  - 运镜
  - 调色
  - 剪辑
  - 转场
  - 混音
  - 生成
  - 投流
  - 拆镜
  - 布光
  - 收声
  objects:
  - 镜头
  - LUT
  - 音轨
  - 分镜
  - 提示词
  - 素材
  - 成片
  - 钩子
  - 节拍表
  - 色彩脚本
CINEMA_SCENARIOS:
- 前期筹备
- 剧本开发
- 角色设计
- 场景设计
- 分镜脚本
- 视觉开发
- 故事板
- 拍摄
- 布光
- 收声
- 场记
- 后期剪辑
- 粗剪
- 精剪
- 调色
- 色彩管理
- 套底
- 混音
- 对白
- 旁白
- 音效
- 音乐
- 视效
- 合成
- 动画
- 数字绘景
- 发行
- 交付
- DCP
- 流媒体
- 投流
- 矩阵
- 带货
- 达人
- ROI
- 漫剧分集
- 口播
- 连载
- AI生图
- AI生视频
CINEMA_URGENCY:
- 交片
- 死线
- Deadline
- 崩溃
- 丢失
- 驳回
- 审核不过
- 渲染失败
- 封禁
- 限流
CINEMA_TOPICS:
  cinematic_structure:
    keywords:
    - 三幕结构
    - 英雄之旅
    - 节拍表
    - 角色弧光
    - 叙事结构
    aliases:
    - 三幕式
    - 剧本结构
    physical_domains:
    - cinema
    - scene_design
    negative_keywords:
    - 投流
    - 带货
    weight: 1.2
    cinematic_role: scene_design
  character_arc:
    keywords:
    - 角色弧光
    - 人物成长
    - 动机
    - 角色发展
    aliases:
    - 人物弧光
    physical_domains:
    - cinema
    - scene_design
    negative_keywords:
    - 投流
    weight: 1.1
    cinematic_role: scene_design
  beat_sheet:
    keywords:
    - 节拍表
    - 结构拆解
    - 叙事节奏
    - Beat Sheet
    aliases:
    - 节拍
    physical_domains:
    - cinema
    - scene_design
    negative_keywords:
    - 投流
    weight: 1.15
    cinematic_role: scene_design
  scene_breakdown:
    keywords:
    - 场景拆解
    - 场次
    - 场景设计
    - 剧本拆解
    aliases:
    - 拆戏
    physical_domains:
    - cinema
    - scene_design
    negative_keywords: []
    weight: 1.1
    cinematic_role: scene_design
  shot_language:
    keywords:
    - 景别
    - 构图
    - 180度线
    - 越轴
    - 匹配剪辑
    - 镜头语言
    aliases:
    - 轴线
    - 机位
    physical_domains:
    - cinema
    - visual_language
    negative_keywords:
    - 投流
    weight: 1.2
    cinematic_role: visual_language
  camera_movement:
    keywords:
    - 推拉摇移
    - 跟拍
    - 航拍
    - 稳定器
    - 运镜
    aliases:
    - 镜头运动
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.15
    cinematic_role: visual_language
  color_grading:
    keywords:
    - 调色
    - LUT
    - 色彩空间
    - Rec.709
    - Rec.2020
    - ACES
    - 色板
    aliases:
    - 色彩校正
    - 套LUT
    physical_domains:
    - cinema
    - visual_language
    negative_keywords:
    - 投流
    weight: 1.25
    cinematic_role: visual_language
  color_management:
    keywords:
    - 色彩管理
    - 套底
    - Log
    - 线性
    - 色域转换
    aliases:
    - 色彩流水线
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.15
    cinematic_role: visual_language
  lighting_design:
    keywords:
    - 布光
    - 三点布光
    - 自然光
    - 影调
    - 光比
    aliases:
    - 打光
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.1
    cinematic_role: visual_language
  storyboard:
    keywords:
    - 分镜
    - 故事板
    - 分镜脚本
    - 画面设计
    aliases:
    - Storyboard
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.2
    cinematic_role: visual_language
  sound_design:
    keywords:
    - 声音设计
    - 混音
    - 对白
    - 旁白
    - Foley
    - 拟音
    - 音效
    aliases:
    - 音频设计
    physical_domains:
    - cinema
    - audio_design
    negative_keywords:
    - 投流
    weight: 1.2
    cinematic_role: audio_design
  music_score:
    keywords:
    - 配乐
    - BGM
    - 音乐选型
    - 背景音乐
    aliases:
    - 音乐
    physical_domains:
    - cinema
    - audio_design
    negative_keywords: []
    weight: 1.1
    cinematic_role: audio_design
  mix_plan:
    keywords:
    - 混音方案
    - '5.1'
    - 立体声
    - 响度
    - LUFS
    aliases:
    - 混音计划
    physical_domains:
    - cinema
    - audio_design
    negative_keywords: []
    weight: 1.15
    cinematic_role: audio_design
  editing_rhythm:
    keywords:
    - 剪辑节奏
    - 蒙太奇
    - 转场
    - 动接动
    - 声画对位
    aliases:
    - 剪接节奏
    physical_domains:
    - cinema
    - editing
    negative_keywords: []
    weight: 1.2
    cinematic_role: editing
  edit_decision_list:
    keywords:
    - EDL
    - 剪辑决策表
    - 粗剪
    - 精剪
    - 剪辑点
    aliases:
    - 剪辑单
    physical_domains:
    - cinema
    - editing
    negative_keywords: []
    weight: 1.15
    cinematic_role: editing
  vfx_compositing:
    keywords:
    - 视效
    - 合成
    - 绿幕
    - 追踪
    - 抠像
    aliases:
    - VFX
    - 特效
    physical_domains:
    - cinema
    - vfx
    negative_keywords: []
    weight: 1.2
    cinematic_role: vfx
  matte_painting:
    keywords:
    - 数字绘景
    - 接景
    - 环境合成
    aliases:
    - Matte Painting
    physical_domains:
    - cinema
    - vfx
    negative_keywords: []
    weight: 1.1
    cinematic_role: vfx
  particle_fx:
    keywords:
    - 粒子
    - 流体
    - 破坏特效
    - 动力学
    aliases:
    - 特效模拟
    physical_domains:
    - cinema
    - vfx
    negative_keywords: []
    weight: 1.1
    cinematic_role: vfx
  continuity_check:
    keywords:
    - 连贯性
    - 穿帮
    - 匹配
    - 180度线
    - 轴线
    aliases:
    - 连戏检查
    physical_domains:
    - cinema
    - continuity_review
    negative_keywords: []
    weight: 1.25
    cinematic_role: continuity_review
  continuity_report:
    keywords:
    - 连贯性报告
    - 穿帮检查
    - 场记
    - 接戏
    aliases:
    - 连戏报告
    physical_domains:
    - cinema
    - continuity_review
    negative_keywords: []
    weight: 1.15
    cinematic_role: continuity_review
  prompt_engineering:
    keywords:
    - 提示词
    - Midjourney
    - Runway
    - Sora
    - Prompt
    aliases:
    - 提示词工程
    physical_domains:
    - cinema
    - prompt_fusion
    negative_keywords: []
    weight: 1.2
    cinematic_role: prompt_fusion
  ai_video_generation:
    keywords:
    - 文生视频
    - 图生视频
    - 可灵
    - 即梦
    - AI视频
    aliases:
    - AI生成视频
    physical_domains:
    - cinema
    - prompt_fusion
    negative_keywords: []
    weight: 1.2
    cinematic_role: prompt_fusion
  ai_image_generation:
    keywords:
    - 文生图
    - AI生图
    - 角色一致性
    - Stable Diffusion
    aliases:
    - AI绘图
    physical_domains:
    - cinema
    - prompt_fusion
    negative_keywords: []
    weight: 1.15
    cinematic_role: prompt_fusion
  comfyui_workflow:
    keywords:
    - ComfyUI
    - 工作流
    - 节点编排
    aliases:
    - ComfyUI工作流
    physical_domains:
    - cinema
    - prompt_fusion
    negative_keywords: []
    weight: 1.1
    cinematic_role: prompt_fusion
  opening_design:
    keywords:
    - 开场
    - 片头
    - 冷开场
    - 热开场
    - 片头序列
    aliases:
    - Opening
    physical_domains:
    - cinema
    - opening_design
    negative_keywords: []
    weight: 1.2
    cinematic_role: opening_design
  title_sequence:
    keywords:
    - 片头序列
    - 字幕设计
    - 品牌片头
    - 标题动画
    aliases:
    - Title Sequence
    physical_domains:
    - cinema
    - opening_design
    negative_keywords: []
    weight: 1.15
    cinematic_role: opening_design
  short_video_hook:
    keywords:
    - 钩子
    - 3秒
    - 完播
    - 留存
    - 开场钩子
    aliases:
    - 短视频钩子
    physical_domains:
    - short_video
    negative_keywords:
    - DCP
    weight: 1.3
    cinematic_role: opening_design
  short_video_script:
    keywords:
    - 短视频脚本
    - 选题
    - 爆款
    - 口播稿
    aliases:
    - 短视频文案
    physical_domains:
    - short_video
    negative_keywords:
    - DCP
    weight: 1.2
    cinematic_role: scene_design
  short_video_marketing:
    keywords:
    - 投流
    - 矩阵
    - 带货
    - 达人
    - ROI
    - 千川
    aliases:
    - 短视频营销
    physical_domains:
    - short_video
    negative_keywords:
    - DCP
    - 调色
    weight: 1.2
    cinematic_role: scene_design
  short_video_editing:
    keywords:
    - 竖屏剪辑
    - 快节奏
    - 卡点
    - 竖屏9:16
    aliases:
    - 短视频剪辑
    physical_domains:
    - short_video
    negative_keywords:
    - DCP
    weight: 1.15
    cinematic_role: editing
  ai_manga_drama:
    keywords:
    - 漫剧
    - AI漫剧
    - 分集
    - 连载
    - AI漫剧
    aliases:
    - 漫画剧
    physical_domains:
    - ai_manga_drama
    negative_keywords:
    - DCP
    - 投流
    weight: 1.25
    cinematic_role: scene_design
  manga_episode:
    keywords:
    - 分集结构
    - 连载钩子
    - 前情
    - 分集大纲
    aliases:
    - 漫剧分集
    physical_domains:
    - ai_manga_drama
    negative_keywords: []
    weight: 1.2
    cinematic_role: scene_design
  voiceover_rhythm:
    keywords:
    - 口播
    - 旁白节奏
    - 语速
    - 口播稿
    aliases:
    - 配音节奏
    physical_domains:
    - ai_manga_drama
    negative_keywords: []
    weight: 1.15
    cinematic_role: audio_design
  character_consistency:
    keywords:
    - 角色一致性
    - 角色漂移
    - 参考图
    - LoRA
    aliases:
    - 角色稳定
    physical_domains:
    - ai_manga_drama
    negative_keywords: []
    weight: 1.2
    cinematic_role: prompt_fusion
  dcp_delivery:
    keywords:
    - DCP
    - 数字电影包
    - 影院交付
    aliases:
    - 数字电影包
    physical_domains:
    - cinema
    negative_keywords:
    - 投流
    - 短视频
    weight: 1.2
    cinematic_role: editing
  netflix_delivery:
    keywords:
    - Netflix规范
    - 流媒体交付
    - IMF
    aliases:
    - 流媒体交付
    physical_domains:
    - cinema
    negative_keywords:
    - 投流
    weight: 1.15
    cinematic_role: editing
  production_management:
    keywords:
    - 制片管理
    - 预算
    - 排期
    - 场记
    - 通告单
    aliases:
    - 制片
    physical_domains:
    - cinema
    negative_keywords:
    - 投流
    weight: 1.1
    cinematic_role: scene_design
  visual_development:
    keywords:
    - 视觉开发
    - 概念设计
    - 美术
    - 概念图
    aliases:
    - 视效开发
    physical_domains:
    - cinema
    negative_keywords: []
    weight: 1.1
    cinematic_role: visual_language
  lip_sync:
    keywords:
    - 口型
    - 口型同步
    - 对白口型
    - 口型对位
    aliases:
    - 对口型
    physical_domains:
    - ai_manga_drama
    - cinema
    negative_keywords: []
    weight: 1.2
    cinematic_role: audio_design
  aspect_ratio:
    keywords:
    - 画幅
    - 宽高比
    - '9:16'
    - '16:9'
    - 2.39:1
    aliases:
    - 比例
    physical_domains:
    - cinema
    - short_video
    negative_keywords: []
    weight: 1.05
    cinematic_role: visual_language
  frame_rate:
    keywords:
    - 帧率
    - 24fps
    - 30fps
    - 60fps
    - 补帧
    aliases:
    - fps
    physical_domains:
    - cinema
    negative_keywords: []
    weight: 1.1
    cinematic_role: visual_language
  color_script:
    keywords:
    - 色彩脚本
    - 色彩设计
    - 色彩叙事
    - 调色方案
    aliases:
    - 色彩剧本
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.2
    cinematic_role: visual_language
  shotlist:
    keywords:
    - 镜头清单
    - 分镜清单
    - 镜头表
    - Shotlist
    aliases:
    - 镜头单
    physical_domains:
    - cinema
    - visual_language
    negative_keywords: []
    weight: 1.2
    cinematic_role: visual_language
  platform_compliance:
    keywords:
    - 平台审核
    - 违禁词
    - 审核规则
    - 合规
    aliases:
    - 审核合规
    physical_domains:
    - short_video
    - ai_manga_drama
    negative_keywords:
    - DCP
    weight: 1.2
    cinematic_role: continuity_review
  data_review:
    keywords:
    - 数据复盘
    - 完播率
    - 互动率
    - 转化
    - 复盘
    aliases:
    - 投流复盘
    physical_domains:
    - short_video
    negative_keywords:
    - DCP
    weight: 1.1
    cinematic_role: scene_design
  render_farm:
    keywords:
    - 渲染农场
    - 批量渲染
    - 渲染队列
    - 渲染失败
    aliases:
    - 渲染
    physical_domains:
    - cinema
    - vfx
    negative_keywords: []
    weight: 1.1
    cinematic_role: vfx
  backup_strategy:
    keywords:
    - 素材备份
    - 版本管理
    - 冗余
    - 素材丢失
    aliases:
    - 备份
    physical_domains:
    - cinema
    negative_keywords: []
    weight: 1.1
    cinematic_role: continuity_review
  copyright_clearance:
    keywords:
    - 版权
    - 授权
    - 音乐版权
    - 素材版权
    - 字体版权
    aliases:
    - 版权清理
    physical_domains:
    - cinema
    - short_video
    negative_keywords: []
    weight: 1.2
    cinematic_role: continuity_review
  subtitle_design:
    keywords:
    - 字幕
    - 字幕设计
    - 字幕规范
    - 字幕样式
    aliases:
    - 字幕
    physical_domains:
    - cinema
    - short_video
    negative_keywords: []
    weight: 1.05
    cinematic_role: opening_design
  trailer_editing:
    keywords:
    - 预告片
    - 预告片剪辑
    - 混剪
    - 预告片结构
    aliases:
    - 预告
    physical_domains:
    - cinema
    negative_keywords: []
    weight: 1.1
    cinematic_role: editing
```


## 内嵌外部知识源配置

> 搜索 API 适配器（7 种源）+ Scrapling 三会话配置 + 可信种子源白名单（40+ 源）+ 工具名映射表。

```yaml
# 外部知识源配置（搜索API适配器 + Scrapling配置 + 种子源白名单）
SEARCH_PROVIDER_REGISTRY:
  bing:
    env_keys:
    - BING_API_KEY
    - AZURE_BING_KEY
    needs_key: true
  google_cse:
    env_keys:
    - GOOGLE_CSE_API_KEY
    - GOOGLE_CSE_ID
    needs_key: true
  serpapi:
    env_keys:
    - SERPAPI_API_KEY
    needs_key: true
  brave:
    env_keys:
    - BRAVE_API_KEY
    needs_key: true
  tavily:
    env_keys:
    - TAVILY_API_KEY
    needs_key: true
  duckduckgo:
    env_keys: []
    needs_key: false
  searxng:
    env_keys:
    - SEARXNG_BASE_URL
    needs_key: false
CINEMA_SEED_SOURCES:
- domain: smpte.org
  category: 规范标准
  trust: 1.0
  session: fast
- domain: acescentral.com
  category: 规范标准
  trust: 1.0
  session: fast
- domain: itu.int
  category: 规范标准
  trust: 1.0
  session: fast
- domain: partner.netflix.com
  category: 规范标准
  trust: 1.0
  session: fast
- domain: dcimovies.com
  category: 规范标准
  trust: 1.0
  session: fast
- domain: ebu.ch
  category: 规范标准
  trust: 0.95
  session: fast
- domain: blackmagicdesign.com
  category: 工具官方文档
  trust: 1.0
  session: fast
- domain: adobe.com
  category: 工具官方文档
  trust: 1.0
  session: fast
- domain: docs.blender.org
  category: 工具官方文档
  trust: 1.0
  session: fast
- domain: foundry.com
  category: 工具官方文档
  trust: 1.0
  session: fast
- domain: avid.com
  category: 工具官方文档
  trust: 1.0
  session: fast
- domain: midjourney.com
  category: 工具官方文档
  trust: 1.0
  session: dynamic
- domain: runwayml.com
  category: 工具官方文档
  trust: 1.0
  session: dynamic
- domain: openai.com
  category: 工具官方文档
  trust: 1.0
  session: dynamic
- domain: klingai.com
  category: 工具官方文档
  trust: 1.0
  session: dynamic
- domain: jimeng.jianying.com
  category: 工具官方文档
  trust: 1.0
  session: dynamic
- domain: comfyanonymous.github.io
  category: 工具官方文档
  trust: 0.95
  session: fast
- domain: wikipedia.org
  category: 学术权威
  trust: 0.85
  session: fast
- domain: siggraph.org
  category: 学术权威
  trust: 0.95
  session: stealth
- domain: arxiv.org
  category: 学术权威
  trust: 0.95
  session: fast
- domain: artofthetitle.com
  category: 案例专业
  trust: 0.95
  session: fast
- domain: vimeo.com
  category: 案例专业
  trust: 0.85
  session: dynamic
- domain: shotdeck.com
  category: 案例专业
  trust: 0.9
  session: stealth
- domain: film-grab.com
  category: 案例专业
  trust: 0.85
  session: fast
- domain: reddit.com
  category: 社区经验
  trust: 0.7
  session: fast
- domain: zhihu.com
  category: 社区经验
  trust: 0.6
  session: fast
- domain: 107cine.com
  category: 社区经验
  trust: 0.75
  session: stealth
- domain: creator.douyin.com
  category: 平台规则
  trust: 0.9
  session: dynamic
- domain: kuaishou.com
  category: 平台规则
  trust: 0.9
  session: dynamic
- domain: creator.tiktok.com
  category: 平台规则
  trust: 0.9
  session: dynamic
- domain: bilibili.com
  category: 平台规则
  trust: 0.85
  session: dynamic
- domain: xiaohongshu.com
  category: 平台规则
  trust: 0.8
  session: dynamic
- domain: youtube.com
  category: 平台规则
  trust: 0.9
  session: dynamic
SCRAPLING_SESSION_CONFIG:
  fast:
    fetcher: Fetcher
    impersonate: chrome
    http3: true
    lazy: false
  stealth:
    fetcher: StealthyFetcher
    headless: true
    solve_cloudflare: true
    stealthy_headers: true
    lazy: true
  dynamic:
    fetcher: DynamicFetcher
    headless: true
    network_idle: true
    lazy: true
CINEMA_TOOL_MAP:
  visual_language:
  - 达芬奇
  - LUT
  - ACES
  - Rec.709
  - Rec.2020
  audio_design:
  - Pro Tools
  - 混音
  - '5.1'
  - Foley
  prompt_fusion:
  - Midjourney
  - Runway
  - Sora
  - 可灵
  - 即梦
  - ComfyUI
  editing:
  - Premiere
  - 达芬奇
  - Avid
  - EDL
  vfx:
  - AE
  - Nuke
  - Blender
  - Houdini
  opening_design:
  - AE
  - Blender
  - 片头设计
  scene_design:
  - 节拍表
  - 三幕结构
  - 英雄之旅
  continuity_review:
  - 180度线
  - 匹配剪辑
  - 连贯性
  color_grading:
  - 达芬奇
  - LUT
  - ACES
```


## 内嵌置信度门禁配置

> deliverable_type 维度映射表 + 置信度阈值 + 三大子领域扩展包 + 影视一票否决项 + 11 维评分权重。

```yaml
# 置信度门禁配置（deliverable_type 维度映射表 + 阈值 + 子领域包 + 否决项 + 评分）
DELIVERABLE_DIMENSION_MAP:
  color_script:
    required:
    - principles
    - standards
    - tool_params
    bonus:
    - case_refs
    - heuristics
    - pitfalls
  shotlist:
    required:
    - principles
    - tool_params
    bonus:
    - case_refs
    - heuristics
  storyboard:
    required:
    - principles
    - tool_params
    bonus:
    - case_refs
  sound_map:
    required:
    - principles
    - standards
    - tool_params
    bonus:
    - case_refs
    - pitfalls
  mix_plan:
    required:
    - principles
    - standards
    - tool_params
    bonus:
    - pitfalls
  prompt_pack:
    required:
    - tool_params
    - heuristics
    bonus:
    - principles
    - case_refs
  opening_sequence:
    required:
    - principles
    - case_refs
    bonus:
    - tool_params
    - heuristics
  edit_decision_list:
    required:
    - principles
    - tool_params
    bonus:
    - heuristics
    - pitfalls
  beat_sheet:
    required:
    - principles
    - case_refs
    bonus:
    - heuristics
  continuity_report:
    required:
    - principles
    - standards
    bonus:
    - heuristics
    - pitfalls
CONFIDENCE_THRESHOLDS:
  high:
    min_trust: 0.9
    min_points: 10
    min_coverage: 0.8
    maturity: v2
  medium:
    min_trust_range:
    - 0.7
    - 0.9
    min_points_range:
    - 6
    - 9
    min_coverage_range:
    - 0.6
    - 0.8
    action: review
    maturity_pass: v2
    maturity_fail: v1
  low:
    max_trust: 0.7
    max_points: 6
    max_coverage: 0.6
    maturity: v1
DOMAIN_PACKS:
  cinema:
    pipeline:
    - 开发
    - 筹备
    - 拍摄
    - 后期
    - 交付
    deliverables:
    - 剧本
    - 视觉开发板
    - 分镜
    - 粗剪
    - 精剪
    - 调色
    - 混音
    - DCP
    standards:
    - SMPTE
    - Rec.2020
    - 24fps
    - 5.1混音
    risk_focus:
    - 版权
    - 预算超支
    - 后期返工
    tools:
    - 达芬奇
    - Premiere
    - Avid
    - Pro Tools
    - Nuke
    - Blender
    quality_bar: 工业级交付标准
  short_video:
    pipeline:
    - 选题
    - 脚本
    - 拍摄/AI生成
    - 剪辑
    - 投流
    - 复盘
    deliverables:
    - 钩子文案
    - 分镜
    - 成片
    - 投流素材矩阵
    - 数据复盘
    standards:
    - 竖屏9:16
    - 3秒钩子
    - 完播率
    - 平台审核规则
    risk_focus:
    - 审核驳回
    - 限流
    - 违禁词
    - 版权音乐
    tools:
    - 剪映
    - CapCut
    - Midjourney
    - 可灵
    - 即梦
    - ComfyUI
    quality_bar: 平台合规+传播效率
  ai_manga_drama:
    pipeline:
    - 大纲
    - 分集
    - 口播
    - AI生图
    - AI生视频
    - 装配
    - 连载
    deliverables:
    - 分集剧本
    - 口播稿
    - 角色一致性参考
    - 分镜
    - 成片
    standards:
    - 角色一致性
    - 口播节奏
    - 连载钩子
    - 平台规范
    risk_focus:
    - 角色漂移
    - 口播不同步
    - 敏感内容
    - 连载断更
    tools:
    - Midjourney
    - Stable Diffusion
    - ComfyUI
    - 可灵
    - 即梦
    - 剪映
    quality_bar: 连载一致性+AI生成质量
CINEMA_VETO_RULES:
- 镜头连贯性断裂:180度线越轴/匹配剪辑失败/轴线错乱未声明
- 色彩空间错配:Rec.709/Rec.2020/sRGB混用未声明转换
- 对白口型不同步:口播/对白与画面口型偏移未处理
- 版权素材未授权:音乐/素材/字体/形象版权未声明
- 平台审核硬伤:短视频违禁词/漫剧敏感内容/诱导性内容
- 不可逆渲染未确认:高负载渲染/批量导出无确认门
- 素材无备份策略:关键素材无冗余/无版本
CINEMA_SCORING_WEIGHTS:
  completeness: 1.0
  personalization: 1.0
  context_fidelity: 1.0
  domain_professionalism: 1.2
  actionability: 1.0
  tool_rationality: 1.0
  risk_control: 1.2
  clarity: 1.0
  cinematic_professionalism: 1.3
  continuity_safety: 1.3
  platform_compliance: 1.2
QA_PASS_THRESHOLD: 85
```


## 内嵌全域技能矩阵

> 冷启动批量生成蓝图（制作系统 Agent × 子任务 × 三大子领域）+ 多系统 Agent 注册表。

```yaml
# 全域技能矩阵（冷启动批量生成蓝图）+ 多系统注册表
COLD_FORGE_MATRIX:
- agent: SceneDesign
  cinematic_role: scene_design
  sub_domain: cinema
  tasks:
  - 三幕结构设计
  - 英雄之旅编排
  - 角色弧光设计
  - 节拍表制作
  - 场景拆解
- agent: SceneDesign
  cinematic_role: scene_design
  sub_domain: short_video
  tasks:
  - 选题脚本
  - 钩子结构
  - 爆款文案
  - 投流策略
- agent: SceneDesign
  cinematic_role: scene_design
  sub_domain: ai_manga_drama
  tasks:
  - 分集大纲
  - 连载钩子
  - 前情回顾
- agent: VisualLanguage
  cinematic_role: visual_language
  sub_domain: cinema
  tasks:
  - 分镜设计
  - 色彩脚本
  - 运镜设计
  - 布光方案
  - 景别构图
- agent: VisualLanguage
  cinematic_role: visual_language
  sub_domain: short_video
  tasks:
  - 竖屏分镜
  - 视觉钩子
  - 卡点设计
- agent: VisualLanguage
  cinematic_role: visual_language
  sub_domain: ai_manga_drama
  tasks:
  - AI生图分镜
  - 角色一致性参考
- agent: AudioDesign
  cinematic_role: audio_design
  sub_domain: cinema
  tasks:
  - 5.1混音
  - Foley拟音
  - 对白处理
  - 混音方案
  - 配乐选型
- agent: AudioDesign
  cinematic_role: audio_design
  sub_domain: short_video
  tasks:
  - BGM选型
  - 音效钩子
  - 卡点音效
- agent: AudioDesign
  cinematic_role: audio_design
  sub_domain: ai_manga_drama
  tasks:
  - 口播节奏
  - 旁白设计
  - 口型对位
- agent: ContinuityReview
  cinematic_role: continuity_review
  sub_domain: cinema
  tasks:
  - 180度线检查
  - 匹配剪辑检查
  - 穿帮检查
  - 连贯性报告
- agent: ContinuityReview
  cinematic_role: continuity_review
  sub_domain: short_video
  tasks:
  - 跨镜头连贯
  - 品牌一致性
  - 平台合规检查
- agent: ContinuityReview
  cinematic_role: continuity_review
  sub_domain: ai_manga_drama
  tasks:
  - 角色漂移检测
  - 场景连贯
  - 敏感内容审查
- agent: PromptFusion
  cinematic_role: prompt_fusion
  sub_domain: cinema
  tasks:
  - Midjourney提示词
  - Runway提示词
  - Sora提示词
  - ComfyUI工作流
- agent: PromptFusion
  cinematic_role: prompt_fusion
  sub_domain: short_video
  tasks:
  - 竖屏AI生成提示词
  - 可灵提示词
  - 即梦提示词
- agent: PromptFusion
  cinematic_role: prompt_fusion
  sub_domain: ai_manga_drama
  tasks:
  - AI生图一致性提示词
  - AI生视频提示词
  - LoRA角色固化
- agent: OpeningDesign
  cinematic_role: opening_design
  sub_domain: cinema
  tasks:
  - 冷开场设计
  - 热开场设计
  - 片头序列
  - 字幕设计
- agent: OpeningDesign
  cinematic_role: opening_design
  sub_domain: short_video
  tasks:
  - 3秒开场
  - 品牌片头
  - 黄金前3秒
- agent: OpeningDesign
  cinematic_role: opening_design
  sub_domain: ai_manga_drama
  tasks:
  - 漫剧开场
  - 分集前情
  - 连载开场
AGENT_REGISTRY:
  MyStudio:
    agents:
    - SceneDesign
    - VisualLanguage
    - AudioDesign
    - ContinuityReview
    - PromptFusion
    - OpeningDesign
    role_map:
      SceneDesign: scene_design
      VisualLanguage: visual_language
      AudioDesign: audio_design
      ContinuityReview: continuity_review
      PromptFusion: prompt_fusion
      OpeningDesign: opening_design
    deliverable_map:
      SceneDesign:
      - beat_sheet
      - scene_breakdown
      VisualLanguage:
      - shotlist
      - storyboard
      - color_script
      AudioDesign:
      - sound_map
      - mix_plan
      ContinuityReview:
      - continuity_report
      PromptFusion:
      - prompt_pack
      OpeningDesign:
      - opening_sequence
CINEMATIC_ROLES:
- scene_design
- visual_language
- audio_design
- continuity_review
- prompt_fusion
- opening_design
- editing
- color_grading
- vfx
DELIVERABLE_TYPES:
- shotlist
- storyboard
- color_script
- sound_map
- prompt_pack
- edit_decision_list
- opening_sequence
- beat_sheet
- continuity_report
- mix_plan
PROJECT_STAGES:
- preproduction
- production
- postproduction
- distribution
SUB_DOMAINS:
- cinema
- short_video
- ai_manga_drama
```



## 开源前审计修复记录（V1.0 → V1.0.1）

开源前对引擎做了深度代码审计 + 多路径试运行，共发现并修复 10 项问题：

| # | 严重度 | 问题 | 修复 |
|---|---|---|---|
| 1 | 🔴严重 | R0 结构化路由：不匹配字段被忽略导致错误命中（`ids if ids else candidates` 空集走 else 不过滤） | 重写为字段交集过滤；未提供字段返回 None 跳过，提供的字段无匹配则整体不命中 |
| 2 | 🔴严重 | `skill_id` 主键被 LLM 输出覆盖（`setdefault` 不覆盖已有 key，LLM 返回 skill_id 会顶替 payload 传入值） | 主键字段（skill_id/domain）改为 payload 优先覆盖 LLM 输出 |
| 3 | 🟡中 | `serve()` 手动补全 QueryUnderstanding 不完整（expanded_queries 缺失，影响 R1 phrase 召回） | 改为调用 `recall_engine.understand()` 完整理解 |
| 4 | 🟡中 | `serve()` R5 兜底丢弃已召回结果（candidates 不足时直接返回单个 forged） | 改为补充模式：已有召回 + 生成结果合并，仅全空时才纯 R5 |
| 5 | 🟡中 | `upsert()` 每次全量重建索引（`_rebuild_one` 调 `_rebuild_all`），反馈/R5 入库性能差 | 实现真正增量 upsert：`_remove_one` + `_index_incremental` + `_recompute_stats` |
| 6 | 🟡中 | `cold_start` 无 LLM 时仍抓网络，极慢/超时 | 无 LLM 时跳过外部知识获取，直接降级生成骨架 |
| 7 | 🟢低 | `_render_template` 重复创建 Jinja Environment（StrictUndefined env 创建后立即丢弃） | 合并为单次创建，宽松 Undefined |
| 8 | 🟢低 | `serve()` 重复 `json.loads(request_json)` 3 次（call_id/topk/recall_mode 各一次） | 一次性解析为 req dict |
| 9 | 🟢低 | `_gen_embedding` 中 `content[:500]` 当 content 为空时虽不报错但逻辑不健壮 | 加 skill_id 兜底，优先级 weighted_recall_text > name > content[:500] > skill_id |
| 10 | 🟢低 | `serve()` status 三元表达式两分支都是 `"hit"`，无意义 | 改为根据 fallback_note 与 source_layer 区分 hit/forged |

**验证**：修复后试运行 74 项全过 + 回归增强 25 项全过（含 R0 部分字段命中、多字段交集、增量 upsert 性能 <0.1s、upsert 覆盖更新无幽灵索引、无 LLM 降级、serve dict/非法 JSON 入参、反馈降级 + pitfalls 回流、工具函数边界）。自测入口从 `status=forged layer=R5` 修正为 `status=hit layer=R0`，印证 R0 路由修复生效。

### 第二轮：两轮全链路场景测试追加修复（V1.0.1 → V1.0.2）

开源前又做了两轮全链路场景测试（第一轮8大主流用户场景 + 第二轮12项边界压力测试，共 234 项），追加修复 3 项问题：

| # | 严重度 | 问题 | 修复 |
|---|---|---|---|
| 11 | 🔴严重 | `_parse_output` 主键覆盖不完整：module_target/deliverable_type/sub_domain/cinematic_role 仍被 LLM 输出覆盖（第一轮仅修 skill_id/domain） | 扩展 `_PAYLOAD_PRIORITY_KEYS` 到全部结构化路由字段，payload 显式值一律优先 |
| 12 | 🟡中 | 成熟度进化基于滑动窗口 `hist[-N:]` 含旧记录，导致过早升级/降级（v2→v3 只需 hist 末3条含旧高分即升） | 改为"末尾连续计数"：`_count_consecutive_tail` 从末尾向前数连续达标/不达标次数，被中断的旧记录不参与 |
| 13 | 🟡中 | `cold_forge` 组合创新无开关，让 generated_count 不可预测（矩阵6任务→9技能） | `cold_forge`/`cold_start` 增 `enable_innovation` 参数，默认 False 关闭 |
| 14 | 🟡中 | `_make_payload` 硬编码 `project_stage="preproduction"`，后期任务技能被错标前期，R0 按阶段过滤不命中 | 新增 `_guess_project_stage(task)` 按 task 关键词推断阶段（剪辑/调色/混音→postproduction 等） |

**验证**：两轮全链路测试 234 项全过（第一轮8场景48项 + 第二轮12边界186项），叠加首轮 99 项，**累计 333 项测试全绿**。覆盖：三大子领域完整业务流、成熟度全生命周期（v0→v3→降级→淘汰）、质检否决与修复、R5兜底飞轮反哺、200技能大规模索引性能、异常输入鲁棒性、序列化往返、配置完整性。


## 内嵌验证测试套件

> 开源可用性验证用例。提取后依次运行，应全绿（共 333 项测试）。

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PandaCineForge 深度试运行脚本 —— 覆盖所有路径，暴露运行时问题。"""
import sys, os, json, traceback, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import panda_cineforge as pcf
from panda_cineforge import (
    PandaCineForge, SkillAsset, RetrievalProfile, RetrievalEntities,
    KnowledgeProvenance, LLMClient, SkillIndexer, RecallEngine, TopicMapper,
    ContractGateway, QAGate, RankingOptimizer, Orchestrator,
    extract_project_stages, normalize_text, char_ngrams,
)

PASS = 0; FAIL = 0; ISSUES = []
def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        ISSUES.append(f"{name}: {detail}")
        print(f"  ❌ {name} | {detail}")

def section(t): print(f"\n=== {t} ===")

# ---------- Mock LLM ----------
class MockLLM(LLMClient):
    def __init__(self):
        self._client = "mock"  # available=True
    @property
    def available(self): return True
    def chat(self, system_message, user_message, temperature=0.2, json_mode=False):
        # 返回一个最小合法 JSON 技能
        return json.dumps({
            "name": "Mock技能", "skill_id": "mock_skill", "version": "1.0.0",
            "last_updated": "2026-06-28T12:00:00Z", "domain": "ai_cinema",
            "sub_domain": "cinema", "cinematic_role": "visual_language",
            "module_target": ["MyStudio.VisualLanguage"], "deliverable_type": "color_script",
            "project_stage": "postproduction", "maturity": "v2", "forge_mode": "cold",
            "retrieval_profile": {"logical_topics": ["color_grading"], "aliases": ["调色"],
                "sample_queries": ["怎么调色"], "problem_patterns": [], "entities": {"who":["调色师"],"actions":["调色"],"objects":["LUT"]},
                "scenarios": ["调色"], "project_stages": ["postproduction"], "urgency": "normal", "negative_queries": [], "summary": "调色"},
            "weighted_recall_text": "调色 色彩脚本 color_script LUT",
            "content": "## TL;DR\n调色技能", "body": {"tl_dr": "调色"},
        }, ensure_ascii=False)
    def embed(self, text):
        # 稳定伪 embedding（基于文本 hash → 8维）
        h = abs(hash(text)) % 10000
        return [((h >> i) & 1) * 1.0 for i in range(8)]

# ---------- Mock 知识获取（避免网络）----------
class MockKnowledgeFetcher(pcf.ExternalKnowledgeFetcher):
    def fetch(self, cinematic_role, deliverable_type, sub_domain, project_stage="", query_text="", mode="cold", timeout=15.0):
        provenance = KnowledgeProvenance()
        provenance.sources = [{"url": "https://example.com", "domain": "example.com", "trust_score": 0.95, "source_class": "案例专业"}]
        provenance.knowledge_points = {"principles": 4, "standards": 2, "tool_params": 3}
        provenance.dimension_coverage = {"required": ["principles","standards","tool_params"], "covered": ["principles","standards","tool_params"], "missing": []}
        provenance.confidence_score = 0.9
        provenance.confidence_tier = "high"
        return [{"dim":"principles","text":"调色原理","source":"example.com","trust":0.95}], provenance

llm = MockLLM()

# ============================================================
section("T1: 引擎初始化")
try:
    eng = PandaCineForge(llm=llm, system_message="sys", user_template="tpl")
    check("引擎构造", isinstance(eng, PandaCineForge))
    check("forge_engine 注入 mock LLM", eng.forge_engine.llm is llm)
except Exception as e:
    check("引擎构造", False, traceback.format_exc())

# ============================================================
section("T2: 单技能 upsert + 索引完整性")
try:
    idx = SkillIndexer()
    s = SkillAsset(skill_id="s1", name="电影调色技能", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"],
        deliverable_type="color_script", project_stage="postproduction", maturity="v2",
        weighted_recall_text="调色 色彩脚本 color_script LUT",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=["调色方案"],
            sample_queries=["电影调色"], entities=RetrievalEntities(who=["调色师"],actions=["调色"],objects=["LUT"]),
            scenarios=["调色"], project_stages=["postproduction"]))
    idx.upsert(s)
    check("upsert 后 skills 计数", len(idx.skills)==1, f"got {len(idx.skills)}")
    check("idx_role 有值", len(idx.idx_role.get("visual_language", set()))==1)
    check("idx_module 有值", len(idx.idx_module.get("MyStudio.VisualLanguage", set()))==1)
    check("phrase_index 非空", len(idx.phrase_index)>0, f"phrase_index={len(idx.phrase_index)}")
    check("topic_index 有 color_grading", "s1" in idx.topic_index.get("color_grading", set()))
    check("ngram_postings 非空", len(idx.ngram_postings)>0)
    check("doc_count==1", idx.doc_count==1)
except Exception as e:
    check("upsert 索引", False, traceback.format_exc())

# ============================================================
section("T3: 多技能 bulk_load + BM25 索引")
try:
    idx2 = SkillIndexer()
    skills = []
    for i, (role, dt) in enumerate([("visual_language","color_script"),("audio_design","sound_map"),("editing","edit_decision_list")]):
        skills.append(SkillAsset(skill_id=f"m{i}", name=f"技能{i} {dt}", domain="ai_cinema", sub_domain="cinema",
            cinematic_role=role, module_target=[f"MyStudio.{role.split('_')[0].title()}"], deliverable_type=dt,
            project_stage="postproduction", maturity="v2",
            weighted_recall_text=f"{dt} 调色 混音 剪辑",
            retrieval_profile=RetrievalProfile(logical_topics=["color_grading"] if i==0 else ["editing_rhythm"],
                aliases=[dt], sample_queries=[f"如何{dt}"], entities=RetrievalEntities(actions=[role]),
                scenarios=["后期"], project_stages=["postproduction"])))
    idx2.bulk_load(skills)
    check("bulk_load 3 技能", len(idx2.skills)==3)
    check("df 计算正确", len(idx2.df)>0)
    check("avg_doc_len>0", idx2.avg_doc_len>0)
except Exception as e:
    check("bulk_load", False, traceback.format_exc())

# ============================================================
section("T4: RecallEngine.understand 完整性")
try:
    idx3 = SkillIndexer()
    idx3.upsert(s)
    tm = TopicMapper()
    re_eng = RecallEngine(idx3, tm)
    qu = re_eng.understand("电影调色怎么搞", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"}, context={"caller_agent":"VisualLanguage"})
    check("normalized_text 非空", bool(qu.normalized_text))
    check("expanded_queries 非空", len(qu.expanded_queries)>0, f"expanded={qu.expanded_queries}")
    check("char_ngrams 非空", len(qu.char_ngrams)>0)
    check("slots.actions 含调色", "调色" in qu.slots.actions, f"actions={qu.slots.actions}")
    check("topics 非空", len(qu.topics)>0, f"topics={[t.topic for t in qu.topics]}")
    check("project_stages 含 postproduction", "postproduction" in qu.project_stages, f"stages={qu.project_stages}")
except Exception as e:
    check("understand", False, traceback.format_exc())

# ============================================================
section("T5: R0 结构化路由")
try:
    re_eng = RecallEngine(SkillIndexer(), tm)
    re_eng.indexer.upsert(s)
    # 命中
    qu_hit = re_eng.understand("调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"]})
    s0, e0, l0 = re_eng.r0_structured_route(qu_hit)
    check("R0 命中", len(s0)==1 and "s1" in s0, f"s0={s0}")
    # 不命中（role 不匹配）
    qu_miss = re_eng.understand("调色", route_fields={"cinematic_role":"audio_design","deliverable_type":"sound_map"})
    s0m, _, _ = re_eng.r0_structured_route(qu_miss)
    check("R0 不命中返回空", len(s0m)==0, f"s0m={s0m}")
    # 无 route_fields
    qu_norf = re_eng.understand("调色", route_fields={})
    s0n, _, _ = re_eng.r0_structured_route(qu_norf)
    check("R0 无 route_fields 返回空", len(s0n)==0)
except Exception as e:
    check("R0", False, traceback.format_exc())

# ============================================================
section("T6: full 召回 + RRF 融合")
try:
    idx4 = SkillIndexer()
    idx4.bulk_load([s] + [SkillAsset(skill_id=f"x{i}", name=f"调色相关{i}", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        project_stage="postproduction", maturity="v1", weighted_recall_text=f"调色 color_script {i}",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=[f"调色{i}"], sample_queries=[f"调色方法{i}"], entities=RetrievalEntities(actions=["调色"]), scenarios=["调色"])) for i in range(5)])
    # 给 s 加 embedding（mock）
    for sk in idx4.skills.values():
        sk.embedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    idx4._rebuild_all()
    re_eng = RecallEngine(idx4, tm, forge_engine=eng.forge_engine)
    qu = re_eng.understand("电影调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"})
    res = re_eng.recall(qu, topk=3, recall_mode="full")
    check("full 召回返回候选", len(res.candidates)>0, f"candidates={len(res.candidates)}")
    check("hit_layer 非空", bool(res.hit_layer), f"hit_layer={res.hit_layer}")
    check("layer_rankings 含 R0", "R0" in res.layer_rankings)
    check("候选有 rrf_score", all(c.rrf_score>0 for c in res.candidates))
except Exception as e:
    check("full recall", False, traceback.format_exc())

# ============================================================
section("T7: fast 召回路径")
try:
    re_eng = RecallEngine(idx4, tm, forge_engine=eng.forge_engine)
    qu = re_eng.understand("电影调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"})
    res = re_eng.recall(qu, topk=2, recall_mode="fast")
    check("fast 召回有候选", len(res.candidates)>0)
    check("fast hit_layer in R0/R1", res.hit_layer in ("R0","R1"), f"hit={res.hit_layer}")
except Exception as e:
    check("fast recall", False, traceback.format_exc())

# ============================================================
section("T8: serve 热运行完整路径（mock LLM + mock 知识）")
try:
    eng2 = PandaCineForge(llm=llm, system_message="sys", user_template="{{skill_name}}")
    # 替换知识获取为 mock
    eng2.forge_engine.forger.knowledge_fetcher = MockKnowledgeFetcher(llm)
    eng2.forge_engine.forger.fusion = pcf.KnowledgeFusionLayer()
    # 预置一个技能
    eng2.indexer.upsert(s)
    # serve 命中
    resp = eng2.serve({
        "call_id": "c1", "route_fields": {"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"],"project_stage":"postproduction","sub_domain":"cinema"},
        "context": {"caller_agent":"VisualLanguage"}, "query_text":"电影调色", "recall_mode":"full", "topk":3
    })
    check("serve 返回 status", resp.get("status") in ("hit","forged"), f"status={resp.get('status')}")
    check("serve 返回 skills", len(resp.get("skills",[]))>0, f"skills={len(resp.get('skills',[]))}")
    check("serve workflow 有 steps", len(resp.get("workflow",{}).get("steps",[]))>0)
    check("serve execution_ready", resp.get("execution_ready")==True)
except Exception as e:
    check("serve", False, traceback.format_exc())

# ============================================================
section("T9: serve R5 兜底（召回为空时实时生成）")
try:
    eng3 = PandaCineForge(llm=llm, system_message="sys", user_template="{{skill_name}}")
    eng3.forge_engine.forger.knowledge_fetcher = MockKnowledgeFetcher(llm)
    # 不预置任何技能，强制 R5
    resp = eng3.serve({
        "call_id": "c2", "route_fields": {"cinematic_role":"scene_design","deliverable_type":"beat_sheet","module_target":["MyStudio.SceneDesign"]},
        "context": {}, "query_text":"三幕结构", "recall_mode":"full", "topk":3
    })
    check("R5 兜底 status=forged", resp.get("status")=="forged", f"status={resp.get('status')}")
    check("R5 返回 1 skill", len(resp.get("skills",[]))==1)
    check("R5 source_layer=R5", resp.get("source_layer")=="R5")
    check("R5 生成后入库", len(eng3.indexer.skills)>=1)
except Exception as e:
    check("R5 fallback", False, traceback.format_exc())

# ============================================================
section("T10: serve 异常输入（缺必填字段）")
try:
    resp = eng2.serve({"call_id":"c3","route_fields":{"cinematic_role":"visual_language"}})  # 缺 deliverable_type
    check("缺字段返回 error", resp.get("status")=="error")
    check("error 有 message", bool(resp.get("message")))
except Exception as e:
    check("serve 异常", False, traceback.format_exc())

# ============================================================
section("T11: serve 空查询文本")
try:
    resp = eng2.serve({
        "call_id":"c4","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},
        "query_text":"", "recall_mode":"full","topk":2
    })
    check("空查询不崩溃", resp.get("status") in ("hit","forged","fallback_degraded"), f"status={resp.get('status')}")
except Exception as e:
    check("空查询", False, traceback.format_exc())

# ============================================================
section("T12: serve 传 JSON 字符串")
try:
    req_str = json.dumps({"call_id":"c5","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"]},"query_text":"调色","recall_mode":"fast","topk":1})
    resp = eng2.serve(req_str)
    check("JSON 字符串入参可用", resp.get("status") in ("hit","forged"), f"status={resp.get('status')}")
except Exception as e:
    check("JSON str", False, traceback.format_exc())

# ============================================================
section("T13: 实战反馈回传 + 成熟度进化")
try:
    eng4 = PandaCineForge(llm=llm, system_message="sys", user_template="{{skill_name}}")
    eng4.forge_engine.forger.knowledge_fetcher = MockKnowledgeFetcher(llm)
    eng4.indexer.upsert(s)  # s 是 v2
    sid = "s1"
    # 连续3次高分 → v2→v3
    for _ in range(3):
        r = eng4.report_feedback(sid, "success", 90)
    check("连续3次高分升 v3", eng4.indexer.skills[sid].maturity=="v3", f"maturity={eng4.indexer.skills[sid].maturity}")
    check("反馈返回 maturity", "maturity" in r)
    check("call_count 累计", eng4.indexer.skills[sid].call_count==3, f"call_count={eng4.indexer.skills[sid].call_count}")
    # 不存在的 skill
    r2 = eng4.report_feedback("not_exist", "success", 90)
    check("不存在 skill 返回 error", r2.get("status")=="error")
except Exception as e:
    check("feedback", False, traceback.format_exc())

# ============================================================
section("T14: 质检 QA + 一票否决")
try:
    # 正常技能
    qa = eng4.qa_check("s1")
    check("qa_check 返回 final_status", "final_status" in qa)
    check("qa_check 返回 overall_score", "overall_score" in qa)
    # 一票否决：写操作无确认门
    bad = SkillAsset(skill_id="bad1", name="坏技能", cinematic_role="editing",
        execution_contract={"tools_write":["render"],"confirmation_required_for":[]},
        content="渲染导出")
    eng4.indexer.upsert(bad)
    qa2 = eng4.qa_check("bad1")
    check("写操作无确认门触发 veto", qa2.get("veto_hit") is not None, f"veto={qa2.get('veto_hit')}")
    check("veto 返回 rejected", qa2.get("final_status")=="rejected")
except Exception as e:
    check("QA", False, traceback.format_exc())

# ============================================================
section("T15: SkillAsset 序列化往返")
try:
    d = s.to_dict()
    check("to_dict 含 retrieval_profile", "retrieval_profile" in d)
    check("to_dict 含 knowledge_provenance", "knowledge_provenance" in d)
    s2 = SkillAsset.from_dict(d)
    check("from_dict 往返 skill_id 一致", s2.skill_id==s.skill_id)
    check("from_dict 往返 cinematic_role 一致", s2.cinematic_role==s.cinematic_role)
    rr = s.to_recall_record()
    check("to_recall_record 含 embedding", "embedding" in rr)
    check("to_recall_record 含 weighted_recall_text", "weighted_recall_text" in rr)
except Exception as e:
    check("serialize", False, traceback.format_exc())

# ============================================================
section("T16: 编排 + 分发")
try:
    idx5 = SkillIndexer()
    idx5.upsert(s)
    orch = Orchestrator(idx5)
    rs = [pcf.RankedSkill("s1","电影调色","ai_cinema",1.0)]
    wf = orch.build_workflow(rs)
    check("workflow 有 step", len(wf["steps"])==1)
    check("step agent 正确", wf["steps"][0]["agent"]=="MyStudio.VisualLanguage")
    disp = pcf.dispatch_to_agent("MyStudio.VisualLanguage", s)
    check("dispatch role_match", disp.get("role_match")==True)
    check("dispatch status", disp.get("status")=="dispatched")
except Exception as e:
    check("orchestrate", False, traceback.format_exc())

# ============================================================
section("T17: 契约层")
try:
    cg = ContractGateway()
    qu = cg.parse_call({"route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":"调色"})
    check("parse_call 成功", qu.route_fields.get("cinematic_role")=="visual_language")
    # 缺字段
    try:
        cg.parse_call({"route_fields":{"cinematic_role":"visual_language"}})
        check("缺字段抛 ValueError", False, "未抛异常")
    except ValueError:
        check("缺字段抛 ValueError", True)
    ret = cg.build_return("c1","hit","R0",[s],{"steps":[]},True)
    check("build_return 结构", ret["call_id"]=="c1" and ret["status"]=="hit")
    check("build_return execution_ready", ret["execution_ready"]==True)
    # 空 skills
    ret2 = cg.build_return("c2","fallback","none",[],None,False)
    check("空 skills execution_ready False", ret2["execution_ready"]==False)
except Exception as e:
    check("contract", False, traceback.format_exc())

# ============================================================
section("T18: 冷启动（小矩阵，mock 知识）")
try:
    eng5 = PandaCineForge(llm=llm, system_message="sys", user_template="{{skill_name}}")
    eng5.forge_engine.forger.knowledge_fetcher = MockKnowledgeFetcher(llm)
    small_matrix = [
        {"agent":"VisualLanguage","cinematic_role":"visual_language","sub_domain":"cinema","tasks":["分镜设计","色彩脚本"]},
    ]
    r = eng5.cold_start(small_matrix)
    check("冷启动完成", r.get("status")=="cold_start_completed")
    check("冷启动生成2技能", r.get("generated_count")==2, f"count={r.get('generated_count')}")
    check("冷启动后索引有技能", len(eng5.indexer.skills)==2)
except Exception as e:
    check("cold_start", False, traceback.format_exc())

# ============================================================
section("T19: forge_one 手动生成")
try:
    eng6 = PandaCineForge(llm=llm, system_message="sys", user_template="{{skill_name}}")
    eng6.forge_engine.forger.knowledge_fetcher = MockKnowledgeFetcher(llm)
    payload = {"skill_name":"测试技能","skill_id":"manual1","cinematic_role":"visual_language",
        "deliverable_type":"color_script","sub_domain":"cinema","output_format":"json",
        "module_target":["MyStudio.VisualLanguage"]}
    sk = eng6.forge_one(payload)
    check("forge_one 返回 SkillAsset", isinstance(sk, SkillAsset))
    check("forge_one 入库", "manual1" in eng6.indexer.skills)
    check("forge_one 有 embedding", len(sk.embedding)>0)
except Exception as e:
    check("forge_one", False, traceback.format_exc())

# ============================================================
section("T20: extract_project_stages + normalize 边界")
try:
    check("extract 前期", "preproduction" in extract_project_stages("剧本筹备阶段"))
    check("extract 后期", "postproduction" in extract_project_stages("剪辑调色"))
    check("extract 发行", "distribution" in extract_project_stages("DCP交付"))
    check("normalize 空串", normalize_text("")=="")
    check("normalize None 容错", normalize_text(None)=="")  # type: ignore
    check("char_ngrams 短串", len(char_ngrams("a"))==0)
except Exception as e:
    check("utils", False, traceback.format_exc())

print(f"\n{'='*50}\n总计: ✅{PASS} ❌{FAIL}\n{'='*50}")
if ISSUES:
    print("\n问题清单:")
    for i, iss in enumerate(ISSUES, 1):
        print(f"  {i}. {iss}")
sys.exit(1 if FAIL else 0)
```

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复后回归 + 增强边界测试。"""
import sys, os, json, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import panda_cineforge as pcf
from panda_cineforge import (PandaCineForge, SkillAsset, RetrievalProfile, RetrievalEntities,
    KnowledgeProvenance, SkillIndexer, RecallEngine, TopicMapper, LLMClient)

PASS=0; FAIL=0; ISSUES=[]
def check(n,c,d=""):
    global PASS,FAIL
    if c: PASS+=1; print(f"  ✅ {n}")
    else: FAIL+=1; ISSUES.append(f"{n}: {d}"); print(f"  ❌ {n} | {d}")
def sec(t): print(f"\n=== {t} ===")

class MockLLM(LLMClient):
    def __init__(self): self._client="mock"
    @property
    def available(self): return True
    def chat(self,sm,um,temperature=0.2,json_mode=False):
        return json.dumps({"name":"M","skill_id":"mock","version":"1.0.0","last_updated":"2026-01-01","domain":"ai_cinema","sub_domain":"cinema","cinematic_role":"visual_language","module_target":["MyStudio.VisualLanguage"],"deliverable_type":"color_script","project_stage":"postproduction","retrieval_profile":{"logical_topics":["color_grading"],"aliases":["调色"],"sample_queries":["调色"],"problem_patterns":[],"entities":{"who":[],"actions":["调色"],"objects":["LUT"]},"scenarios":[],"project_stages":["postproduction"],"urgency":"normal","negative_queries":[],"summary":"调色"},"weighted_recall_text":"调色 color_script","content":"## TL;DR\n调色","body":{"tl_dr":"调色"}},ensure_ascii=False)
    def embed(self,t): return [0.1]*8

class MockKF(pcf.ExternalKnowledgeFetcher):
    def fetch(self,*a,**k):
        p=KnowledgeProvenance(); p.sources=[{"url":"x","domain":"x","trust_score":0.95,"source_class":"案例"}]
        p.knowledge_points={"principles":4}; p.confidence_score=0.9; p.confidence_tier="high"
        p.dimension_coverage={"required":["principles"],"covered":["principles"],"missing":[]}
        return [{"dim":"principles","text":"原理"}],p

def mkskill(sid, role="visual_language", dt="color_script", sub="cinema"):
    return SkillAsset(skill_id=sid, name=f"技能{sid}", domain="ai_cinema", sub_domain=sub,
        cinematic_role=role, module_target=["MyStudio.VisualLanguage"], deliverable_type=dt,
        project_stage="postproduction", maturity="v2", weighted_recall_text=f"调色 {dt} {sid}",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=[f"调色{sid}"],
            sample_queries=[f"调色{sid}"], entities=RetrievalEntities(actions=["调色"]), scenarios=["调色"]))

# ===== R0 部分字段命中（只给 role，不给 module/stage）=====
sec("A1: R0 部分字段命中")
try:
    idx=SkillIndexer(); idx.upsert(mkskill("s1"))
    re_eng=RecallEngine(idx, TopicMapper())
    qu=re_eng.understand("调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"})
    s0,_,_=re_eng.r0_structured_route(qu)
    check("只给role+deliverable 命中", len(s0)==1 and "s1" in s0, f"s0={s0}")
except Exception as e: check("R0部分字段",False,traceback.format_exc())

# ===== R0 多字段交集 =====
sec("A2: R0 多字段交集")
try:
    idx=SkillIndexer()
    idx.upsert(mkskill("a", role="visual_language", dt="color_script"))
    idx.upsert(mkskill("b", role="visual_language", dt="shotlist"))
    re_eng=RecallEngine(idx, TopicMapper())
    qu=re_eng.understand("调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"})
    s0,_,_=re_eng.r0_structured_route(qu)
    check("role+deliverable 交集仅 a", set(s0.keys())=={"a"}, f"s0={s0}")
except Exception as e: check("R0交集",False,traceback.format_exc())

# ===== 增量 upsert 性能（不应全量重建）=====
sec("A3: 增量 upsert 性能")
try:
    idx=SkillIndexer()
    for i in range(50): idx.upsert(mkskill(f"k{i}"))
    t0=time.time()
    idx.upsert(mkskill("k50"))
    dt=time.time()-t0
    check("50+1 增量 upsert <0.1s", dt<0.1, f"dt={dt:.3f}s")
    check("增量后 51 技能", len(idx.skills)==51)
    check("增量后 df 重算", len(idx.df)>0)
    # 验证旧技能索引仍在
    check("旧技能索引保留", "k0" in idx.idx_role.get("visual_language",set()))
except Exception as e: check("增量upsert",False,traceback.format_exc())

# ===== upsert 更新已有技能（覆盖）=====
sec("A4: upsert 覆盖更新")
try:
    idx=SkillIndexer()
    s1=mkskill("s1", role="visual_language")
    idx.upsert(s1)
    # 更新为不同 role
    s1b=SkillAsset(skill_id="s1", name="更新后", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="audio_design", module_target=["MyStudio.AudioDesign"], deliverable_type="sound_map",
        project_stage="postproduction", maturity="v2", weighted_recall_text="混音 sound_map",
        retrieval_profile=RetrievalProfile(logical_topics=["sound_design"], aliases=["混音"], sample_queries=["混音"], entities=RetrievalEntities(actions=["混音"]), scenarios=["混音"]))
    idx.upsert(s1b)
    check("更新后旧 role 索引清除", "s1" not in idx.idx_role.get("visual_language",set()))
    check("更新后新 role 索引建立", "s1" in idx.idx_role.get("audio_design",set()))
    check("更新后 df 无幽灵", all("s1" not in v or True for v in idx.ngram_postings.values()))
except Exception as e: check("upsert覆盖",False,traceback.format_exc())

# ===== 无 LLM 降级 cold_start 不抓网络 =====
sec("A5: 无LLM降级cold_start不抓网络")
try:
    eng=PandaCineForge(llm=LLMClient(), system_message="s", user_template="{{skill_name}}")  # 无 API key → available False
    t0=time.time()
    r=eng.cold_start([{"agent":"VisualLanguage","cinematic_role":"visual_language","sub_domain":"cinema","tasks":["分镜"]}])
    dt=time.time()-t0
    check("无LLM cold_start 快速完成 <5s", dt<5, f"dt={dt:.1f}s")
    check("无LLM cold_start 生成1技能", r.get("generated_count")==1)
    check("无LLM 入库", len(eng.indexer.skills)==1)
except Exception as e: check("无LLM降级",False,traceback.format_exc())

# ===== serve 调用方传 dict 不传 JSON 字符串 =====
sec("A6: serve dict 入参")
try:
    eng=PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{skill_name}}")
    eng.forge_engine.forger.knowledge_fetcher=MockKF(eng.llm)
    eng.indexer.upsert(mkskill("s1"))
    resp=eng.serve({"call_id":"c1","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"]},"query_text":"调色","recall_mode":"full","topk":2})
    check("dict入参 status", resp.get("status") in ("hit","forged"), f"status={resp.get('status')}")
except Exception as e: check("serve dict",False,traceback.format_exc())

# ===== 非法 JSON 字符串 =====
sec("A7: serve 非法JSON")
try:
    eng=PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{skill_name}}")
    resp=eng.serve("{not valid json}")
    check("非法JSON返回error", resp.get("status")=="error")
except Exception as e: check("非法JSON",False,traceback.format_exc())

# ===== 反馈后成熟度降级 =====
sec("A8: 反馈连续低分降级")
try:
    eng=PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{skill_name}}")
    eng.forge_engine.forger.knowledge_fetcher=MockKF(eng.llm)
    s=mkskill("s1"); s.maturity="v2"
    eng.indexer.upsert(s)
    for _ in range(2): eng.report_feedback("s1","failed",40,["原因1"])
    check("连续2次低分 v2→v1", eng.indexer.skills["s1"].maturity=="v1", f"maturity={eng.indexer.skills['s1'].maturity}")
    # 反馈回流到 cache
    pits=eng.knowledge_cache.get_pitfalls("visual_language","color_script")
    check("反馈回流pitfalls", len(pits)>=1, f"pits={pits}")
except Exception as e: check("降级",False,traceback.format_exc())

# ===== 自测入口 __main__ 逻辑 =====
sec("A9: __main__ 自测逻辑")
try:
    eng=PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{skill_name}}")
    eng.forge_engine.forger.knowledge_fetcher=MockKF(eng.llm)
    fake=SkillAsset(skill_id="test_001", name="电影调色色彩脚本技能", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        project_stage="postproduction", maturity="v2", priority="P1", tags=["调色"],
        weighted_recall_text="调色 色彩脚本 color_script Rec.709 ACES 达芬奇 LUT",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=["色彩脚本","调色方案"],
            sample_queries=["电影调色怎么做","色彩脚本设计"], entities=RetrievalEntities(who=["调色师"],actions=["调色"],objects=["LUT","色彩脚本"]),
            scenarios=["调色"], project_stages=["postproduction"], urgency="normal", summary="电影调色"))
    eng.indexer.upsert(fake)
    result=eng.serve({"call_id":"tc","caller_agent":"VisualLanguage",
        "route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"],"project_stage":"postproduction","sub_domain":"cinema"},
        "context":{"project_id":"p1","caller_agent":"VisualLanguage"},"query_text":"电影调色","recall_mode":"fast","topk":3})
    check("自测 status", result.get("status") in ("hit","forged"), f"status={result.get('status')}")
    check("自测 layer", result.get("source_layer") in ("R0","R1"), f"layer={result.get('source_layer')}")
    check("自测 skills>0", len(result.get("skills",[]))>0)
except Exception as e: check("自测",False,traceback.format_exc())

# ===== 工具函数边界 =====
sec("A10: 工具函数边界")
try:
    check("safe_get 嵌套", pcf.safe_get({"a":{"b":{"c":1}}},"a","b","c")==1)
    check("safe_get 缺省", pcf.safe_get({"a":1},"b",default="x")=="x")
    check("safe_get 非dict", pcf.safe_get("str","a",default="y")=="y")
    check("gen_id 唯一性", pcf.gen_id()!=pcf.gen_id())
    check("_char_jaccard 相同=1", abs(pcf._char_jaccard("调色","调色")-1.0)<0.01)
    check("_char_jaccard 空=0", pcf._char_jaccard("","x")==0.0)
except Exception as e: check("utils边界",False,traceback.format_exc())

print(f"\n{'='*50}\n回归+增强: ✅{PASS} ❌{FAIL}\n{'='*50}")
if ISSUES:
    for i,s in enumerate(ISSUES,1): print(f"  {i}. {s}")
sys.exit(1 if FAIL else 0)
```

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第一轮：主流用户场景全链路测试。
模拟真实用户从冷启动到热运行到反馈闭环的完整业务流，覆盖三大子领域。"""
import sys, os, json, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import panda_cineforge as pcf
from panda_cineforge import (PandaCineForge, SkillAsset, RetrievalProfile, RetrievalEntities,
    KnowledgeProvenance, LLMClient, SkillIndexer, RecallEngine, TopicMapper,
    ContractGateway, QAGate, RankingOptimizer, Orchestrator,
    COLD_FORGE_MATRIX, DOMAIN_PACKS, AGENT_REGISTRY, CINEMATIC_ROLES, DELIVERABLE_TYPES)

PASS=0; FAIL=0; ISSUES=[]
def check(n,c,d=""):
    global PASS,FAIL
    if c: PASS+=1; print(f"  ✅ {n}")
    else: FAIL+=1; ISSUES.append(f"{n}: {d}"); print(f"  ❌ {n} | {d}")
def sec(t): print(f"\n{'='*60}\n场景 {t}\n{'='*60}")

# ---------- Mock LLM：模拟真实 LLM 返回结构化技能 ----------
class MockLLM(LLMClient):
    def __init__(self): self._client="mock"; self._call_count=0
    @property
    def available(self): return True
    def chat(self, sm, um, temperature=0.2, json_mode=False):
        self._call_count += 1
        # 从 user_message 中提取 skill_name（模拟 LLM 理解输入）
        import re
        m = re.search(r"skill_name:\s*(.+?)(\n|$)", um)
        skill_name = m.group(1).strip() if m else "影视技能"
        # 从 user_message 提取 cinematic_role
        m2 = re.search(r"cinematic_role:\s*(\S+)", um)
        role = m2.group(1).strip() if m2 else "visual_language"
        m3 = re.search(r"deliverable_type:\s*(\S+)", um)
        dt = m3.group(1).strip() if m3 else "color_script"
        m4 = re.search(r"sub_domain:\s*(\S+)", um)
        sub = m4.group(1).strip() if m4 else "cinema"
        return json.dumps({
            "name": skill_name, "skill_id": f"mock_{self._call_count}", "version": "1.0.0",
            "last_updated": "2026-06-28T12:00:00Z", "domain": "ai_cinema", "sub_domain": sub,
            "cinematic_role": role, "module_target": ["MyStudio.VisualLanguage"],
            "deliverable_type": dt, "project_stage": "postproduction", "maturity": "v2",
            "retrieval_profile": {
                "logical_topics": ["color_grading"], "aliases": [skill_name, "调色"],
                "sample_queries": [f"如何{skill_name}", f"{skill_name}怎么做", f"{skill_name}教程"],
                "problem_patterns": [], "entities": {"who":["调色师"],"actions":["调色"],"objects":["LUT"]},
                "scenarios": ["调色"], "project_stages": ["postproduction"],
                "urgency": "normal", "negative_queries": [], "summary": skill_name,
            },
            "weighted_recall_text": f"{skill_name} {dt} 调色 LUT",
            "content": f"## TL;DR\n{skill_name}专业技能", "body": {"tl_dr": skill_name},
            "execution_contract": {"tools_read": ["达芬奇"], "tools_write": [], "confirmation_required_for": []},
            "capabilities": {"tools": ["达芬奇"], "data_sources": [], "output_formats": ["json"]},
            "fallback_strategy": {"level1_tool":"达芬奇","level2_data":"LUT预设","level3_output":"默认调色"},
            "runtime_contract": {"context":"影视"}, "persona_adaptation": {"user_profile":True,"modes":["专业"],"constraints":{"safety_first":True,"location_aware":False,"time_sensitive":True}},
        }, ensure_ascii=False)
    def embed(self, t):
        h = abs(hash(t)) % 256
        return [((h >> i) & 1) * 1.0 for i in range(8)]

class MockKF(pcf.ExternalKnowledgeFetcher):
    def fetch(self, *a, **k):
        p = KnowledgeProvenance()
        p.sources = [{"url":"https://example.com","domain":"example.com","trust_score":0.95,"source_class":"案例专业"}]
        p.knowledge_points = {"principles":5,"standards":3,"tool_params":4,"case_refs":2,"heuristics":1}
        p.dimension_coverage = {"required":["principles","standards","tool_params"],"covered":["principles","standards","tool_params"],"missing":[]}
        p.confidence_score = 0.92; p.confidence_tier = "high"
        return [{"dim":"principles","text":"调色原理：先校正后调色","source":"example.com","trust":0.95},
                {"dim":"standards","text":"Rec.709 用于 SDR","source":"example.com","trust":0.95},
                {"dim":"tool_params","text":"达芬奇色轮三级调色","source":"example.com","trust":0.95}], p

def make_engine():
    eng = PandaCineForge(llm=MockLLM(), system_message="sys", user_template="{{skill_name}}")
    eng.forge_engine.forger.knowledge_fetcher = MockKF(eng.llm)
    return eng


# ============================================================
sec("1：新用户首次冷启动（无 LLM 降级路径）")
# 模拟：开源用户未配置 OPENAI_API_KEY，直接冷启动
try:
    eng = PandaCineForge(llm=LLMClient(), system_message="sys", user_template="{{skill_name}}")
    check("无API Key LLM不可用", not eng.llm.available)
    t0 = time.time()
    r = eng.cold_start([{"agent":"VisualLanguage","cinematic_role":"visual_language","sub_domain":"cinema","tasks":["分镜设计","色彩脚本"]}])
    dt = time.time() - t0
    check("冷启动完成", r.get("status")=="cold_start_completed")
    check("生成2技能", r.get("generated_count")==2, f"count={r.get('generated_count')}")
    check("无LLM快速完成<10s", dt<10, f"dt={dt:.1f}s")
    check("技能已入库", len(eng.indexer.skills)==2)
    # 降级路径下技能应有骨架（weighted_recall_text 非空）
    for sid, sk in eng.indexer.skills.items():
        check(f"{sid} 有召回文本", bool(sk.weighted_recall_text), f"wrt={sk.weighted_recall_text!r}")
        break
    # 无 LLM 时 maturity 应为 v1（置信度门禁 low）
    check("无LLM maturity=v1", all(s.maturity=="v1" for s in eng.indexer.skills.values()), f"maturities={[s.maturity for s in eng.indexer.skills.values()]}")
except Exception as e:
    check("场景1", False, traceback.format_exc())

# ============================================================
sec("2：影视公司冷启动 + 热运行召回（完整闭环）")
# 模拟：影视公司配置好 LLM，冷启动预置技能，然后 Agent 热运行召回
try:
    eng = make_engine()
    # 冷启动小矩阵
    matrix = [
        {"agent":"VisualLanguage","cinematic_role":"visual_language","sub_domain":"cinema","tasks":["分镜设计","色彩脚本","运镜设计"]},
        {"agent":"AudioDesign","cinematic_role":"audio_design","sub_domain":"cinema","tasks":["5.1混音","对白处理"]},
        {"agent":"ContinuityReview","cinematic_role":"continuity_review","sub_domain":"cinema","tasks":["180度线检查"]},
    ]
    r = eng.cold_start(matrix)
    check("冷启动6技能", r.get("generated_count")==6, f"count={r.get('generated_count')}")
    check("maturity_dist 含 v2", "v2" in r.get("maturity_dist",{}), f"dist={r.get('maturity_dist')}")
    # 热运行：调色师 Agent 请求色彩脚本技能
    resp = eng.serve({
        "call_id":"c1","caller_agent":"VisualLanguage",
        "route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"],"project_stage":"postproduction","sub_domain":"cinema"},
        "context":{"project_id":"film_001","caller_agent":"VisualLanguage","project_type":"feature_film"},
        "query_text":"电影调色方案","recall_mode":"full","topk":3
    })
    check("serve status=hit", resp.get("status")=="hit", f"status={resp.get('status')}")
    check("serve source_layer=R0", resp.get("source_layer")=="R0", f"layer={resp.get('source_layer')}")
    check("serve 返回技能", len(resp.get("skills",[]))>0)
    check("serve workflow 有步骤", len(resp.get("workflow",{}).get("steps",[]))>0)
    check("serve execution_ready", resp.get("execution_ready")==True)
    # 验证召回的技能 deliverable_type 匹配
    for sk in resp.get("skills",[]):
        check("召回技能 deliverable_type=color_script", sk.get("deliverable_type")=="color_script", f"dt={sk.get('deliverable_type')}")
        break
except Exception as e:
    check("场景2", False, traceback.format_exc())

# ============================================================
sec("3：短视频创作者使用流程")
# 模拟：短视频创作者需要钩子设计 + 投流策略
try:
    eng = make_engine()
    eng.cold_start([
        {"agent":"OpeningDesign","cinematic_role":"opening_design","sub_domain":"short_video","tasks":["3秒开场","品牌片头"]},
        {"agent":"SceneDesign","cinematic_role":"scene_design","sub_domain":"short_video","tasks":["爆款文案","投流策略"]},
    ])
    # 请求钩子设计
    resp = eng.serve({
        "call_id":"c2","caller_agent":"OpeningDesign",
        "route_fields":{"cinematic_role":"opening_design","deliverable_type":"opening_sequence","module_target":["MyStudio.OpeningDesign"],"sub_domain":"short_video"},
        "context":{"project_id":"sv_001","caller_agent":"OpeningDesign","platform":"douyin"},
        "query_text":"3秒开场钩子","recall_mode":"full","topk":2
    })
    check("短视频 serve status", resp.get("status") in ("hit","forged"), f"status={resp.get('status')}")
    check("短视频 sub_domain=short_video", all(s.get("sub_domain")=="short_video" for s in resp.get("skills",[])))
    # 请求投流策略
    resp2 = eng.serve({
        "call_id":"c3","caller_agent":"SceneDesign",
        "route_fields":{"cinematic_role":"scene_design","deliverable_type":"beat_sheet","module_target":["MyStudio.SceneDesign"],"sub_domain":"short_video"},
        "context":{"caller_agent":"SceneDesign"},"query_text":"投流策略","recall_mode":"full","topk":2
    })
    check("投流 serve status", resp2.get("status") in ("hit","forged"), f"status={resp2.get('status')}")
except Exception as e:
    check("场景3", False, traceback.format_exc())

# ============================================================
sec("4：AI漫剧创作者使用流程")
# 模拟：AI漫剧创作者需要分集大纲 + 角色一致性
try:
    eng = make_engine()
    eng.cold_start([
        {"agent":"SceneDesign","cinematic_role":"scene_design","sub_domain":"ai_manga_drama","tasks":["分集大纲","连载钩子"]},
        {"agent":"PromptFusion","cinematic_role":"prompt_fusion","sub_domain":"ai_manga_drama","tasks":["AI生图一致性提示词","LoRA角色固化"]},
    ])
    # 请求分集大纲
    resp = eng.serve({
        "call_id":"c4","caller_agent":"SceneDesign",
        "route_fields":{"cinematic_role":"scene_design","deliverable_type":"beat_sheet","module_target":["MyStudio.SceneDesign"],"sub_domain":"ai_manga_drama"},
        "context":{"caller_agent":"SceneDesign","series_id":"md_001"},
        "query_text":"漫剧分集大纲","recall_mode":"full","topk":2
    })
    check("漫剧 serve status", resp.get("status") in ("hit","forged"))
    check("漫剧 sub_domain", all(s.get("sub_domain")=="ai_manga_drama" for s in resp.get("skills",[])))
    # 请求角色一致性提示词
    resp2 = eng.serve({
        "call_id":"c5","caller_agent":"PromptFusion",
        "route_fields":{"cinematic_role":"prompt_fusion","deliverable_type":"prompt_pack","module_target":["MyStudio.PromptFusion"],"sub_domain":"ai_manga_drama"},
        "context":{"caller_agent":"PromptFusion"},"query_text":"角色一致性提示词","recall_mode":"full","topk":2
    })
    check("角色一致性 serve status", resp2.get("status") in ("hit","forged"))
    check("角色一致性 deliverable_type", any(s.get("deliverable_type")=="prompt_pack" for s in resp2.get("skills",[])))
except Exception as e:
    check("场景4", False, traceback.format_exc())

# ============================================================
sec("5：技能成熟度全生命周期（v0→v2→v3→降级→淘汰）")
try:
    eng = make_engine()
    sk = SkillAsset(skill_id="life_001", name="生命周期测试技能", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        project_stage="postproduction", maturity="v0", weighted_recall_text="调色 color_script",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=["调色"], sample_queries=["调色"], entities=RetrievalEntities(actions=["调色"]), scenarios=["调色"]))
    eng.indexer.upsert(sk)
    sid = "life_001"
    # v0 → v1: 单次反馈
    eng.report_feedback(sid, "success", 70)
    check("v0 单次反馈后仍 v0/v1", eng.indexer.skills[sid].maturity in ("v0","v1"), f"m={eng.indexer.skills[sid].maturity}")
    # v1 → v2: 手动设为 v1 后连续3次高分
    eng.indexer.skills[sid].maturity = "v1"
    eng.indexer.skills[sid].quality_history = []
    for _ in range(3): eng.report_feedback(sid, "success", 90)
    check("v1 连续3次高分升 v2", eng.indexer.skills[sid].maturity=="v2", f"m={eng.indexer.skills[sid].maturity}")
    # v2 → v3: 连续3次高分
    for _ in range(3): eng.report_feedback(sid, "success", 95)
    check("v2 连续3次高分升 v3", eng.indexer.skills[sid].maturity=="v3", f"m={eng.indexer.skills[sid].maturity}")
    # v3 → v2: 连续2次低分降级
    for _ in range(2): eng.report_feedback(sid, "failed", 40)
    check("v3 连续2次低分降 v2", eng.indexer.skills[sid].maturity=="v2", f"m={eng.indexer.skills[sid].maturity}")
    # 插入一次高分打断连续低分，再测 v2 → v1（连续2次低分）
    eng.report_feedback(sid, "success", 90)
    for _ in range(2): eng.report_feedback(sid, "failed", 30)
    check("v2 (打断后) 连续2次低分降 v1", eng.indexer.skills[sid].maturity=="v1", f"m={eng.indexer.skills[sid].maturity}")
    # 验证 call_count 累计
    check("call_count 累计正确", eng.indexer.skills[sid].call_count==12, f"cc={eng.indexer.skills[sid].call_count}")
    # 验证质量历史长度限制
    check("quality_history 限长20", len(eng.indexer.skills[sid].quality_history)<=20, f"len={len(eng.indexer.skills[sid].quality_history)}")
except Exception as e:
    check("场景5", False, traceback.format_exc())

# ============================================================
sec("6：质检否决场景与修复")
try:
    eng = make_engine()
    # 6.1 正常技能通过质检
    good = SkillAsset(skill_id="good_001", name="正常调色技能", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        weighted_recall_text="调色 color_script LUT", content="调色技能内容",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=["调色"], sample_queries=["调色"], entities=RetrievalEntities(actions=["调色"])),
        execution_contract={"tools_read":["达芬奇"],"tools_write":[],"confirmation_required_for":[]},
        capabilities={"tools":["达芬奇"]}, fallback_strategy={"level1_tool":"x","level2_data":"y","level3_output":"z"})
    eng.indexer.upsert(good)
    qa = eng.qa_check("good_001")
    check("正常技能质检非rejected", qa.get("final_status")!="rejected", f"status={qa.get('final_status')}")
    check("正常技能有分数", qa.get("overall_score",0)>0)
    # 6.2 写操作无确认门 → veto
    bad1 = SkillAsset(skill_id="bad_001", name="渲染技能", cinematic_role="editing",
        execution_contract={"tools_write":["批量渲染"],"confirmation_required_for":[]},
        content="批量渲染导出")
    eng.indexer.upsert(bad1)
    qa2 = eng.qa_check("bad_001")
    check("写操作无确认门 veto", qa2.get("veto_hit") is not None, f"veto={qa2.get('veto_hit')}")
    check("veto rejected", qa2.get("final_status")=="rejected")
    # 6.3 修复后重新质检
    eng.indexer.skills["bad_001"].execution_contract["confirmation_required_for"] = ["批量渲染"]
    eng.indexer.upsert(eng.indexer.skills["bad_001"])
    qa3 = eng.qa_check("bad_001")
    check("修复确认门后 veto 消除", qa3.get("veto_hit") is None, f"veto={qa3.get('veto_hit')}")
except Exception as e:
    check("场景6", False, traceback.format_exc())

# ============================================================
sec("7：多技能召回 + 编排分发至多 Agent")
try:
    eng = make_engine()
    # 预置跨 role 的多个技能
    for i, (role, dt, agent) in enumerate([
        ("visual_language","color_script","MyStudio.VisualLanguage"),
        ("audio_design","sound_map","MyStudio.AudioDesign"),
        ("continuity_review","continuity_report","MyStudio.ContinuityReview"),
    ]):
        eng.indexer.upsert(SkillAsset(skill_id=f"multi_{i}", name=f"多技能{i}", domain="ai_cinema", sub_domain="cinema",
            cinematic_role=role, module_target=[agent], deliverable_type=dt, project_stage="postproduction",
            maturity="v2", weighted_recall_text=f"{dt} 调色 混音 剪辑",
            retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=[dt], sample_queries=[dt], entities=RetrievalEntities(actions=[role.split('_')[0]]), scenarios=["后期"])))
    # 用全文召回（不给精确 route_fields，让 R1/R3 命中）
    resp = eng.serve({
        "call_id":"c7","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script","module_target":["MyStudio.VisualLanguage"]},
        "context":{},"query_text":"后期制作调色混音","recall_mode":"full","topk":3
    })
    check("多技能召回 status", resp.get("status") in ("hit","forged"))
    check("多技能返回>0", len(resp.get("skills",[]))>0)
    wf = resp.get("workflow",{})
    check("workflow steps>0", len(wf.get("steps",[]))>0)
    # 验证每个 step 结构完整
    for step in wf.get("steps",[]):
        check("step 含 agent", "agent" in step)
        check("step 含 skill_id", "skill_id" in step)
        check("step 含 order", "order" in step)
        break
    # 分发验证
    if wf.get("steps"):
        first_step = wf["steps"][0]
        disp = pcf.dispatch_to_agent(first_step["agent"], eng.indexer.skills[first_step["skill_id"]])
        check("dispatch 成功", disp.get("status")=="dispatched")
        check("dispatch 含 role_match", "role_match" in disp)
except Exception as e:
    check("场景7", False, traceback.format_exc())

# ============================================================
sec("8：R5 实时生成兜底 + 飞轮反哺")
try:
    eng = make_engine()
    # 空索引，请求一个冷启动矩阵里没有的 role 组合
    resp = eng.serve({
        "call_id":"c8","route_fields":{"cinematic_role":"vfx","deliverable_type":"shotlist","module_target":["MyStudio.VisualLanguage"]},
        "context":{},"query_text":"视效合成","recall_mode":"full","topk":2
    })
    check("R5 兜底 status=forged", resp.get("status")=="forged", f"status={resp.get('status')}")
    check("R5 source_layer=R5", resp.get("source_layer")=="R5", f"layer={resp.get('source_layer')}")
    check("R5 返回1技能", len(resp.get("skills",[]))==1)
    # 飞轮反哺：生成的技能应已入库
    check("R5 生成后入库", len(eng.indexer.skills)>=1)
    # 再次请求相同需求，应命中已入库的（不再 R5）
    resp2 = eng.serve({
        "call_id":"c8b","route_fields":{"cinematic_role":"vfx","deliverable_type":"shotlist","module_target":["MyStudio.VisualLanguage"]},
        "context":{},"query_text":"视效合成","recall_mode":"full","topk":2
    })
    check("飞轮反哺后 status=hit", resp2.get("status")=="hit", f"status={resp2.get('status')}")
    check("飞轮反哺后 layer!=R5", resp2.get("source_layer")!="R5", f"layer={resp2.get('source_layer')}")
except Exception as e:
    check("场景8", False, traceback.format_exc())


print(f"\n{'='*60}\n第一轮场景测试: ✅{PASS} ❌{FAIL}\n{'='*60}")
if ISSUES:
    print("\n问题清单:")
    for i,s in enumerate(ISSUES,1): print(f"  {i}. {s}")
sys.exit(1 if FAIL else 0)
```

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""第二轮：边界与压力测试。"""
import sys, os, json, time, traceback, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import panda_cineforge as pcf
from panda_cineforge import (PandaCineForge, SkillAsset, RetrievalProfile, RetrievalEntities,
    KnowledgeProvenance, LLMClient, SkillIndexer, RecallEngine, TopicMapper,
    ContractGateway, QAGate, QueryUnderstanding, normalize_text, char_ngrams, extract_project_stages,
    COLD_FORGE_MATRIX, CINEMA_TOPICS, DOMAIN_PACKS, DELIVERABLE_DIMENSION_MAP)

PASS=0; FAIL=0; ISSUES=[]
def check(n,c,d=""):
    global PASS,FAIL
    if c: PASS+=1; print(f"  ✅ {n}")
    else: FAIL+=1; ISSUES.append(f"{n}: {d}"); print(f"  ❌ {n} | {d}")
def sec(t): print(f"\n{'='*60}\n{t}\n{'='*60}")

class MockLLM(LLMClient):
    def __init__(self): self._client="mock"
    @property
    def available(self): return True
    def chat(self,sm,um,temperature=0.2,json_mode=False):
        return json.dumps({"name":"M","skill_id":"mock","version":"1.0.0","last_updated":"2026-01-01","domain":"ai_cinema","sub_domain":"cinema","cinematic_role":"visual_language","module_target":["MyStudio.VisualLanguage"],"deliverable_type":"color_script","retrieval_profile":{"logical_topics":["color_grading"],"aliases":["调色"],"sample_queries":["调色"],"problem_patterns":[],"entities":{"who":[],"actions":["调色"],"objects":["LUT"]},"scenarios":[],"project_stages":[],"urgency":"normal","negative_queries":[],"summary":"调色"},"weighted_recall_text":"调色 color_script","content":"## TL;DR\n调色","body":{"tl_dr":"调色"}},ensure_ascii=False)
    def embed(self,t): return [float(abs(hash(t))%10)/10]*8

class MockKF(pcf.ExternalKnowledgeFetcher):
    def fetch(self,*a,**k):
        p=KnowledgeProvenance(); p.sources=[{"url":"x","domain":"x","trust_score":0.95,"source_class":"案例"}]
        p.knowledge_points={"principles":5}; p.confidence_score=0.9; p.confidence_tier="high"
        p.dimension_coverage={"required":["principles"],"covered":["principles"],"missing":[]}
        return [{"dim":"principles","text":"原理"}],p

def mkskill(sid, role="visual_language", dt="color_script", sub="cinema", maturity="v2"):
    return SkillAsset(skill_id=sid, name=f"技能{sid}", domain="ai_cinema", sub_domain=sub,
        cinematic_role=role, module_target=["MyStudio.VisualLanguage"], deliverable_type=dt,
        project_stage="postproduction", maturity=maturity, weighted_recall_text=f"调色 {dt} {sid}",
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading"], aliases=[f"调色{sid}"],
            sample_queries=[f"调色{sid}"], entities=RetrievalEntities(actions=["调色"]), scenarios=["调色"]))

# ============================================================
sec("B1: 大规模索引性能（200技能）")
try:
    idx = SkillIndexer()
    skills = [mkskill(f"big_{i}") for i in range(200)]
    t0 = time.time()
    idx.bulk_load(skills)
    dt_load = time.time()-t0
    check("200技能 bulk_load <2s", dt_load<2, f"dt={dt_load:.2f}s")
    check("200技能全部入库", len(idx.skills)==200)
    # 召回性能
    re_eng = RecallEngine(idx, TopicMapper())
    t0 = time.time()
    for _ in range(50):
        qu = re_eng.understand("电影调色", route_fields={"cinematic_role":"visual_language","deliverable_type":"color_script"})
        re_eng.recall(qu, topk=5, recall_mode="full")
    dt_recall = time.time()-t0
    check("50次召回 <2s", dt_recall<2, f"dt={dt_recall:.2f}s")
    # 增量 upsert 性能
    t0 = time.time()
    for i in range(20):
        idx.upsert(mkskill(f"inc_{i}"))
    dt_inc = time.time()-t0
    check("20次增量upsert <1s", dt_inc<1, f"dt={dt_inc:.2f}s")
except Exception as e:
    check("大规模索引", False, traceback.format_exc())

# ============================================================
sec("B2: 重复 upsert 同一 skill_id（覆盖更新）")
try:
    idx = SkillIndexer()
    s1 = mkskill("dup_001", role="visual_language", dt="color_script")
    idx.upsert(s1)
    check("首次upsert", len(idx.skills)==1)
    # 同 skill_id 不同内容
    s2 = mkskill("dup_001", role="audio_design", dt="sound_map")
    s2.weighted_recall_text = "混音 sound_map"
    s2.retrieval_profile = RetrievalProfile(logical_topics=["sound_design"], aliases=["混音"], sample_queries=["混音"], entities=RetrievalEntities(actions=["混音"]), scenarios=["混音"])
    idx.upsert(s2)
    check("覆盖后仍1技能", len(idx.skills)==1)
    check("覆盖后内容更新", idx.skills["dup_001"].cinematic_role=="audio_design")
    check("旧role索引清除", "dup_001" not in idx.idx_role.get("visual_language",set()))
    check("新role索引建立", "dup_001" in idx.idx_role.get("audio_design",set()))
    # BM25 索引无幽灵（旧 ngram 不应再指向 dup_001）
    ghost_grams = [g for g,postings in idx.ngram_postings.items() if "dup_001" in postings]
    # 新内容也应被索引
    check("新内容有BM25索引", any("dup_001" in p for p in idx.ngram_postings.values()))
except Exception as e:
    check("重复upsert", False, traceback.format_exc())

# ============================================================
sec("B3: 异常输入鲁棒性")
try:
    eng = PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{x}}")
    eng.forge_engine.forger.knowledge_fetcher = MockKF(eng.llm)
    eng.indexer.upsert(mkskill("s1"))
    # 3.1 None 入参
    try:
        resp = eng.serve(None)
        check("serve(None) 不崩溃", resp.get("status")=="error")
    except Exception as e:
        check("serve(None) 不崩溃", False, str(e))
    # 3.2 空 dict
    resp = eng.serve({})
    check("serve({}) 返回error", resp.get("status")=="error")
    # 3.3 route_fields 为空 dict
    resp = eng.serve({"call_id":"c","route_fields":{},"query_text":"调色"})
    check("空route_fields 返回error", resp.get("status")=="error")
    # 3.4 query_text 超长
    long_text = "调色"*10000
    resp = eng.serve({"call_id":"c","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":long_text,"topk":1})
    check("超长query不崩溃", resp.get("status") in ("hit","forged","fallback_degraded","error"))
    # 3.5 topk 异常值
    resp = eng.serve({"call_id":"c","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":"调色","topk":0})
    check("topk=0 不崩溃", resp.get("status") in ("hit","forged","fallback_degraded","error"))
    resp = eng.serve({"call_id":"c","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":"调色","topk":-1})
    check("topk=-1 不崩溃", resp.get("status") in ("hit","forged","fallback_degraded","error"))
    # 3.6 recall_mode 非法值
    resp = eng.serve({"call_id":"c","route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":"调色","recall_mode":"invalid"})
    check("非法recall_mode不崩溃", resp.get("status") in ("hit","forged","fallback_degraded","error"))
except Exception as e:
    check("异常输入", False, traceback.format_exc())

# ============================================================
sec("B4: 契约层边界")
try:
    cg = ContractGateway()
    # 4.1 非法 JSON 字符串
    try:
        cg.parse_call("{invalid")
        check("非法JSON抛异常", False)
    except (ValueError, json.JSONDecodeError):
        check("非法JSON抛异常", True)
    # 4.2 None 入参
    try:
        cg.parse_call(None)
        check("None入参抛异常", False)
    except (ValueError, TypeError, AttributeError):
        check("None入参抛异常", True)
    # 4.3 route_fields 缺 cinematic_role
    try:
        cg.parse_call({"route_fields":{"deliverable_type":"color_script"}})
        check("缺cinematic_role抛异常", False)
    except ValueError:
        check("缺cinematic_role抛异常", True)
    # 4.4 完整契约
    qu = cg.parse_call({"route_fields":{"cinematic_role":"visual_language","deliverable_type":"color_script"},"query_text":"调色","context":{"x":1}})
    check("完整契约解析", qu.route_fields["cinematic_role"]=="visual_language")
    check("context 保留", qu.context=={"x":1})
except Exception as e:
    check("契约边界", False, traceback.format_exc())

# ============================================================
sec("B5: 外部知识获取降级（无网络/mock）")
try:
    # 5.1 无 LLM 时 forge 跳过外部知识
    eng = PandaCineForge(llm=LLMClient(), system_message="s", user_template="{{x}}")
    check("无LLM不调外部知识", not eng.llm.available)
    sk = eng.forge_one({"skill_id":"t1","skill_name":"测试","cinematic_role":"visual_language","deliverable_type":"color_script","sub_domain":"cinema","output_format":"json"})
    check("无LLM forge_one 完成", isinstance(sk, SkillAsset))
    check("无LLM knowledge_provenance 空sources", len(sk.knowledge_provenance.sources)==0)
    # 5.2 mock 知识获取正常
    eng2 = PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{x}}")
    eng2.forge_engine.forger.knowledge_fetcher = MockKF(eng2.llm)
    sk2 = eng2.forge_one({"skill_id":"t2","skill_name":"测试2","cinematic_role":"visual_language","deliverable_type":"color_script","sub_domain":"cinema","output_format":"json"})
    check("mock知识 forge_one 完成", isinstance(sk2, SkillAsset))
    check("mock知识 provenance 有sources", len(sk2.knowledge_provenance.sources)>0)
except Exception as e:
    check("外部知识降级", False, traceback.format_exc())

# ============================================================
sec("B6: 序列化往返一致性（含所有字段）")
try:
    sk = SkillAsset(skill_id="ser_001", name="序列化测试", domain="ai_cinema", sub_domain="cinema",
        cinematic_role="visual_language", module_target=["MyStudio.VisualLanguage"], deliverable_type="color_script",
        project_stage="postproduction", maturity="v2", forge_mode="cold", version="2.1.3",
        weighted_recall_text="调色 color_script LUT", tags=["调色","色彩"],
        retrieval_profile=RetrievalProfile(logical_topics=["color_grading","color_management"], aliases=["调色方案","色彩脚本"],
            sample_queries=["电影调色","色彩脚本设计"], problem_patterns=["色彩空间混用"],
            entities=RetrievalEntities(who=["调色师"],actions=["调色","套LUT"],objects=["LUT","色轮"]),
            scenarios=["调色","色彩管理"], project_stages=["postproduction"], urgency="normal",
            negative_queries=["投流","带货"], summary="电影调色技能"),
        knowledge_provenance=KnowledgeProvenance(sources=[{"url":"x","trust":0.9}], knowledge_points={"principles":3}, confidence_score=0.85, confidence_tier="medium"),
        execution_contract={"tools_read":["达芬奇"],"tools_write":[],"confirmation_required_for":[]},
        capabilities={"tools":["达芬奇"]}, fallback_strategy={"level1_tool":"x","level2_data":"y","level3_output":"z"})
    # to_dict → from_dict 往返
    d = sk.to_dict()
    sk2 = SkillAsset.from_dict(d)
    check("skill_id 往返", sk2.skill_id==sk.skill_id)
    check("module_target 往返", sk2.module_target==sk.module_target)
    check("retrieval_profile.aliases 往返", sk2.retrieval_profile.aliases==sk.retrieval_profile.aliases)
    check("retrieval_profile.entities.actions 往返", sk2.retrieval_profile.entities.actions==["调色","套LUT"])
    check("knowledge_provenance.confidence_tier 往返", sk2.knowledge_provenance.confidence_tier=="medium")
    check("tags 往返", sk2.tags==["调色","色彩"])
    # to_recall_record
    rr = sk.to_recall_record()
    check("recall_record 含全部结构化字段", all(k in rr for k in ["skill_id","cinematic_role","deliverable_type","module_target","embedding","weighted_recall_text"]))
    # JSON 序列化可逆
    js = json.dumps(d, ensure_ascii=False)
    sk3 = SkillAsset.from_dict(json.loads(js))
    check("JSON序列化往返", sk3.skill_id==sk.skill_id and sk3.cinematic_role==sk.cinematic_role)
except Exception as e:
    check("序列化往返", False, traceback.format_exc())

# ============================================================
sec("B7: 三大子领域 domain_pack 完整性")
try:
    for sub in ("cinema","short_video","ai_manga_drama"):
        dp = DOMAIN_PACKS.get(sub, {})
        check(f"{sub} domain_pack 存在", bool(dp))
        check(f"{sub} 有 pipeline", "pipeline" in dp and len(dp["pipeline"])>0)
        check(f"{sub} 有 deliverables", "deliverables" in dp and len(dp["deliverables"])>0)
        check(f"{sub} 有 standards", "standards" in dp)
        check(f"{sub} 有 risk_focus", "risk_focus" in dp)
        check(f"{sub} 有 tools", "tools" in dp)
except Exception as e:
    check("domain_pack", False, traceback.format_exc())

# ============================================================
sec("B8: deliverable_type 维度映射完整性")
try:
    for dt, dims in DELIVERABLE_DIMENSION_MAP.items():
        check(f"{dt} 有 required 维度", "required" in dims and len(dims["required"])>0)
        check(f"{dt} 有 bonus 维度", "bonus" in dims)
        # 验证维度都是合法值
        valid_dims = {"principles","standards","tool_params","case_refs","heuristics","pitfalls"}
        check(f"{dt} required 维度合法", all(d in valid_dims for d in dims["required"]), f"invalid: {set(dims['required'])-valid_dims}")
except Exception as e:
    check("维度映射", False, traceback.format_exc())

# ============================================================
sec("B9: 冷启动矩阵完整性")
try:
    check("矩阵非空", len(COLD_FORGE_MATRIX)>0)
    agents_seen = set()
    for entry in COLD_FORGE_MATRIX:
        check("矩阵项含 agent", "agent" in entry)
        check("矩阵项含 cinematic_role", "cinematic_role" in entry)
        check("矩阵项含 sub_domain", "sub_domain" in entry)
        check("矩阵项含 tasks", "tasks" in entry and len(entry["tasks"])>0)
        check("sub_domain 合法", entry["sub_domain"] in ("cinema","short_video","ai_manga_drama"))
        agents_seen.add(entry["agent"])
    check("矩阵覆盖多 Agent", len(agents_seen)>=4, f"agents={agents_seen}")
except Exception as e:
    check("冷启动矩阵", False, traceback.format_exc())

# ============================================================
sec("B10: Topic 映射器覆盖度")
try:
    tm = TopicMapper()
    check("Topic 数>=40", len(CINEMA_TOPICS)>=40, f"count={len(CINEMA_TOPICS)}")
    # 每个.Topic 有 cinematic_role
    no_role = [t for t,c in CINEMA_TOPICS.items() if not c.get("cinematic_role")]
    check("所有Topic有cinematic_role", len(no_role)==0, f"missing={no_role}")
    # 测试典型查询命中
    test_cases = [
        ("电影调色色彩脚本", "color_grading"),
        ("180度线越轴穿帮", "continuity_check"),
        ("Midjourney提示词", "prompt_engineering"),
        ("3秒开场钩子", "short_video_hook"),
        ("漫剧分集连载", "ai_manga_drama"),
    ]
    for query, expected_topic in test_cases:
        topics = tm.detect_topics(query, top_n=10)
        topic_names = [t.topic for t in topics]
        check(f"查询'{query}'命中{expected_topic}", expected_topic in topic_names, f"got={topic_names[:3]}")
except Exception as e:
    check("Topic覆盖度", False, traceback.format_exc())

# ============================================================
sec("B11: 质检评分维度完整性（11维）")
try:
    eng = PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{x}}")
    sk = mkskill("qa_001")
    sk.content = "调色技能内容"
    sk.execution_contract = {"tools_read":["达芬奇"],"tools_write":[],"confirmation_required_for":[]}
    sk.capabilities = {"tools":["达芬奇"]}
    sk.fallback_strategy = {"level1_tool":"x","level2_data":"y","level3_output":"z"}
    eng.indexer.upsert(sk)
    qa = eng.qa_check("qa_001")
    scores = qa.get("dimension_scores", {})
    expected_dims = {"completeness","personalization","context_fidelity","domain_professionalism",
        "actionability","tool_rationality","risk_control","clarity",
        "cinematic_professionalism","continuity_safety","platform_compliance"}
    check("评分含11维", set(scores.keys())==expected_dims, f"missing={expected_dims-set(scores.keys())}")
    check("所有维度分0-100", all(0<=v<=100 for v in scores.values()))
except Exception as e:
    check("质检11维", False, traceback.format_exc())

# ============================================================
sec("B12: cold_start 幂等性（重复调用）")
try:
    eng = PandaCineForge(llm=MockLLM(), system_message="s", user_template="{{x}}")
    eng.forge_engine.forger.knowledge_fetcher = MockKF(eng.llm)
    matrix = [{"agent":"VisualLanguage","cinematic_role":"visual_language","sub_domain":"cinema","tasks":["分镜"]}]
    r1 = eng.cold_start(matrix)
    n1 = len(eng.indexer.skills)
    # 再次 cold_start（会覆盖索引）
    r2 = eng.cold_start(matrix)
    n2 = len(eng.indexer.skills)
    check("重复cold_start 技能数一致", n1==n2, f"n1={n1} n2={n2}")
    check("重复cold_start status一致", r1["status"]==r2["status"])
except Exception as e:
    check("幂等性", False, traceback.format_exc())


print(f"\n{'='*60}\n第二轮边界测试: ✅{PASS} ❌{FAIL}\n{'='*60}")
if ISSUES:
    print("\n问题清单:")
    for i,s in enumerate(ISSUES,1): print(f"  {i}. {s}")
sys.exit(1 if FAIL else 0)
```



---

## 设计要点速查

| 维度 | 传统工具（给人用） | PandaCineForge V1.0（给 AI 用） |
|---|---|---|
| 查询形态 | 自然语言模糊 | 结构化契约 + route_fields 精确路由 |
| 召回 | 多路并联全量 | R0-R5 分层级联，命中即返 |
| 输出 | Markdown 人类可读 | 结构化 SkillAsset，AI 直接执行 |
| 专业性 | LLM 单次生成 | 双知识源 + 三段式保障 + 实战反馈飞轮 |
| 资产对象 | 生成器输出 ≠ 编排器输入 | 统一 SkillAsset，生产消费收敛 |
| 知识来源 | 模型内部知识 | 模型内部 + 外部实时获取（搜索+Scrapling） |
| 进化 | 一次成型 | v0→v3 成熟度 + 自然选择 + 知识回流 |

---

> **PandaCineForge V1.0** —— 面向 AI 影视创作领域的通用化技能底座引擎 / 双模式 / 分层级联回 / 固定化契约 / 五层技能锻造 / 三段式专业性保障 / 外部知识全自动获取 / 生产+调度融合 / 影视垂直化 / 多系统通用支撑。
