/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  mapValueType,
  parseValueTypeReferences,
  toBackendValueTypeInput,
} from "@/modules/knowledge-network/services/mappers/value-type.mapper";

describe("mapValueType", () => {
  it("reads an enum value type and leaves out what it does not declare", () => {
    const valueType = mapValueType({
      base_type: "keyword",
      comment: "Status of a lab order",
      enum: [
        { display: "Applied", value: "applied" },
        { deprecated: true, description: "Before 2024", display: "Paid", value: "paid" },
      ],
      id: "lis_apply_status",
      length: null,
      name: "Lab order status",
      range: null,
      tags: null,
      update_time: 1_700_000_000_000,
      updater: { id: "u-1", name: "Admin" },
    });

    expect(valueType).toMatchObject({
      baseType: "keyword",
      description: "Status of a lab order",
      enum: [
        { display: "Applied", value: "applied" },
        { deprecated: true, description: "Before 2024", display: "Paid", value: "paid" },
      ],
      id: "lis_apply_status",
      name: "Lab order status",
      tags: [],
      updaterName: "Admin",
    });
    expect(valueType).not.toHaveProperty("range");
    expect(valueType).not.toHaveProperty("length");
  });

  it("reads range and length bounds, dropping one of the wrong shape", () => {
    expect(
      mapValueType({
        base_type: "decimal",
        id: "amount_cny",
        range: { max: null, min: 0 },
        unit: "CNY",
      }),
    ).toMatchObject({ name: "amount_cny", range: { min: 0 }, unit: "CNY" });
    expect(
      mapValueType({ base_type: "string", id: "cn_id_card", length: { max: 18, min: 18 } }).length,
    ).toEqual({ max: 18, min: 18 });
    expect(mapValueType({ base_type: "string", id: "x", length: { min: 1.5 } })).not.toHaveProperty(
      "length",
    );
  });

  it("keeps a base type it does not know as the backend names it", () => {
    expect(mapValueType({ base_type: "geo", id: "x" }).baseType).toBe("geo");
    expect(mapValueType({ id: "x" }).baseType).toBe("string");
  });
});

describe("toBackendValueTypeInput", () => {
  it("writes the value type whole, with the fields it does not declare left out", () => {
    expect(
      toBackendValueTypeInput({
        baseType: "keyword",
        description: "",
        enum: [{ deprecated: true, display: "Paid", value: "paid" }],
        icon: "tag",
        id: "lis_apply_status",
        name: "Lab order status",
        tags: ["lab"],
      }),
    ).toEqual({
      base_type: "keyword",
      comment: "",
      enum: [{ deprecated: true, display: "Paid", value: "paid" }],
      icon: "tag",
      id: "lis_apply_status",
      name: "Lab order status",
      tags: ["lab"],
    });
  });

  it("leaves out the ID of a new value type without one, for the backend to make", () => {
    expect(
      toBackendValueTypeInput({ baseType: "decimal", description: "", name: "Amount", tags: [] }),
    ).not.toHaveProperty("id");
  });
});

describe("parseValueTypeReferences", () => {
  it("reads the properties that still name a value type", () => {
    expect(
      parseValueTypeReferences({
        reason: "referenced",
        references: [
          {
            object_type_id: "lab_order",
            object_type_name: "Lab order",
            property: "fee",
            property_type: "decimal",
          },
          { object_type_id: "invoice", property: "total" },
          { property: "orphan" },
          "bad",
        ],
      }),
    ).toEqual([
      {
        objectTypeId: "lab_order",
        objectTypeName: "Lab order",
        property: "fee",
        propertyType: "decimal",
      },
      { objectTypeId: "invoice", objectTypeName: "invoice", property: "total", propertyType: "" },
    ]);
  });

  it.each([undefined, "referenced", { references: "lab_order" }])(
    "reads %j as no references",
    (details) => {
      expect(parseValueTypeReferences(details)).toEqual([]);
    },
  );
});
