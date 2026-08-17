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
  transformPrecisionSafeJSONResponse,
} from "@/framework/request/precision-safe-json";

describe("precision-safe JSON", () => {
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
      parsePrecisionSafeJSON(
        '{"signed":-9223372036854775808,"unsigned":18446744073709551615}',
      ),
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
      formatPrecisionSafeJSON(
        '{"decimal":0.12345678901234,"unsafeInteger":110101199001152345}',
      ),
    ).toBe(
      '{\n  "decimal": 0.12345678901234,\n  "unsafeInteger": 110101199001152345\n}',
    );
  });
});
