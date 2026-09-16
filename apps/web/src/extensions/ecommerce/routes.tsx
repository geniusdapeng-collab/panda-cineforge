import P10 from "./pages/P10";
import P11 from "./pages/P11";
import P12 from "./pages/P12";
import P13 from "./pages/P13";
import P14 from "./pages/P14";
import P15 from "./pages/P15";
import P16 from "./pages/P16";
import P17 from "./pages/P17";
import P18 from "./pages/P18";
import P19 from "./pages/P19";
import P20 from "./pages/P20";

/**
 * 电商业务页只通过基座行业扩展契约接入。
 * legacyPaths 仅用于已有书签平滑迁移，不再把 P 编号暴露为产品导航。
 */
export const industryRoutes = [
  { path: "/operational-incidents", legacyPaths: ["/p10"], capabilityId: "ecommerce.incidents", element: <P10 /> },
  { path: "/price-health", legacyPaths: ["/p11"], capabilityId: "ecommerce.price-health", element: <P11 /> },
  { path: "/business-goals", legacyPaths: ["/p12"], capabilityId: "ecommerce.business-goals", element: <P12 /> },
  { path: "/orders", legacyPaths: ["/p13"], capabilityId: "ecommerce.orders", element: <P13 /> },
  { path: "/sales-channels", legacyPaths: ["/p14"], capabilityId: "ecommerce.sales-channels", element: <P14 /> },
  { path: "/customer-reviews", legacyPaths: ["/p15"], capabilityId: "ecommerce.customer-reviews", element: <P15 /> },
  { path: "/customer-service-monitor", legacyPaths: ["/p16"], capabilityId: "ecommerce.customer-service", element: <P16 /> },
  { path: "/warehouses", legacyPaths: ["/p17"], capabilityId: "ecommerce.warehouses", element: <P17 /> },
  { path: "/stores", legacyPaths: ["/p18"], capabilityId: "ecommerce.stores", element: <P18 /> },
  { path: "/business-analytics", legacyPaths: ["/p19"], capabilityId: "ecommerce.business-analytics", element: <P19 /> },
  { path: "/business-profile", legacyPaths: ["/p20"], capabilityId: "ecommerce.business-profile", element: <P20 /> },
] as const;
