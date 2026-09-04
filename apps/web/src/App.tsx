import { Route, Routes } from "react-router";
import P1 from "./pages/p1/P1";
import P2 from "./pages/p2/P2";
import P9 from "./pages/p9/P9";
import P21 from "./pages/p21/P21";
import P22 from "./pages/p22/P22";
import P0 from "./pages/p0/P0";
import P3 from "./pages/p3/P3";
import P4 from "./pages/p4/P4";
import P5 from "./pages/p5/P5";
import P6 from "./pages/p6/P6";
import P7 from "./pages/p7/P7";
import P8 from "./pages/p8/P8";
import P10 from "./pages/p10/P10";
import P11 from "./pages/p11/P11";
import P12 from "./pages/p12/P12";
import P13 from "./pages/p13/P13";
import P14 from "./pages/p14/P14";
import P15 from "./pages/p15/P15";
import P16 from "./pages/p16/P16";
import P17 from "./pages/p17/P17";
import P18 from "./pages/p18/P18";
import P19 from "./pages/p19/P19";
import P20 from "./pages/p20/P20";
import P23 from "./pages/p23/P23";
import P24 from "./pages/p24/P24";
import DevMatrix from "./pages/dev/DevMatrix";
import Onboarding from "./pages/onboarding/Onboarding";
import { Bridge } from "./shell/Bridge";
import { SideNav } from "./shell/SideNav";
import { useLocation } from "react-router";
import { StarRing } from "./components/star-ring/StarRing";

/** 阶段三路由：页面自包 Bridge（注入真实左右栏）；/dev 矩阵保持壳内平铺 */
function Shell() {
  const { pathname } = useLocation();
  // 非产品路由（开发矩阵/落地向导）不带常驻导航；其余全部页面左侧导航常驻
  const bare = pathname === "/dev" || pathname.startsWith("/onboarding");
  return (
    <div className="flex min-h-screen">
      {!bare && <SideNav />}
      <div className="min-w-0 flex-1">
    {/* AI 助手 AskRail：全局右侧通栏对话框（任何页面常驻；⌘K 唤起） */}
        <StarRing />
        <Routes>
      <Route path="/" element={<P0 />} />
      <Route path="/p1" element={<P1 />} />
      <Route path="/p2/:threadId" element={<P2 />} />
      <Route path="/p9" element={<P9 />} />
      <Route path="/p21" element={<P21 />} />
      <Route path="/p22" element={<P22 />} />
      <Route path="/p3" element={<P3 />} />
      <Route path="/p4" element={<P4 />} />
      <Route path="/p5" element={<P5 />} />
      <Route path="/p6" element={<P6 />} />
      <Route path="/p6/create" element={<P6 />} />
      <Route path="/p7" element={<P7 />} />
      <Route path="/p8" element={<P8 />} />
      <Route path="/p8/agent/:agentId" element={<P8 />} />
      <Route path="/p10" element={<P10 />} />
      <Route path="/p11" element={<P11 />} />
      <Route path="/p12" element={<P12 />} />
      <Route path="/p13" element={<P13 />} />
      <Route path="/p14" element={<P14 />} />
      <Route path="/p15" element={<P15 />} />
      <Route path="/p16" element={<P16 />} />
      <Route path="/p17" element={<P17 />} />
      <Route path="/p18" element={<P18 />} />
      <Route path="/p19" element={<P19 />} />
      <Route path="/p20" element={<P20 />} />
      <Route path="/p23" element={<P23 />} />
      <Route path="/p24" element={<P24 />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dev" element={<Bridge><DevMatrix /></Bridge>} />
      <Route path="*" element={<P0 />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return <Shell />;
}
