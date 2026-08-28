/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ResolvedTheme = "dark" | "light";

/**
 * Kept separate from the resolved theme so a future user-menu preference can
 * override the operating-system setting without changing consumers.
 */
export type ThemePreference = "dark" | "light" | "system";

export const SYSTEM_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? "dark" : "light";
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }

  // Safari before 14 exposes only the legacy MediaQueryList listener API. Keeping this fallback
  // also lets embedded webviews follow the host operating-system setting.
  mediaQuery.addListener(onChange);

  return () => {
    mediaQuery.removeListener(onChange);
  };
}

export function applyDocumentTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
