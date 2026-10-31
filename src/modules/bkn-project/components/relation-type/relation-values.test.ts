/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftRelationType } from "@/modules/bkn-project/types/draft";

import { relationEditorValues, relationSave } from "./relation-values";

const basic = { description: " Who ordered ", name: " Orders of customer " };

describe("relation values", () => {
  it("reads a direct relation and saves it back", () => {
    const relation = mapDraft(mockDraft("p1")).items.relationTypes[0];
    const values = relationEditorValues(relation);
    expect(values.mappingMode).toBe("direct");
    expect(values.mappingRules).toMatchObject({
      propertyMappings: [{ sourcePropertyName: "customer_id", targetPropertyName: "customer_id" }],
      sourceObjectTypeId: relation.source,
      targetObjectTypeId: relation.target,
    });

    expect(relationSave(basic, values)).toEqual({
      description: "Who ordered",
      mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
      name: "Orders of customer",
      source: relation.source,
      target: relation.target,
    });
  });

  it("pairs a link table's two mappings into rows, and splits them again", () => {
    const relation = {
      ...mapDraft(mockDraft("p1")).items.relationTypes[0],
      linkTable: { catalogId: "c1", name: "order_items", resourceId: "res-items" },
      mapping: [],
      sourceMapping: [{ sourceProperty: "id", targetProperty: "order_id" }],
      targetMapping: [{ sourceProperty: "product_id", targetProperty: "id" }],
    } satisfies DraftRelationType;
    const values = relationEditorValues(relation);
    expect(values.mappingMode).toBe("resource");
    expect(values.mappingRules).toMatchObject({
      backingDataSourceId: "res-items",
      backingDataSourceName: "order_items",
      resourceMappings: [
        {
          resourceSourcePropertyName: "order_id",
          resourceTargetPropertyName: "product_id",
          sourceObjectPropertyName: "id",
          targetObjectPropertyName: "id",
        },
      ],
    });

    expect(relationSave(basic, values)).toMatchObject({
      link: {
        resourceId: "res-items",
        sourceMapping: relation.sourceMapping,
        targetMapping: relation.targetMapping,
      },
      mapping: [],
    });
  });

  it("starts a new relation empty, or from the ends it was asked for", () => {
    expect(relationEditorValues().mappingRules.sourceObjectTypeId).toBe("");
    expect(
      relationEditorValues(undefined, { source: "orders", target: "customers" }).mappingRules,
    ).toMatchObject({ sourceObjectTypeId: "orders", targetObjectTypeId: "customers" });
  });
});
