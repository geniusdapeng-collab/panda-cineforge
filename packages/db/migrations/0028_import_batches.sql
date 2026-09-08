-- 0028_import_batches.sql · 真实表格口径导入（P3：Excel/CSV 口径映射器）
-- 来源：升级方案 P3——大卖方法论「口径即资产」：卖家真实在用的财务核算表/定价表/仓库跟单表
--      上传 → LLM 辅助字段映射 → 人工确认 → 落 0027 财务/供应链表。映射结果必须人工确认才落库；
--      口径冲突时以卖家表格为准；导入批次可回滚（status=rolled_back + 反向删行留事件）。

-- ① 导入批次（一次上传一条）
CREATE TABLE IF NOT EXISTS import_batches (
  id            TEXT PRIMARY KEY,                    -- ib-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  filename      TEXT NOT NULL,
  target_table  TEXT NOT NULL                        -- 落库目标（白名单四表，拒绝任意表名注入）
                CHECK (target_table IN ('payouts','platform_penalties','cost_items','shipments')),
  status        TEXT NOT NULL DEFAULT 'mapped'
                CHECK (status IN ('mapped','confirmed','imported','rolled_back','failed')),
  mapping       JSONB NOT NULL DEFAULT '{}',         -- {源列名: 目标字段}（人工确认后的最终映射）
  mapping_via   TEXT NOT NULL DEFAULT 'rule'         -- rule=确定性规则命中 / llm=模型辅助（人工确认后同为 confirmed）
                CHECK (mapping_via IN ('rule','llm')),
  row_count     INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  created_by    TEXT NOT NULL DEFAULT 'system',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at  TIMESTAMPTZ,
  imported_at   TIMESTAMPTZ
);
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_import_batches_ws ON import_batches;
CREATE POLICY p_import_batches_ws ON import_batches
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));

-- ② 导入行暂存（确认前可预览/改映射；落库后保留供回滚定位）
CREATE TABLE IF NOT EXISTS import_rows (
  id            BIGSERIAL PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  batch_id      TEXT NOT NULL REFERENCES import_batches(id),
  row_no        INTEGER NOT NULL,
  raw           JSONB NOT NULL,                      -- 原始行（源列名→值）
  normalized    JSONB,                               -- 映射后行（目标字段→值；confirmed 时生成）
  target_id     TEXT,                                -- 落库后目标表主键（回滚定位）
  status        TEXT NOT NULL DEFAULT 'staged'
                CHECK (status IN ('staged','imported','skipped','failed')),
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, batch_id, row_no)
);
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_import_rows_ws ON import_rows;
CREATE POLICY p_import_rows_ws ON import_rows
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_rows (workspace_id, batch_id, row_no);

-- 授权（与 0021-0027 同口径）
GRANT SELECT, INSERT, UPDATE, DELETE ON import_batches TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON import_rows TO workloom_app;
