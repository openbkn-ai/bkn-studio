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

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
]);

/** Backend validates metadata description length before applying form description. */
const OPERATOR_DESCRIPTION_MAX_LENGTH = 500;

export type OpenApiOperationPreview = {
  method: string;
  path: string;
  summary?: string;
};

export type OpenApiDocumentAnalysis =
  | {
      ok: true;
      openApiVersion: string;
      serverUrl?: string;
      operationCount: number;
      operations: OpenApiOperationPreview[];
      operationsMissingSummary: OpenApiOperationPreview[];
    }
  | { ok: false; reason: string };

function isFullOpenApiDocument(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).openapi === "string"
  );
}

function collectOpenApiOperations(
  paths: Record<string, unknown>,
): OpenApiOperationPreview[] {
  const operations: OpenApiOperationPreview[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (!operation || typeof operation !== "object") {
        continue;
      }

      const summary = (operation as { summary?: unknown }).summary;

      operations.push({
        path,
        method: method.toUpperCase(),
        summary: typeof summary === "string" ? summary : undefined,
      });
    }
  }

  return operations;
}

function resolveComponentRefPath(
  doc: Record<string, unknown>,
  ref: string,
): boolean {
  if (!ref.startsWith("#/components/")) {
    return true;
  }

  const segments = ref.slice("#/".length).split("/");
  let current: unknown = doc;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current !== undefined && current !== null;
}

function collectLocalComponentRefs(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalComponentRefs(item, refs));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.$ref === "string" && record.$ref.startsWith("#/components/")) {
    refs.add(record.$ref);
  }

  Object.values(record).forEach((nested) => collectLocalComponentRefs(nested, refs));
}

function findBrokenComponentRef(
  doc: Record<string, unknown>,
): string | undefined {
  const refs = new Set<string>();

  collectLocalComponentRefs(doc, refs);

  for (const ref of refs) {
    if (!resolveComponentRefPath(doc, ref)) {
      return ref;
    }
  }

  return undefined;
}

function findOperationDescriptionTooLong(
  paths: Record<string, unknown>,
): OpenApiOperationPreview | undefined {
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (!operation || typeof operation !== "object") {
        continue;
      }

      const description = (operation as { description?: unknown }).description;

      if (
        typeof description === "string" &&
        description.length > OPERATOR_DESCRIPTION_MAX_LENGTH
      ) {
        const summary = (operation as { summary?: unknown }).summary;

        return {
          path,
          method: method.toUpperCase(),
          summary: typeof summary === "string" ? summary : undefined,
        };
      }
    }
  }

  return undefined;
}

export function analyzeOpenApiDocumentText(
  openapiSpec?: string,
): OpenApiDocumentAnalysis {
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
        "缺少 OpenAPI 顶层字段 openapi。编辑页应展示完整文档，而不是 api_spec 片段。",
    };
  }

  const doc = parsed as Record<string, unknown>;
  const info = doc.info;

  if (!info || typeof info !== "object") {
    return {
      ok: false,
      reason: "info 必须为对象，且包含 title 与 version。",
    };
  }

  const infoRecord = info as Record<string, unknown>;
  const title = infoRecord.title;
  const version = infoRecord.version;

  if (typeof title !== "string" || !title.trim()) {
    return { ok: false, reason: "info.title 不能为空。" };
  }

  if (typeof version !== "string" || !version.trim()) {
    return { ok: false, reason: "info.version 不能为空。" };
  }

  const servers = doc.servers;

  if (!Array.isArray(servers) || servers.length === 0) {
    return { ok: false, reason: "servers 至少需要一个服务地址。" };
  }

  const firstServer = servers[0];

  if (
    !firstServer ||
    typeof firstServer !== "object" ||
    typeof (firstServer as { url?: unknown }).url !== "string" ||
    !(firstServer as { url: string }).url.trim()
  ) {
    return { ok: false, reason: "servers[0].url 不能为空。" };
  }

  const paths = doc.paths;

  if (!paths || typeof paths !== "object") {
    return { ok: false, reason: "缺少必填顶层字段 paths。" };
  }

  const operations = collectOpenApiOperations(paths as Record<string, unknown>);

  if (operations.length === 0) {
    return { ok: false, reason: "paths 中未找到有效的 HTTP 接口定义。" };
  }

  const operationsMissingSummary = operations.filter((operation) => !operation.summary?.trim());

  return {
    ok: true,
    openApiVersion: String(doc.openapi),
    serverUrl: (firstServer as { url: string }).url.trim(),
    operationCount: operations.length,
    operations,
    operationsMissingSummary,
  };
}

export function buildOpenApiDocumentFromMetadata(metadata: BackendMetadata): string | undefined {
  if (!metadata.api_spec) {
    return undefined;
  }

  const apiSpec =
    typeof metadata.api_spec === "string"
      ? (JSON.parse(metadata.api_spec) as InternalApiSpec)
      : (metadata.api_spec as InternalApiSpec);

  // Probe a cast expression, not the bare `apiSpec` reference: the type guard
  // narrows to Record<string, unknown>, which would otherwise collapse the
  // negative branch (InternalApiSpec) to `never` and break every field read below.
  if (isFullOpenApiDocument(apiSpec as unknown)) {
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
  const analysis = analyzeOpenApiDocumentText(openapiSpec);

  if (!analysis.ok) {
    return analysis;
  }

  if (analysis.operationsMissingSummary.length > 0) {
    const first = analysis.operationsMissingSummary[0];

    return {
      ok: false,
      reason: `接口 ${first.method} ${first.path} 缺少 summary，请补充后再保存。`,
    };
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(openapiSpec ?? "") as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "JSON 语法无效，无法解析。" };
  }

  const brokenRef = findBrokenComponentRef(parsed);

  if (brokenRef) {
    return {
      ok: false,
      reason: `文档引用了未定义的组件 ${brokenRef}。请补齐 components 段，或改为内联响应定义。`,
    };
  }

  const paths = parsed.paths;

  if (paths && typeof paths === "object") {
    const longDescriptionOperation = findOperationDescriptionTooLong(
      paths as Record<string, unknown>,
    );

    if (longDescriptionOperation) {
      return {
        ok: false,
        reason: `接口 ${longDescriptionOperation.method} ${longDescriptionOperation.path} 的 description 超过 ${OPERATOR_DESCRIPTION_MAX_LENGTH} 字符。请缩短后再保存。`,
      };
    }
  }

  return { ok: true };
}

export function extractOpenApiMetadataHints(
  openapiSpec?: string,
): { title?: string; description?: string } {
  if (!openapiSpec?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(openapiSpec) as {
      info?: { description?: string; title?: string };
    };

    return {
      title: parsed.info?.title,
      description: parsed.info?.description,
    };
  } catch {
    return {};
  }
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
