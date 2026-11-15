/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";

/** A field value is JSON data; unlike an HTTP body string it must be quoted. */
export function jsonValueText(value: unknown): string {
  return typeof value === "string"
    ? JSON.stringify(value)
    : transformPrecisionSafeJSONRequest(value);
}
