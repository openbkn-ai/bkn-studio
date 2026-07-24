/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { normalizeExecuteDependencies } from "@/modules/execution-factory/services/function.service";

/**
 * 这层规范化写错的代价是后端 400，而 400 会以「运行失败」的形式出现在调试输出里，
 * 排查时很难联想到是依赖字段的形状问题，所以逐条锁住。
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
