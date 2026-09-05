/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";

import { ThemeContext, ThemeToggleContext } from "./theme-context";

import {
  applyDocumentTheme,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
  storeThemePreference,
  subscribeToSystemTheme,
  type ResolvedTheme,
} from "./theme-mode";

function getServerTheme(): ResolvedTheme {
  return "light";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themePreference, setThemePreference] = useState(getStoredThemePreference);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    getServerTheme,
  );
  const resolvedTheme = resolveTheme(themePreference, systemTheme);
  const toggleTheme = useCallback(() => {
    setThemePreference((currentPreference) => {
      const currentTheme = resolveTheme(currentPreference, systemTheme);
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      storeThemePreference(nextTheme);
      return nextTheme;
    });
  }, [systemTheme]);

  // The initial document theme is set synchronously in index.html. Keep the DOM in sync with
  // operating-system changes before the browser paints the React update.
  useLayoutEffect(() => {
    applyDocumentTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>
    </ThemeToggleContext.Provider>
  );
}
