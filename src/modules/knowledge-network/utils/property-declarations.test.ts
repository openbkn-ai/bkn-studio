/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type {
  ObjectTypeDataProperty,
  PropertyDeclarations,
  ValueType,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  aliasProblem,
  arePropertyDeclarationsEqual,
  checkPropertyDeclarations,
  constraintFieldsForType,
  enumValueFits,
  enumValueKey,
  fitDeclarationsToType,
  isRangeReversed,
  isTimezoneName,
  normalizeDeclarations,
  rangeBoundFits,
  semanticHolders,
  semanticsForType,
  valueTypeKind,
  valueTypesForPropertyType,
  withValueType,
} from "@/modules/knowledge-network/utils/property-declarations";

const valueType = (id: string, baseType: ValueType["baseType"], rest: Partial<ValueType> = {}) =>
  ({
    baseType,
    description: "",
    id,
    name: id,
    tags: [],
    updateTime: "-",
    updaterName: "-",
    ...rest,
  }) satisfies ValueType;

const property = (
  name: string,
  type: string,
  declarations?: PropertyDeclarations,
  displayName = name,
): ObjectTypeDataProperty => ({
  declarations,
  displayKey: false,
  displayName,
  incrementalKey: false,
  name,
  primaryKey: false,
  type,
});

describe("semanticsForType", () => {
  it.each([
    ["datetime", ["event_time", "end_time", "valid_from", "valid_to"]],
    ["Timestamp", ["event_time", "end_time", "valid_from", "valid_to"]],
    ["point", ["location"]],
    ["float", ["latitude", "longitude"]],
    ["keyword", ["status", "severity"]],
    ["integer", ["status", "severity"]],
    ["boolean", []],
    [undefined, []],
  ])("offers the semantics a %s property can declare", (type, semantics) => {
    expect(semanticsForType(type)).toEqual(semantics);
  });
});

describe("constraintFieldsForType", () => {
  it("offers a range, a unit and uniqueness to a number", () => {
    expect(constraintFieldsForType("decimal")).toEqual({
      length: false,
      pattern: false,
      range: "number",
      timezone: false,
      unique: true,
      unit: true,
    });
  });

  it("offers a length and a pattern to text", () => {
    expect(constraintFieldsForType("string")).toMatchObject({
      length: true,
      pattern: true,
      range: null,
      unit: false,
    });
  });

  it("writes a date range as dates and a datetime range as times, with a time zone only for datetime", () => {
    expect(constraintFieldsForType("date")).toMatchObject({ range: "date", timezone: false });
    expect(constraintFieldsForType("datetime")).toMatchObject({
      range: "datetime",
      timezone: true,
    });
    expect(constraintFieldsForType("timestamp")).toMatchObject({
      range: "datetime",
      timezone: false,
    });
  });

  it.each(["json", "binary", "vector", "point", "shape", ""])(
    "does not offer uniqueness to %s",
    (type) => {
      expect(constraintFieldsForType(type).unique).toBe(false);
    },
  );
});

describe("range bounds", () => {
  it.each([
    ["number", 1, true],
    ["number", "1", false],
    ["number", Number.POSITIVE_INFINITY, false],
    ["date", "2026-01-31", true],
    ["date", "2026-01-31T00:00:00Z", false],
    ["date", "2026-13-01", false],
    ["datetime", "2026-01-31T08:00:00+08:00", true],
    ["datetime", "2026-01-31T08:00:00.5Z", true],
    ["datetime", "2026-01-31T08:00:00", false],
    ["datetime", "2026-01-31", false],
  ] as const)("reads %s bound %s as fitting: %s", (kind, bound, fits) => {
    expect(rangeBoundFits(kind, bound)).toBe(fits);
  });

  it("finds a reversed range only when both bounds fit", () => {
    expect(isRangeReversed("number", { max: 1, min: 2 })).toBe(true);
    expect(isRangeReversed("number", { max: 2, min: 2 })).toBe(false);
    expect(isRangeReversed("number", { min: 2 })).toBe(false);
    expect(
      isRangeReversed("datetime", {
        max: "2026-01-01T00:00:00Z",
        min: "2026-01-01T08:00:00+08:00",
      }),
    ).toBe(false);
    expect(
      isRangeReversed("datetime", {
        max: "2026-01-01T00:00:00Z",
        min: "2026-01-01T09:00:00+08:00",
      }),
    ).toBe(true);
    expect(isRangeReversed("date", { max: "2026-01-01", min: "bad" })).toBe(false);
  });
});

describe("isTimezoneName", () => {
  it("accepts an IANA name and refuses Local, empty text and unknown names", () => {
    expect(isTimezoneName("Asia/Shanghai")).toBe(true);
    expect(isTimezoneName("UTC")).toBe(true);
    expect(isTimezoneName("Local")).toBe(false);
    expect(isTimezoneName("")).toBe(false);
    expect(isTimezoneName("Mars/Olympus")).toBe(false);
  });
});

describe("normalizeDeclarations", () => {
  it("drops what declares nothing, so an undeclared property has no declarations", () => {
    expect(
      normalizeDeclarations({
        aliases: [" ", ""],
        constraints: {
          length: { max: undefined, min: undefined },
          passthrough: {},
          range: { max: undefined },
          unique: false,
          unit: "  ",
          valueType: "",
        },
        required: false,
      }),
    ).toBeUndefined();
  });

  it("keeps the declarations and trims the aliases, unit and time zone", () => {
    expect(
      normalizeDeclarations({
        aliases: [" Order number ", ""],
        constraints: { range: { min: 0 }, timezone: " Asia/Shanghai ", unit: " CNY " },
        required: true,
        semantic: "status",
      }),
    ).toEqual({
      aliases: ["Order number"],
      constraints: { range: { min: 0 }, timezone: "Asia/Shanghai", unit: "CNY" },
      required: true,
      semantic: "status",
    });
  });

  it("compares two declarations whatever order their keys came in", () => {
    expect(
      arePropertyDeclarationsEqual(
        { constraints: { range: { max: 9, min: 1 }, unique: true } },
        { constraints: { unique: true, range: { min: 1, max: 9 } }, required: false },
      ),
    ).toBe(true);
    expect(arePropertyDeclarationsEqual({ aliases: ["a", "b"] }, { aliases: ["b", "a"] })).toBe(
      false,
    );
  });
});

describe("fitDeclarationsToType", () => {
  const amount = valueType("amount_cny", "decimal", { range: { min: 0 }, unit: "CNY" });

  it("clears what a new type cannot declare and names it", () => {
    const result = fitDeclarationsToType(
      {
        aliases: ["Amount"],
        constraints: { range: { max: 100, min: 0 }, unique: true, unit: "CNY" },
        required: true,
        semantic: "latitude",
      },
      "string",
      [],
    );

    expect(result.cleared).toEqual(["semantic", "range", "unit"]);
    expect(result.declarations).toEqual({
      aliases: ["Amount"],
      constraints: { unique: true },
      required: true,
    });
  });

  it("clears a value type of another base type, and keeps one the list does not hold", () => {
    expect(
      fitDeclarationsToType({ constraints: { valueType: "amount_cny" } }, "integer", [amount]),
    ).toEqual({ cleared: ["valueType"], declarations: undefined });
    expect(
      fitDeclarationsToType({ constraints: { valueType: "missing" } }, "integer", [amount]),
    ).toEqual({ cleared: [], declarations: { constraints: { valueType: "missing" } } });
  });

  it("clears a range whose bounds the new type writes another way", () => {
    expect(
      fitDeclarationsToType({ constraints: { range: { min: "2026-01-01" } } }, "datetime", [])
        .cleared,
    ).toEqual(["range"]);
    expect(
      fitDeclarationsToType(
        { constraints: { range: { min: "2026-01-01T00:00:00Z" } } },
        "timestamp",
        [],
      ).cleared,
    ).toEqual([]);
  });

  it("clears the crs and time zone once they no longer apply", () => {
    expect(
      fitDeclarationsToType({ constraints: { crs: "wgs84" }, semantic: "latitude" }, "integer", []),
    ).toEqual({ cleared: ["semantic", "crs"], declarations: undefined });
    expect(
      fitDeclarationsToType({ constraints: { timezone: "Asia/Shanghai" } }, "date", []).cleared,
    ).toEqual(["timezone"]);
  });

  it("keeps everything a type change leaves valid", () => {
    const declarations: PropertyDeclarations = {
      constraints: { range: { min: 0 }, unique: true },
      semantic: "severity",
    };
    expect(fitDeclarationsToType(declarations, "integer", [])).toEqual({
      cleared: [],
      declarations,
    });
  });
});

describe("withValueType", () => {
  it("drops the inline rules a value type now holds and keeps the rest", () => {
    expect(
      withValueType(
        {
          crs: "wgs84",
          length: { max: 3 },
          passthrough: { future: 1 },
          pattern: "^a",
          range: { min: 0 },
          unique: true,
          unit: "CNY",
        },
        "amount_cny",
      ),
    ).toEqual({ crs: "wgs84", passthrough: { future: 1 }, unique: true, valueType: "amount_cny" });
  });

  it("removes the value type alone when none is chosen", () => {
    expect(withValueType({ unique: true, valueType: "amount_cny" }, undefined)).toEqual({
      unique: true,
    });
    expect(withValueType({ valueType: "amount_cny" }, undefined)).toBeUndefined();
  });
});

describe("aliasProblem", () => {
  const others = [property("patient_name", "string", undefined, "Patient")];

  it.each([
    [["a", "b"], null],
    [Array.from({ length: 11 }, (_, index) => `alias ${index}`), "tooMany"],
    [["  "], "empty"],
    [["a,b"], "comma"],
    [["a，b"], "comma"],
    [["x".repeat(41)], "tooLong"],
    [["a", "a"], "duplicate"],
    [["order_id"], "ownName"],
    [["Order"], "ownName"],
    [["patient_name"], "otherProperty"],
    [["Patient"], "otherProperty"],
  ])("finds %j to be %s", (aliases, key) => {
    expect(aliasProblem(aliases, ["order_id", "Order"], others)?.key ?? null).toBe(key);
  });

  it("counts an alias by its characters, not its UTF-16 units", () => {
    expect(aliasProblem(["\u{1F600}".repeat(40)], [], [])).toBeNull();
  });

  it("names the property an alias belongs to", () => {
    expect(aliasProblem(["Patient"], [], others)).toEqual({
      key: "otherProperty",
      params: { alias: "Patient", property: "patient_name" },
    });
  });
});

describe("checkPropertyDeclarations", () => {
  it("finds nothing in a consistent object type", () => {
    expect(
      checkPropertyDeclarations([
        property("ordered_at", "datetime", { semantic: "event_time" }),
        property("finished_at", "datetime", { semantic: "end_time" }),
        property("lat", "float", { constraints: { crs: "wgs84" }, semantic: "latitude" }),
        property("lon", "float", { constraints: { crs: "wgs84" }, semantic: "longitude" }),
        property("status", "keyword", { aliases: ["State"] }),
      ]),
    ).toEqual([]);
  });

  it("names the second property that takes a semantic, and the one holding it", () => {
    expect(
      checkPropertyDeclarations([
        property("a", "keyword", { semantic: "status" }),
        property("b", "keyword", { semantic: "status" }),
      ]),
    ).toEqual([{ key: "semanticTaken", params: { semantic: "status" }, properties: ["b", "a"] }]);
  });

  it("finds an end time without an event time and a coordinate without its pair", () => {
    expect(
      checkPropertyDeclarations([
        property("finished_at", "datetime", { semantic: "end_time" }),
        property("lat", "float", { semantic: "latitude" }),
      ]).map((issue) => issue.key),
    ).toEqual(["endTimeWithoutEventTime", "latitudeWithoutLongitude"]);
    expect(
      checkPropertyDeclarations([property("lon", "float", { semantic: "longitude" })]).map(
        (issue) => issue.key,
      ),
    ).toEqual(["longitudeWithoutLatitude"]);
  });

  it("finds a location next to coordinates, and coordinates in two systems", () => {
    expect(
      checkPropertyDeclarations([
        property("place", "point", { semantic: "location" }),
        property("lat", "float", { constraints: { crs: "wgs84" }, semantic: "latitude" }),
        property("lon", "float", { constraints: { crs: "gcj02" }, semantic: "longitude" }),
      ]),
    ).toEqual([
      { key: "locationWithCoordinates", properties: ["place", "lat"] },
      {
        key: "crsMismatch",
        params: { latitude: "wgs84", longitude: "gcj02" },
        properties: ["lon", "lat"],
      },
    ]);
  });

  it("finds an alias that is the name or display name of another property", () => {
    expect(
      checkPropertyDeclarations([
        property("a", "string", { aliases: ["Patient"] }),
        property("patient_name", "string", undefined, "Patient"),
      ]),
    ).toEqual([
      {
        key: "aliasTaken",
        params: { alias: "Patient", property: "patient_name" },
        properties: ["a", "patient_name"],
      },
    ]);
  });
});

describe("semanticHolders", () => {
  it("leaves out the property being edited", () => {
    const holders = semanticHolders(
      [
        property("a", "keyword", { semantic: "status" }),
        property("b", "datetime", { semantic: "event_time" }),
      ],
      "a",
    );
    expect([...holders.keys()]).toEqual(["event_time"]);
  });
});

describe("value types", () => {
  it("offers a property only the value types of its own type", () => {
    const list = [valueType("a", "decimal"), valueType("b", "string")];
    expect(valueTypesForPropertyType(list, "Decimal").map((item) => item.id)).toEqual(["a"]);
  });

  it("names the kind of a value type by its rules", () => {
    expect(valueTypeKind({ enum: [{ display: "A", value: "a" }], pattern: "^a" })).toBe("enum");
    expect(valueTypeKind({ length: { max: 18 } })).toBe("format");
    expect(valueTypeKind({ range: { min: 0 }, unit: "CNY" })).toBe("range");
    expect(valueTypeKind({ unit: "CNY" })).toBe("unit");
    expect(valueTypeKind({})).toBeUndefined();
  });

  it.each([
    ["integer", "-3", true],
    ["integer", "1.5", false],
    ["unsigned integer", "-3", false],
    ["decimal", "1.50", true],
    ["float", "1e3", true],
    ["float", "abc", false],
    ["date", "2026-01-31", true],
    ["datetime", "2026-01-31", false],
    ["keyword", "anything", true],
  ])("reads enum code %s %s as fitting: %s", (baseType, value, fits) => {
    expect(enumValueFits(baseType, value)).toBe(fits);
  });

  it("compares enum codes as values of the base type", () => {
    expect(enumValueKey("decimal", "1")).toBe(enumValueKey("decimal", "1.0"));
    expect(enumValueKey("datetime", "2026-01-01T08:00:00+08:00")).toBe(
      enumValueKey("datetime", "2026-01-01T00:00:00Z"),
    );
    expect(enumValueKey("keyword", "A")).not.toBe(enumValueKey("keyword", "a"));
  });
});
