/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";
import JSONBig from "json-bigint";

import { transformPrecisionSafeJSONRequest } from "@/framework/request/precision-safe-json";

const preservingJSON = JSONBig();
// Accept the decimal forms previously handled by Number(), then normalize them
// through BigNumber before they reach the JSON wire contract. This keeps UI
// inputs such as 007, +1, .5, and 1. compatible without emitting invalid JSON.
const numericInput = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const int64Minimum = new BigNumber("-9223372036854775808");
const int64Maximum = new BigNumber("9223372036854775807");
// Duration values are numeric quantities in the object-metric API, not ISO-8601 text.
const numericTypes = new Set(["int64", "decimal", "duration"]);

/** Keep values requiring more than JavaScript's number precision as BigNumber values. */
export function parseObjectMetricNumericInput(value: string): number | BigNumber | undefined {
  const text = value.trim();
  if (!numericInput.test(text)) return undefined;
  const exact = new BigNumber(text);
  if (!exact.isFinite()) return undefined;
  const ordinary = Number(text);
  return Number.isFinite(ordinary) && new BigNumber(String(ordinary)).isEqualTo(exact)
    ? ordinary
    : exact;
}

/** Explain why a valid numeric input cannot be used as a signed 64-bit integer. */
export function objectMetricInt64InputError(
  value: string,
): "not_integer" | "out_of_range" | undefined {
  const exact = new BigNumber(value.trim());
  if (!exact.isInteger()) return "not_integer";
  if (exact.isLessThan(int64Minimum) || exact.isGreaterThan(int64Maximum)) return "out_of_range";
  return undefined;
}

/** Authoring state keeps ordinary numbers unchanged and precise values as text. */
export function objectMetricAuthoringNumericValue(value: string): number | string | undefined {
  const parsed = parseObjectMetricNumericInput(value);
  return typeof parsed === "number"
    ? parsed
    : parsed === undefined
      ? undefined
      : preservingJSON.stringify(parsed);
}

export function formatObjectMetricNumericInput(value: unknown): string {
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (value === null || value === undefined) return "";
  return preservingJSON.stringify(value);
}

function restoreNumericLiterals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreNumericLiterals);
  if (value === null || typeof value !== "object") return value;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const original = value as Record<string, unknown>;
  const restored = Object.fromEntries(
    Object.entries(original).map(([key, entry]) => [key, restoreNumericLiterals(entry)]),
  );
  if (
    (restored.node_type === "literal" || restored.source === "literal") &&
    typeof restored.value_type === "string" &&
    numericTypes.has(restored.value_type) &&
    typeof restored.value === "string"
  ) {
    restored.value = parseObjectMetricNumericInput(restored.value) ?? restored.value;
  }
  return restored;
}

/** Serialize typed metric literals as numbers, even after a response parsed them as strings. */
export function serializeObjectMetricBody(
  value: unknown,
  headers?: { set(name: string, value: string): unknown },
): string {
  headers?.set("Content-Type", "application/json");
  return transformPrecisionSafeJSONRequest(restoreNumericLiterals(value));
}
