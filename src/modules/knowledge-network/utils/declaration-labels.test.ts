/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";
import { knowledgeNetworkZhCN } from "@/modules/knowledge-network/locales/zh-CN";
import {
  declarationFieldKey,
  definitionKey,
  definitionNamesFromPayload,
  groupClearedDeclarations,
} from "@/modules/knowledge-network/utils/declaration-labels";

describe("declarationFieldKey", () => {
  it.each([
    "aliases",
    "cardinality",
    "constraints",
    "fallback_for",
    "importance",
    "lifecycle",
    "properties",
    "required",
    "reverse_name",
    "semantic",
    "verification",
  ])("names %s in both languages", (field) => {
    expect(declarationFieldKey(field)).toBe(`knowledgeNetwork.declarations.field.${field}`);
    const zh = knowledgeNetworkZhCN.knowledgeNetwork.declarations.field;
    const en = knowledgeNetworkEnUS.knowledgeNetwork.declarations.field;
    expect(zh[field as keyof typeof zh]).toBeTruthy();
    expect(en[field as keyof typeof en]).toBeTruthy();
  });

  it("has no key for a declaration this release does not know", () => {
    expect(declarationFieldKey("future_field")).toBeUndefined();
  });
});

describe("groupClearedDeclarations", () => {
  it("lists a property split over several entries once, with each field once", () => {
    expect(
      groupClearedDeclarations([
        { fields: ["semantic"], id: "lab_order", kind: "object_type", property: "ordered_at" },
        { fields: ["aliases"], id: "lab_order", kind: "object_type", property: "status" },
        {
          fields: ["constraints", "semantic"],
          id: "lab_order",
          kind: "object_type",
          property: "ordered_at",
        },
      ]),
    ).toEqual([
      {
        id: "lab_order",
        kind: "object_type",
        ownFields: [],
        properties: [
          { fields: ["semantic", "constraints"], name: "ordered_at" },
          { fields: ["aliases"], name: "status" },
        ],
      },
    ]);
  });

  it("groups by definition in the order the backend listed them", () => {
    expect(
      groupClearedDeclarations([
        { fields: ["semantic"], id: "lab_order", kind: "object_type", property: "ordered_at" },
        { fields: ["reverse_name"], id: "lab_order", kind: "relation_type" },
        { fields: ["aliases"], id: "lab_order", kind: "object_type" },
        { fields: ["aliases", "lifecycle"], id: "lab_order", kind: "object_type" },
        { fields: ["constraints"], id: "lab_order", kind: "object_type", property: "status" },
      ]),
    ).toEqual([
      {
        id: "lab_order",
        kind: "object_type",
        ownFields: ["aliases", "lifecycle"],
        properties: [
          { fields: ["semantic"], name: "ordered_at" },
          { fields: ["constraints"], name: "status" },
        ],
      },
      // The same id on another kind is another definition.
      { id: "lab_order", kind: "relation_type", ownFields: ["reverse_name"], properties: [] },
    ]);
  });
});

describe("definitionNamesFromPayload", () => {
  it("reads the names of a network export, including those under its concept groups", () => {
    const names = definitionNamesFromPayload({
      action_types: [{ id: "revoke", name: "Revoke order" }],
      concept_groups: [{ object_types: [{ id: "patient", name: "Patient" }] }],
      object_types: [{ id: "lab_order", name: "Lab order" }, { id: "nameless" }, null],
      relation_types: [{ id: "ordered_for", name: "Ordered for" }],
    });

    expect(names.get(definitionKey("object_type", "lab_order"))).toBe("Lab order");
    expect(names.get(definitionKey("object_type", "patient"))).toBe("Patient");
    expect(names.get(definitionKey("relation_type", "ordered_for"))).toBe("Ordered for");
    expect(names.get(definitionKey("action_type", "revoke"))).toBe("Revoke order");
    expect(names.has(definitionKey("object_type", "nameless"))).toBe(false);
  });

  it("reads nothing from a payload without definition lists", () => {
    expect(definitionNamesFromPayload({ id: "orders", object_types: "lab_order" }).size).toBe(0);
  });
});
