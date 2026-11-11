/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { theme as antdTheme, type ThemeConfig } from "antd";

import { colorWithAlpha, createSemanticColors } from "@/app/theme/semantic-colors";
import type { ResolvedTheme } from "@/app/theme/theme-mode";
import type { RuntimeConfig } from "@/framework/runtime/types";

/**
 * Floating layers in dark mode (messages, notifications, modals, dropdowns, popovers, select
 * panels): one clear step lighter than the page, ringed by a hairline, over a deeper mask.
 * Shadows alone barely show on a dark page, so the ring is what sets the layer apart.
 */
const DARK_OVERLAY_TOKENS = {
  colorBgElevated: "#24272e",
  boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.1), 0 12px 32px rgba(0, 0, 0, 0.55)",
  boxShadowSecondary: "0 0 0 1px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.5)",
  colorBgMask: "rgba(0, 0, 0, 0.65)",
};

const DARK_STATUS_TOKENS = {
  colorError: "#f87171",
  colorErrorBg: "rgba(248, 113, 113, 0.12)",
  colorErrorBorder: "rgba(248, 113, 113, 0.35)",
  colorSuccessBg: "rgba(74, 222, 128, 0.12)",
  colorSuccessBorder: "rgba(74, 222, 128, 0.35)",
  colorWarning: "#fbbf24",
  colorWarningBg: "rgba(251, 191, 36, 0.12)",
  colorWarningBorder: "rgba(251, 191, 36, 0.35)",
  colorInfo: "#60a5fa",
  colorInfoBg: "rgba(96, 165, 250, 0.12)",
  colorInfoBorder: "rgba(96, 165, 250, 0.35)",
  // Preset tag colors (<Tag color="red">) read palette steps 1 / 3 / 7.
  red1: "rgba(248, 113, 113, 0.12)",
  red3: "rgba(248, 113, 113, 0.35)",
  red7: "#f87171",
  green1: "rgba(74, 222, 128, 0.12)",
  green3: "rgba(74, 222, 128, 0.35)",
  green7: "#4ade80",
  orange1: "rgba(251, 146, 60, 0.12)",
  orange3: "rgba(251, 146, 60, 0.35)",
  orange7: "#fb923c",
  gold1: "rgba(251, 191, 36, 0.12)",
  gold3: "rgba(251, 191, 36, 0.35)",
  gold7: "#fbbf24",
  purple1: "rgba(167, 139, 250, 0.12)",
  purple3: "rgba(167, 139, 250, 0.35)",
  purple7: "#c4b5fd",
  blue1: "rgba(96, 165, 250, 0.12)",
  blue3: "rgba(96, 165, 250, 0.35)",
  blue7: "#93c5fd",
};

/**
 * Light success tints. AntD derives a success tag's fill and border from colorSuccess; from the deep
 * green used for text that lands on a grayish olive. Pin them to the page's own success tints.
 */
const LIGHT_SUCCESS_TOKENS = {
  colorSuccessBg: "#ecfdf3",
  colorSuccessBgHover: "#dcfce7",
  colorSuccessBorder: "#bbf7d0",
  colorSuccessBorderHover: "#86efac",
};

/** Compatibility helper for consumers that need the dark solid-action state colors. */
export function darkButtonFor(primaryColor: string) {
  const colors = createSemanticColors(primaryColor, "dark");
  return {
    active: colors.actionPrimaryActive,
    base: colors.actionPrimary,
    hover: colors.actionPrimaryHover,
    text: colors.actionPrimaryText,
  };
}

/**
 * Compatibility helper for consumers that need the dark accent state colors. The semantic color
 * generator adjusts the configured brand just enough to meet contrast on the dark page surface.
 */
export function darkPrimaryFor(primaryColor: string) {
  const colors = createSemanticColors(primaryColor, "dark");
  return {
    active: colors.accentPrimaryActive,
    base: colors.accentPrimary,
    hover: colors.accentPrimaryHover,
  };
}

export function createThemeConfig(
  runtimeConfig: RuntimeConfig,
  resolvedTheme: ResolvedTheme,
): ThemeConfig {
  const isDark = resolvedTheme === "dark";
  const colors = createSemanticColors(runtimeConfig.theme.primaryColor, resolvedTheme);

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: colors.accentPrimary,
      borderRadius: runtimeConfig.theme.borderRadius,
      colorBgLayout: isDark ? "#111318" : "#f6f8fb",
      colorBgContainer: isDark ? "#1a1d23" : "#ffffff",
      ...(isDark ? { ...DARK_OVERLAY_TOKENS, colorBorderSecondary: "#23262d" } : {}),
      colorBorder: isDark ? "#2b2f37" : "#e5eaf2",
      colorInfo: "#2563eb",
      colorLink: colors.link,
      colorLinkHover: colors.linkHover,
      colorLinkActive: colors.accentPrimaryActive,
      colorSuccess: isDark ? "#4ade80" : "#15803d",
      // Dark status tints: the hue at 12% alpha with a 35% border, so tags adapt to whatever row or
      // panel they sit on. AntD's generated dark palette lands on near-black maroon/olive.
      ...(isDark ? DARK_STATUS_TOKENS : LIGHT_SUCCESS_TOKENS),
      colorText: isDark ? "#e6e8eb" : "#111827",
      colorTextSecondary: isDark ? "#a8afba" : "#475569",
      colorTextTertiary: colors.textTertiary,
      colorTextPlaceholder: colors.textPlaceholder,
      colorTextDisabled: colors.textDisabled,
      // Keyboard focus ring. AntD's default 4px ring and light derived border blur into a gray
      // box on square controls; use a 2px solid primary color to preserve accessibility without
      // looking like an accidental selection state.
      lineWidthFocus: 2,
      colorPrimaryBorder: colors.focusRing,
    },
    components: {
      Button: {
        // AntD's 2px drop shadow reads as a dirty band under flat square buttons, worst in dark mode.
        defaultShadow: "none",
        primaryShadow: "none",
        dangerShadow: "none",
        primaryColor: colors.actionPrimaryText,
        colorPrimary: colors.actionPrimary,
        colorPrimaryHover: colors.actionPrimaryHover,
        colorPrimaryActive: colors.actionPrimaryActive,
      },
      Input: {
        activeBorderColor: colors.focusRing,
        activeShadow: `0 0 0 3px ${colorWithAlpha(colors.focusRing, 0.12)}`,
        hoverBorderColor: isDark ? "#454b56" : "#cbd5e1",
      },
      Select: {
        activeBorderColor: colors.focusRing,
        activeOutlineColor: colorWithAlpha(colors.focusRing, 0.12),
        hoverBorderColor: isDark ? "#454b56" : "#cbd5e1",
      },
      Tabs: {
        inkBarColor: colors.selectionAccent,
        itemActiveColor: colors.selectionAccent,
        itemHoverColor: colors.linkHover,
        itemSelectedColor: colors.selectionAccent,
      },
      Segmented: {
        // Give options room to breathe and keep the track one step above the card, not a black slot.
        controlPaddingHorizontal: 14,
        controlPaddingHorizontalSM: 10,
        trackPadding: 3,
        trackBg: isDark ? "#23262d" : "#eef2f7",
        itemSelectedBg: isDark ? "#343842" : "#ffffff",
        itemColor: isDark ? "#a8afba" : "#475569",
        itemHoverColor: isDark ? "#e6e8eb" : "#111827",
        itemSelectedColor: isDark ? "#e6e8eb" : "#111827",
      },
      Table: {
        // Keep selectable rows easy to scan: hover gives a quiet cue, selection
        // remains legible, and selected-hover adds only a small amount of emphasis.
        rowHoverBg: colors.bgHover,
        rowSelectedBg: colors.bgSelected,
        rowSelectedHoverBg: colors.bgSelectedHover,
      },
    },
  };
}
