/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applyIndexFormToSchema,
  indexFormValuesFromResource,
} from "@/modules/data-catalog/utils/resource-index-config";

describe("resource-index-config", () => {
  it("writes defaults and per-field overrides into schema features", () => {
    const result = applyIndexFormToSchema(
      [
        { name: "id", type: "string", features: [{ featureType: "keyword" }] },
        { name: "title", type: "string" },
        { name: "body", type: "string" },
        { name: "note", type: "string" },
      ],
      {
        buildKeyFields: ["id"],
        embeddingFields: ["body", "note"],
        embeddingModel: "embed-default",
        fieldEmbeddingModels: { note: "embed-special" },
        fulltextFields: ["title", "body"],
        fulltextAnalyzer: "standard",
        fieldFulltextAnalyzers: { title: "ik_max_word" },
      },
    );

    expect(result.indexConfig).toEqual({
      buildKeyFields: ["id"],
      defaultFulltextAnalyzer: "standard",
      defaultEmbeddingModel: "embed-default",
    });
    expect(result.schema.find((f) => f.name === "title")?.features).toEqual([
      {
        name: "fulltext",
        displayName: "fulltext",
        featureType: "fulltext",
        refProperty: "title",
        isDefault: true,
        isNative: true,
        config: { analyzer: "ik_max_word" },
      },
    ]);
    expect(result.schema.find((f) => f.name === "body")?.features).toEqual([
      {
        name: "fulltext",
        displayName: "fulltext",
        featureType: "fulltext",
        refProperty: "body",
        isDefault: true,
        isNative: true,
        config: { analyzer: "standard" },
      },
      {
        name: "vector",
        displayName: "vector",
        featureType: "vector",
        refProperty: "body",
        isDefault: true,
        isNative: true,
        config: { embedding_model: "embed-default" },
      },
    ]);
    expect(result.schema.find((f) => f.name === "note")?.features).toEqual([
      {
        name: "vector",
        displayName: "vector",
        featureType: "vector",
        refProperty: "note",
        isDefault: true,
        isNative: true,
        config: { embedding_model: "embed-special" },
      },
    ]);
  });

  it("writes at most three feature groups and marks one default per type", () => {
    const result = applyIndexFormToSchema(
      [{ name: "body", type: "string", displayName: "Body" }],
      {
        buildKeyFields: [],
        embeddingFields: ["body"],
        embeddingModel: "embed-default",
        fieldEmbeddingModels: {},
        fieldEmbeddingModelGroups: {
          body: ["embed-a", "embed-b", "embed-c", "embed-d"],
        },
        fulltextFields: ["body"],
        fulltextAnalyzer: "standard",
        fieldFulltextAnalyzers: {},
        fieldFulltextAnalyzerGroups: {
          body: ["ik_max_word", "", "standard", "hanlp_index"],
        },
      },
    );

    expect(result.schema[0].features).toEqual([
      {
        name: "fulltext",
        displayName: "fulltext",
        featureType: "fulltext",
        refProperty: "body",
        isDefault: true,
        isNative: true,
        config: { analyzer: "ik_max_word" },
      },
      {
        name: "fulltext_2",
        displayName: "fulltext_2",
        featureType: "fulltext",
        refProperty: "body",
        isDefault: false,
        isNative: true,
        config: { analyzer: "standard" },
      },
      {
        name: "fulltext_3",
        displayName: "fulltext_3",
        featureType: "fulltext",
        refProperty: "body",
        isDefault: false,
        isNative: true,
        config: { analyzer: "standard" },
      },
      {
        name: "vector",
        displayName: "vector",
        featureType: "vector",
        refProperty: "body",
        isDefault: true,
        isNative: true,
        config: { embedding_model: "embed-a" },
      },
      {
        name: "vector_2",
        displayName: "vector_2",
        featureType: "vector",
        refProperty: "body",
        isDefault: false,
        isNative: true,
        config: { embedding_model: "embed-b" },
      },
      {
        name: "vector_3",
        displayName: "vector_3",
        featureType: "vector",
        refProperty: "body",
        isDefault: false,
        isNative: true,
        config: { embedding_model: "embed-c" },
      },
    ]);
  });

  it("reads defaults and per-field overrides from resource", () => {
    const values = indexFormValuesFromResource({
      indexConfig: {
        buildKeyFields: ["id"],
        defaultEmbeddingModel: "embed-default",
        defaultFulltextAnalyzer: "standard",
      },
      schema: [
        {
          name: "title",
          type: "string",
          features: [{ featureType: "fulltext", config: { analyzer: "ik_max_word" } }],
        },
        {
          name: "body",
          type: "string",
          features: [
            { featureType: "fulltext", config: { analyzer: "standard" } },
            { featureType: "vector", config: { embedding_model: "embed-default" } },
          ],
        },
        {
          name: "note",
          type: "string",
          features: [{ featureType: "vector", config: { embedding_model: "embed-special" } }],
        },
      ],
    });

    expect(values).toEqual({
      buildKeyFields: ["id"],
      embeddingFields: ["body", "note"],
      embeddingModel: "embed-default",
      fieldEmbeddingModelGroups: {
        body: [{ value: "", name: undefined, description: undefined, isDefault: undefined }],
        note: [{ value: "embed-special", name: undefined, description: undefined, isDefault: undefined }],
      },
      fieldEmbeddingModels: { note: "embed-special" },
      fieldFulltextAnalyzerGroups: {
        body: [{ value: "", name: undefined, description: undefined, isDefault: undefined }],
        title: [{ value: "ik_max_word", name: undefined, description: undefined, isDefault: undefined }],
      },
      fieldFulltextAnalyzers: { title: "ik_max_word" },
      fulltextFields: ["title", "body"],
      fulltextAnalyzer: "standard",
    });
  });
});
