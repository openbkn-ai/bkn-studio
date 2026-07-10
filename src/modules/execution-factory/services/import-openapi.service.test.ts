/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";
import { importOpenApiTools } from "@/modules/execution-factory/services/tool.service";
import { registerOpenApiImport } from "@/modules/execution-factory/services/import-openapi.service";

vi.mock("@/modules/execution-factory/services/capability-bundle.service", () => ({
  registerOpenApiBundle: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  createToolbox: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  importOpenApiTools: vi.fn(),
}));

const petstoreSpec = JSON.stringify({
  openapi: "3.0.4",
  info: { title: "Swagger Petstore", version: "1.0.0" },
  servers: [{ url: "/api/v3" }],
  paths: {
    "/pet": {
      put: {
        summary: "Update a pet",
        responses: { "200": { description: "OK" } },
      },
    },
  },
});

describe("registerOpenApiImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createToolbox).mockResolvedValue({
      boxId: "box-1",
      id: "box-1",
      name: "Swagger_Petstore_OpenAPI_3_0",
      description: "Petstore",
      metadataType: "openapi",
      source: "custom",
      status: "offline",
      category: "other_category",
      toolCount: 0,
      creator: "admin",
      updatedBy: "admin",
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(importOpenApiTools).mockResolvedValue({
      successIds: ["tool-1"],
      successCount: 1,
      failureCount: 0,
      failures: [],
    });
  });

  it("submits the resolved service URL inside the OpenAPI document", async () => {
    await registerOpenApiImport({
      openapiSpec: petstoreSpec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxName: "Swagger_Petstore_OpenAPI_3_0",
    });

    const submittedSpec = vi.mocked(importOpenApiTools).mock.calls[0]?.[1];
    const submittedDoc = JSON.parse(submittedSpec) as { servers?: Array<{ url?: string }> };

    expect(submittedDoc.servers?.[0]?.url).toBe("https://petstore3.swagger.io/api/v3");
  });

  it("truncates generated toolbox descriptions before creating a toolbox", async () => {
    await registerOpenApiImport({
      openapiSpec: petstoreSpec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxDescription: "x".repeat(501),
      toolboxName: "Swagger_Petstore_OpenAPI_3_0",
    });

    expect(vi.mocked(createToolbox).mock.calls[0]?.[0].description).toHaveLength(500);
  });

  it("submits backend-safe OpenAPI operation summaries", async () => {
    const spec = JSON.stringify({
      openapi: "3.0.4",
      info: { title: "Swagger Petstore", version: "1.0.0" },
      servers: [{ url: "/api/v3" }],
      paths: {
        "/user/createWithList": {
          post: {
            summary: "Creates list of users with given input array.",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    await registerOpenApiImport({
      openapiSpec: spec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxName: "Swagger_Petstore_OpenAPI_3_0",
    });

    const submittedSpec = vi.mocked(importOpenApiTools).mock.calls[0]?.[1];
    const submittedDoc = JSON.parse(submittedSpec) as {
      paths?: Record<string, Record<string, { summary?: string }>>;
    };

    expect(submittedDoc.paths?.["/user/createWithList"]?.post?.summary).toBe(
      "Creates_list_of_users_with_given_input_array",
    );
  });
});
