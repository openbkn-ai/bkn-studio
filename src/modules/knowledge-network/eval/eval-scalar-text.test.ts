/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";
import { expect, it } from "vitest";
import { evalScalarText } from "./eval-scalar-text";

it("preserves valid zero, false and exact numeric values", () => {
  expect(evalScalarText("物料")).toBe("物料");
  expect(evalScalarText(0)).toBe("0");
  expect(evalScalarText(false)).toBe("false");
  expect(evalScalarText(9007199254740993n)).toBe("9007199254740993");
  expect(evalScalarText(new BigNumber("9007199254740993.25"))).toBe("9007199254740993.25");
});

it.each([undefined, null, {}, [], { id: "hidden" }])("rejects non-scalar metadata: %j", (value) => {
  expect(evalScalarText(value)).toBe("");
});
