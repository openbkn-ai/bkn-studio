/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getIndexCapabilities } from "@/modules/data-catalog/services/index-capability.service";

export type AnalyzerCapabilitiesLoadState = "idle" | "loading" | "ready" | "empty" | "error";

export type AnalyzerCapabilitiesLoadResult = {
  errorMessage: string | null;
  options: string[];
  state: AnalyzerCapabilitiesLoadState;
};

/** Loads the server-owned analyzer snapshot without a client-side fallback. */
export async function loadAnalyzerCapabilities(): Promise<AnalyzerCapabilitiesLoadResult> {
  try {
    const capabilities = await getIndexCapabilities();
    if (capabilities.fulltextAnalyzers.length === 0) {
      return { state: "empty", options: [], errorMessage: null };
    }
    return { state: "ready", options: capabilities.fulltextAnalyzers, errorMessage: null };
  } catch (error) {
    return {
      state: "error",
      options: [],
      errorMessage: extractRequestErrorMessage(error),
    };
  }
}

export function findUnavailableAnalyzers(options: string[], candidates: Array<string | undefined | null>): string[] {
  const available = new Set(options);
  return [...new Set(candidates.map((item) => item?.trim()).filter((item): item is string => Boolean(item && !available.has(item))))];
}
