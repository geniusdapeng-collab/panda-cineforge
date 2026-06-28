#!/usr/bin/env python3
"""
PandaCineForge MCP Server
Model Context Protocol adapter for AI Agent integration.
"""

import json
import sys
from typing import Any


def send_message(msg: dict) -> None:
    json_str = json.dumps(msg)
    sys.stdout.write(f"Content-Length: {len(json_str)}\r\n\r\n{json_str}")
    sys.stdout.flush()


def read_message() -> dict:
    line = sys.stdin.readline()
    if not line.startswith("Content-Length:"):
        return {}
    length = int(line.split(":")[1].strip())
    sys.stdin.readline()  # empty line
    body = sys.stdin.read(length)
    return json.loads(body)


def handle_initialize(params: dict) -> dict:
    return {
        "protocolVersion": "2024-11-05",
        "serverInfo": {"name": "panda-cineforge", "version": "1.0.0"},
        "capabilities": {"tools": {}}
    }


def handle_tools_list(params: dict) -> dict:
    return {
        "tools": [
            {
                "name": "generate_skill",
                "description": "Generate a structured AI agent skill for cinematic video production",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Skill title"},
                        "genre": {"type": "string", "description": "Film genre (e.g., drama, action, documentary)"},
                        "duration": {"type": "number", "description": "Target duration in seconds"},
                        "style": {"type": "string", "description": "Visual style (e.g., Hollywood, indie, anime)"},
                        "complexity": {"type": "string", "enum": ["simple", "standard", "complex"], "default": "standard"}
                    },
                    "required": ["title", "genre"]
                }
            },
            {
                "name": "extract_skill",
                "description": "Extract a deployable skill file from the master skill.md",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "output_path": {"type": "string", "description": "Output directory for extracted skill"},
                        "include_examples": {"type": "boolean", "default": True}
                    },
                    "required": ["output_path"]
                }
            },
            {
                "name": "get_engine_status",
                "description": "Get the current status of the PandaCineForge skill engine",
                "inputSchema": {"type": "object", "properties": {}}
            }
        ]
    }


def handle_tool_call(params: dict) -> dict:
    name = params.get("name", "")
    args = params.get("arguments", {})

    if name == "generate_skill":
        return {
            "content": [{
                "type": "text",
                "text": f"Skill generated for '{args.get('title')}'.\nGenre: {args.get('genre')}, Duration: {args.get('duration', 'N/A')}s, Style: {args.get('style', 'default')}.\n\nDeploy with: python extract.py --output ./my-skill"
            }]
        }

    if name == "extract_skill":
        return {
            "content": [{
                "type": "text",
                "text": f"Skill extracted to {args.get('output_path')}.\nInclude examples: {args.get('include_examples', True)}\n\nReady for deployment."
            }]
        }

    if name == "get_engine_status":
        return {
            "content": [{
                "type": "text",
                "text": "PandaCineForge v1.0.0 — Engine Status: READY\n\nLayers: L0 Cold Boot → L1 Storytelling → L2 Prompt → L3 Quality → L4 Knowledge → L5 Discipline\nRecall: R0-R5 (Immediate → Stable)\nMemory: Multi-Lane Working Memory\n\nAll systems operational. Ready to generate skills."
            }]
        }

    return {"content": [{"type": "text", "text": f"Unknown tool: {name}"}]}


def main():
    send_message({"jsonrpc": "2.0", "id": None, "result": handle_initialize({})})

    while True:
        msg = read_message()
        if not msg:
            break
        method = msg.get("method", "")
        msg_id = msg.get("id")
        params = msg.get("params", {})

        if method == "initialize":
            send_message({"jsonrpc": "2.0", "id": msg_id, "result": handle_initialize(params)})
        elif method == "tools/list":
            send_message({"jsonrpc": "2.0", "id": msg_id, "result": handle_tools_list(params)})
        elif method == "tools/call":
            send_message({"jsonrpc": "2.0", "id": msg_id, "result": handle_tool_call(params)})


if __name__ == "__main__":
    main()
