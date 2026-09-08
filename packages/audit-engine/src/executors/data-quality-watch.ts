/**
 * executors/data-quality-watch.ts —— data-quality-watch 执行体：数据源健康巡检（P1 配套）
 *
 * 数据源接入中心的"数据健康"线：同步延迟 / 同步失败 / 长时未同步 / 停用中仍有数据写入诉求。
 * 阈值：延迟 >3600s P2、>6h P1；最近同步 >24h 视为断流（data_sources.last_sync_at）。
 * 数据源 = data_sources + data_source_sync_logs（0027 ⑩⑪）。
 */
import { type ExecutorResult, type Queryable } from "./types.js";

export const LAG_WARN_SEC = 3600;
export const LAG_CRIT_SEC = 6 * 3600;
export const STALE_HOURS = 24;

export interface DataSourceHealth {
  id: string;
  label: string;
  platform: string;
  shopId: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncLagSec: number | null;
  issue: "ok" | "lag-warn" | "lag-crit" | "stale" | "failed" | "never-synced";
}

export async function execDataQualityWatch(
  q: Queryable, workspaceId: string,
): Promise<ExecutorResult<{ sources: DataSourceHealth[] }>> {
  const r = await q.query<{
    id: string; label: string; platform: string; shop_id: string; enabled: boolean;
    last_sync_at: Date | null; last_sync_status: string | null; sync_lag_sec: number | null;
  }>(
    `SELECT id, label, platform, shop_id, enabled, last_sync_at, last_sync_status, sync_lag_sec
       FROM data_sources WHERE workspace_id = $1
      ORDER BY platform, shop_id`,
    [workspaceId],
  );

  const now = Date.now();
  const sources: DataSourceHealth[] = r.rows.map((x) => {
    const lag = x.sync_lag_sec;
    const staleH = x.last_sync_at ? (now - new Date(x.last_sync_at).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
    let issue: DataSourceHealth["issue"] = "ok";
    if (!x.last_sync_at) issue = "never-synced";
    else if (x.last_sync_status === "failed") issue = "failed";
    else if (lag !== null && lag > LAG_CRIT_SEC) issue = "lag-crit";
    else if (staleH > STALE_HOURS) issue = "stale";
    else if (lag !== null && lag > LAG_WARN_SEC) issue = "lag-warn";
    if (!x.enabled && issue === "ok") issue = "ok"; // 停用即不巡检（显式停用是用户意图）
    if (!x.enabled) issue = "ok";
    return {
      id: x.id, label: x.label, platform: x.platform, shopId: x.shop_id,
      enabled: x.enabled, lastSyncAt: x.last_sync_at ? new Date(x.last_sync_at).toISOString() : null,
      lastSyncStatus: x.last_sync_status, syncLagSec: lag, issue,
    };
  });

  const bad = sources.filter((s) => s.issue !== "ok");
  return {
    skill: "data-quality-watch",
    generatedAt: new Date().toISOString(),
    headline: { label: "异常数据源", value: bad.length, unit: "count" },
    detail: { sources },
    traces: [{
      formula: "延迟>1h P2 / >6h P1；最近同步>24h 断流；状态 failed 直报",
      inputs: { total: sources.length, thresholds: { LAG_WARN_SEC, LAG_CRIT_SEC, STALE_HOURS } },
      result: `异常 ${bad.length}/${sources.length}`,
    }],
    narrativeHints: [
      bad.length > 0
        ? `异常数据源：${bad.slice(0, 5).map((s) => `${s.label}（${s.issue}）`).join("、")}——数据断流时所有下游分析都在"猜"，违反拒绝默认纪律`
        : "全部数据源同步健康",
    ],
    actions: [
      { label: "断流数据源自动重试同步并告警", level: "auto" },
      { label: "连续 3 次失败暂停该源并通知管理员", level: "review" },
    ],
  };
}
