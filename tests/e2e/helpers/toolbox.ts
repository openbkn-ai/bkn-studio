import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, buildUniqueName, defaultApiHeaders, expectOk } from "./common";
import { buildMinimalOpenApiSpec } from "./operator";

export function buildMultiEndpointOpenApiSpec(baseName: string) {
  const single = buildMinimalOpenApiSpec(baseName);
  return {
    ...single,
    paths: {
      "/execute-a": {
        post: {
          summary: `${baseName}_tool_a`,
          description: "E2E tool A",
          requestBody: single.paths["/execute"].post.requestBody,
          responses: single.paths["/execute"].post.responses,
        },
      },
      "/execute-b": {
        post: {
          summary: `${baseName}_tool_b`,
          description: "E2E tool B",
          requestBody: single.paths["/execute"].post.requestBody,
          responses: single.paths["/execute"].post.responses,
        },
      },
    },
  };
}

export async function importOpenApiToolsBatchViaApi(
  request: APIRequestContext,
  boxId: string,
  baseName: string,
) {
  const openApiSpec = buildMultiEndpointOpenApiSpec(baseName);

  const response = await request.post(`${API_PREFIX}/tool-box/${boxId}/tool`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      metadata_type: "openapi",
      data: openApiSpec,
      tool_desc: "E2E batch import",
    },
  });

  await expectOk(response, "Batch import OpenAPI tools");

  const body = (await response.json()) as {
    success_ids?: string[];
    success_count?: number;
    failure_count?: number;
  };

  return {
    toolIds: body.success_ids ?? [],
    successCount: body.success_count ?? body.success_ids?.length ?? 0,
    failureCount: body.failure_count ?? 0,
  };
}

export async function unpublishToolboxViaApi(request: APIRequestContext, boxId: string) {
  const response = await request.post(`${API_PREFIX}/tool-box/${boxId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "unpublish" },
  });
  await expectOk(response, "Unpublish toolbox");
}

export async function offlineToolboxViaApi(request: APIRequestContext, boxId: string) {
  const response = await request.post(`${API_PREFIX}/tool-box/${boxId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "offline" },
  });
  await expectOk(response, "Offline toolbox");
}

export type ToolboxRecord = {
  boxId: string;
  name: string;
};

export type ToolRecord = {
  toolId: string;
  name: string;
};

export function buildToolboxName(suffix?: string) {
  return buildUniqueName(suffix ? `at_e2e_toolbox_${suffix}` : "at_e2e_toolbox");
}

export async function createToolboxViaApi(
  request: APIRequestContext,
  name: string,
): Promise<ToolboxRecord> {
  const openApiSpec = buildMinimalOpenApiSpec(name);

  const response = await request.post(`${API_PREFIX}/tool-box`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      box_category: "other_category",
      box_desc: "E2E toolbox",
      box_name: name,
      box_svc_url: "http://127.0.0.1:9000/api/agent-operator-integration",
      data: openApiSpec,
      metadata_type: "openapi",
    },
  });

  await expectOk(response, "Create toolbox");

  const body = (await response.json()) as { box_id?: string };
  if (!body.box_id) {
    throw new Error(`Create toolbox failed: ${JSON.stringify(body)}`);
  }

  return { boxId: body.box_id, name };
}

export async function createToolViaApi(
  request: APIRequestContext,
  boxId: string,
  toolName: string,
): Promise<ToolRecord> {
  const openApiSpec = buildMinimalOpenApiSpec(toolName);

  const response = await request.post(`${API_PREFIX}/tool-box/${boxId}/tool`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      metadata_type: "openapi",
      data: openApiSpec,
      tool_name: toolName,
      tool_desc: "E2E tool",
    },
  });

  await expectOk(response, "Create tool");

  const body = (await response.json()) as {
    tool_id?: string;
    success_ids?: string[];
  };
  const toolId = body.tool_id ?? body.success_ids?.[0];
  if (!toolId) {
    throw new Error(`Create tool failed: ${JSON.stringify(body)}`);
  }

  return { toolId, name: toolName };
}

export async function publishToolboxViaApi(
  request: APIRequestContext,
  boxId: string,
) {
  const response = await request.post(`${API_PREFIX}/tool-box/${boxId}/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: { status: "published" },
  });
  await expectOk(response, "Publish toolbox");
}

export async function exportToolboxViaApi(request: APIRequestContext, boxId: string) {
  const response = await request.get(`${API_PREFIX}/impex/export/toolbox/${boxId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Export toolbox");
  return response.json();
}

export async function importToolboxViaApi(
  request: APIRequestContext,
  payload: unknown,
  mode: "create" | "upsert" = "create",
) {
  const response = await request.post(`${API_PREFIX}/impex/import/toolbox`, {
    headers: defaultApiHeaders(),
    multipart: {
      mode,
      data: {
        name: "import.adp.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(payload)),
      },
    },
  });
  await expectOk(response, "Import toolbox");
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

export async function deleteToolboxViaApi(request: APIRequestContext, boxId: string) {
  try {
    await request.post(`${API_PREFIX}/tool-box/${boxId}/status`, {
      headers: {
        ...defaultApiHeaders(),
        "Content-Type": "application/json",
      },
      data: { status: "offline" },
    });
  } catch {
    // Ignore offline errors.
  }

  const response = await request.delete(`${API_PREFIX}/tool-box/${boxId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Delete toolbox");
}

export async function cleanupToolboxViaApi(request: APIRequestContext, boxId: string) {
  await deleteToolboxViaApi(request, boxId);
}
