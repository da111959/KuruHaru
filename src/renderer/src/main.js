import "./assets/main.css";
import "./assets/page-skin.css";
import "./assets/component-themes.css";
import "./assets/flat-design.css";
import "./assets/telegram-workbench.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
