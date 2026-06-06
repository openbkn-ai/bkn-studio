import type { APIRequestContext } from "@playwright/test";

export const BUSINESS_DOMAIN = process.env.E2E_BUSINESS_DOMAIN ?? "bd_public";
export const API_BASE_URL =
  process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:9000/api";
export const API_PREFIX = `${API_BASE_URL}/agent-operator-integration/v1`;

export type RegisteredOperator = {
  operatorId: string;
  version: string;
  name: string;
};

export function buildOperatorName(suffix: string) {
  return `at_e2e_operator_${suffix}`;
}

export function buildMinimalOpenApiSpec(operatorName: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: operatorName,
      description: "Execution factory Playwright AT operator",
      version: "1.0.0",
    },
    servers: [{ url: "http://127.0.0.1:9000", description: "local" }],
    paths: {
      "/execute": {
        post: {
          summary: operatorName,
          description: "Playwright AT execute endpoint",
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

export function defaultApiHeaders() {
  return {
    "x-business-domain": BUSINESS_DOMAIN,
    Accept: "application/json",
  };
}

export async function assertBackendReady(request: APIRequestContext) {
  const response = await request.get(
    `${API_PREFIX}/operator/info/list?page=1&page_size=1`,
    { headers: defaultApiHeaders() },
  );

  if (!response.ok()) {
    throw new Error(
      `Backend unavailable (${response.status()}). Start execution-factory-dev stack before running AT.`,
    );
  }
}

export async function registerOperatorViaApi(
  request: APIRequestContext,
  operatorName: string,
): Promise<RegisteredOperator> {
  const response = await request.post(`${API_PREFIX}/operator/register`, {
    headers: {
      ...defaultApiHeaders(),
      "Content-Type": "application/json",
    },
    data: {
      data: JSON.stringify(buildMinimalOpenApiSpec(operatorName)),
      direct_publish: false,
      operator_metadata_type: "openapi",
      operator_info: { category: "other_category" },
    },
  });

  if (!response.ok()) {
    throw new Error(`Register failed (${response.status()}): ${await response.text()}`);
  }

  const body = (await response.json()) as Array<{
    operator_id?: string;
    version?: string;
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

  if (!detailResponse.ok()) {
    throw new Error(`Get operator failed (${detailResponse.status()})`);
  }

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

  if (!response.ok()) {
    throw new Error(`Delete failed (${response.status()}): ${await response.text()}`);
  }
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

  if (!response.ok()) {
    throw new Error(
      `Status update failed (${response.status()}): ${await response.text()}`,
    );
  }
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
    // Ignore if already offline or unpublish.
  }

  await deleteOperatorViaApi(request, operator);
}
