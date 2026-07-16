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
  it("writes vector/fulltext features and index_config from form values", () => {
    const result = applyIndexFormToSchema(
      [
        { name: "id", type: "string", features: [{ featureType: "keyword" }] },
        { name: "title", type: "string" },
        { name: "body", type: "string" },
      ],
      {
        buildKeyFields: ["id"],
        embeddingFields: ["body"],
        embeddingModel: "embed-1",
        fulltextFields: ["title", "body"],
        fulltextAnalyzer: "ik_max_word",
      },
    );

    expect(result.indexConfig).toEqual({
      buildKeyFields: ["id"],
      defaultFulltextAnalyzer: "ik_max_word",
      defaultEmbeddingModel: "embed-1",
    });
    expect(result.schema.find((f) => f.name === "id")?.features).toEqual([
      { featureType: "keyword" },
    ]);
    expect(result.schema.find((f) => f.name === "title")?.features).toEqual([
      { featureType: "fulltext", config: { analyzer: "ik_max_word" } },
    ]);
    expect(result.schema.find((f) => f.name === "body")?.features).toEqual([
      { featureType: "fulltext", config: { analyzer: "ik_max_word" } },
      { featureType: "vector", config: { embedding_model: "embed-1" } },
    ]);
  });

  it("reads form values back from resource features", () => {
    const values = indexFormValuesFromResource({
      indexConfig: { buildKeyFields: ["id"], defaultEmbeddingModel: "embed-1" },
      schema: [
        {
          name: "title",
          type: "string",
          features: [{ featureType: "fulltext", config: { analyzer: "standard" } }],
        },
        {
          name: "body",
          type: "string",
          features: [{ featureType: "vector", config: { embedding_model: "embed-1" } }],
        },
      ],
    });

    expect(values).toEqual({
      buildKeyFields: ["id"],
      embeddingFields: ["body"],
      embeddingModel: "embed-1",
      fulltextFields: ["title"],
      fulltextAnalyzer: "standard",
    });
  });
});
