/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext, useContext } from "react";

import type { ResolvedTheme } from "./theme-mode";

// A light fallback keeps isolated widgets and their tests usable; the mounted application always
// provides the resolved operating-system theme.
export const ThemeContext = createContext<ResolvedTheme>("light");

export function useResolvedTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}
