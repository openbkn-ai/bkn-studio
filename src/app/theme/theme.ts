/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { theme as antdTheme, type ThemeConfig } from "antd";

import type { ResolvedTheme } from "@/app/theme/theme-mode";
import type { RuntimeConfig } from "@/framework/runtime/types";

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

const DEFAULT_PRIMARY = "#1e3a8a";
const DEFAULT_DARK_PRIMARY = { base: "#3b82f6", hover: "#5b95f7", active: "#2f6fdc" };
/**
 * The solid primary button on dark surfaces, kept apart from the dark accent above: white text
 * on it reads at about 5.2:1 (4.7:1 on hover), where the brighter accent falls short. Mirrored by
 * --color-button-primary* in global.css for the controls styled outside AntD's tokens.
 */
const DEFAULT_DARK_BUTTON = { base: "#2563eb", hover: "#2f6fdc", active: "#1d4ed8" };

/** The solid primary button in dark mode: the platform's own, or the brand's lifted primary. */
export function darkButtonFor(primaryColor: string) {
  return primaryColor.trim().toLowerCase() === DEFAULT_PRIMARY
    ? DEFAULT_DARK_BUTTON
    : darkPrimaryFor(primaryColor);
}

function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }

  const [r, g, b] = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) {
    return [0, 0, lightness];
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === r
      ? (g - b) / delta + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * A brand primary tuned for white surfaces (often a deep navy) disappears on dark ones. Keep the
 * configured hue but lift its lightness so host / OEM brand colors still apply in dark mode.
 */
export function darkPrimaryFor(primaryColor: string) {
  if (primaryColor.trim().toLowerCase() === DEFAULT_PRIMARY) {
    return DEFAULT_DARK_PRIMARY;
  }

  const hsl = hexToHsl(primaryColor);
  if (!hsl) {
    return DEFAULT_DARK_PRIMARY;
  }

  const [hue, saturation] = hsl;
  return {
    base: hslToHex(hue, saturation, 0.6),
    hover: hslToHex(hue, saturation, 0.68),
    active: hslToHex(hue, saturation, 0.52),
  };
}

export function createThemeConfig(
  runtimeConfig: RuntimeConfig,
  resolvedTheme: ResolvedTheme,
): ThemeConfig {
  const isDark = resolvedTheme === "dark";
  const darkPrimary = darkPrimaryFor(runtimeConfig.theme.primaryColor);
  const darkButton = darkButtonFor(runtimeConfig.theme.primaryColor);

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? darkPrimary.base : runtimeConfig.theme.primaryColor,
      borderRadius: runtimeConfig.theme.borderRadius,
      colorBgLayout: isDark ? "#111318" : "#f6f8fb",
      colorBgContainer: isDark ? "#1a1d23" : "#ffffff",
      ...(isDark ? { colorBgElevated: "#20232a", colorBorderSecondary: "#23262d" } : {}),
      colorBorder: isDark ? "#2b2f37" : "#e5eaf2",
      colorInfo: "#2563eb",
      colorLink: isDark ? "#60a5fa" : "#2563eb",
      ...(isDark ? { colorLinkHover: "#93c5fd", colorLinkActive: "#3b82f6" } : {}),
      colorSuccess: isDark ? "#4ade80" : "#15803d",
      // Dark status tints: the hue at 12% alpha with a 35% border, so tags adapt to whatever row or
      // panel they sit on. AntD's generated dark palette lands on near-black maroon/olive.
      ...(isDark ? DARK_STATUS_TOKENS : {}),
      colorText: isDark ? "#e6e8eb" : "#111827",
      colorTextSecondary: isDark ? "#a8afba" : "#475569",
      colorTextTertiary: isDark ? "#7d8592" : "#94a3b8",
      // Keyboard focus ring. AntD's default 4px ring and light derived border blur into a gray
      // box on square controls; use a 2px solid primary color to preserve accessibility without
      // looking like an accidental selection state.
      lineWidthFocus: 2,
      colorPrimaryBorder: "#2563eb",
    },
    components: {
      Button: {
        // AntD's 2px drop shadow reads as a dirty band under flat square buttons, worst in dark mode.
        defaultShadow: "none",
        primaryShadow: "none",
        dangerShadow: "none",
        primaryColor: "#ffffff",
        colorPrimary: isDark ? darkButton.base : "#1e3a8a",
        colorPrimaryHover: isDark ? darkButton.hover : "#17306f",
        colorPrimaryActive: isDark ? darkButton.active : "#0f2a4a",
      },
      Input: {
        activeBorderColor: "#2563eb",
        activeShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
        hoverBorderColor: isDark ? "#454b56" : "#cbd5e1",
      },
      Select: {
        activeBorderColor: "#2563eb",
        activeOutlineColor: "rgba(37, 99, 235, 0.12)",
        hoverBorderColor: isDark ? "#454b56" : "#cbd5e1",
      },
      Tabs: {
        inkBarColor: isDark ? "#60a5fa" : "#2563eb",
        itemActiveColor: isDark ? "#93c5fd" : "#1e3a8a",
        itemHoverColor: isDark ? "#bfdbfe" : "#2563eb",
        itemSelectedColor: isDark ? "#93c5fd" : "#1e3a8a",
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
        rowHoverBg: isDark ? "#20232a" : "#f8fafc",
        rowSelectedBg: isDark ? "#1c2638" : "#eff6ff",
        rowSelectedHoverBg: isDark ? "#223049" : "#dbeafe",
      },
    },
  };
}
