#!/usr/bin/env bash
# 售前数字孪生 · 一键恢复（售前现场演示：免 seed/免模拟，30 秒进入「经营中的电商集团」）
# 用法：pnpm demo:twin:restore（依赖 demo/twin/panda-30d.sql.gz，随仓库分发）
set -euo pipefail
cd "$(dirname "$0")/.."
SNAP=demo/twin/panda-30d.sql.gz
[ -f "$SNAP" ] || { echo "❌ 未找到快照 $SNAP（可执行 pnpm db:seed && pnpm demo:twin && pnpm demo:twin:snapshot 重新生成）"; exit 1; }
DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)
echo "⚠️  将重置本地 workloom 库为「熊猫优选集团 30 天经营态」快照"
case "${1:-}" in --yes|-y) ;; *) [ -t 0 ] && { read -r -p "确认继续？[y/N] " a; [ "$a" = "y" ] || exit 0; } ;; esac
psql "$DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
zcat "$SNAP" | psql "$DB_URL" -q >/dev/null
EVENTS=$(psql "$DB_URL" -t -c "SELECT count(*) FROM biz_events" | tr -d ' ')
echo "✅ 快照已恢复（事件 ${EVENTS} 条）。启动 pnpm dev 后："
echo "   · P1 晨间简报 / P9 夜班驾驶舱：30 天夜班战报与 08:30 决策包（黑五作战周 escalate 样本）"
echo "   · P6 技能市场：160 官方技能 + 使用看板/采纳率"
echo "   · 广告驾驶舱 / 店铺矩阵看板：ACoS 保险丝熔断与 14 店日销节奏"
echo "   · 大促作战室：第 20–22 天黑五跨时区作战投影"
echo "   · pnpm db:verify-chain 可现场验证全库哈希链（防篡改演示）"
