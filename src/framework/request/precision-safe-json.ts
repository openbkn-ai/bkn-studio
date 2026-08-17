/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import JSONBig from "json-bigint";

const precisionSafeJSON = JSONBig({ storeAsString: true });
const precisionPreservingJSON = JSONBig();

/**
 * Parses JSON without converting integers outside JavaScript's safe range to
 * lossy numbers. Unsafe integers become decimal strings; safe integers keep
 * their number type.
 */
export function parsePrecisionSafeJSON(data: string): unknown {
  return precisionSafeJSON.parse(data) as unknown;
}

/** Pretty-prints JSON while keeping precise numeric literals as JSON numbers. */
export function formatPrecisionSafeJSON(data: string): string {
  return precisionPreservingJSON.stringify(precisionPreservingJSON.parse(data), null, 2);
}

/** Axios response transformer for APIs that may return dynamic business data. */
export function transformPrecisionSafeJSONResponse(data: unknown): unknown {
  if (typeof data !== "string" || data.length === 0) {
    return data;
  }

  try {
    return parsePrecisionSafeJSON(data);
  } catch {
    // Match Axios' default transformer so non-JSON error bodies do not replace
    // the AxiosError and bypass status-based retry or error handling.
    return data;
  }
}
