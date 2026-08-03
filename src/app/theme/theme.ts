/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ThemeConfig } from "antd";

import type { RuntimeConfig } from "@/framework/runtime/types";

export function createThemeConfig(runtimeConfig: RuntimeConfig): ThemeConfig {
  return {
    token: {
      colorPrimary: runtimeConfig.theme.primaryColor,
      borderRadius: runtimeConfig.theme.borderRadius,
      colorBgLayout: "#f6f8fb",
      colorBgContainer: "#ffffff",
      colorBorder: "#e5eaf2",
      colorInfo: "#2563eb",
      colorLink: "#2563eb",
      colorSuccess: "#15803d",
      colorText: "#111827",
      colorTextSecondary: "#475569",
      colorTextTertiary: "#94a3b8",
      // 键盘焦点环。antd 默认 4px + 浅色派生边框，在方角控件上糊成一团灰框；
      // 收成 2px 实线主色，键盘可达性保留，视觉上不再像误触发的选中态。
      lineWidthFocus: 2,
      colorPrimaryBorder: "#2563eb",
    },
    components: {
      Button: {
        primaryColor: "#ffffff",
        colorPrimary: "#1e3a8a",
        colorPrimaryHover: "#17306f",
        colorPrimaryActive: "#0f2a4a",
      },
      Input: {
        activeBorderColor: "#2563eb",
        activeShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
        hoverBorderColor: "#cbd5e1",
      },
      Select: {
        activeBorderColor: "#2563eb",
        activeOutlineColor: "rgba(37, 99, 235, 0.12)",
        hoverBorderColor: "#cbd5e1",
      },
      Tabs: {
        inkBarColor: "#2563eb",
        itemActiveColor: "#1e3a8a",
        itemHoverColor: "#2563eb",
        itemSelectedColor: "#1e3a8a",
      },
      Table: {
        // Keep selectable rows easy to scan: hover gives a quiet cue, selection
        // remains legible, and selected-hover adds only a small amount of emphasis.
        rowHoverBg: "#f8fafc",
        rowSelectedBg: "#eff6ff",
        rowSelectedHoverBg: "#dbeafe",
      },
    },
  };
}
