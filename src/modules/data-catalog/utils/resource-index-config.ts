/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  ResourceFieldFeature,
  ResourceIndexConfig,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";

export type ResourceIndexFormValues = {
  buildKeyFields: string[];
  embeddingFields: string[];
  embeddingModel: string;
  fulltextAnalyzer?: string;
  fulltextFields: string[];
};

/**
 * Merge UI field-role selections into schema features + resource index_config.
 * Preserves unrelated features (e.g. keyword) on each field.
 */
export function applyIndexFormToSchema(
  schema: ResourceSchemaField[],
  values: ResourceIndexFormValues,
): { indexConfig: ResourceIndexConfig; schema: ResourceSchemaField[] } {
  const embeddingSet = new Set(values.embeddingFields);
  const fulltextSet = new Set(values.fulltextFields);

  const nextSchema = schema.map((field) => {
    const kept = (field.features ?? []).filter(
      (feature) => feature.featureType !== "vector" && feature.featureType !== "fulltext",
    );
    const features: ResourceFieldFeature[] = [...kept];

    if (fulltextSet.has(field.name)) {
      features.push({
        featureType: "fulltext",
        config: values.fulltextAnalyzer ? { analyzer: values.fulltextAnalyzer } : undefined,
      });
    }

    if (embeddingSet.has(field.name)) {
      features.push({
        featureType: "vector",
        config: values.embeddingModel
          ? { embedding_model: values.embeddingModel }
          : undefined,
      });
    }

    return {
      ...field,
      features: features.length > 0 ? features : undefined,
    };
  });

  return {
    schema: nextSchema,
    indexConfig: {
      buildKeyFields: values.buildKeyFields,
      defaultFulltextAnalyzer: values.fulltextAnalyzer || undefined,
      defaultEmbeddingModel: values.embeddingModel || undefined,
    },
  };
}

/** Derive flat field lists from resource schema features for form/display. */
export function indexFormValuesFromResource(resource: {
  indexConfig?: ResourceIndexConfig;
  schema: ResourceSchemaField[];
}): ResourceIndexFormValues {
  const embeddingFields: string[] = [];
  const fulltextFields: string[] = [];
  let embeddingModel = resource.indexConfig?.defaultEmbeddingModel ?? "";
  let fulltextAnalyzer = resource.indexConfig?.defaultFulltextAnalyzer ?? "";

  for (const field of resource.schema) {
    for (const feature of field.features ?? []) {
      if (feature.featureType === "vector") {
        embeddingFields.push(field.name);
        const model = feature.config?.embedding_model;
        if (typeof model === "string" && model && !embeddingModel) {
          embeddingModel = model;
        }
      }
      if (feature.featureType === "fulltext") {
        fulltextFields.push(field.name);
        const analyzer = feature.config?.analyzer;
        if (typeof analyzer === "string" && analyzer && !fulltextAnalyzer) {
          fulltextAnalyzer = analyzer;
        }
      }
    }
  }

  return {
    buildKeyFields: resource.indexConfig?.buildKeyFields ?? [],
    embeddingFields,
    embeddingModel,
    fulltextFields,
    fulltextAnalyzer: fulltextAnalyzer || undefined,
  };
}
