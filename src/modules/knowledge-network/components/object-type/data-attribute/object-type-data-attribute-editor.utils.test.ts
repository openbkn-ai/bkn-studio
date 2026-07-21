/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

import {
  applyDisplayKeySelection,
  applyPrimaryKeySelection,
  areConnectionsEqual,
  areDataPropertiesEqual,
  areDataSourcesEqual,
  areStringArraysEqualAsSets,
} from "./object-type-data-attribute-editor.utils";

function createProperty(
  overrides: Partial<ObjectTypeDataProperty> & Pick<ObjectTypeDataProperty, "name">,
): ObjectTypeDataProperty {
  return {
    displayKey: false,
    displayName: overrides.displayName ?? overrides.name,
    incrementalKey: false,
    primaryKey: false,
    type: "string",
    ...overrides,
  };
}

describe("areConnectionsEqual", () => {
  it("returns true for identical connection lists", () => {
    const connections = [
      {
        propertyName: "id",
        viewFieldName: "id",
        x1: 1,
        x2: 2,
        y1: 3,
        y2: 4,
      },
    ];

    expect(areConnectionsEqual(connections, [...connections])).toBe(true);
  });

  it("returns false when coordinates differ", () => {
    const left = [
      {
        propertyName: "id",
        viewFieldName: "id",
        x1: 1,
        x2: 2,
        y1: 3,
        y2: 4,
      },
    ];
    const right = [
      {
        propertyName: "id",
        viewFieldName: "id",
        x1: 1,
        x2: 2,
        y1: 3,
        y2: 5,
      },
    ];

    expect(areConnectionsEqual(left, right)).toBe(false);
  });
});

describe("areStringArraysEqualAsSets", () => {
  it("ignores order", () => {
    expect(areStringArraysEqualAsSets(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("detects missing members", () => {
    expect(areStringArraysEqualAsSets(["a", "b"], ["a"])).toBe(false);
  });
});

describe("areDataPropertiesEqual", () => {
  it("returns true when semantic fields match regardless of object identity", () => {
    const left = [
      createProperty({
        displayKey: true,
        mappedField: { displayName: "ID", name: "id", type: "integer" },
        name: "id",
        primaryKey: true,
        type: "integer",
      }),
    ];
    const right = left.map((item) => ({
      ...item,
      incrementalKey: false,
      mappedField: item.mappedField ? { ...item.mappedField } : undefined,
    }));

    expect(areDataPropertiesEqual(left, right)).toBe(true);
  });

  it("returns false when mapped field changes", () => {
    const left = [
      createProperty({
        mappedField: { displayName: "ID", name: "id", type: "integer" },
        name: "id",
        type: "integer",
      }),
    ];
    const right = [
      createProperty({
        mappedField: { displayName: "Code", name: "code", type: "string" },
        name: "id",
        type: "integer",
      }),
    ];

    expect(areDataPropertiesEqual(left, right)).toBe(false);
  });
});

describe("areDataSourcesEqual", () => {
  it("treats undefined pairs as equal", () => {
    expect(areDataSourcesEqual(undefined, undefined)).toBe(true);
  });

  it("compares data source ids and names", () => {
    expect(
      areDataSourcesEqual(
        { dataSourceId: "ds-1", id: "view-1", name: "Orders" },
        { dataSourceId: "ds-1", id: "view-1", name: "Orders" },
      ),
    ).toBe(true);
    expect(
      areDataSourcesEqual(
        { id: "view-1", name: "Orders" },
        { id: "view-2", name: "Orders" },
      ),
    ).toBe(false);
  });
});

describe("applyPrimaryKeySelection", () => {
  it("skips updates when selection is unchanged", () => {
    const properties = [
      createProperty({ name: "id", primaryKey: true, type: "integer" }),
      createProperty({ name: "title", primaryKey: false }),
    ];

    const result = applyPrimaryKeySelection(properties, ["id"]);

    expect(result.changed).toBe(false);
    expect(result.nextProperties).toBe(properties);
  });

  it("marks changed when selection differs", () => {
    const properties = [
      createProperty({ name: "id", primaryKey: true, type: "integer" }),
      createProperty({ name: "code", primaryKey: false, type: "string" }),
    ];

    const result = applyPrimaryKeySelection(properties, ["code"]);

    expect(result.changed).toBe(true);
    expect(result.nextProperties.map((item) => item.primaryKey)).toEqual([false, true]);
  });
});

describe("applyDisplayKeySelection", () => {
  it("skips updates when clearing an already empty display key", () => {
    const properties = [
      createProperty({ name: "id", displayKey: false }),
      createProperty({ name: "title", displayKey: false }),
    ];

    const result = applyDisplayKeySelection(properties, "");

    expect(result.changed).toBe(false);
    expect(result.nextProperties).toBe(properties);
  });

  it("updates only when the display key actually changes", () => {
    const properties = [
      createProperty({ name: "id", displayKey: false }),
      createProperty({ name: "title", displayKey: true }),
    ];

    const result = applyDisplayKeySelection(properties, "id");

    expect(result.changed).toBe(true);
    expect(result.nextProperties.map((item) => item.displayKey)).toEqual([true, false]);
  });
});
