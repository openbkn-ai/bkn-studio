/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { OperatorExecuteControl, OperatorRecord } from "@/modules/execution-factory/types/operator";

import { formatExecutionUnitTime } from "./format-timestamp";

export { formatExecutionUnitTime };

export function resolveOperatorCategoryLabel(
  record: Pick<OperatorRecord, "category" | "categoryName">,
  t: (key: string) => string,
) {
  if (record.category) {
    const key = `executionFactory.operatorCategories.${record.category}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return record.categoryName ?? record.category ?? "-";
}

export function resolveToolboxCategoryLabel(
  record: { categoryName?: string; categoryType?: string },
  t: (key: string) => string,
) {
  if (record.categoryType) {
    const key = `executionFactory.toolboxCategories.${record.categoryType}`;
    const translated = t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return record.categoryName ?? record.categoryType ?? "-";
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

export function resolveMcpCategoryLabel(
  category: string | undefined,
  t: (key: string) => string,
) {
  if (!category) {
    return "-";
  }

  const operatorKey = `executionFactory.operatorCategories.${category}`;
  const operatorLabel = t(operatorKey);
  if (operatorLabel !== operatorKey) {
    return operatorLabel;
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

export function formatExecuteControlDisplay(
  control: OperatorExecuteControl | undefined,
  t: (key: string) => string,
) {
  if (!control) {
    return "-";
  }

  const parts = [
    control.timeout !== undefined
      ? `${t("executionFactory.executeControlTimeout")}: ${control.timeout}ms`
      : null,
    control.retryPolicy?.maxAttempts !== undefined
      ? `${t("executionFactory.executeControlMaxAttempts")}: ${control.retryPolicy.maxAttempts}`
      : null,
    control.retryPolicy?.initialDelay !== undefined
      ? `${t("executionFactory.executeControlInitialDelay")}: ${control.retryPolicy.initialDelay}ms`
      : null,
    control.retryPolicy?.maxDelay !== undefined
      ? `${t("executionFactory.executeControlMaxDelay")}: ${control.retryPolicy.maxDelay}ms`
      : null,
    control.retryPolicy?.backoffFactor !== undefined
      ? `${t("executionFactory.executeControlBackoffFactor")}: ${control.retryPolicy.backoffFactor}`
      : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "-";
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
