/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { PropsWithChildren } from "react";
import { useLayoutEffect, useSyncExternalStore } from "react";

import { ThemeContext } from "./theme-context";

import {
  applyDocumentTheme,
  getSystemTheme,
  resolveTheme,
  subscribeToSystemTheme,
  type ThemePreference,
} from "./theme-mode";

const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

function getServerTheme() {
  return "light";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    getServerTheme,
  );
  const resolvedTheme = resolveTheme(DEFAULT_THEME_PREFERENCE, systemTheme);

  // The initial document theme is set synchronously in index.html. Keep the DOM in sync with
  // operating-system changes before the browser paints the React update.
  useLayoutEffect(() => {
    applyDocumentTheme(resolvedTheme);
  }, [resolvedTheme]);

  return <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>;
}
