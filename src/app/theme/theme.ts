/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { theme as antdTheme, type ThemeConfig } from "antd";

import type { ResolvedTheme } from "@/app/theme/theme-mode";
import type { RuntimeConfig } from "@/framework/runtime/types";

export function createThemeConfig(
  runtimeConfig: RuntimeConfig,
  resolvedTheme: ResolvedTheme,
): ThemeConfig {
  const isDark = resolvedTheme === "dark";

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: runtimeConfig.theme.primaryColor,
      borderRadius: runtimeConfig.theme.borderRadius,
      colorBgLayout: isDark ? "#0f172a" : "#f6f8fb",
      colorBgContainer: isDark ? "#172033" : "#ffffff",
      colorBorder: isDark ? "#334155" : "#e5eaf2",
      colorInfo: "#2563eb",
      colorLink: "#2563eb",
      colorSuccess: isDark ? "#4ade80" : "#15803d",
      colorText: isDark ? "#f1f5f9" : "#111827",
      colorTextSecondary: isDark ? "#cbd5e1" : "#475569",
      colorTextTertiary: isDark ? "#94a3b8" : "#94a3b8",
      // Keyboard focus ring. AntD's default 4px ring and light derived border blur into a gray
      // box on square controls; use a 2px solid primary color to preserve accessibility without
      // looking like an accidental selection state.
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
        rowHoverBg: isDark ? "#243047" : "#f8fafc",
        rowSelectedBg: isDark ? "#1e3a5f" : "#eff6ff",
        rowSelectedHoverBg: isDark ? "#254b78" : "#dbeafe",
      },
    },
  };
}
