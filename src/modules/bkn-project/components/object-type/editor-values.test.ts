/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { draftSave, editorDataSource, editorProperties } from "./editor-values";

function customers() {
  const objectType = mapDraft(mockDraft("p1")).items.objectTypes.find(
    (item) => item.id === "customers",
  )!;
  return { ...objectType, displayKey: "name", incrementalKey: "name" };
}

describe("editor values", () => {
  it("marks the identity, the title and the update field on the properties", () => {
    const objectType = customers();
    const properties = editorProperties(objectType);

    expect(
      properties.map(({ name, primaryKey, displayKey, incrementalKey }) => ({
        displayKey,
        incrementalKey,
        name,
        primaryKey,
      })),
    ).toEqual([
      { displayKey: false, incrementalKey: false, name: "customer_id", primaryKey: true },
      { displayKey: true, incrementalKey: true, name: "name", primaryKey: false },
    ]);
    expect(properties[0].mappedField).toEqual({
      displayName: "customer_id",
      name: "customer_id",
      type: "string",
    });
    expect(editorDataSource(objectType)).toEqual({
      id: objectType.table.resourceId,
      name: objectType.table.name,
      type: "resource",
    });
  });

  it("saves what the editor left, keeping the update field only while its property stays", () => {
    const objectType = customers();
    const [id, name] = editorProperties(objectType);
    const basic = { description: " Who buys ", name: " Customer " };

    expect(draftSave(objectType, basic, [id, { ...name, comment: "Shown" }])).toEqual({
      description: "Who buys",
      displayKey: "name",
      incrementalKey: "name",
      name: "Customer",
      primaryKeys: ["customer_id"],
      properties: [
        {
          description: "",
          displayName: id.displayName,
          mappedField: "customer_id",
          name: "customer_id",
          type: "string",
        },
        {
          description: "Shown",
          displayName: name.displayName,
          mappedField: "name",
          name: "name",
          type: "string",
        },
      ],
    });
    // Without the property, the update field goes too; a property that maps no column sends none.
    const unmapped = { ...id, mappedField: undefined };
    const saved = draftSave(objectType, basic, [unmapped]);
    expect(saved.incrementalKey).toBe("");
    expect(saved.properties[0]).not.toHaveProperty("mappedField");
  });
});
