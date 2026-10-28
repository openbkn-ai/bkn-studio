/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { formatExecutionUnitTime } from "./format-timestamp";

export { formatExecutionUnitTime };

export function resolveToolboxCategoryLabel(
  record: { categoryName?: string; categoryType?: string },
  t: (key: string) => string,
) {
  if (record.categoryType) {
    // Shared predefined categories, alongside toolbox-only ones.
    for (const dictionary of ["toolboxCategories", "categoryLabels"]) {
      const key = `executionFactory.${dictionary}.${record.categoryType}`;
      const translated = t(key);
      if (translated !== key) {
        return translated;
      }
    }
  }

  return record.categoryName ?? record.categoryType ?? "-";
}

export function localizeCategoryOptions(
  options: ReadonlyArray<{ value: string; label: string }>,
  t: (key: string) => string,
) {
  return options.map((item) => ({
    ...item,
    label: resolveToolboxCategoryLabel({ categoryType: item.value, categoryName: item.label }, t),
  }));
}

export function resolveSkillCategoryLabel(
  record: { category?: string; categoryName?: string },
  t: (key: string) => string,
) {
  if (record.category) {
    const key = `executionFactory.skillCategories.${record.category}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return record.categoryName ?? record.category ?? "-";
}

export function resolveMcpCategoryLabel(category: string | undefined, t: (key: string) => string) {
  if (!category) {
    return "-";
  }

  const key = `executionFactory.categoryLabels.${category}`;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }

  return category;
}

export function resolveMcpCreationTypeLabel(
  creationType: string | undefined,
  t: (key: string) => string,
) {
  if (!creationType) {
    return "-";
  }

  const key = `executionFactory.mcpCreationTypes.${creationType}`;
  const translated = t(key);
  return translated !== key ? translated : creationType;
}

export function formatOptionalTimestamp(value?: number) {
  return formatExecutionUnitTime(value);
}

export function formatRecordHeaders(headers?: Record<string, string>) {
  if (!headers || Object.keys(headers).length === 0) {
    return "-";
  }

  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
