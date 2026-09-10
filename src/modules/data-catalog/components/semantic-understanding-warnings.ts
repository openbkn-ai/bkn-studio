/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";

type WarningDetail = {
  code?: unknown;
  params?: {
    field_name?: unknown;
    field_type?: unknown;
  };
};

type PolicyOmission = {
  fieldName: string;
  fieldType: string;
};

const WARNING_FIELD_TYPE_KEYS: Record<string, string> = {
  binary: "dataCatalog.taskManagement.semantic.warnings.types.binary",
  other: "dataCatalog.taskManagement.semantic.warnings.types.other",
};

function jsonObject(value?: string): Record<string, unknown> | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function parsePolicyOmissions(value: unknown): PolicyOmission[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const detail = item as WarningDetail;
    const fieldName = detail.params?.field_name;
    const fieldType = detail.params?.field_type;
    return detail.code === "sample_omitted_by_policy"
      && typeof fieldName === "string"
      && fieldName.length > 0
      && typeof fieldType === "string"
      ? [{ fieldName, fieldType }]
      : [];
  });
}

export function getSemanticUnderstandingWarnings(
  t: TFunction,
  ...payloads: Array<string | undefined>
): string[] {
  const objects = payloads.map(jsonObject).filter((value) => value !== undefined);
  const omissions = objects.flatMap((object) => parsePolicyOmissions(object.warning_details));
  const messages = omissions.map(({ fieldName, fieldType }) => {
    const typeKey = WARNING_FIELD_TYPE_KEYS[fieldType];
    const localizedType = typeKey ? String(t(typeKey)) : fieldType;
    return String(t(
      "dataCatalog.taskManagement.semantic.warnings.sampleOmittedByPolicy",
      { field: fieldName, type: localizedType },
    ));
  });

  for (const object of objects) {
    if (!Array.isArray(object.warnings)) continue;
    for (const warning of object.warnings) {
      if (typeof warning === "string") {
        messages.push(warning);
      }
    }
  }
  return [...new Set(messages)];
}
