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

const petstoreYamlSpec = `openapi: "3.0.3"
info:
  title: Swagger Petstore
  version: "1.0.0"
servers:
  - url: https://petstore3.swagger.io/api/v3
paths:
  /pet:
    get:
      summary: Get pet
      responses:
        "200":
          description: OK
`;

describe("registerOpenApiImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createToolbox).mockResolvedValue({
      boxId: "box-1",
      name: "Swagger_Petstore_OpenAPI_3_0",
      description: "Petstore",
      metadataType: "openapi",
      status: "offline",
      categoryType: "other_category",
      categoryName: "other_category",
      toolCount: 0,
      createUser: "admin",
      updateUser: "admin",
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

  it("converts an imported YAML document to JSON before submission", async () => {
    await registerOpenApiImport({
      openapiSpec: petstoreYamlSpec,
      toolboxName: "Swagger_Petstore_OpenAPI_3_0",
    });

    const submittedSpec = vi.mocked(importOpenApiTools).mock.calls[0]?.[1];
    expect(submittedSpec).toEqual(expect.any(String));
    const submittedDoc = JSON.parse(String(submittedSpec)) as Record<string, unknown>;
    expect(submittedDoc).toMatchObject({
      openapi: "3.0.3",
      servers: [{ url: "https://petstore3.swagger.io/api/v3" }],
    });
  });

  it("uses the selected existing toolbox without creating a new one", async () => {
    await registerOpenApiImport({
      boxId: "box-existing",
      openapiSpec: petstoreSpec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxMode: "existing",
    });

    expect(createToolbox).not.toHaveBeenCalled();
    expect(importOpenApiTools).toHaveBeenCalledWith(
      "box-existing",
      expect.any(String),
      undefined,
    );
  });

  it("does not silently create a toolbox when existing mode has no box id", async () => {
    await expect(
      registerOpenApiImport({
        openapiSpec: petstoreSpec,
        serviceUrl: "https://petstore3.swagger.io/api/v3",
        toolboxMode: "existing",
        toolboxName: "Should Not Be Created",
      }),
    ).rejects.toThrow("未提交工具集 ID");

    expect(createToolbox).not.toHaveBeenCalled();
    expect(importOpenApiTools).not.toHaveBeenCalled();
  });

  it("normalizes toolbox name spaces before creating a toolbox", async () => {
    await registerOpenApiImport({
      openapiSpec: petstoreSpec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxName: "示例工具箱 API",
    });

    expect(vi.mocked(createToolbox).mock.calls[0]?.[0].name).toBe("示例工具箱_API");
  });

  it("creates an empty toolbox then imports tools (no openapi data on create)", async () => {
    await registerOpenApiImport({
      openapiSpec: petstoreSpec,
      serviceUrl: "https://petstore3.swagger.io/api/v3",
      toolboxName: "Swagger_Petstore_OpenAPI_3_0",
      category: "animals",
      toolboxMode: "new",
    });

    expect(createToolbox).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Swagger_Petstore_OpenAPI_3_0",
        category: "animals",
        metadataType: "openapi",
        serviceUrl: "https://petstore3.swagger.io/api/v3",
      }),
    );
    const createArg = vi.mocked(createToolbox).mock.calls[0]?.[0];
    expect(createArg).toBeDefined();
    expect(createArg).not.toHaveProperty("openapiSpec");

    expect(importOpenApiTools).toHaveBeenCalledWith(
      "box-1",
      expect.any(String),
      undefined,
    );
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
