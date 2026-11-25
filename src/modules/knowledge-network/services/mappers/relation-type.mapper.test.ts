/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapRelationType } from "@/modules/knowledge-network/services/mappers";
import type {
  KnowledgeNetworkRelationTypeMutationPayload,
  StoredRelationProperty,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  mapStoredRelationProperties,
  toBackendRelationTypeCreateEntry,
} from "./relation-type.mapper";

describe("relation type mapper", () => {
  it("writes resource mappings as the indirect relation type", () => {
    const payload = toBackendRelationTypeCreateEntry({
      color: "#1677ff",
      description: "",
      mappingMode: "resource",
      mappingRules: {
        backingDataSourceId: "resource-1",
        resourceMappings: [],
        propertyMappings: [],
        sourceObjectTypeId: "order",
        targetObjectTypeId: "item",
      },
      name: "Order item",
      sourceObjectTypeId: "order",
      tags: [],
      targetObjectTypeId: "item",
    });

    expect(payload.type).toBe("indirect");
    expect(payload.mapping_mode).toBe("indirect");
  });

  it("reads indirect relation types as resource mappings", () => {
    expect(
      mapRelationType({ id: "indirect-1", name: "Indirect", type: "indirect" }).mappingMode,
    ).toBe("resource");
  });
});

function indirectMutation(
  properties?: StoredRelationProperty[],
): KnowledgeNetworkRelationTypeMutationPayload {
  return {
    color: "#1677ff",
    description: "",
    mappingMode: "resource",
    name: "Association",
    tags: [],
    sourceObjectTypeId: "source",
    targetObjectTypeId: "target",
    mappingRules: {
      backingDataSourceId: "bridge",
      sourceObjectTypeId: "source",
      targetObjectTypeId: "target",
      resourceMappings: [],
      propertyMappings: [],
      ...(properties !== undefined ? { relationProperties: properties } : {}),
    },
  };
}

describe("relation property declaration round trips", () => {
  it("omits properties during an ordinary mapping save", () => {
    expect(toBackendRelationTypeCreateEntry(indirectMutation()).mapping_rules).not.toHaveProperty(
      "properties",
    );
  });
  it("sends an explicit empty array to clear all properties", () => {
    expect(toBackendRelationTypeCreateEntry(indirectMutation([])).mapping_rules).toMatchObject({
      properties: [],
    });
  });
  it("preserves a full API-created declaration, false required and a zero bound", () => {
    const raw = {
      name: "edge_value",
      display_name: "Decimal edge",
      type: "decimal",
      required: false,
      mapped_field: { name: "edge_decimal", type: "decimal", schema_revision: 2 },
      constraints: {
        range: { min: 0, max: "11.125", inclusive: true },
        value_type: "money",
        future: { policy: "retain" },
      },
      future_declaration: { revision: 3 },
    };
    const properties = mapStoredRelationProperties({ properties: [raw] });
    expect(properties[0]).toMatchObject({
      type: "decimal",
      required: false,
      constraints: raw.constraints,
      declaration: raw,
    });
    const payload = toBackendRelationTypeCreateEntry(indirectMutation(properties));
    expect(payload.mapping_rules).toMatchObject({ properties: [raw] });
    const reopened = mapStoredRelationProperties(payload.mapping_rules);
    expect(reopened).toEqual(properties);
    expect(raw.constraints.range.min).toBe(0);
    expect(reopened[0].declaration).not.toBe(raw);
    expect(reopened[0].constraints).not.toBe(raw.constraints);
  });
  it("writes edited fields while preserving unknown constraints and mapped-field extensions", () => {
    const properties = mapStoredRelationProperties({
      properties: [
        {
          name: "edge_value",
          display_name: "Old",
          type: "integer",
          required: true,
          mapped_field: { name: "edge_value", type: "integer", source_revision: 4 },
          constraints: { range: { min: 7, max: 11 }, future: { policy: "retain" } },
          future_attribute: "retain",
        },
      ],
    });
    const changed = {
      ...properties[0],
      displayName: "Updated",
      required: false,
      constraints: { ...properties[0].constraints, range: { min: 0, max: 10 } },
    };
    const payload = toBackendRelationTypeCreateEntry(indirectMutation([changed]));
    expect(payload.mapping_rules).toMatchObject({
      properties: [
        {
          display_name: "Updated",
          required: false,
          mapped_field: { name: "edge_value", type: "integer", source_revision: 4 },
          constraints: { range: { min: 0, max: 10 }, future: { policy: "retain" } },
          future_attribute: "retain",
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain('"declaration":');
  });
  it("writes a newly configured required integer property with its mapped type", () => {
    const payload = toBackendRelationTypeCreateEntry(
      indirectMutation([
        {
          name: "edge_value",
          displayName: "Edge value",
          type: "integer",
          required: true,
          mappedField: "edge_value",
          constraints: { range: { min: 7, max: 11 } },
        },
      ]),
    );
    expect(payload.mapping_rules).toMatchObject({
      properties: [
        {
          name: "edge_value",
          display_name: "Edge value",
          type: "integer",
          required: true,
          mapped_field: { name: "edge_value", type: "integer" },
          constraints: { range: { min: 7, max: 11 } },
        },
      ],
    });
    expect(mapStoredRelationProperties(payload.mapping_rules)[0]).toMatchObject({
      type: "integer",
      required: true,
      mappedField: "edge_value",
      constraints: { range: { min: 7, max: 11 } },
    });
  });
});
