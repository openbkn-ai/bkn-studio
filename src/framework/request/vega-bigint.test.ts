/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { transformVegaDynamicDataResponse } from "@/framework/request/vega-bigint";

describe("transformVegaDynamicDataResponse", () => {
  it("preserves an unsafe BIGINT as a decimal string", () => {
    expect(
      transformVegaDynamicDataResponse(
        '{"entries":[{"id_card":110101199001152345,"safe_id":42}]}',
      ),
    ).toEqual({
      entries: [{ id_card: "110101199001152345", safe_id: 42 }],
    });
  });

  it("preserves signed and unsigned 64-bit boundaries as decimal strings", () => {
    expect(
      transformVegaDynamicDataResponse(
        '{"signed":-9223372036854775808,"unsigned":18446744073709551615}',
      ),
    ).toEqual({
      signed: "-9223372036854775808",
      unsigned: "18446744073709551615",
    });
  });

  it("leaves an empty response unchanged", () => {
    expect(transformVegaDynamicDataResponse("")).toBe("");
  });
});
