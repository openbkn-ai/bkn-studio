/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export function objectMetricFormErrorCount(error: unknown): number {
  if (!error || typeof error !== "object" || !("errorFields" in error)) return 0;
  const errorFields = (error as { errorFields?: unknown }).errorFields;
  if (!Array.isArray(errorFields)) return 0;
  return errorFields.filter(
    (field) =>
      field &&
      typeof field === "object" &&
      "errors" in field &&
      Array.isArray((field as { errors?: unknown }).errors) &&
      (field as { errors: unknown[] }).errors.length > 0,
  ).length;
}
