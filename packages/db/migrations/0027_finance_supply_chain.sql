-- 0027_finance_supply_chain.sql · 电商真实化一期：财务与供应链数据模型（P0）
-- 来源：升级方案《WorkLoom电商系统升级评估与方案》——对标大卖实战系统三大板块
--      （利润分析 / 头程跟单 / 财务中心）补齐真实表结构，替代"仅技能文档"的空心状态。
-- 铁律：
--  ① 金额一律 NUMERIC(18,2) + 币种字段，跨币种不强行折算（报告层按汇率口径处理，同 audit-engine 口径）；
--  ② 成本五类枚举与 bundles/ecommerce/schemas/cost-ledger.yml 同源（改枚举必须同步改 yml）；
--  ③ 口径参数化：利润瀑布的扣减项开关/顺序不进代码，进 cost-ledger.yml（口径即资产——以卖家真实表格为准）；
--  ④ RLS 工作区隔离（同 0021-0026 口径）；全部写操作经 append_event_insert 五元事件留痕；
--  ⑤ 头程八节点状态机与 bundles/ecommerce/schemas/cost-ledger.yml 的 shipment_milestones 定义同源。

-- ① 采购单（PO）
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            TEXT PRIMARY KEY,                    -- po-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,                       -- 店铺（profiles 一店一档 shop_id 口径）
  supplier      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','shipped','received','closed','canceled')),
  currency      TEXT NOT NULL DEFAULT 'CNY',
  total_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,    -- 采购总额（含税口径见 cost-ledger.yml）
  items         JSONB NOT NULL DEFAULT '[]',         -- [{sku, qty, unit_price, amount}]
  expected_at   TIMESTAMPTZ,                         -- 预计到货
  created_by    TEXT NOT NULL DEFAULT 'system',      -- member_no 或 agent preset key
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_purchase_orders_ws ON purchase_orders;
CREATE POLICY p_purchase_orders_ws ON purchase_orders
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_purchase_orders_shop ON purchase_orders (workspace_id, shop_id, status);

-- ② 应付账款（供应商账期）
CREATE TABLE IF NOT EXISTS payables (
  id            TEXT PRIMARY KEY,                    -- py-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  po_id         TEXT REFERENCES purchase_orders(id),
  supplier      TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'CNY',
  amount        NUMERIC(18,2) NOT NULL,
  paid_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  due_at        TIMESTAMPTZ NOT NULL,                -- 账期到期日
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','partial','settled','overdue')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_payables_ws ON payables;
CREATE POLICY p_payables_ws ON payables
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_payables_due ON payables (workspace_id, status, due_at);

-- ③ 店铺真实回款（平台结算到账；利润分析的"真实锚点"）
CREATE TABLE IF NOT EXISTS payouts (
  id            TEXT PRIMARY KEY,                    -- po-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,
  platform      TEXT NOT NULL,                       -- PlatformId（connectors/types 口径）
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'CNY',
  gross_amount  NUMERIC(18,2) NOT NULL,              -- 账期销售额（平台口径）
  fee_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,    -- 平台佣金+服务费合计
  refund_amount NUMERIC(18,2) NOT NULL DEFAULT 0,    -- 账期退款冲抵
  net_amount    NUMERIC(18,2) NOT NULL,              -- 实际到账（gross-fee-refund-其他，以平台结算单为准）
  settled_at    TIMESTAMPTZ,                         -- 到账时间（NULL=在途）
  source        TEXT NOT NULL DEFAULT 'import'       -- import=表格导入 / api=连接器真实回读 / mock=演示
                CHECK (source IN ('import','api','mock')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, shop_id, period_start, period_end)
);
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_payouts_ws ON payouts;
CREATE POLICY p_payouts_ws ON payouts
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_payouts_period ON payouts (workspace_id, period_start, period_end);

-- ④ 平台罚款（ODR/迟发/违规等扣款——利润分析必须单列，大卖实战口径）
CREATE TABLE IF NOT EXISTS platform_penalties (
  id            TEXT PRIMARY KEY,                    -- pp-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,
  platform      TEXT NOT NULL,
  kind          TEXT NOT NULL,                       -- odr/late-shipment/violation/deposit/other（cost-ledger.yml 枚举）
  currency      TEXT NOT NULL DEFAULT 'CNY',
  amount        NUMERIC(18,2) NOT NULL,              -- 罚款金额（正数=被扣）
  reason        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('pending','confirmed','appealing','waived')),
  occurred_at   TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'import' CHECK (source IN ('import','api','mock')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE platform_penalties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_platform_penalties_ws ON platform_penalties;
CREATE POLICY p_platform_penalties_ws ON platform_penalties
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_platform_penalties_shop ON platform_penalties (workspace_id, shop_id, occurred_at);

-- ⑤ 全口径成本项（采购/头程物流/仓储/广告/平台费/罚款 六类；SKU 利润瀑布的事实源）
CREATE TABLE IF NOT EXISTS cost_items (
  id            TEXT PRIMARY KEY,                    -- ci-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,
  sku           TEXT,                                -- NULL=店铺级分摊项（仓储/罚款等）
  category      TEXT NOT NULL
                CHECK (category IN ('purchase','freight','storage','ads','platform_fee','penalty')),
  currency      TEXT NOT NULL DEFAULT 'CNY',
  amount        NUMERIC(18,2) NOT NULL,              -- 成本金额（正数=支出）
  period        DATE NOT NULL,                       -- 归属期间（月粒度，取月首日）
  ref_type      TEXT,                                -- 来源单据类型（po/payout/penalty/shipment/manual）
  ref_id        TEXT,                                -- 来源单据 id
  source        TEXT NOT NULL DEFAULT 'import' CHECK (source IN ('import','api','mock','manual')),
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_cost_items_ws ON cost_items;
CREATE POLICY p_cost_items_ws ON cost_items
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_cost_items_sku_period ON cost_items (workspace_id, shop_id, sku, period);
CREATE INDEX IF NOT EXISTS idx_cost_items_category ON cost_items (workspace_id, category, period);

-- ⑥ 头程批次（跨境跟单主体）
CREATE TABLE IF NOT EXISTS shipments (
  id            TEXT PRIMARY KEY,                    -- sh-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,
  tracking_no   TEXT NOT NULL,                       -- 运单/柜号
  carrier       TEXT NOT NULL DEFAULT '',            -- 物流商
  channel       TEXT NOT NULL DEFAULT 'sea'          -- sea/air/rail/express
                CHECK (channel IN ('sea','air','rail','express')),
  origin        TEXT NOT NULL DEFAULT '',            -- 起运地（国内仓）
  destination   TEXT NOT NULL DEFAULT '',            -- 目的地（FBA 仓/海外仓代码）
  boxes         INTEGER NOT NULL DEFAULT 0,
  units         INTEGER NOT NULL DEFAULT 0,
  items         JSONB NOT NULL DEFAULT '[]',         -- [{sku, qty}]
  status        TEXT NOT NULL DEFAULT 'booked'
                CHECK (status IN ('booked','departed','consolidated','loaded','sailed','arrived','clearing','signed','shelved','exception','lost')),
  current_node  TEXT NOT NULL DEFAULT 'departed',    -- 当前节点（shipment_milestones.node 最新值冗余，便于看板）
  loss_flag     BOOLEAN NOT NULL DEFAULT false,      -- 在途损耗标记
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_shipments_ws ON shipments;
CREATE POLICY p_shipments_ws ON shipments
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (workspace_id, status, updated_at);

-- ⑦ 头程节点流水（八节点状态机：发货→集货→装柜→开船→到港→清关→签收→入网）
CREATE TABLE IF NOT EXISTS shipment_milestones (
  id            TEXT PRIMARY KEY,                    -- sm-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shipment_id   TEXT NOT NULL REFERENCES shipments(id),
  node          TEXT NOT NULL
                CHECK (node IN ('departed','consolidated','loaded','sailed','arrived','clearing','signed','shelved')),
  occurred_at   TIMESTAMPTZ NOT NULL,                -- 实际发生时间（NULL 不允许；预计时间走 eta）
  eta           BOOLEAN NOT NULL DEFAULT false,      -- true=预计节点（未发生，计划口径）
  note          TEXT NOT NULL DEFAULT '',
  created_by    TEXT NOT NULL DEFAULT 'system',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shipment_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_shipment_milestones_ws ON shipment_milestones;
CREATE POLICY p_shipment_milestones_ws ON shipment_milestones
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_shipment_milestones_ship ON shipment_milestones (workspace_id, shipment_id, occurred_at);

-- ⑧ 库龄分桶快照（0-30/31-60/61-90/90+ 天；库存健康与清仓请示 R6 的数据源）
CREATE TABLE IF NOT EXISTS inventory_ageing (
  id            TEXT PRIMARY KEY,                    -- ia-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  shop_id       TEXT NOT NULL,
  sku           TEXT NOT NULL,
  bucket        TEXT NOT NULL CHECK (bucket IN ('0-30','31-60','61-90','90+')),
  qty           INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'CNY',
  value_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,    -- 该桶库存货值（资金占用口径）
  snapshot_date DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, shop_id, sku, bucket, snapshot_date)
);
ALTER TABLE inventory_ageing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_inventory_ageing_ws ON inventory_ageing;
CREATE POLICY p_inventory_ageing_ws ON inventory_ageing
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_inventory_ageing_date ON inventory_ageing (workspace_id, snapshot_date);

-- ⑨ 利润瀑布视图（扣减项与顺序以 cost-ledger.yml 为运行时参数，此处为默认全口径）
--    ⑨a SKU 成本账（SKU×期间 六类成本；payout 是店铺级口径，不在 SKU 层重复摊派——
--        店铺→SKU 的分摊规则属于卖家口径，进 cost-ledger.yml allocation，不进视图硬编码）
CREATE OR REPLACE VIEW sku_cost_ledger AS
SELECT
  workspace_id,
  shop_id,
  sku,
  period,
  currency,
  COALESCE(SUM(amount) FILTER (WHERE category = 'purchase'), 0)     AS cost_purchase,
  COALESCE(SUM(amount) FILTER (WHERE category = 'freight'), 0)      AS cost_freight,
  COALESCE(SUM(amount) FILTER (WHERE category = 'storage'), 0)      AS cost_storage,
  COALESCE(SUM(amount) FILTER (WHERE category = 'ads'), 0)          AS cost_ads,
  COALESCE(SUM(amount) FILTER (WHERE category = 'platform_fee'), 0) AS cost_platform_fee,
  COALESCE(SUM(amount) FILTER (WHERE category = 'penalty'), 0)      AS cost_penalty,
  COALESCE(SUM(amount), 0)                                          AS cost_total
FROM cost_items
GROUP BY workspace_id, shop_id, sku, period, currency;

--    ⑨b 店铺利润瀑布（店铺×期间：真实回款净额 − 六类成本 = 净利；分桶聚合后连接，杜绝笛卡尔放大）
CREATE OR REPLACE VIEW shop_profit_waterfall AS
WITH payout_agg AS (
  SELECT workspace_id, shop_id, date_trunc('month', period_start) AS period, currency,
         SUM(gross_amount) AS gross, SUM(fee_amount) AS fee, SUM(refund_amount) AS refund,
         SUM(net_amount) AS payout_net
    FROM payouts
   GROUP BY workspace_id, shop_id, date_trunc('month', period_start), currency
),
cost_agg AS (
  SELECT workspace_id, shop_id, period, currency,
         SUM(amount) FILTER (WHERE category = 'purchase')     AS cost_purchase,
         SUM(amount) FILTER (WHERE category = 'freight')      AS cost_freight,
         SUM(amount) FILTER (WHERE category = 'storage')      AS cost_storage,
         SUM(amount) FILTER (WHERE category = 'ads')          AS cost_ads,
         SUM(amount) FILTER (WHERE category = 'platform_fee') AS cost_platform_fee,
         SUM(amount) FILTER (WHERE category = 'penalty')      AS cost_penalty,
         SUM(amount)                                          AS cost_total
    FROM cost_items
   GROUP BY workspace_id, shop_id, period, currency
)
SELECT
  COALESCE(p.workspace_id, c.workspace_id) AS workspace_id,
  COALESCE(p.shop_id, c.shop_id)           AS shop_id,
  COALESCE(p.period, c.period)             AS period,
  COALESCE(p.currency, c.currency)         AS currency,
  COALESCE(p.gross, 0)        AS gross_amount,
  COALESCE(p.fee, 0)          AS fee_amount,
  COALESCE(p.refund, 0)       AS refund_amount,
  COALESCE(p.payout_net, 0)   AS payout_net,
  COALESCE(c.cost_purchase, 0)     AS cost_purchase,
  COALESCE(c.cost_freight, 0)      AS cost_freight,
  COALESCE(c.cost_storage, 0)      AS cost_storage,
  COALESCE(c.cost_ads, 0)          AS cost_ads,
  COALESCE(c.cost_platform_fee, 0) AS cost_platform_fee,
  COALESCE(c.cost_penalty, 0)      AS cost_penalty,
  COALESCE(c.cost_total, 0)        AS cost_total,
  COALESCE(p.payout_net, 0) - COALESCE(c.cost_total, 0) AS net_profit,
  CASE WHEN COALESCE(p.payout_net, 0) > 0
       THEN ROUND((COALESCE(p.payout_net, 0) - COALESCE(c.cost_total, 0)) / p.payout_net * 100, 2)
       ELSE NULL END AS net_margin_pct
FROM payout_agg p
FULL OUTER JOIN cost_agg c
  ON c.workspace_id = p.workspace_id AND c.shop_id = p.shop_id AND c.period = p.period;

-- ⑩ 数据源接入中心（P1：18 数据源管理页的事实源；卡片=平台店铺授权 + 同步状态）
CREATE TABLE IF NOT EXISTS data_sources (
  id            TEXT PRIMARY KEY,                    -- ds-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  platform      TEXT NOT NULL,                       -- PlatformId
  shop_id       TEXT NOT NULL,
  label         TEXT NOT NULL,                       -- 卡片标题（如「亚马逊·美国站」）
  auth_kind     TEXT NOT NULL DEFAULT 'api'          -- api=开放平台 / rpa=浏览器剧本(computer-use) / import=表格导入
                CHECK (auth_kind IN ('api','rpa','import')),
  credential_ref TEXT,                               -- credentials 表凭据引用（不落明文，F1 口径）
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_sync_at  TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('ok','degraded','failed')),
  sync_lag_sec  INTEGER,                             -- 数据延迟秒数（data-quality-watch 输入）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, shop_id)
);
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_data_sources_ws ON data_sources;
CREATE POLICY p_data_sources_ws ON data_sources
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));

-- ⑪ 数据源同步日志（接入中心"同步记录"与数据质量巡检证据）
CREATE TABLE IF NOT EXISTS data_source_sync_logs (
  id            TEXT PRIMARY KEY,                    -- sl-<毫秒>-<随机尾>
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  data_source_id TEXT NOT NULL REFERENCES data_sources(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','degraded','failed')),
  rows_read     INTEGER NOT NULL DEFAULT 0,
  rows_written  INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE data_source_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_data_source_sync_logs_ws ON data_source_sync_logs;
CREATE POLICY p_data_source_sync_logs_ws ON data_source_sync_logs
  USING (workspace_id = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id = current_setting('app.workspace_id', true));
CREATE INDEX IF NOT EXISTS idx_ds_sync_logs_ds ON data_source_sync_logs (workspace_id, data_source_id, started_at DESC);

-- 授权（与 0021-0026 同口径）
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON payables TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON payouts TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_penalties TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cost_items TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipments TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON shipment_milestones TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_ageing TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_sources TO workloom_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_source_sync_logs TO workloom_app;
GRANT SELECT ON sku_cost_ledger TO workloom_app;
GRANT SELECT ON shop_profit_waterfall TO workloom_app;
