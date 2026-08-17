/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import JSONBig from "json-bigint";

const precisionSafeJSON = JSONBig({ storeAsString: true });

/**
 * Parses JSON without converting integers outside JavaScript's safe range to
 * lossy numbers. Unsafe integers become decimal strings; safe integers keep
 * their number type.
 */
export function parsePrecisionSafeJSON(data: string): unknown {
  return precisionSafeJSON.parse(data) as unknown;
}

/** Axios response transformer for APIs that may return dynamic business data. */
export function transformPrecisionSafeJSONResponse(data: unknown): unknown {
  if (typeof data !== "string" || data.length === 0) {
    return data;
  }

  return parsePrecisionSafeJSON(data);
}
