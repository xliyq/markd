import { createApp } from "vue";
import App from "./App.vue";
// Milkdown 主题样式（nord）：之前只调 nord(ctx) 设变量、从未 import CSS → 编辑区样式全裸奔
import "./style.css";

createApp(App).mount("#app");
