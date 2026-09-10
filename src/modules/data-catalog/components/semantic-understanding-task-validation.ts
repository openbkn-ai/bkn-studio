/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const MIN_SEMANTIC_UNDERSTANDING_SAMPLE_ROWS = 1;
export const MAX_SEMANTIC_UNDERSTANDING_SAMPLE_ROWS = 20;

export function isValidSemanticUnderstandingSampleRows(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SEMANTIC_UNDERSTANDING_SAMPLE_ROWS &&
    value <= MAX_SEMANTIC_UNDERSTANDING_SAMPLE_ROWS;
}

export function parseSemanticUnderstandingSampleRowsInput(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
