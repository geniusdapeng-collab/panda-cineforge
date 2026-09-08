-- 0026_tenant_overlay.sql · 租户覆盖层（Tenant Overlay）存储（基座能力 M2 补迁移）
-- 背景：packages/base/overlay（model/store/pipeline/rebase/draft-builder/doc-intake）与
--      apps/server/src/trpc/overlay-router.ts 已就绪，P26 定制中心 / P27 配置录入已上线，
--      但 DDL 一直只在 store.test.ts 内建——本迁移补齐生产事实源。
-- 纪律：RLS 工作区隔离（同 0021-0025 口径）；overlay_version 单调递增（只增不改，历史留档）；
--      进入 active 自动留快照（一键回滚=恢复快照并新版本号激活）；全部写操作五元事件留痕（overlay.* 事件）。

-- ① 覆盖层主表（七类资产覆盖声明：persona/kb/crew/threshold/skill/fence/brand）
CREATE TABLE IF NOT EXISTS tenant_overlays (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL,                    -- 无 FK（与 base/overlay store DDL 同口径：覆盖层可先于工作区档案存在）
  tenant_id       TEXT NOT NULL,
  base_bundle     TEXT NOT NULL,                    -- 行业包 slug（ecommerce 等）
  base_version    TEXT NOT NULL,                    -- 基座版本号（rebase 检测基准）
  overlay_version INTEGER NOT NULL,                 -- 单调递增（同 tenant+bundle 内）
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','canary','active','rolled_back')),
  canary_scope    JSONB,                            -- 灰度范围（如 {"ratio":0.2}）
  items           JSONB NOT NULL DEFAULT '[]',      -- 覆盖声明数组（parseOverlay 校验过）
  note            TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, base_bundle, overlay_version)
);
ALTER TABLE tenant_overlays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_overlays_ws ON tenant_overlays;
CREATE POLICY p_tenant_overlays_ws ON tenant_overlays
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_tenant_overlays_active
  ON tenant_overlays (workspace_id, base_bundle, status, overlay_version DESC);

-- ② 覆盖层快照（进入 active 时的不可变存档，回滚=快照恢复为新版本）
CREATE TABLE IF NOT EXISTS tenant_overlay_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    TEXT NOT NULL,                    -- 无 FK（与 base/overlay store DDL 同口径：覆盖层可先于工作区档案存在）
  tenant_id       TEXT NOT NULL,
  base_bundle     TEXT NOT NULL,
  overlay_version INTEGER NOT NULL,
  doc             JSONB NOT NULL,                   -- OverlayDoc 全量
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tenant_overlay_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_overlay_snapshots_ws ON tenant_overlay_snapshots;
CREATE POLICY p_tenant_overlay_snapshots_ws ON tenant_overlay_snapshots
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_tenant_overlay_snapshots_bundle
  ON tenant_overlay_snapshots (workspace_id, base_bundle, overlay_version DESC);

-- 授权（与 0021-0025 同口径）
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_overlays TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_overlay_snapshots TO workloom_app;
