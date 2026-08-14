/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import JSONBig from "json-bigint";

const vegaDynamicDataJSON = JSONBig({ storeAsString: true });

/**
 * Parses Vega's dynamic rows before Axios applies its default JSON parser.
 * Integers treated as precision-sensitive by json-bigint become decimal
 * strings and therefore remain exact for display and request reuse.
 */
export function transformVegaDynamicDataResponse(data: unknown): unknown {
  if (typeof data !== "string" || data.length === 0) {
    return data;
  }

  return vegaDynamicDataJSON.parse(data);
}
