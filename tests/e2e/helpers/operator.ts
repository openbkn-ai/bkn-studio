import type { APIRequestContext } from "@playwright/test";

import {
  API_PREFIX,
  buildUniqueName,
  defaultApiHeaders,
  expectOk,
} from "./common";

export {
  assertBackendReady,
  apiUrl,
  buildUniqueName,
  BUSINESS_DOMAIN,
  API_BASE_URL,
  API_PREFIX,
  defaultApiHeaders,
} from "./common";

export type RegisteredOperator = {
  operatorId: string;
  version: string;
  name: string;
};

export function buildOperatorName(suffix?: string) {
  return buildUniqueName(suffix ? `at_e2e_operator_${suffix}` : "at_e2e_operator");
}

export function buildMinimalOpenApiSpec(operatorName: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: operatorName,
      description: "Execution factory E2E operator",
      version: "1.0.0",
    },
    servers: [{ url: "http://127.0.0.1:9000", description: "local" }],
    paths: {
      "/execute": {
        post: {
          summary: operatorName,
          description: "E2E execute endpoint",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["input"],
                  properties: {
                    input: { type: "string", description: "Input text" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function buildFunctionHandlerCode() {
  return [
    "def handler(event):",
    "    x = event.get('x', 0)",
    "    return {'result': x + 1}",
  ].join("\n");
}

export async function registerOperatorViaApi(
  request: APIRequestContext,
  operatorName: string,
  options?: { metadataType?: "openapi" | "function"; directPublish?: boolean },
): Promise<RegisteredOperator> {
  const metadataType = options?.metadataType ?? "openapi";
  const payload =
    metadataType === "function"
      ? {
          name: operatorName,
          description: "E2E function operator",
          operator_metadata_type: "function",
          direct_publish: options?.directPublish ?? false,
          function_input: {
            name: operatorName,
            description: "E2E function operator",
            script_type: "python",
            code: buildFunctionHandlerCode(),
            inputs: [{ name: "x", type: "number", description: "input x" }],
            outputs: [],
          },
          operator_info: { category: "other_category" },
        }
      : {
          data: JSON.stringify(buildMinimalOpenApiSpec(operatorName)),
          direct_publish: options?.directPublish ?? false,
          operator_metadata_type: "openapi",
          operator_info: { category: "other_category" },
        };

  const response = await request.post(`${API_PREFIX}/operator/register`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: payload,
  });

  await expectOk(response, "Register operator");

  const body = (await response.json()) as Array<{
    operator_id?: string;
    status?: string;
    error?: unknown;
  }>;

  const result = body[0];
  if (!result?.operator_id || result.status === "failed") {
    throw new Error(`Register failed: ${JSON.stringify(body)}`);
  }

  const detailResponse = await request.get(
    `${API_PREFIX}/operator/info/${result.operator_id}`,
    { headers: defaultApiHeaders() },
  );
  await expectOk(detailResponse, "Get operator detail");

  const detail = (await detailResponse.json()) as {
    name?: string;
    version: string;
  };

  return {
    operatorId: result.operator_id,
    version: detail.version,
    name: detail.name ?? operatorName,
  };
}

export async function exportOperatorViaApi(
  request: APIRequestContext,
  operatorId: string,
) {
  const response = await request.get(`${API_PREFIX}/impex/export/operator/${operatorId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Export operator");
  return response.json();
}

export async function importOperatorViaApi(
  request: APIRequestContext,
  payload: unknown,
  mode: "create" | "upsert" = "create",
) {
  const response = await request.post(`${API_PREFIX}/impex/import/operator`, {
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
  await expectOk(response, "Import operator");
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}

export async function debugOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
  event: Record<string, unknown> = { input: "e2e" },
) {
  const response = await request.post(`${API_PREFIX}/operator/debug`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      operator_id: operator.operatorId,
      version: operator.version,
      event,
    },
  });
  await expectOk(response, "Debug operator");
  return response.json();
}

export async function deleteOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
) {
  const response = await request.delete(`${API_PREFIX}/operator/delete`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: [{ operator_id: operator.operatorId, version: operator.version }],
  });
  await expectOk(response, "Delete operator");
}

export async function updateOperatorStatusViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
  status: "published" | "offline" | "unpublish",
) {
  const response = await request.post(`${API_PREFIX}/operator/status`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: [
      {
        operator_id: operator.operatorId,
        version: operator.version,
        status,
      },
    ],
  });
  await expectOk(response, `Update operator status to ${status}`);
}

export async function publishOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
) {
  await updateOperatorStatusViaApi(request, operator, "published");
}

export async function cleanupOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
) {
  try {
    await updateOperatorStatusViaApi(request, operator, "offline");
  } catch {
    // Ignore if already offline.
  }

  await deleteOperatorViaApi(request, operator);
}

export async function getOperatorDetailViaApi(
  request: APIRequestContext,
  operatorId: string,
) {
  const response = await request.get(`${API_PREFIX}/operator/info/${operatorId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "Get operator detail");
  return response.json() as Promise<{
    name?: string;
    version: string;
    description?: string;
    metadata_type?: string;
  }>;
}

export async function refreshOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
): Promise<RegisteredOperator> {
  const detail = await getOperatorDetailViaApi(request, operator.operatorId);
  return {
    operatorId: operator.operatorId,
    version: detail.version,
    name: detail.name ?? operator.name,
  };
}

export async function updateOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
  operatorName: string,
  description = "E2E updated operator",
) {
  const openApiSpec = buildMinimalOpenApiSpec(operatorName);
  openApiSpec.info.description = description;

  const response = await request.post(`${API_PREFIX}/operator/info`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      operator_id: operator.operatorId,
      data: openApiSpec,
      metadata_type: "openapi",
      name: operatorName,
      description,
      operator_info: { category: "other_category" },
    },
  });
  await expectOk(response, "Update operator");
}

export async function listOperatorHistoryViaApi(
  request: APIRequestContext,
  operatorId: string,
) {
  const response = await request.get(`${API_PREFIX}/operator/history/${operatorId}`, {
    headers: defaultApiHeaders(),
  });
  await expectOk(response, "List operator history");
  const body = await response.json();
  return Array.isArray(body) ? body : [];
}

export async function unpublishOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
) {
  await updateOperatorStatusViaApi(request, operator, "unpublish");
}

export async function offlineOperatorViaApi(
  request: APIRequestContext,
  operator: RegisteredOperator,
) {
  await updateOperatorStatusViaApi(request, operator, "offline");
}
