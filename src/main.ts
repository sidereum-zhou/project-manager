import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '@fontsource/material-symbols-outlined/latin-300.css';
import '@fontsource/material-symbols-outlined/latin-400.css';
import './styles/theme.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
