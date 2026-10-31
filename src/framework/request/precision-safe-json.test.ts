/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  formatPrecisionSafeJSON,
  parsePrecisionSafeJSON,
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
  transformPrecisionSafeJSONResponse,
} from "@/framework/request/precision-safe-json";

describe("precision-safe JSON", () => {
  it("keeps an already serialized request body unchanged on retry", () => {
    const first = transformPrecisionSafeJSONRequest({ need_total: true });
    expect(transformPrecisionSafeJSONRequest(first)).toBe(first);
  });

  it("preserves an unsafe BIGINT as a decimal string", () => {
    expect(
      transformPrecisionSafeJSONResponse(
        '{"entries":[{"id_card":110101199001152345,"safe_id":42}]}',
      ),
    ).toEqual({
      entries: [{ id_card: "110101199001152345", safe_id: 42 }],
    });
  });

  it("preserves signed and unsigned 64-bit boundaries as decimal strings", () => {
    expect(
      parsePrecisionSafeJSON('{"signed":-9223372036854775808,"unsigned":18446744073709551615}'),
    ).toEqual({
      signed: "-9223372036854775808",
      unsigned: "18446744073709551615",
    });
  });

  it("leaves an empty response unchanged", () => {
    expect(transformPrecisionSafeJSONResponse("")).toBe("");
  });

  it("leaves a non-JSON error response unchanged for Axios error handling", () => {
    const gatewayError = "<html><body>Bad Gateway</body></html>";

    expect(transformPrecisionSafeJSONResponse(gatewayError)).toBe(gatewayError);
  });

  it("formats precise numeric literals without changing their JSON type", () => {
    expect(
      formatPrecisionSafeJSON('{"decimal":0.12345678901234,"unsafeInteger":110101199001152345}'),
    ).toBe('{\n  "decimal": 0.12345678901234,\n  "unsafeInteger": 110101199001152345\n}');
  });
});

describe("Decimal exponent preservation", () => {
  it.each([
    "1e-10000001",
    "-1e-10000001",
    "1e10000001",
    "-1e10000001",
    "1e-1000000000",
    "-1e-1000000000",
    "1e1000000000",
    "-1e1000000000",
  ])("preserves %s for display and rejects it for numeric serialization", (literal) => {
    const raw = `{"value":${literal}}`;
    expect(parsePrecisionSafeJSON(raw)).toEqual({ value: literal });
    expect(transformPrecisionSafeJSONResponse(raw)).toEqual({ value: literal });
    expect(() => parsePrecisionPreservingJSON(raw)).toThrow(RangeError);
    expect(() => formatPrecisionSafeJSON(raw)).toThrow(RangeError);
  });

  it("keeps zero coefficients valid even with an extreme exponent", () => {
    expect(transformPrecisionSafeJSONRequest(parsePrecisionPreservingJSON("0e-1000000000"))).toBe(
      "0",
    );
  });

  it.each(["1e-10000000", "1e10000000"])(
    "retains a nonzero value at the supported exponent boundary: %s",
    (literal) => {
      const serialized = transformPrecisionSafeJSONRequest(parsePrecisionPreservingJSON(literal));
      expect(serialized.replace("e+", "e")).toBe(literal);
    },
  );

  it("reads extreme and subnormal numeric literals without changing their value", () => {
    expect(
      parsePrecisionSafeJSON(
        '{"tiny":1e-1000,"big":1e309,"subnormal":4e-324,"integer":42,"quoted":"1e309"}',
      ),
    ).toEqual({ tiny: "1e-1000", big: "1e309", subnormal: "4e-324", integer: 42, quoted: "1e309" });
  });
  it("formats extreme numbers as numeric literals", () => {
    expect(formatPrecisionSafeJSON('{"tiny":1e-1000,"big":1e309}')).toBe(
      '{\n  "tiny": 1e-1000,\n  "big": 1e+309\n}',
    );
  });
  it.each(["__proto__", "constructor"])("retains the existing rejection of %s keys", (key) => {
    expect(() => parsePrecisionSafeJSON(`{"${key}":{"polluted":true}}`)).toThrow();
  });
});
