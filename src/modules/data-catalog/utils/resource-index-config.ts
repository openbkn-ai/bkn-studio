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
  defaultKeywordIgnoreAbove?: number;
  incrementalFields?: string[];
  primaryKeyFields?: string[];
  embeddingFields: string[];
  /** Resource-level default embedding model (required when embeddingFields non-empty). */
  embeddingModel: string;
  /** Per-field embedding model override; empty = inherit resource default. */
  fieldEmbeddingModels: Record<string, string>;
  /** Per-field embedding feature list; empty value = inherit resource default. */
  fieldEmbeddingModelGroups?: Record<string, ResourceFeatureDraftInput[]>;
  /** Per-field keyword feature list; value is ignore_above. */
  fieldKeywordGroups?: Record<string, ResourceFeatureDraftInput[]>;
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

/** Reports whether persisted features satisfy the backend build contract. */
export function hasPersistedBuildFeatures(resource: { schema: ResourceSchemaField[] }): boolean {
  let hasIndexFeature = false;
  for (const field of resource.schema) {
    const features = field.features ?? [];
    if (
      features.some((feature) => ["keyword", "fulltext", "vector"].includes(feature.featureType))
    ) {
      hasIndexFeature = true;
    }

    const fieldType = field.type.trim().toLowerCase();
    if (fieldType !== "string" && fieldType !== "text") {
      continue;
    }
    const keyword = features.find((feature) => feature.featureType === "keyword");
    const ignoreAbove = Number(keyword?.config?.ignore_above);
    if (!keyword || !Number.isSafeInteger(ignoreAbove) || ignoreAbove < 1 || ignoreAbove > 8191) {
      return false;
    }
    if (fieldType === "text" && !features.some((feature) => feature.featureType === "fulltext")) {
      return false;
    }
  }
  return hasIndexFeature;
}

function readStringConfig(config: Record<string, unknown> | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function featureName(type: "keyword" | "fulltext" | "vector", index: number): string {
  return index === 0 ? type : `${type}_${index + 1}`;
}

function featureDisplayName(
  field: ResourceSchemaField,
  type: "keyword" | "fulltext" | "vector",
  index: number,
): string {
  const base = field.displayName?.trim() || field.name;
  return `${base} ${type} ${index + 1}`;
}

function normalizeDraft(
  item: ResourceFeatureDraftInput,
  type: "keyword" | "fulltext" | "vector",
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
  type: "keyword" | "fulltext" | "vector",
): ResourceFeatureDraft[] {
  const drafts = items.slice(0, 1).map((item, index) => normalizeDraft(item, type, index));
  const defaultIndex = drafts.findIndex((item) => item.isDefault);
  return drafts.map((item, index) => ({
    ...item,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }));
}

/**
 * Merge UI field-role selections into schema features + resource index_config.
 * Preserves feature types that are not managed by the supplied form values.
 */
export function applyIndexFormToSchema(
  schema: ResourceSchemaField[],
  values: ResourceIndexFormValues,
): { indexConfig: ResourceIndexConfig; schema: ResourceSchemaField[] } {
  const embeddingSet = new Set(values.embeddingFields);
  const fulltextSet = new Set(values.fulltextFields);
  const managesKeyword = values.fieldKeywordGroups !== undefined;
  const defaultKeywordIgnoreAbove = values.defaultKeywordIgnoreAbove ?? 256;
  const defaultAnalyzer = values.fulltextAnalyzer?.trim() ?? "";
  const defaultModel = values.embeddingModel.trim();

  const nextSchema = schema.map((field) => {
    const managesTextFeatures = ["string", "text"].includes(field.type.trim().toLowerCase());
    const kept = (field.features ?? []).filter(
      (feature) =>
        !managesTextFeatures ||
        ((feature.featureType !== "vector" || Boolean(feature.refProperty)) &&
          feature.featureType !== "fulltext" &&
          (!managesKeyword || feature.featureType !== "keyword")),
    );
    const features: ResourceFieldFeature[] = [...kept];

    if (managesTextFeatures && managesKeyword) {
      for (const [index, item] of normalizeDefaultFeature(
        values.fieldKeywordGroups?.[field.name] ?? [],
        "keyword",
      ).entries()) {
        const configuredIgnoreAbove = item.value?.trim();
        const ignoreAbove = configuredIgnoreAbove
          ? Number(configuredIgnoreAbove)
          : defaultKeywordIgnoreAbove;
        const name = item.name?.trim() || featureName("keyword", index);
        features.push({
          name,
          displayName: name || featureDisplayName(field, "keyword", index),
          featureType: "keyword",
          ...(item.description?.trim() ? { description: item.description.trim() } : {}),
          isDefault: item.isDefault,
          config: { ignore_above: ignoreAbove },
        });
      }
    }

    if (managesTextFeatures && fulltextSet.has(field.name)) {
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
          isDefault: item.isDefault,
          isNative: true,
          config: analyzer ? { analyzer } : undefined,
        });
      }
    }

    if (managesTextFeatures && embeddingSet.has(field.name)) {
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
      ...(values.defaultKeywordIgnoreAbove !== undefined ? { defaultKeywordIgnoreAbove } : {}),
      incrementalFields: values.incrementalFields ?? [],
      primaryKeyFields: values.primaryKeyFields ?? [],
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
  const fieldKeywordGroups: Record<string, ResourceFeatureDraft[]> = {};
  const fieldFulltextAnalyzerGroups: Record<string, ResourceFeatureDraft[]> = {};

  let embeddingModel = resource.indexConfig?.defaultEmbeddingModel ?? "";
  let fulltextAnalyzer = resource.indexConfig?.defaultFulltextAnalyzer ?? "";
  const defaultKeywordIgnoreAbove = resource.indexConfig?.defaultKeywordIgnoreAbove ?? 256;

  for (const field of resource.schema) {
    for (const feature of field.features ?? []) {
      if (feature.featureType === "keyword") {
        const ignoreAbove = feature.config?.ignore_above;
        fieldKeywordGroups[field.name] = [
          ...(fieldKeywordGroups[field.name] ?? []),
          {
            description: feature.description,
            isDefault: feature.isDefault,
            name: feature.name,
            value:
              typeof ignoreAbove === "number" || typeof ignoreAbove === "string"
                ? String(ignoreAbove)
                : "",
          },
        ];
      }
      if (feature.featureType === "vector" && !feature.refProperty) {
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

    const fieldType = field.type.trim().toLowerCase();
    if (
      (fieldType === "string" || fieldType === "text") &&
      !fieldKeywordGroups[field.name]?.length
    ) {
      fieldKeywordGroups[field.name] = [
        {
          isDefault: true,
          name: "keyword",
          value: "",
        },
      ];
    }
    if (fieldType === "text" && !fieldFulltextAnalyzerGroups[field.name]?.length) {
      fieldFulltextAnalyzerGroups[field.name] = [
        {
          isDefault: true,
          name: "fulltext",
          value: "",
        },
      ];
      fulltextFields.push(field.name);
    }
  }

  return {
    defaultKeywordIgnoreAbove,
    incrementalFields: resource.indexConfig?.incrementalFields ?? [],
    primaryKeyFields: resource.indexConfig?.primaryKeyFields ?? [],
    embeddingFields,
    embeddingModel,
    fieldEmbeddingModels,
    fieldEmbeddingModelGroups,
    fieldKeywordGroups,
    fieldFulltextAnalyzers,
    fieldFulltextAnalyzerGroups,
    fulltextFields,
    fulltextAnalyzer: fulltextAnalyzer || undefined,
  };
}
