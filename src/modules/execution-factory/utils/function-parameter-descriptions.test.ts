/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { undescribedInputs } from "./function-parameter-descriptions";

describe("undescribedInputs", () => {
  it("names inputs without a description, nested ones by path", () => {
    expect(
      undescribedInputs([
        { name: "code", type: "string", description: "供应商编码" },
        { name: "min", type: "number", description: "  " },
        {
          name: "filter",
          type: "object",
          description: "筛选",
          sub_parameters: [
            { name: "region", type: "string" },
            { name: "plant", type: "string", description: "工厂" },
          ],
        },
      ]),
    ).toEqual(["min", "filter.region"]);
  });

  it("leaves the element type of a list and the value type of a dict alone", () => {
    expect(
      undescribedInputs([
        { name: "ids", type: "array", description: "编码", sub_parameters: [{ name: "items" }] },
        { name: "map", type: "object", description: "映射", sub_parameters: [{ name: "values" }] },
      ]),
    ).toEqual([]);
  });
});
