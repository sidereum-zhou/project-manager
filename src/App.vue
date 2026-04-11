<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <AppLayout />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  darkTheme,
  type GlobalThemeOverrides,
} from 'naive-ui';
import AppLayout from './AppLayout.vue';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#62d4b8',
    primaryColorHover: '#8de4d0',
    primaryColorPressed: '#42c2a5',
    primaryColorSuppl: '#62d4b8',
    infoColor: '#79b6ff',
    successColor: '#62d4b8',
    warningColor: '#f0b35f',
    errorColor: '#ff8299',
    bodyColor: '#08101d',
    cardColor: '#101826',
    modalColor: '#101826',
    popoverColor: '#131f34',
    tableColor: '#101826',
    actionColor: 'rgba(255, 255, 255, 0.04)',
    hoverColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(148, 163, 184, 0.18)',
    textColorBase: '#f4f7fb',
    textColor1: '#f4f7fb',
    textColor2: '#d4deec',
    textColor3: '#90a0b7',
    inputColor: '#111b2b',
    dividerColor: 'rgba(148, 163, 184, 0.14)',
    scrollbarColor: 'rgba(148, 163, 184, 0.32)',
    scrollbarColorHover: 'rgba(148, 163, 184, 0.48)',
    borderRadius: '16px',
    borderRadiusSmall: '12px',
    fontFamily: '"Aptos", "Segoe UI Variable Text", "Microsoft YaHei UI", "PingFang SC", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
  },
};
</script>

<style>
#app {
  height: 100vh;
}
</style>
