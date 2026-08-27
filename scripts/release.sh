#!/usr/bin/env bash
# ============================================================
# WorkLoom Release 本地发布脚本（W2；CI 之外的备用手动通道）
# 前置：macOS 上已 bash scripts/pack-macos.sh --version <tag> 产出 dist/
# 用法：GH_TOKEN=<pat> bash scripts/release.sh v1.1.0
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:?用法：GH_TOKEN=<pat> bash scripts/release.sh v1.1.0}"
: "${GH_TOKEN:?需要 GH_TOKEN（repo 权限 PAT，用完即清）}"
REPO="geniusdapeng-collab/workloom-im"
ZIP="dist/WorkLoom-macOS.zip"
SUM="dist/WorkLoom-macOS.zip.sha256"
[ -f "$ZIP" ] && [ -f "$SUM" ] || { echo "❌ 缺 $ZIP / ${SUM}——先跑 scripts/pack-macos.sh"; exit 1; }
unzip -l "$ZIP" | grep -q "PLACEHOLDER-NOT-FOR-RELEASE" && { echo "❌ 结构校验包禁止发布"; exit 1; }

API="https://api.github.com/repos/$REPO"
NOTES="WorkLoom 织元 ${VER}（macOS）——三步启航：下载解压 → 拖入应用程序 → Control+点按打开（唯一授权）。依赖全自带，无需 brew/sudo/命令行。校验：shasum -a 256 -c WorkLoom-macOS.zip.sha256"

echo "== 发布 $VER → $REPO =="
# 1. 建/取 Release
REL=$(curl -sf -X POST "$API/releases" -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  -d "{\"tag_name\":\"$VER\",\"name\":\"WorkLoom 织元 $VER\",\"body\":\"$NOTES\"}" 2>/dev/null) \
  || REL=$(curl -sf "$API/releases/tags/$VER" -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json")
RID=$(printf '%s' "$REL" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
UP="https://uploads.github.com/repos/$REPO/releases/$RID/assets"
echo "→ release id=${RID}，上传资产…"
for f in "$ZIP" "$SUM"; do
  curl -sf --retry 4 -X POST "$UP?name=$(basename "$f")" \
    -H "Authorization: token $GH_TOKEN" -H "Content-Type: application/octet-stream" \
    --data-binary @"$f" >/dev/null && echo "  ✅ $(basename "$f")"
done
echo "✅ 已发布：https://github.com/$REPO/releases/tag/$VER"
echo "→ 下一步：激活官网下载钮（apps/site/index.html 两处 button[disabled] → a[href=releases/latest/download/WorkLoom-macOS.zip]，见 apps/site/README.md）"
