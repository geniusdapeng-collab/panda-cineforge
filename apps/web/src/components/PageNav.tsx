/**
 * 页面导航（左栏）：P1–P20 全量入口（经营态页面统一导航）
 * 视觉口径：与 Bridge 左栏一致（text-ink3 分组标 / border-line 卡片 / hover:border-gline）
 */
const NAV: Array<{ group: string; items: Array<{ path: string; label: string; tag: string }> }> = [
  {
    group: "经营驾驶",
    items: [
      { path: "/", label: "经营主页·首页", tag: "P0" },
      { path: "/p1", label: "晨报·经营主页", tag: "P1" },
      { path: "/p12", label: "经营目标", tag: "P12" },
      { path: "/p18", label: "多店驾驶舱", tag: "P18" },
      { path: "/p23", label: "店铺矩阵看板", tag: "P23" },
      { path: "/p19", label: "经营问数", tag: "P19" },
      { path: "/p3", label: "掌上日报·交接", tag: "P3" },
    ],
  },
  {
    group: "订单与平台",
    items: [
      { path: "/p13", label: "订单穿透", tag: "P13" },
      { path: "/p14", label: "平台运营", tag: "P14" },
      { path: "/p11", label: "商品价格矩阵", tag: "P11" },
    ],
  },
  {
    group: "买家与评价",
    items: [
      { path: "/p15", label: "评价与差评防御", tag: "P15" },
      { path: "/p16", label: "客服监控墙", tag: "P16" },
    ],
  },
  {
    group: "仓储与履约",
    items: [{ path: "/p17", label: "海外仓地图", tag: "P17" }],
  },
  {
    group: "夜班与组织",
    items: [
      { path: "/p9", label: "夜班中心频道", tag: "P9" },
      { path: "/p10", label: "断点看板", tag: "P10" },
      { path: "/p21", label: "董事长视图", tag: "P21" },
      { path: "/p4", label: "审批中心", tag: "P4" },
      { path: "/p5", label: "规则中心", tag: "P5" },
      { path: "/p6", label: "技能市场", tag: "P6" },
      { path: "/p7", label: "组织记忆", tag: "P7" },
      { path: "/p8", label: "团队成员", tag: "P8" },
    ],
  },
  {
    group: "档案",
    items: [{ path: "/p20", label: "店铺档案", tag: "P20" }],
  },
];

export function PageNav({ current }: { current: string }) {
  return (
    <>
      {NAV.map((g) => (
        <div key={g.group} className="mb-3">
          <div className="mb-2 px-1 text-[11px] tracking-[.2em] text-ink3">{g.group}</div>
          {g.items.map((it) => (
            <a
              key={it.path}
              href={it.path}
              className={`mb-1.5 flex items-center justify-between rounded-lg border px-3 py-2.5 text-body transition-colors ${
                current === it.tag
                  ? "border-gline bg-card text-gold"
                  : "border-line bg-card text-ink2 hover:border-gline"
              }`}
            >
              <span>{it.label}</span>
              <span className="font-mono text-[11px] text-ink3">{it.tag}</span>
            </a>
          ))}
        </div>
      ))}
    </>
  );
}
