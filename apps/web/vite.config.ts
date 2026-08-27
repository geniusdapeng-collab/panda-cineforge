import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A6：vite proxy 转发 /trpc → server（总纲 §2.4 前后端交互）
// W2：preview 同口径代理（桌面发行版以 vite preview 静态服务 dist）
const trpcProxy = {
  target: `http://localhost:${Number(process.env.SERVER_PORT ?? 8787)}`,
  changeOrigin: true,
};
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { "/trpc": trpcProxy },
  },
  preview: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { "/trpc": trpcProxy },
  },
});
