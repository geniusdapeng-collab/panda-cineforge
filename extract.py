#!/usr/bin/env python3
"""
extract.py — One-shot extractor for PandaCineForge
===============================================
Extracts the embedded engine code + 4 config files from panda_cineforge.skill.md

Usage:
    python extract.py panda_cineforge.skill.md [output_dir]

Produces:
    - panda_cineforge.py      (the engine body)
    - system_message.txt
    - user_message_template.txt
    - input_schema.json
    - render_template.md
"""

import re
import sys
import os


def extract_skill_md(skill_md_path: str, output_dir: str = "."):
    with open(skill_md_path, "r", encoding="utf-8") as f:
        content = f.read()

    os.makedirs(output_dir, exist_ok=True)

    # 1. Extract engine code block (```python ... ```)
    engine_match = re.search(
        r'```python\n(#!/usr/bin/env python3.*?)^```',
        content,
        re.DOTALL | re.MULTILINE
    )
    if engine_match:
        engine_code = engine_match.group(1)
        out_path = os.path.join(output_dir, "panda_cineforge.py")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(engine_code)
        print(f"✓ Extracted: {out_path}")
    else:
        print("✗ Engine code block not found")
        return False

    # 2. Extract system_message (text block after "## 内嵌影视 SystemMessage")
    sys_match = re.search(
        r'## 内嵌影视 SystemMessage\s*\n>\s*技能锻造时.*?\n\n```text\n(.*?)```',
        content,
        re.DOTALL
    )
    if sys_match:
        with open(os.path.join(output_dir, "system_message.txt"), "w", encoding="utf-8") as f:
            f.write(sys_match.group(1).strip())
        print(f"✓ Extracted: {output_dir}/system_message.txt")
    else:
        print("✗ system_message not found")

    # 3. Extract user_message_template
    usr_match = re.search(
        r'## 内嵌影视 UserMessage 模板.*?\n```text\n(.*?)```',
        content,
        re.DOTALL
    )
    if usr_match:
        with open(os.path.join(output_dir, "user_message_template.txt"), "w", encoding="utf-8") as f:
            f.write(usr_match.group(1).strip())
        print(f"✓ Extracted: {output_dir}/user_message_template.txt")
    else:
        print("✗ user_message_template not found")

    # 4. Extract input_schema
    schema_match = re.search(
        r'## 内嵌 InputSchema.*?\n```json\n(.*?)```',
        content,
        re.DOTALL
    )
    if schema_match:
        with open(os.path.join(output_dir, "input_schema.json"), "w", encoding="utf-8") as f:
            f.write(schema_match.group(1).strip())
        print(f"✓ Extracted: {output_dir}/input_schema.json")
    else:
        print("✗ input_schema not found")

    # 5. Extract render_template
    tmpl_match = re.search(
        r'## 内嵌 RenderTemplate.*?\n````jinja2\n(.*?)````',
        content,
        re.DOTALL
    )
    if tmpl_match:
        with open(os.path.join(output_dir, "render_template.md"), "w", encoding="utf-8") as f:
            f.write(tmpl_match.group(1).strip())
        print(f"✓ Extracted: {output_dir}/render_template.md")
    else:
        print("✗ render_template not found")

    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract.py panda_cineforge.skill.md [output_dir]")
        sys.exit(1)

    skill_md = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    success = extract_skill_md(skill_md, out_dir)
    sys.exit(0 if success else 1)
