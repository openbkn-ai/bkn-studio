/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { aliasProblem, aliasRefusalText, cleanAliases } from "./aliases";

const t = ((key: string, options?: object) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

describe("aliases", () => {
  it("trims each alias and leaves out empty ones", () => {
    expect(cleanAliases([" PO ", "", "  ", "Purchase order"])).toEqual(["PO", "Purchase order"]);
    expect(cleanAliases(undefined)).toEqual([]);
  });

  it("says what BKN would refuse before saving, one problem at a time", () => {
    expect(aliasProblem(t, ["PO", "Purchase order"], ["Order"])).toBeNull();
    expect(
      aliasProblem(
        t,
        Array.from({ length: 11 }, (_, i) => `a${i}`),
        [],
      ),
    ).toBe('bknProject.aliases.too_many:{"max":10}');
    // Characters, not UTF-16 units, as BKN counts them.
    expect(aliasProblem(t, ["长".repeat(40)], [])).toBeNull();
    expect(aliasProblem(t, ["长".repeat(41)], [])).toContain("bknProject.aliases.too_long");
    expect(aliasProblem(t, ["订单，单据"], [])).toContain("bknProject.aliases.comma");
    expect(aliasProblem(t, ["PO", " PO"], [])).toContain("bknProject.aliases.repeated");
    expect(aliasProblem(t, ["Order"], [" Order "])).toContain("bknProject.aliases.own_name");
  });

  it("says bkn-project's refusals in business words, naming the other item", () => {
    expect(
      aliasRefusalText(t, {
        alias: "Clients",
        item: "Orders",
        other: "Customers",
        reason: "alias_of_other",
      }),
    ).toBe('bknProject.aliases.alias_of_other:{"alias":"Clients","max":10,"other":"Customers"}');
    expect(aliasRefusalText(t, { reason: "something_new" })).toBe("bknProject.aliases.other");
    expect(aliasRefusalText(t, undefined)).toBe("bknProject.aliases.other");
  });
});
