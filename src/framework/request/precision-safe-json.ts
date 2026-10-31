/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import JSONBig from "json-bigint";
import BigNumber from "bignumber.js";
import { isLosslessNumber, parse } from "lossless-json";

const precisionPreservingJSON = JSONBig();
const numericLiterals = new WeakMap<BigNumber, string>();

/** Keep the previous numeric/string boundary and preserve extreme exponents. */
function preciseNumber(text: string): number | BigNumber {
  const number = Number(text);
  const exact = new BigNumber(text);
  if (!exact.isFinite() || (exact.isZero() && /[1-9]/.test(text.split(/[eE]/)[0])))
    throw new RangeError("JSON number exceeds the supported precision range.");
  if (text.length > 15 || !Number.isFinite(number) || !exact.isEqualTo(number)) {
    numericLiterals.set(exact, text);
    return exact;
  }
  return number;
}

/** Keep the original JSON spelling for precise values without expanding extreme exponents. */
export function precisionPreservingValueText(value: unknown): string {
  return BigNumber.isBigNumber(value)
    ? (numericLiterals.get(value) ?? String(value))
    : String(value);
}

function parseWithNumbers(data: string, numberValue: (text: string) => unknown): unknown {
  return parse(
    data,
    (key, value) => {
      // Retain json-bigint's existing protection for special object keys.
      if (key === "__proto__" || key === "constructor")
        throw new SyntaxError("Unsupported JSON object key.");
      return isLosslessNumber(value) ? numberValue(value.value) : value;
    },
    { onDuplicateKey: ({ newValue }) => newValue },
  );
}

/** Unsafe numeric literals remain decimal strings; safe numbers keep their type. */
export function parsePrecisionSafeJSON(data: string): unknown {
  return parseWithNumbers(data, (text) => {
    try {
      const value = preciseNumber(text);
      return BigNumber.isBigNumber(value) ? text : value;
    } catch (error) {
      if (error instanceof RangeError) return text;
      throw error;
    }
  });
}

/** Retain numeric literals as numbers or BigNumbers, distinct from quoted strings. */
export function parsePrecisionPreservingJSON(data: string): unknown {
  return parseWithNumbers(data, preciseNumber);
}

/** Pretty-prints JSON while keeping precise numeric literals as JSON numbers. */
export function formatPrecisionSafeJSON(data: string): string {
  return precisionPreservingJSON.stringify(parsePrecisionPreservingJSON(data), null, 2);
}

/** Axios request transformer for bodies containing precise numeric literals. */
export function transformPrecisionSafeJSONRequest(data: unknown): string {
  if (typeof data === "string") return data;
  return precisionPreservingJSON.stringify(data);
}

/** Axios response transformer for APIs that may return dynamic business data. */
export function transformPrecisionSafeJSONResponse(data: unknown): unknown {
  if (typeof data !== "string" || data.length === 0) {
    return data;
  }

  try {
    return parsePrecisionSafeJSON(data);
  } catch {
    // Match Axios' default transformer so non-JSON error bodies do not replace
    // the AxiosError and bypass status-based retry or error handling.
    return data;
  }
}
