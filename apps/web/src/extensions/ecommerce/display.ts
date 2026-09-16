/** 电商行业投影的客户端展示边界：任何底层字段、编号和枚举都不得直接上屏。 */
const STATUS_TEXT: Record<string, string> = {
  online: "在线",
  offline: "离线",
  active: "运行中",
  paused: "已暂停",
  pending: "待处理",
  completed: "已完成",
  failed: "失败",
};

const NODE_TEXT: Record<string, string> = {
  amazon: "亚马逊",
  tiktok: "抖音电商",
  douyin: "抖音电商",
  jd: "京东",
  pdd: "拼多多",
  taobao: "淘宝",
  tmall: "天猫",
  shopify: "品牌独立站",
  agent: "数字员工",
  human: "人类成员",
  system: "系统",
};

export const FIELD_TEXT: Record<string, string> = {
  property: "店铺主体",
  brand_guideline: "品牌规范",
  product_matrix: "商品矩阵",
  business: "经营信息",
  competitors: "竞品信息",
  channels: "销售平台",
  promo_calendar: "营销日历",
  goals: "经营目标",
  audience: "目标客群",
  history_curve: "历史趋势",
  account_health: "账号健康",
  operations: "运营配置",
  staffing: "人员配置",
  suppliers: "供应商",
  warehouses: "仓库",
  logistics: "物流",
  incident_profile: "异常画像",
  faq_kb: "常见问题知识库",
  inspection: "巡检配置",
  shops: "店铺清单",
  sop: "标准作业流程",
  forbidden: "禁止事项",
  approval_matrix: "审批矩阵",
  compensation_policy: "赔付政策",
  memory: "组织记忆",
  name: "名称",
  label: "显示名称",
  status: "状态",
  channel: "销售平台",
  threshold: "触发条件",
  description: "说明",
  note: "备注",
};

export function clientIdentifierText(value: unknown): string {
  const text = String(value ?? "");
  const suffix = text.match(/([0-9]{3,})$/)?.[1];
  return suffix ? `记录尾号 ${suffix.slice(-4)}` : "已脱敏记录";
}

export function clientStatusLabel(value: unknown): string {
  return STATUS_TEXT[String(value ?? "").toLowerCase()] ?? "状态待确认";
}

export function clientNodeText(value: unknown, fallback = "未命名对象"): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const mapped = NODE_TEXT[text.toLowerCase()];
  if (mapped) return mapped;
  return /[\p{Script=Han}]/u.test(text) && !/[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+/i.test(text) ? text : fallback;
}

export function clientValueText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  const text = String(value).trim();
  const status = STATUS_TEXT[text.toLowerCase()];
  if (status) return status;
  if (/^[\d.,%¥$+\-:：/年月日天小时分钟秒]+$/.test(text)) return text;
  return /[\p{Script=Han}]/u.test(text) && !/[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+/i.test(text) ? text : fallback;
}

export function fieldText(value: string): string {
  return FIELD_TEXT[value] ?? "其他信息";
}
