<template>
  <n-config-provider :theme="lightTheme" :theme-overrides="themeOverrides">
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
  lightTheme,
  type GlobalThemeOverrides,
} from 'naive-ui';
import AppLayout from './AppLayout.vue';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0053db',
    primaryColorHover: '#0048c1',
    primaryColorPressed: '#003798',
    primaryColorSuppl: '#0053db',
    infoColor: '#0053db',
    successColor: '#15803d',
    warningColor: '#d97706',
    errorColor: '#9f403d',
    bodyColor: '#f9f9f9',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    actionColor: '#f2f4f4',
    hoverColor: '#e4e9ea',
    borderColor: 'rgba(172, 179, 180, 0.15)',
    textColorBase: '#2d3435',
    textColor1: '#2d3435',
    textColor2: '#596061',
    textColor3: '#757c7d',
    inputColor: '#ffffff',
    dividerColor: 'rgba(172, 179, 180, 0.1)',
    scrollbarColor: 'rgba(172, 179, 180, 0.32)',
    scrollbarColorHover: 'rgba(172, 179, 180, 0.48)',
    borderRadius: '0.125rem',
    borderRadiusSmall: '0.125rem',
    fontFamily: '"Inter", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
  },
  Button: {
    borderRadiusMedium: '0.125rem',
    borderRadiusSmall: '0.125rem',
    borderRadiusLarge: '0.125rem',
  },
  Input: {
    borderRadius: '0.25rem',
  },
  Card: {
    borderRadius: '0.5rem',
  },
  Tabs: {
    tabTextColorLine: '#596061',
    tabTextColorActiveLine: '#0053db',
    tabTextColorHoverLine: '#0053db',
    barColor: '#0053db',
  },
  Tag: {
    borderRadius: '0.25rem',
  },
  Dialog: {
    borderRadius: '0.5rem',
  },
};
</script>

<style>
#app {
  height: 100vh;
}
</style>
