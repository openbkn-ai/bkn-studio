/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useState } from "react";

/** `oauth`: the client gets only the URL and signs in through the browser. `apiKey`: bak_ header. */
export type McpAuthMode = "oauth" | "apiKey";

const STORAGE_KEY = "bkn-mcp-connect-auth-mode";
const DEFAULT_MODE: McpAuthMode = "oauth";

export function readStoredMcpAuthMode(): McpAuthMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "oauth" || value === "apiKey" ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function writeStoredMcpAuthMode(mode: McpAuthMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode, blocked site data); the choice just is not kept.
  }
}

/** The connect guide's auth mode, remembered per browser. Defaults to sign-in. */
export function useMcpAuthMode() {
  const [mode, setModeState] = useState<McpAuthMode>(readStoredMcpAuthMode);
  const setMode = useCallback((next: McpAuthMode) => {
    setModeState(next);
    writeStoredMcpAuthMode(next);
  }, []);
  return [mode, setMode] as const;
}
