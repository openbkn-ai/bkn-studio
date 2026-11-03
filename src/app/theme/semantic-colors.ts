/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ResolvedTheme } from "@/app/theme/theme-mode";

const DEFAULT_PRIMARY = "#1e3a8a";
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#111318";
const LIGHT_ACTION_TEXT = "#ffffff";
const DARK_ACTION_TEXT = "#111827";

export const semanticColorVariableNames = {
  actionPrimary: "--color-action-primary",
  actionPrimaryActive: "--color-action-primary-active",
  actionPrimaryHover: "--color-action-primary-hover",
  actionPrimaryText: "--color-action-primary-text",
  accentPrimary: "--color-accent-primary",
  accentPrimaryActive: "--color-accent-primary-active",
  accentPrimaryHover: "--color-accent-primary-hover",
  link: "--color-link",
  linkHover: "--color-link-hover",
  focusRing: "--color-focus-ring",
  selectionAccent: "--color-selection-accent",
  textTertiary: "--color-text-tertiary",
  textPlaceholder: "--color-text-placeholder",
  textDisabled: "--color-text-disabled",
  bgHover: "--color-bg-hover",
  bgSelected: "--color-bg-selected",
  bgSelectedHover: "--color-bg-selected-hover",
} as const;

export type SemanticColors = Record<keyof typeof semanticColorVariableNames, string>;

export const defaultSemanticColors: Record<ResolvedTheme, SemanticColors> = {
  light: {
    actionPrimary: "#1e3a8a",
    actionPrimaryHover: "#17306f",
    actionPrimaryActive: "#0f2a4a",
    actionPrimaryText: LIGHT_ACTION_TEXT,
    accentPrimary: "#2563eb",
    accentPrimaryHover: "#1d4ed8",
    accentPrimaryActive: "#1e40af",
    link: "#1d4ed8",
    linkHover: "#1e40af",
    focusRing: "#2563eb",
    selectionAccent: "#2563eb",
    textTertiary: "#64748b",
    textPlaceholder: "#94a3b8",
    textDisabled: "#94a3b8",
    bgHover: "#f8fafc",
    bgSelected: "#eff6ff",
    bgSelectedHover: "#dbeafe",
  },
  dark: {
    actionPrimary: "#2563eb",
    actionPrimaryHover: "#2f6fdc",
    actionPrimaryActive: "#1d4ed8",
    actionPrimaryText: LIGHT_ACTION_TEXT,
    accentPrimary: "#60a5fa",
    accentPrimaryHover: "#93c5fd",
    accentPrimaryActive: "#3b82f6",
    link: "#93c5fd",
    linkHover: "#bfdbfe",
    focusRing: "#60a5fa",
    selectionAccent: "#60a5fa",
    textTertiary: "#7d8592",
    textPlaceholder: "#69717e",
    textDisabled: "#565d69",
    bgHover: "#20232a",
    bgSelected: "#1c2638",
    bgSelectedHover: "#223049",
  },
};

type Rgb = readonly [number, number, number];

function parseHex(color: string): Rgb | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color.trim());
  if (!match) {
    return null;
  }

  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

function toHex([red, green, blue]: Rgb): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(from: string, to: string, amount: number): string {
  const fromRgb = parseHex(from);
  const toRgb = parseHex(to);
  if (!fromRgb || !toRgb) {
    return from;
  }

  return toHex([
    fromRgb[0] + (toRgb[0] - fromRgb[0]) * amount,
    fromRgb[1] + (toRgb[1] - fromRgb[1]) * amount,
    fromRgb[2] + (toRgb[2] - fromRgb[2]) * amount,
  ]);
}

function relativeLuminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) {
    return 0;
  }

  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function colorWithAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.join(", ")}, ${alpha})`;
}

function ensureContrast(
  color: string,
  background: string,
  target: string,
  minimumRatio: number,
): string {
  if (contrastRatio(color, background) >= minimumRatio) {
    return color;
  }

  let lower = 0;
  let upper = 1;
  let result = target;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const amount = (lower + upper) / 2;
    const candidate = mix(color, target, amount);
    if (contrastRatio(candidate, background) >= minimumRatio) {
      result = candidate;
      upper = amount;
    } else {
      lower = amount;
    }
  }
  return result;
}

function actionColors(primaryColor: string) {
  const whiteRatio = contrastRatio(primaryColor, LIGHT_ACTION_TEXT);
  const darkRatio = contrastRatio(primaryColor, DARK_ACTION_TEXT);
  const text = whiteRatio >= darkRatio ? LIGHT_ACTION_TEXT : DARK_ACTION_TEXT;
  const stateTarget = text === LIGHT_ACTION_TEXT ? "#000000" : "#ffffff";
  const base = ensureContrast(primaryColor, text, stateTarget, 4.5);

  return {
    actionPrimary: base,
    actionPrimaryHover: ensureContrast(mix(base, stateTarget, 0.1), text, stateTarget, 4.5),
    actionPrimaryActive: ensureContrast(mix(base, stateTarget, 0.2), text, stateTarget, 4.5),
    actionPrimaryText: text,
  };
}

export function createSemanticColors(
  primaryColor: string,
  resolvedTheme: ResolvedTheme,
): SemanticColors {
  const defaults = defaultSemanticColors[resolvedTheme];
  const normalizedPrimary = parseHex(primaryColor)
    ? primaryColor.trim().toLowerCase()
    : DEFAULT_PRIMARY;
  if (normalizedPrimary === DEFAULT_PRIMARY) {
    return defaults;
  }

  const surface = resolvedTheme === "dark" ? DARK_SURFACE : LIGHT_SURFACE;
  const contrastTarget = resolvedTheme === "dark" ? "#ffffff" : "#000000";
  const accent = ensureContrast(normalizedPrimary, surface, contrastTarget, 4.5);
  const accentHover = ensureContrast(
    mix(accent, contrastTarget, 0.16),
    surface,
    contrastTarget,
    4.5,
  );
  const accentActive = ensureContrast(
    mix(accent, contrastTarget, 0.28),
    surface,
    contrastTarget,
    4.5,
  );

  return {
    ...defaults,
    ...actionColors(normalizedPrimary),
    accentPrimary: accent,
    accentPrimaryHover: accentHover,
    accentPrimaryActive: accentActive,
    link: accent,
    linkHover: accentHover,
    focusRing: accent,
    selectionAccent: accent,
  };
}

export function semanticColorCssVariables(colors: SemanticColors): Record<string, string> {
  return Object.fromEntries(
    Object.entries(semanticColorVariableNames).map(([name, variable]) => [
      variable,
      colors[name as keyof SemanticColors],
    ]),
  );
}
