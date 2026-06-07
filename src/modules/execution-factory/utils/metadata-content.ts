import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";

type InternalApiSpec = {
  components?: { schemas?: Record<string, unknown> };
  parameters?: Array<Record<string, unknown>>;
  request_body?: {
    content?: Record<string, unknown>;
    description?: string;
    required?: boolean;
  };
  responses?: Array<{
    content?: Record<string, unknown>;
    description?: string;
    status_code?: string;
  }>;
};

export type BackendMetadata = {
  api_spec?: unknown;
  description?: string;
  function_content?: {
    code?: string;
    dependencies?: FunctionInputPayload["dependencies"];
    script_type?: string;
  };
  method?: string;
  path?: string;
  server_url?: string;
  summary?: string;
};

function isFullOpenApiDocument(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).openapi === "string"
  );
}

export function buildOpenApiDocumentFromMetadata(metadata: BackendMetadata): string | undefined {
  if (!metadata.api_spec) {
    return undefined;
  }

  const apiSpec =
    typeof metadata.api_spec === "string"
      ? (JSON.parse(metadata.api_spec) as InternalApiSpec)
      : (metadata.api_spec as InternalApiSpec);

  if (isFullOpenApiDocument(apiSpec)) {
    return JSON.stringify(apiSpec, null, 2);
  }

  const path = metadata.path ?? "/";
  const method = (metadata.method ?? "POST").toLowerCase();
  const summary = metadata.summary ?? metadata.description ?? "Operator";
  const description = metadata.description ?? summary;
  const serverUrl = metadata.server_url ?? "http://localhost:8080";

  const operation: Record<string, unknown> = {
    summary,
    description,
  };

  if (apiSpec.parameters?.length) {
    operation.parameters = apiSpec.parameters;
  }

  if (apiSpec.request_body?.content) {
    operation.requestBody = {
      description: apiSpec.request_body.description ?? "",
      required: apiSpec.request_body.required ?? false,
      content: apiSpec.request_body.content,
    };
  }

  const responses: Record<string, unknown> = {};
  for (const response of apiSpec.responses ?? []) {
    if (!response.status_code) {
      continue;
    }

    responses[response.status_code] = {
      description: response.description ?? "OK",
      ...(response.content ? { content: response.content } : {}),
    };
  }

  if (Object.keys(responses).length === 0) {
    responses["200"] = {
      description: "OK",
      content: {
        "application/json": {
          schema: { type: "object" },
        },
      },
    };
  }

  operation.responses = responses;

  const document: Record<string, unknown> = {
    openapi: "3.0.3",
    info: {
      title: summary,
      description,
      version: "1.0.0",
    },
    servers: [{ url: serverUrl }],
    paths: {
      [path]: {
        [method]: operation,
      },
    },
  };

  if (apiSpec.components?.schemas && Object.keys(apiSpec.components.schemas).length > 0) {
    document.components = apiSpec.components;
  }

  return JSON.stringify(document, null, 2);
}

export function serializeOpenApiSpec(metadata?: BackendMetadata): string | undefined {
  if (!metadata?.api_spec) {
    return undefined;
  }

  if (typeof metadata.api_spec === "string") {
    try {
      const parsed = JSON.parse(metadata.api_spec) as unknown;
      if (isFullOpenApiDocument(parsed)) {
        return JSON.stringify(parsed, null, 2);
      }
    } catch {
      return metadata.api_spec;
    }
  }

  if (isFullOpenApiDocument(metadata.api_spec)) {
    return JSON.stringify(metadata.api_spec, null, 2);
  }

  return buildOpenApiDocumentFromMetadata(metadata);
}

export function validateOpenApiDocumentText(
  openapiSpec?: string,
): { ok: true } | { ok: false; reason: string } {
  if (!openapiSpec?.trim()) {
    return { ok: false, reason: "OpenAPI 规范不能为空。" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(openapiSpec);
  } catch {
    return { ok: false, reason: "JSON 语法无效，无法解析。" };
  }

  if (!isFullOpenApiDocument(parsed)) {
    return {
      ok: false,
      reason:
        "缺少 OpenAPI 3.0 顶层字段（openapi、info、servers、paths）。编辑页应展示完整文档，而不是 api_spec 片段。",
    };
  }

  const doc = parsed as Record<string, unknown>;
  const missing: string[] = [];

  if (!doc.info) {
    missing.push("info");
  }
  if (!doc.servers) {
    missing.push("servers");
  }
  if (!doc.paths) {
    missing.push("paths");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `缺少必填顶层字段：${missing.join("、")}。`,
    };
  }

  return { ok: true };
}

export function parseOpenApiDataPayload(
  openapiSpec?: string,
  mode: "register" | "edit" = "register",
): string | Record<string, unknown> | undefined {
  if (!openapiSpec?.trim()) {
    return undefined;
  }

  const trimmed = openapiSpec.trim();

  if (mode === "register") {
    // `/operator/register` binds `data` as string.
    return trimmed;
  }

  // `/operator/info` and similar edit APIs bind `data` as json.RawMessage.
  // Sending a JSON string here makes the backend try to parse a quoted string
  // instead of an OpenAPI object (see reference operator-web E2E helpers).
  return JSON.parse(trimmed) as Record<string, unknown>;
}

export function mapFunctionContent(
  metadata?: BackendMetadata,
): FunctionInputPayload | undefined {
  const content = metadata?.function_content;

  if (!content?.code) {
    return undefined;
  }

  return {
    code: content.code,
    script_type: (content.script_type as "python") ?? "python",
    dependencies: content.dependencies,
  };
}
