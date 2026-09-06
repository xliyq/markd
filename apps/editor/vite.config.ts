import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";

// Vite+：dev/build 用 Vite 8 + Rolldown
export default defineConfig({
  base: "./", // 相对路径：静态托管到任意子路径（GitHub Pages / 自定义域）均可用
  plugins: [vue()],
  server: {
    port: 5173,
  },
});
