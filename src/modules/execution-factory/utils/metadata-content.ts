/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import { parseFunctionParametersFromApiSpec } from "@/modules/execution-factory/utils/function-parameter-schema";
import { parse as parseYaml } from "yaml";

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
    inputs?: FunctionInputPayload["inputs"];
    outputs?: FunctionInputPayload["outputs"];
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
export const CAPABILITY_DESCRIPTION_MAX_LENGTH = 2048;
export const TOOLBOX_DESCRIPTION_MAX_LENGTH = 500;

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

export type OpenApiSpecSource =
  | { kind: "paste" }
  | { kind: "file"; fileName?: string }
  | { kind: "url"; url: string };

export type ResolvedOpenApiServiceUrl =
  | { ok: true; source: "absolute" | "resolved-relative"; url: string }
  | { ok: false; reason: string; relativeUrl?: string };

export type OpenApiDocumentParseResult =
  | {
      ok: true;
      document: Record<string, unknown>;
      format: "json" | "yaml";
    }
  | { ok: false; reason: string };

export function parseOpenApiDocumentText(openapiSpec?: string): OpenApiDocumentParseResult {
  const text = openapiSpec?.trim();
  if (!text) {
    return { ok: false, reason: "OpenAPI 规范不能为空。" };
  }

  let parsed: unknown;
  let format: "json" | "yaml" = "json";

  try {
    parsed = JSON.parse(text);
  } catch {
    format = "yaml";
    try {
      parsed = parseYaml(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: `OpenAPI 文件不是有效的 JSON 或 YAML：${detail}`,
      };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "OpenAPI 文档顶层必须是对象。" };
  }

  return {
    ok: true,
    document: parsed as Record<string, unknown>,
    format,
  };
}

export function normalizeOpenApiDocumentText(openapiSpec: string): string {
  const parsed = parseOpenApiDocumentText(openapiSpec);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  return JSON.stringify(parsed.document, null, 2);
}

export function normalizeGeneratedCapabilityName(value?: string): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || undefined;
}

export function normalizeGeneratedCapabilityDescription(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, CAPABILITY_DESCRIPTION_MAX_LENGTH);
}

export function normalizeGeneratedToolboxDescription(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, TOOLBOX_DESCRIPTION_MAX_LENGTH);
}

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
        description.length > CAPABILITY_DESCRIPTION_MAX_LENGTH
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
  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok) {
    return parseResult;
  }

  const parsed = parseResult.document;
  if (!isFullOpenApiDocument(parsed)) {
    return {
      ok: false,
      reason:
        "缺少 OpenAPI 顶层字段 openapi。编辑页应展示完整文档，而不是 api_spec 片段。",
    };
  }

  const doc = parsed;
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

  // servers is optional in OpenAPI 3.x. When absent, the import form's service URL
  // is the runtime base URL and will be injected on submit via rewriteOpenApiServerUrl.
  const servers: unknown[] = Array.isArray(doc.servers) ? doc.servers : [];
  let serverUrl: string | undefined;

  if (servers.length > 0) {
    const firstServer = servers[0];
    if (
      !firstServer ||
      typeof firstServer !== "object" ||
      typeof (firstServer as { url?: unknown }).url !== "string" ||
      !(firstServer as { url: string }).url.trim()
    ) {
      return { ok: false, reason: "servers[0].url 不能为空。" };
    }
    serverUrl = (firstServer as { url: string }).url.trim();
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
    serverUrl,
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
  const maybeFullDocument: unknown = apiSpec;
  if (isFullOpenApiDocument(maybeFullDocument)) {
    return JSON.stringify(maybeFullDocument, null, 2);
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

export function resolveOpenApiServiceUrl(
  openapiSpec: string,
  source?: OpenApiSpecSource,
): ResolvedOpenApiServiceUrl {
  const analysis = analyzeOpenApiDocumentText(openapiSpec);

  if (!analysis.ok) {
    return { ok: false, reason: analysis.reason };
  }

  const serverUrl = analysis.serverUrl?.trim();
  if (!serverUrl) {
    return {
      ok: false,
      reason: "OpenAPI 未声明 servers，请在表单中填写完整的 HTTP(S) 服务地址。",
    };
  }

  if (/^https?:\/\//i.test(serverUrl)) {
    return { ok: true, source: "absolute", url: serverUrl };
  }

  if (source?.kind === "url") {
    try {
      const resolved = new URL(serverUrl, source.url);
      if (/^https?:$/i.test(resolved.protocol)) {
        return {
          ok: true,
          source: "resolved-relative",
          url: resolved.toString().replace(/\/$/, ""),
        };
      }
    } catch {
      // Fall through to the manual input message below.
    }
  }

  return {
    ok: false,
    relativeUrl: serverUrl,
    reason: `OpenAPI servers[0].url 是相对路径 ${serverUrl}，请填写完整服务地址。`,
  };
}

export function rewriteOpenApiServerUrl(openapiSpec: string, serviceUrl?: string): string {
  const normalizedServiceUrl = serviceUrl?.trim();

  if (!normalizedServiceUrl || !/^https?:\/\//i.test(normalizedServiceUrl)) {
    return openapiSpec;
  }

  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok || !isFullOpenApiDocument(parseResult.document)) {
    return openapiSpec;
  }
  const parsed = parseResult.document;

  const servers: unknown[] = Array.isArray(parsed.servers)
    ? Array.from(parsed.servers as unknown[])
    : [];
  const firstServer =
    servers[0] && typeof servers[0] === "object" && !Array.isArray(servers[0])
      ? { ...(servers[0] as Record<string, unknown>), url: normalizedServiceUrl }
      : { url: normalizedServiceUrl };

  servers[0] = firstServer;

  return JSON.stringify(
    {
      ...parsed,
      servers,
    },
    null,
    2,
  );
}

export function rewriteOpenApiOperationSummaries(openapiSpec: string): string {
  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok || !isFullOpenApiDocument(parseResult.document)) {
    return openapiSpec;
  }
  const parsed = parseResult.document;

  const paths = parsed.paths;
  if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
    return openapiSpec;
  }

  const rewrittenPaths: Record<string, unknown> = {};

  for (const [path, pathItem] of Object.entries(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) {
      rewrittenPaths[path] = pathItem;
      continue;
    }

    const rewrittenPathItem: Record<string, unknown> = { ...(pathItem as Record<string, unknown>) };

    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) {
        continue;
      }

      if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
        continue;
      }

      const operationRecord = operation as Record<string, unknown>;
      const rawSummary =
        typeof operationRecord.summary === "string" ? operationRecord.summary : "";
      const safeSummary =
        normalizeGeneratedCapabilityName(rawSummary) ??
        normalizeGeneratedCapabilityName(`${method}_${path}`) ??
        "api_tool";

      rewrittenPathItem[method] = {
        ...operationRecord,
        ...(!operationRecord.description && rawSummary && rawSummary !== safeSummary
          ? { description: rawSummary }
          : {}),
        summary: safeSummary,
      };
    }

    rewrittenPaths[path] = rewrittenPathItem;
  }

  return JSON.stringify(
    {
      ...parsed,
      paths: rewrittenPaths,
    },
    null,
    2,
  );
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

  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok) {
    return parseResult;
  }
  const parsed = parseResult.document;

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
        reason: `接口 ${longDescriptionOperation.method} ${longDescriptionOperation.path} 的 description 超过 ${CAPABILITY_DESCRIPTION_MAX_LENGTH} 字符。请缩短后再保存。`,
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

  const parseResult = parseOpenApiDocumentText(openapiSpec);
  if (!parseResult.ok) {
    return {};
  }
  const parsed = parseResult.document as {
    info?: { description?: string; title?: string };
  };

  return {
    title: parsed.info?.title,
    description: parsed.info?.description,
  };
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
  const parsed = parseOpenApiDocumentText(trimmed);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  return parsed.document;
}

export function mapFunctionContent(
  metadata?: BackendMetadata,
): FunctionInputPayload | undefined {
  const content = metadata?.function_content;

  if (!content?.code) {
    return undefined;
  }

  // 新版后端会在 function_content 里直接回 inputs/outputs；老数据/老后端只能从
  // api_spec 的 JSON Schema 反解。读不到参数会让编辑表单空着，一保存就覆盖没了。
  const fallback = parseFunctionParametersFromApiSpec(metadata?.api_spec);

  return {
    code: content.code,
    script_type: (content.script_type as "python") ?? "python",
    dependencies: content.dependencies,
    inputs: content.inputs?.length ? content.inputs : fallback.inputs,
    outputs: content.outputs?.length ? content.outputs : fallback.outputs,
  };
}
