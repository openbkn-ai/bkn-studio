/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  objectMetricUnitOptions,
  objectMetricUnitSelectionLocked,
} from "@/modules/knowledge-network/lib/object-metric-unit-catalog";

describe("object metric unit catalog", () => {
  it("offers currencies for amount results", () => {
    const options = objectMetricUnitOptions("amount", "decimal");

    expect(options.map((item) => item.code)).toContain("CNY");
    expect(options.every((item) => item.quantityKind === "currency")).toBe(true);
  });

  it("locks uniquely determined dimensionless units", () => {
    expect(objectMetricUnitOptions("percentage", "decimal").map((item) => item.code)).toEqual([
      "%",
    ]);
    expect(objectMetricUnitSelectionLocked("percentage")).toBe(true);
  });

  it("keeps an existing registered unit visible while editing", () => {
    const options = objectMetricUnitOptions("measure", "decimal", {
      code: "box",
      quantityKind: "custom",
      scaleFactor: 1,
      system: "registered",
    });

    expect(options.at(-1)?.label).toBe("box · 已有单位");
  });

  it.each([
    ["count", "int64", ["1", "item", "order", "person", "record", "occurrence"]],
    ["duration", "duration", ["ms", "s", "min", "h", "d"]],
    ["percentage", "decimal", ["%"]],
    ["ratio", "decimal", ["1"]],
    ["rank", "decimal", ["1"]],
    ["score", "decimal", ["1"]],
  ] as const)("offers only valid %s units", (semanticType, physicalType, expectedCodes) => {
    expect(objectMetricUnitOptions(semanticType, physicalType).map((item) => item.code)).toEqual(
      expectedCodes,
    );
  });

  it("offers every supported measurement family without mixing currency or count", () => {
    const kinds = new Set(
      objectMetricUnitOptions("measure", "decimal").map((item) => item.quantityKind),
    );
    expect(kinds).toEqual(new Set(["dimensionless", "weight", "length", "data_size"]));
  });

  it("does not expose a unit for text, date or boolean semantics", () => {
    expect(objectMetricUnitOptions("category", "string")).toEqual([]);
    expect(objectMetricUnitOptions("date", "date")).toEqual([]);
    expect(objectMetricUnitOptions("boolean", "boolean")).toEqual([]);
  });

  it("does not duplicate a current unit already present in the catalog", () => {
    const options = objectMetricUnitOptions("amount", "decimal", {
      code: "CNY",
      quantityKind: "currency",
      scaleFactor: 1,
      system: "ISO_4217",
    });
    expect(options.filter((item) => item.code === "CNY")).toHaveLength(1);
  });
});
