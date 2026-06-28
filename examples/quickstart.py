#!/usr/bin/env python3
"""
quickstart.py — PandaCineForge zero-config smoke test
=======================================================
Runs without any API key. Verifies the engine initializes and degrades gracefully.
"""

import sys
sys.path.insert(0, ".")

# If engine hasn't been extracted yet, auto-extract from skill.md
import os
if not os.path.exists("panda_cineforge.py"):
    import subprocess
    subprocess.run([sys.executable, "extract.py", "panda_cineforge.skill.md", "."], check=True)

import panda_cineforge as pcf

# Initialize with empty templates (no API key needed for smoke test)
engine = pcf.PandaCineForge(
    system_message="You are a skill forge for cinema.",
    user_template="Generate a skill for {{skill_name}}.",
)

print(f"[PandaCineForge] Engine initialized | LLM available={engine.llm.available}")
print(f"[PandaCineForge] Cold forge matrix size={len(pcf.COLD_FORGE_MATRIX)}")
print(f"[PandaCineForge] Cinema topics={len(pcf.CINEMA_TOPICS)}")
print(f"[PandaCineForge] Seed sources={len(pcf.CINEMA_SEED_SOURCES)}")

# Test recall with a fake skill in index
fake = pcf.SkillAsset(
    skill_id="test_001",
    name="电影调色色彩脚本技能",
    domain="ai_cinema",
    sub_domain="cinema",
    cinematic_role="visual_language",
    module_target=["MyStudio.VisualLanguage"],
    deliverable_type="color_script",
    project_stage="postproduction",
    maturity="v2",
    priority="P1",
    tags=["调色", "色彩脚本"],
    weighted_recall_text="调色 色彩脚本 color_script Rec.709 ACES 达芬奇 LUT",
    retrieval_profile=pcf.RetrievalProfile(
        logical_topics=["color_grading"],
        aliases=["色彩脚本", "调色方案"],
        sample_queries=["电影调色怎么做", "色彩脚本设计"],
        entities=pcf.RetrievalEntities(who=["调色师"], actions=["调色"], objects=["LUT", "色彩脚本"]),
        scenarios=["调色"],
        project_stages=["postproduction"],
        urgency="normal",
        summary="电影调色",
    ),
)
engine.indexer.upsert(fake)

result = engine.serve({
    "call_id": "test_call",
    "caller_agent": "VisualLanguage",
    "route_fields": {
        "module_target": ["MyStudio.VisualLanguage"],
        "cinematic_role": "visual_language",
        "deliverable_type": "color_script",
        "project_stage": "postproduction",
        "sub_domain": "cinema",
    },
    "context": {"project_id": "p1", "caller_agent": "VisualLanguage"},
    "query_text": "电影调色",
    "recall_mode": "fast",
    "topk": 3,
})

print(f"[PandaCineForge] Recall status={result.get('status')} layer={result.get('source_layer')} skills={len(result.get('skills', []))}")
print("\n✓ Smoke test passed — engine is functional without API keys.")
