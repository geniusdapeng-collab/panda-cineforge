/**
 * 全局常量 —— 全部默认值回引 PRD V2.5；行业阈值默认值由 bundles/ecommerce 提供（L2.6），
 * 底座不内置行业数值。此处只放行业无关的机制默认值。
 */

/** 峰谷窗口（F4.6/F6.3/G9）：夜间 22:00–08:00 旗舰模型费率 ≤ 标准 20% */
export const OFF_PEAK_WINDOW = { start: "22:00", end: "08:00" } as const;
export const OFF_PEAK_RATE_RATIO = 0.2;

/** 夜班默认时刻（F4.1/F4.4/F4.8，均可配） */
export const NIGHT_DEFAULTS = {
  candidateTime: "18:00", // 候选清单生成
  startTime: "22:00", // 战队出征
  packageTime: "08:30", // 清晨决策包送达
  timezone: "Asia/Shanghai",
} as const;

/** 巡检默认时刻（F9.1，可配） */
export const INSPECTION_DEFAULT_TIME = "07:00";

/** 并发上限（G11/L3.1）：单工作区 10 并发 Quest，超出排队且可见 */
export const MAX_CONCURRENT_THREADS = 10;

/** 审批口径（G6/F5.7/E4.5/L5.2） */
export const APPROVAL_LIMITS = {
  packageMaxItems: 20, // 整包 ≤20 条，超出按严重度截断
  expireHours: 24, // 待审超时标记 expired（高危项不存在超时自动放行，L5.4）
  rejectReasonMaxChars: 200, // 驳回必填原因 ≤200 字
} as const;

/** 回收区保留天数（F1.11）：默认 30，可配 7–90 */
export const RECYCLE_BIN_DAYS = { default: 30, min: 7, max: 90 } as const;

/** 数据保留（L1.7）：社区版事件保留 7 天；到期降级保留 90 天可导出 */
export const RETENTION_DAYS = { communityEvents: 7, afterDowngrade: 90 } as const;

/** dry-run 回放窗口（F2.5）：最近 10 条历史动作 */
export const DRY_RUN_REPLAY_LIMIT = 10;

/** 一键暂停端到端口径（G5）：≤60s */
export const PAUSE_ALL_SLA_SECONDS = 60;

/** 对象写锁超时（E2.5）：超时转「需介入」，禁止强制抢锁 */
export const OBJECT_LOCK_TIMEOUT_MS = 10_000;

/** 意识系统频次阈值（F8.4）：同类任务 ≥3 次/周触发「建议固化」 */
export const AWARENESS_WEEKLY_THRESHOLD = 3;

/** 意图路由超时（P1 超时态）：>3s 显「识别中…」可取消 */
export const INTENT_ROUTE_TIMEOUT_MS = 3_000;

/** 记忆默认置信度（F1.4） */
export const MEMORY_DEFAULT_CONFIDENCE = 0.5;

/** 向量维度（org_memory / industry_assets embedding） */
export const EMBEDDING_DIM = 1536;
