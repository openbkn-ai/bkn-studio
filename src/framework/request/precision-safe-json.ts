/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import JSONBig from "json-bigint";
import BigNumber from "bignumber.js";
import { isLosslessNumber, parse, stringify } from "lossless-json";

const precisionPreservingJSON = JSONBig();
const numberLiteral = Symbol.for("openbkn.precision-safe-json.number-literal");

type ParsedBigNumber = BigNumber & { readonly [numberLiteral]?: string };
type PrecisionJSONOptions = { allowSpecialKeys?: boolean };
type PrecisionJSONParseOptions = PrecisionJSONOptions & { preserveNumberLiterals?: boolean };

/** Keep the previous numeric/string boundary and preserve extreme exponents. */
function preciseNumber(text: string, preserveNumberLiterals = false): number | BigNumber {
  const number = Number(text);
  const exact = new BigNumber(text);
  if (!exact.isFinite() || (exact.isZero() && /[1-9]/.test(text.split(/[eE]/)[0])))
    throw new RangeError("JSON number exceeds the supported precision range.");
  if (
    text.length > 15 ||
    !Number.isFinite(number) ||
    !exact.isEqualTo(number) ||
    (preserveNumberLiterals && String(number) !== text)
  ) {
    // Keep the spelling with the value across module reloads without adding a JSON property.
    Object.defineProperty(exact, numberLiteral, { value: text });
    return exact;
  }
  return number;
}

/** Keep the original JSON spelling for precise values without expanding extreme exponents. */
export function precisionPreservingValueText(value: unknown): string {
  return BigNumber.isBigNumber(value)
    ? ((value as ParsedBigNumber)[numberLiteral] ?? String(value))
    : String(value);
}

function parseWithNumbers(
  data: string,
  numberValue: (text: string) => unknown,
  { allowSpecialKeys = false }: PrecisionJSONOptions = {},
): unknown {
  return parse(
    data,
    (key, value) => {
      // LosslessJSON stores special keys as own data properties, like JSON.parse.
      // Preserve the existing rejection unless a caller explicitly handles arbitrary JSON data.
      if (!allowSpecialKeys && (key === "__proto__" || key === "constructor"))
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
export function parsePrecisionPreservingJSON(
  data: string,
  options?: PrecisionJSONParseOptions,
): unknown {
  return parseWithNumbers(
    data,
    (text) => preciseNumber(text, options?.preserveNumberLiterals),
    options,
  );
}

/** Pretty-prints JSON while keeping precise numeric literals as JSON numbers. */
export function formatPrecisionSafeJSON(data: string, options?: PrecisionJSONOptions): string {
  return precisionPreservingJSON.stringify(parsePrecisionPreservingJSON(data, options), null, 2);
}

/** Axios request transformer for bodies containing precise numeric literals. */
export function transformPrecisionSafeJSONRequest(data: unknown): string {
  if (typeof data === "string") return data;
  return precisionPreservingJSON.stringify(data);
}

/** Preserve the original number spelling when writing editable request definitions. */
export function transformNumberLiteralJSONRequest(data: unknown): string {
  if (typeof data === "string") return data;
  return (
    stringify(data, undefined, undefined, [
      {
        test: (value) => value instanceof BigNumber && value.isFinite(),
        stringify: precisionPreservingValueText,
      },
    ]) ?? ""
  );
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
