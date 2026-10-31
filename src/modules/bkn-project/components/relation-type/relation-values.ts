/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { DraftRelationType, DraftRelationTypeSave } from "@/modules/bkn-project/types/draft";
import {
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
} from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";

/*
 * A draft relation type as the knowledge network's relation mapping takes it, and back. Through a
 * link table, the draft keeps the source's mapping to the table and the table's to the target
 * apart; the mapping rows pair them up, one row each.
 */

export function relationEditorValues(
  relation?: Pick<
    DraftRelationType,
    "linkTable" | "mapping" | "source" | "sourceMapping" | "target" | "targetMapping"
  >,
  ends?: { source?: string; target?: string },
): RelationTypeMappingFormValues {
  if (!relation) {
    const values = createDefaultRelationTypeMappingValues("direct");
    return {
      ...values,
      mappingRules: {
        ...values.mappingRules,
        sourceObjectTypeId: ends?.source ?? "",
        targetObjectTypeId: ends?.target ?? "",
      },
    };
  }
  const link = relation.linkTable;
  const rows = Math.max(relation.sourceMapping.length, relation.targetMapping.length);
  return {
    mappingMode: link ? "resource" : "direct",
    mappingRules: buildRelationTypeMappingRulesFromDetail({
      backingDataSourceId: link?.resourceId,
      backingDataSourceName: link?.name,
      mappingMode: link ? "resource" : "direct",
      propertyMappings: link
        ? []
        : relation.mapping.map((pair) => ({
            sourcePropertyName: pair.sourceProperty,
            targetPropertyName: pair.targetProperty,
          })),
      resourceMappings: link
        ? Array.from({ length: rows }, (_, at) => ({
            resourceSourcePropertyName: relation.sourceMapping[at]?.targetProperty ?? "",
            resourceTargetPropertyName: relation.targetMapping[at]?.sourceProperty ?? "",
            sourceObjectPropertyName: relation.sourceMapping[at]?.sourceProperty ?? "",
            targetObjectPropertyName: relation.targetMapping[at]?.targetProperty ?? "",
          }))
        : [],
      sourceObjectTypeId: relation.source,
      targetObjectTypeId: relation.target,
    }),
  };
}

/** What saving sends for the editor's values, the rows left half filled dropped. */
export function relationSave(
  basic: { description: string; name: string },
  values: RelationTypeMappingFormValues,
): DraftRelationTypeSave {
  const { mappingMode, mappingRules } = normalizeRelationTypeMappingValues(values);
  const base = {
    description: basic.description.trim(),
    name: basic.name.trim(),
    source: mappingRules.sourceObjectTypeId,
    target: mappingRules.targetObjectTypeId,
  };
  if (mappingMode === "direct") {
    return {
      ...base,
      mapping: mappingRules.propertyMappings
        .filter((pair) => pair.sourcePropertyName && pair.targetPropertyName)
        .map((pair) => ({
          sourceProperty: pair.sourcePropertyName,
          targetProperty: pair.targetPropertyName,
        })),
    };
  }
  const rows = mappingRules.resourceMappings.filter(
    (row) =>
      row.sourceObjectPropertyName &&
      row.resourceSourcePropertyName &&
      row.resourceTargetPropertyName &&
      row.targetObjectPropertyName,
  );
  return {
    ...base,
    link: {
      resourceId: mappingRules.backingDataSourceId,
      sourceMapping: rows.map((row) => ({
        sourceProperty: row.sourceObjectPropertyName,
        targetProperty: row.resourceSourcePropertyName,
      })),
      targetMapping: rows.map((row) => ({
        sourceProperty: row.resourceTargetPropertyName,
        targetProperty: row.targetObjectPropertyName,
      })),
    },
    mapping: [],
  };
}
