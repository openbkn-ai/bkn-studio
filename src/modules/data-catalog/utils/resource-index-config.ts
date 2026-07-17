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
  /** Resource-level default embedding model (required when embeddingFields non-empty). */
  embeddingModel: string;
  /** Per-field embedding model override; empty = inherit resource default. */
  fieldEmbeddingModels: Record<string, string>;
  /** Per-field embedding feature list; empty value = inherit resource default. */
  fieldEmbeddingModelGroups?: Record<string, ResourceFeatureDraftInput[]>;
  /** Per-field analyzer override; empty = inherit resource default. */
  fieldFulltextAnalyzers: Record<string, string>;
  /** Per-field fulltext feature list; empty value = inherit resource default. */
  fieldFulltextAnalyzerGroups?: Record<string, ResourceFeatureDraftInput[]>;
  /** Resource-level default analyzer (required when fulltextFields non-empty). */
  fulltextAnalyzer?: string;
  fulltextFields: string[];
};

export type ResourceFeatureDraft = {
  description?: string;
  isDefault?: boolean;
  name?: string;
  value?: string;
};

export type ResourceFeatureDraftInput = ResourceFeatureDraft | string;

function readStringConfig(config: Record<string, unknown> | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function featureName(type: "fulltext" | "vector", index: number): string {
  return index === 0 ? type : `${type}_${index + 1}`;
}

function featureDisplayName(
  field: ResourceSchemaField,
  type: "fulltext" | "vector",
  index: number,
): string {
  const base = field.displayName?.trim() || field.name;
  return `${base} ${type} ${index + 1}`;
}

function normalizeDraft(
  item: ResourceFeatureDraftInput,
  type: "fulltext" | "vector",
  index: number,
): ResourceFeatureDraft {
  if (typeof item === "string") {
    return {
      isDefault: index === 0,
      name: featureName(type, index),
      value: item,
    };
  }
  return {
    ...item,
    isDefault: item.isDefault ?? index === 0,
    name: item.name?.trim() || featureName(type, index),
    value: item.value ?? "",
  };
}

function normalizeDefaultFeature(
  items: ResourceFeatureDraftInput[],
  type: "fulltext" | "vector",
): ResourceFeatureDraft[] {
  const drafts = items.slice(0, 3).map((item, index) => normalizeDraft(item, type, index));
  const defaultIndex = drafts.findIndex((item) => item.isDefault);
  return drafts.map((item, index) => ({
    ...item,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }));
}

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
  const defaultAnalyzer = values.fulltextAnalyzer?.trim() ?? "";
  const defaultModel = values.embeddingModel.trim();

  const nextSchema = schema.map((field) => {
    const kept = (field.features ?? []).filter(
      (feature) => feature.featureType !== "vector" && feature.featureType !== "fulltext",
    );
    const features: ResourceFieldFeature[] = [...kept];

    if (fulltextSet.has(field.name)) {
      const analyzers = values.fieldFulltextAnalyzerGroups?.[field.name] ?? [
        values.fieldFulltextAnalyzers[field.name] ?? "",
      ];
      for (const [index, item] of normalizeDefaultFeature(analyzers, "fulltext").entries()) {
        const analyzer = item.value?.trim() || defaultAnalyzer;
        const name = item.name?.trim() || featureName("fulltext", index);
        features.push({
          name,
          displayName: name || featureDisplayName(field, "fulltext", index),
          featureType: "fulltext",
          ...(item.description?.trim() ? { description: item.description.trim() } : {}),
          refProperty: field.name,
          isDefault: item.isDefault,
          isNative: true,
          config: analyzer ? { analyzer } : undefined,
        });
      }
    }

    if (embeddingSet.has(field.name)) {
      const models = values.fieldEmbeddingModelGroups?.[field.name] ?? [
        values.fieldEmbeddingModels[field.name] ?? "",
      ];
      for (const [index, item] of normalizeDefaultFeature(models, "vector").entries()) {
        const embeddingModel = item.value?.trim() || defaultModel;
        const name = item.name?.trim() || featureName("vector", index);
        features.push({
          name,
          displayName: name || featureDisplayName(field, "vector", index),
          featureType: "vector",
          ...(item.description?.trim() ? { description: item.description.trim() } : {}),
          refProperty: field.name,
          isDefault: item.isDefault,
          isNative: true,
          config: embeddingModel ? { embedding_model: embeddingModel } : undefined,
        });
      }
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
      defaultFulltextAnalyzer: defaultAnalyzer || undefined,
      defaultEmbeddingModel: defaultModel || undefined,
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
  const fieldEmbeddingModels: Record<string, string> = {};
  const fieldFulltextAnalyzers: Record<string, string> = {};
  const fieldEmbeddingModelGroups: Record<string, ResourceFeatureDraft[]> = {};
  const fieldFulltextAnalyzerGroups: Record<string, ResourceFeatureDraft[]> = {};

  let embeddingModel = resource.indexConfig?.defaultEmbeddingModel ?? "";
  let fulltextAnalyzer = resource.indexConfig?.defaultFulltextAnalyzer ?? "";

  for (const field of resource.schema) {
    for (const feature of field.features ?? []) {
      if (feature.featureType === "vector") {
        if (!embeddingFields.includes(field.name)) {
          embeddingFields.push(field.name);
        }
        const model = readStringConfig(feature.config, "embedding_model");
        fieldEmbeddingModelGroups[field.name] = [
          ...(fieldEmbeddingModelGroups[field.name] ?? []),
          {
            description: feature.description,
            isDefault: feature.isDefault,
            name: feature.name,
            value: model && model !== embeddingModel ? model : "",
          },
        ];
        if (model) {
          if (embeddingModel && model !== embeddingModel) {
            fieldEmbeddingModels[field.name] = model;
          } else if (!embeddingModel) {
            embeddingModel = model;
          }
        }
      }
      if (feature.featureType === "fulltext") {
        if (!fulltextFields.includes(field.name)) {
          fulltextFields.push(field.name);
        }
        const analyzer = readStringConfig(feature.config, "analyzer");
        fieldFulltextAnalyzerGroups[field.name] = [
          ...(fieldFulltextAnalyzerGroups[field.name] ?? []),
          {
            description: feature.description,
            isDefault: feature.isDefault,
            name: feature.name,
            value: analyzer && analyzer !== fulltextAnalyzer ? analyzer : "",
          },
        ];
        if (analyzer) {
          if (fulltextAnalyzer && analyzer !== fulltextAnalyzer) {
            fieldFulltextAnalyzers[field.name] = analyzer;
          } else if (!fulltextAnalyzer) {
            fulltextAnalyzer = analyzer;
          }
        }
      }
    }
  }

  return {
    buildKeyFields: resource.indexConfig?.buildKeyFields ?? [],
    embeddingFields,
    embeddingModel,
    fieldEmbeddingModels,
    fieldEmbeddingModelGroups,
    fieldFulltextAnalyzers,
    fieldFulltextAnalyzerGroups,
    fulltextFields,
    fulltextAnalyzer: fulltextAnalyzer || undefined,
  };
}
