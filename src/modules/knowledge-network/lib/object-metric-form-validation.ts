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

export function objectMetricFormIssues(error: unknown): Array<{
  code: string;
  field: string;
  message: string;
}> {
  if (!error || typeof error !== "object" || !("errorFields" in error)) return [];
  const fields = (error as { errorFields?: unknown }).errorFields;
  if (!Array.isArray(fields)) return [];
  return fields
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const field = item as { name?: unknown; errors?: unknown };
      const message = Array.isArray(field.errors)
        ? field.errors.find((value): value is string => typeof value === "string" && !!value.trim())
        : undefined;
      if (!message) return [];
      const name = Array.isArray(field.name)
        ? field.name.filter(
            (part): part is string | number => typeof part === "string" || typeof part === "number",
          )
        : [];
      return [
        {
          code: "form_validation",
          field: name.join(".").slice(0, 200),
          message: message.slice(0, 500),
        },
      ];
    })
    .slice(0, 20);
}
