/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildBackendObjectTypePayload,
  mapDataProperty,
  toBackendDataProperty,
} from "@/modules/knowledge-network/services/mappers";
import type { BackendDataProperty } from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapPropertyConstraints,
  mapPropertyDeclarations,
  propertyDeclarationPatch,
  toBackendPropertyConstraints,
} from "@/modules/knowledge-network/services/mappers/declarations";
import type {
  KnowledgeNetworkObjectTypeMutationPayload,
  ObjectTypeDataProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

const meta = { displayKey: "", primaryKeys: ["order_no"] };

// The data properties of lab_order in the clinic-lab sample, as the backend returns them.
const labOrderProperties: BackendDataProperty[] = [
  {
    aliases: ["Barcode"],
    constraints: { pattern: "^LO\\d{10}$", unique: true },
    name: "order_no",
    type: "string",
  },
  { constraints: { value_type: "cn_id_card" }, name: "patient_id_card", type: "string" },
  { name: "doctor_id", required: true, type: "string" },
  {
    aliases: ["Applied at"],
    constraints: { timezone: "Asia/Shanghai" },
    name: "ordered_at",
    required: true,
    semantic: "event_time",
    type: "datetime",
  },
  {
    constraints: { value_type: "lis_apply_status" },
    name: "status",
    required: true,
    semantic: "status",
    type: "keyword",
  },
  {
    aliases: ["Lab fee"],
    constraints: { value_type: "amount_cny" },
    name: "fee",
    type: "decimal",
  },
  { name: "updated_at", type: "datetime" },
];

const DECLARATION_KEYS = ["aliases", "constraints", "required", "semantic"];

describe("mapPropertyDeclarations", () => {
  it("reads the declarations of each clinic-lab property", () => {
    const declarations = labOrderProperties.map((item) => mapPropertyDeclarations(item));

    expect(declarations).toEqual([
      { aliases: ["Barcode"], constraints: { pattern: "^LO\\d{10}$", unique: true } },
      { constraints: { valueType: "cn_id_card" } },
      { required: true },
      {
        aliases: ["Applied at"],
        constraints: { timezone: "Asia/Shanghai" },
        required: true,
        semantic: "event_time",
      },
      { constraints: { valueType: "lis_apply_status" }, required: true, semantic: "status" },
      { aliases: ["Lab fee"], constraints: { valueType: "amount_cny" } },
      undefined,
    ]);
  });

  it.each<[string, BackendDataProperty]>([
    ["nulls", { aliases: null, constraints: null, name: "a", required: null, semantic: null }],
    ["empty values", { aliases: [], constraints: {}, name: "a", required: false, semantic: "" }],
    ["a semantic it does not know", { name: "a", semantic: "future_semantic" }],
  ])("reads %s as no declarations", (_, item) => {
    expect(mapPropertyDeclarations(item)).toBeUndefined();
  });

  it("keeps a constraint it does not know, or a known one in another shape, as it came", () => {
    expect(
      mapPropertyConstraints({
        crs: "epsg3857",
        future: { level: 2 },
        length: { min: 1.5 },
        range: { max: 10, min: 0 },
        unique: "yes",
      }),
    ).toEqual({
      passthrough: {
        crs: "epsg3857",
        future: { level: 2 },
        length: { min: 1.5 },
        unique: "yes",
      },
      range: { max: 10, min: 0 },
    });
  });

  it("writes those constraints back unchanged", () => {
    const constraints = {
      crs: "epsg3857",
      future: { level: 2 },
      range: { max: "2026-12-31", min: "2026-01-01" },
      value_type: "vt",
    };
    expect(toBackendPropertyConstraints(mapPropertyConstraints(constraints)!)).toEqual(constraints);
  });
});

describe("propertyDeclarationPatch", () => {
  const stored = mapPropertyDeclarations(labOrderProperties[3]);

  it("sends nothing for declarations the user left alone", () => {
    expect(propertyDeclarationPatch(stored, stored, { primaryKey: false })).toEqual({});
    expect(propertyDeclarationPatch(undefined, undefined, { primaryKey: false })).toEqual({});
  });

  it("sends a changed field whole, and only that field", () => {
    expect(
      propertyDeclarationPatch({ ...stored, aliases: ["Applied at", "Ordered at"] }, stored, {
        primaryKey: false,
      }),
    ).toEqual({ aliases: ["Applied at", "Ordered at"] });
    expect(
      propertyDeclarationPatch({ ...stored, constraints: { timezone: "UTC" } }, stored, {
        primaryKey: false,
      }),
    ).toEqual({ constraints: { timezone: "UTC" } });
  });

  it("sends null for each field the user cleared", () => {
    expect(propertyDeclarationPatch(undefined, stored, { primaryKey: false })).toEqual({
      aliases: null,
      constraints: null,
      required: null,
      semantic: null,
    });
    expect(
      propertyDeclarationPatch({ ...stored, required: false }, stored, { primaryKey: false }),
    ).toEqual({ required: null });
  });

  it("never sends required for a primary key", () => {
    expect(
      propertyDeclarationPatch({ aliases: ["Barcode"], required: true }, undefined, {
        primaryKey: true,
      }),
    ).toEqual({ aliases: ["Barcode"] });
    expect(propertyDeclarationPatch(undefined, { required: true }, { primaryKey: true })).toEqual(
      {},
    );
  });
});

describe("data property declarations on save", () => {
  const properties = labOrderProperties.map((item) => mapDataProperty(item, meta));
  const baseline = new Map(
    properties.flatMap((item) => (item.declarations ? [[item.name, item.declarations]] : [])),
  );

  it("sends no declaration field for an object type saved unchanged", () => {
    properties.forEach((property) => {
      const body = toBackendDataProperty(property, baseline);
      DECLARATION_KEYS.forEach((key) => expect(body).not.toHaveProperty(key));
    });
  });

  it("sends no declaration field when the caller does not edit them", () => {
    // Such as the mask rule save: the backend keeps what it holds.
    properties.forEach((property) => {
      const body = toBackendDataProperty(property);
      DECLARATION_KEYS.forEach((key) => expect(body).not.toHaveProperty(key));
    });
  });

  it("sends every declaration of a new object type", () => {
    const body = toBackendDataProperty(properties[3], new Map());
    expect(body).toMatchObject({
      aliases: ["Applied at"],
      constraints: { timezone: "Asia/Shanghai" },
      required: true,
      semantic: "event_time",
    });
  });

  it("does not send required for the primary key, even when the form holds it", () => {
    const orderNo: ObjectTypeDataProperty = {
      ...properties[0],
      declarations: { ...properties[0].declarations, required: true },
    };
    expect(orderNo.primaryKey).toBe(true);
    expect(toBackendDataProperty(orderNo, baseline)).not.toHaveProperty("required");
  });

  it("builds the same object type body as before when no property declares anything", () => {
    const input: KnowledgeNetworkObjectTypeMutationPayload = {
      color: "#1677ff",
      conceptGroupIds: [],
      dataProperties: [mapDataProperty({ name: "updated_at", type: "datetime" }, meta)],
      description: "",
      id: "lab_order",
      logicProperties: [],
      name: "Lab order",
      tags: [],
    };
    expect(buildBackendObjectTypePayload({ ...input, declarationBaseline: new Map() }, [])).toEqual(
      buildBackendObjectTypePayload(input, []),
    );
  });
});
