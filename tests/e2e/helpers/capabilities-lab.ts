import type { APIRequestContext } from "@playwright/test";

import { BUSINESS_DOMAIN, expectOk } from "./common";
import { OSS_MOCK_DOCKER_URL } from "./oss-mock";

export const LAB_API_BASE_URL =
  process.env.E2E_LAB_API_BASE_URL ?? "http://127.0.0.1:9010/api/capabilities-lab/v1";

export function labApiHeaders(contentType = "application/json") {
  const headers: Record<string, string> = {
    "x-business-domain": BUSINESS_DOMAIN,
    Accept: "application/json",
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  return headers;
}

export async function assertCapabilitiesLabReady(request: APIRequestContext) {
  const response = await request.get(`${LAB_API_BASE_URL}/health`, {
    headers: labApiHeaders(),
  });

  if (!response.ok()) {
    throw new Error(
      `capabilities-lab unavailable (${response.status()}). Start execution-factory-dev stack with capabilities-lab.`,
    );
  }
}

/** Unique OpenAPI path per test run to avoid duplicate-path bundle failures in shared groups. */
export function buildLabWeatherOpenApi(toolName: string, uniqueSuffix?: string) {
  const pathSuffix = uniqueSuffix ?? toolName.replace(/[^a-zA-Z0-9]/g, "_");
  return {
    openapi: "3.0.3",
    info: { title: toolName, version: "1.0.0" },
    servers: [{ url: OSS_MOCK_DOCKER_URL }],
    paths: {
      [`/proxy/uapis/weather/${pathSuffix}`]: {
        get: {
          summary: toolName,
          parameters: [
            {
              name: "city",
              in: "query",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Weather",
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

export async function createHttpCapabilityViaLabApi(
  request: APIRequestContext,
  input: {
    openapiSpec: string;
    serviceUrl: string;
    name?: string;
    description?: string;
    orchestrationEnabled?: boolean;
  },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/http`, {
    headers: labApiHeaders(),
    data: {
      openapi_spec: input.openapiSpec,
      service_url: input.serviceUrl,
      name: input.name,
      description: input.description,
      orchestration_enabled: input.orchestrationEnabled ?? false,
      group: { mode: "auto" },
    },
  });

  await expectOk(response, "Create HTTP capability via lab API");
  return response.json() as Promise<{
    capability?: {
      id?: string;
      name?: string;
      box_id?: string;
      tool_id?: string;
      group?: { id?: string; name?: string };
      orchestration?: { enabled?: boolean; operator_id?: string };
    };
  }>;
}

export async function listCapabilitiesViaLabApi(
  request: APIRequestContext,
  query?: {
    keyword?: string;
    groupId?: string;
    kind?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const params = new URLSearchParams({
    kind: query?.kind ?? "http",
    page: String(query?.page ?? 1),
    page_size: String(query?.pageSize ?? 50),
  });
  if (query?.keyword) {
    params.set("keyword", query.keyword);
  }
  if (query?.groupId) {
    params.set("group_id", query.groupId);
  }
  if (query?.status && query.status !== "all") {
    params.set("status", query.status);
  }

  const response = await request.get(`${LAB_API_BASE_URL}/capabilities?${params.toString()}`, {
    headers: labApiHeaders(),
  });

  await expectOk(response, "List capabilities via lab API");
  return response.json() as Promise<{
    data?: Array<{
      id?: string;
      name?: string;
      kind?: string;
      box_id?: string;
      tool_id?: string;
      orchestration?: { enabled?: boolean; operator_id?: string };
    }>;
    total?: number;
    page?: number;
    page_size?: number;
  }>;
}

export async function getCapabilityViaLabApi(request: APIRequestContext, capabilityId: string) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "Get capability via lab API");
  return response.json() as Promise<{
    id?: string;
    name?: string;
    kind?: string;
    status?: string;
    orchestration?: { enabled?: boolean; operator_id?: string };
  }>;
}

export async function debugCapabilityViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
  body: Record<string, unknown> = { city: "beijing" },
) {
  const response = await request.post(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/debug`,
    {
      headers: labApiHeaders(),
      data: { query: body },
    },
  );

  await expectOk(response, "Debug capability via lab API");
  return response.json() as Promise<{
    status_code?: number;
    body?: unknown;
    duration_ms?: number;
    error?: string;
  }>;
}

export async function publishCapabilityViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
  status = "published",
) {
  const response = await request.post(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/publish`,
    {
      headers: labApiHeaders(),
      data: { status },
    },
  );

  await expectOk(response, "Publish capability via lab API");
  return response.json() as Promise<{ ok?: boolean; status?: string }>;
}

export async function publishGroupViaLabApi(
  request: APIRequestContext,
  groupId: string,
  status = "published",
) {
  const response = await request.post(
    `${LAB_API_BASE_URL}/groups/${encodeURIComponent(groupId)}/publish`,
    {
      headers: labApiHeaders(),
      data: { status },
    },
  );

  await expectOk(response, "Publish group via lab API");
  return response.json() as Promise<{ ok?: boolean; status?: string }>;
}

export async function enableOrchestrationViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
) {
  const response = await request.post(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/orchestration/enable`,
    { headers: labApiHeaders(), data: {} },
  );

  await expectOk(response, "Enable orchestration via lab API");
  return response.json() as Promise<{ operator_id?: string }>;
}

export async function getOrchestrationViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/orchestration`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "Get orchestration via lab API");
  return response.json() as Promise<{
    enabled?: boolean;
    operator_id?: string;
    tool_id?: string;
    box_id?: string;
  }>;
}

export async function listVersionsViaLabApi(request: APIRequestContext, capabilityId: string) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/versions`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "List versions via lab API");
  return response.json() as Promise<{
    kind?: string;
    versions?: Array<{ version?: string; status?: string }>;
  }>;
}

export async function importOpenApiViaLabApi(
  request: APIRequestContext,
  input: {
    openapiSpec: string;
    serviceUrl: string;
    description?: string;
    orchestrationEnabled?: boolean;
  },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/http/import`, {
    headers: labApiHeaders(),
    data: {
      openapi_spec: input.openapiSpec,
      service_url: input.serviceUrl,
      description: input.description,
      orchestration_enabled: input.orchestrationEnabled ?? false,
      group: { mode: "auto" },
    },
  });

  await expectOk(response, "Import OpenAPI via lab API");
  return response.json() as Promise<{
    box_id?: string;
    capabilities?: Array<{ id?: string; name?: string }>;
  }>;
}

export async function registerMcpViaLabApi(
  request: APIRequestContext,
  input: { name: string; url: string; description?: string },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/mcp`, {
    headers: labApiHeaders(),
    data: {
      name: input.name,
      url: input.url,
      description: input.description,
      mode: "sse",
      creation_type: "custom",
      category: "other_category",
    },
  });

  await expectOk(response, "Register MCP via lab API");
  return response.json() as Promise<{
    capability?: { id?: string; name?: string; mcp_id?: string };
  }>;
}

export async function registerSkillZipViaLabApi(
  request: APIRequestContext,
  zipBuffer: Buffer,
  filename = "skill.zip",
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/skill`, {
    headers: labApiHeaders(""),
    multipart: {
      file_type: "zip",
      category: "other_category",
      source: "custom",
      file: {
        name: filename,
        mimeType: "application/zip",
        buffer: zipBuffer,
      },
    },
  });

  await expectOk(response, "Register skill via lab API");
  return response.json() as Promise<{
    capability?: { id?: string; name?: string; skill_id?: string };
  }>;
}

export async function deleteCapabilityViaLabApi(request: APIRequestContext, capabilityId: string) {
  const response = await request.delete(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "Delete capability via lab API");
  return response.json() as Promise<{ ok?: boolean }>;
}

export async function updateHttpCapabilityViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
  input: { name?: string; description?: string; openapi_spec?: string },
) {
  const response = await request.patch(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}`,
    {
      headers: labApiHeaders(),
      data: input,
    },
  );

  await expectOk(response, "Update HTTP capability via lab API");
  return response.json() as Promise<{ id?: string; name?: string; description?: string }>;
}

export async function updateCapabilityViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
  input: Record<string, unknown>,
) {
  const response = await request.patch(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}`,
    {
      headers: labApiHeaders(),
      data: input,
    },
  );

  await expectOk(response, "Update capability via lab API");
  return response.json() as Promise<{ id?: string; name?: string; kind?: string }>;
}

export async function listCategoriesViaLabApi(request: APIRequestContext) {
  const response = await request.get(`${LAB_API_BASE_URL}/categories`, {
    headers: labApiHeaders(),
  });

  await expectOk(response, "List categories via lab API");
  return response.json() as Promise<{
    data?: Array<{ category_type?: string; name?: string }>;
  }>;
}

export async function listMcpToolsViaLabApi(request: APIRequestContext, capabilityId: string) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/mcp/tools`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "List MCP tools via lab API");
  return response.json() as Promise<{ tools?: Array<{ name?: string }> }>;
}

export async function downloadSkillPackageViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/skill/download`,
    { headers: labApiHeaders("") },
  );

  await expectOk(response, "Download skill package via lab API");
  return response.body();
}

export async function updateSkillPackageViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
  zipBuffer: Buffer,
  filename = "skill.zip",
) {
  const response = await request.put(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/skill/package`,
    {
      headers: labApiHeaders(""),
      multipart: {
        file_type: "zip",
        file: {
          name: filename,
          mimeType: "application/zip",
          buffer: zipBuffer,
        },
      },
    },
  );

  await expectOk(response, "Update skill package via lab API");
  return response.json() as Promise<{ capability?: { id?: string; name?: string } }>;
}

export async function registerSkillContentViaLabApi(
  request: APIRequestContext,
  content: string,
  filename = "SKILL.md",
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/skill`, {
    headers: labApiHeaders(""),
    multipart: {
      file_type: "content",
      category: "other_category",
      source: "custom",
      file: {
        name: filename,
        mimeType: "text/markdown",
        buffer: Buffer.from(content, "utf-8"),
      },
    },
  });

  await expectOk(response, "Register skill content via lab API");
  return response.json() as Promise<{
    capability?: { id?: string; name?: string; skill_id?: string };
  }>;
}

export async function exportCapabilityViaLabApi(
  request: APIRequestContext,
  capabilityId: string,
) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/export`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "Export capability via lab API");
  return response.json() as Promise<Record<string, unknown>>;
}

export async function importCapabilityPackageViaLabApi(
  request: APIRequestContext,
  payload: unknown,
  mode: "create" | "upsert" = "create",
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/import`, {
    headers: labApiHeaders(""),
    multipart: {
      mode,
      file: {
        name: "import.adp.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(payload)),
      },
    },
  });

  await expectOk(response, "Import capability package via lab API");
  return response.json() as Promise<{ component_type?: string; mode?: string }>;
}

export async function listCatalogViaLabApi(
  request: APIRequestContext,
  query?: { keyword?: string; kind?: string; page?: number; pageSize?: number },
) {
  const params = new URLSearchParams({
    kind: query?.kind ?? "all",
    page: String(query?.page ?? 1),
    page_size: String(query?.pageSize ?? 50),
  });
  if (query?.keyword) {
    params.set("keyword", query.keyword);
  }

  const response = await request.get(`${LAB_API_BASE_URL}/catalog?${params.toString()}`, {
    headers: labApiHeaders(),
  });

  await expectOk(response, "List catalog via lab API");
  return response.json() as Promise<{
    data?: Array<{
      id?: string;
      kind?: string;
      name?: string;
      installed?: boolean;
    }>;
    total?: number;
  }>;
}

export async function installFromCatalogViaLabApi(
  request: APIRequestContext,
  input: {
    kind: "http" | "mcp" | "skill";
    sourceId: string;
    mode?: "create" | "upsert";
    name?: string;
  },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/catalog/install`, {
    headers: labApiHeaders(),
    data: {
      kind: input.kind,
      source_id: input.sourceId,
      mode: input.mode ?? "create",
      name: input.name,
    },
  });

  await expectOk(response, "Install from catalog via lab API");
  return response.json() as Promise<{
    component_type?: string;
    mode?: string;
    capabilities?: Array<{
      id?: string;
      name?: string;
      kind?: string;
      box_id?: string;
    }>;
  }>;
}

export async function executePythonViaLabApi(
  request: APIRequestContext,
  code: string,
  event: Record<string, unknown> = { x: 41 },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/function/execute`, {
    headers: labApiHeaders(),
    data: { code, event, timeout: 30 },
  });

  await expectOk(response, "Execute Python via lab API");
  return response.json() as Promise<{
    output?: { result?: number } | number | Record<string, unknown>;
    error?: string;
  }>;
}

export async function getPythonTemplateViaLabApi(request: APIRequestContext) {
  const response = await request.get(`${LAB_API_BASE_URL}/template/python`, {
    headers: labApiHeaders(),
  });

  await expectOk(response, "Get Python template via lab API");
  return response.json() as Promise<{ template?: string }>;
}

export async function createFunctionCapabilityViaLabApi(
  request: APIRequestContext,
  input: { name: string; code: string; description?: string },
) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/function`, {
    headers: labApiHeaders(),
    data: {
      name: input.name,
      description: input.description,
      code: input.code,
      group: { mode: "auto" },
      inputs: [{ name: "event", type: "object" }],
      outputs: [{ name: "result", type: "object" }],
    },
  });

  await expectOk(response, "Create function capability via lab API");
  return response.json() as Promise<{
    capability?: { id?: string; name?: string; kind?: string; box_id?: string };
  }>;
}

export async function parseMcpSseViaLabApi(request: APIRequestContext, url: string) {
  const response = await request.post(`${LAB_API_BASE_URL}/capabilities/mcp/parse-sse`, {
    headers: labApiHeaders(),
    data: { url, mode: "sse" },
  });

  await expectOk(response, "Parse MCP SSE via lab API");
  return response.json() as Promise<{ tools?: Array<{ name?: string }> }>;
}

export async function getSkillContentViaLabApi(request: APIRequestContext, capabilityId: string) {
  const response = await request.get(
    `${LAB_API_BASE_URL}/capabilities/${encodeURIComponent(capabilityId)}/skill/content`,
    { headers: labApiHeaders() },
  );

  await expectOk(response, "Get skill content via lab API");
  return response.json() as Promise<{ files?: Array<{ rel_path?: string }>; content?: string }>;
}

export async function getLabMetaViaLabApi(request: APIRequestContext) {
  const response = await request.get(`${LAB_API_BASE_URL}/meta`, {
    headers: labApiHeaders(),
  });

  await expectOk(response, "Get lab meta via lab API");
  return response.json() as Promise<{
    service?: string;
    version?: string;
    features?: Record<string, boolean>;
  }>;
}

export async function getLabMetricsViaLabApi(request: APIRequestContext) {
  const response = await request.get(`${LAB_API_BASE_URL}/metrics`, {
    headers: labApiHeaders(""),
  });

  await expectOk(response, "Get lab metrics via lab API");
  return response.text();
}
