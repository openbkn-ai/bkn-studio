/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { normalizeExecuteDependencies } from "@/modules/execution-factory/services/function.service";

/**
 * Incorrect normalization produces backend 400 that appears as a runtime failure in debug output,
 * making dependency-field shape hard to diagnose, so protect each case explicitly.
 */
describe("normalizeExecuteDependencies", () => {
  it("drops rows without a name, because the panel keeps unfinished placeholders", () => {
    expect(
      normalizeExecuteDependencies([{ name: "" }, { version: "1.0.0" }, { name: "   " }]),
    ).toEqual([]);
  });

  it("omits the version entirely when blank, since `name==` is not a valid pip spec", () => {
    expect(normalizeExecuteDependencies([{ name: "requests", version: "   " }])).toEqual([
      { name: "requests" },
    ]);
    expect(normalizeExecuteDependencies([{ name: "requests" }])).toEqual([{ name: "requests" }]);
  });

  it("trims surrounding whitespace, which the backend would otherwise reject", () => {
    expect(normalizeExecuteDependencies([{ name: " requests ", version: " 2.31.0 " }])).toEqual([
      { name: "requests", version: "2.31.0" },
    ]);
  });

  it("returns an empty list for undefined so the field can be omitted from the body", () => {
    expect(normalizeExecuteDependencies(undefined)).toEqual([]);
  });
});
