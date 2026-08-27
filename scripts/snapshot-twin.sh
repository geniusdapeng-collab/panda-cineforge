#!/usr/bin/env bash
# 售前数字孪生 · 快照导出（seed + simulate-twin 之后执行）
# 产出：demo/twin/panda-30d.sql.gz（含结构与数据、RLS 策略与授权，可入库存档）
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p demo/twin
DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)
pg_dump "$DB_URL" | gzip -9 > demo/twin/panda-30d.sql.gz
SIZE=$(du -h demo/twin/panda-30d.sql.gz | cut -f1)
EVENTS=$(psql "$DB_URL" -t -c "SELECT count(*) FROM biz_events" | tr -d ' ')
echo "✅ 快照已导出：demo/twin/panda-30d.sql.gz（${SIZE}，事件 ${EVENTS} 条）"
