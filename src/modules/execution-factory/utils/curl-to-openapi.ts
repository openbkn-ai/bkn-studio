/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type QuickApiParameter = {
  name: string;
  in: "query" | "header" | "path";
  description?: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "integer";
  example?: string;
};

export type QuickApiRequestBody = {
  contentType: string;
  example?: unknown;
  raw?: string;
  schema?: Record<string, unknown>;
};

export type ParsedQuickApi = {
  method: string;
  serverUrl: string;
  path: string;
  queryParams: QuickApiParameter[];
  summary: string;
  requestBody?: QuickApiRequestBody;
  warnings?: string[];
};

export type ParseCurlResult =
  | { ok: true; value: ParsedQuickApi }
  | { ok: false; reason: string };

type CurlHeader = {
  name: string;
  value: string;
};

type TokenizeResult =
  | { ok: true; tokens: string[] }
  | { ok: false; reason: string };

type CurlScan = {
  dataParts: string[];
  dataAsQuery: boolean;
  explicitMethod?: string;
  formParts: string[];
  headers: CurlHeader[];
  urls: string[];
};

type CurlScanResult =
  | { ok: true; value: CurlScan }
  | { ok: false; reason: string };

type RequestBodyResult =
  | { ok: true; value?: QuickApiRequestBody }
  | { ok: false; reason: string };

const HEADER_ERROR = "请求头应为 \"Name: Value\" 格式。";
const JSON_ERROR = "请求体不是合法 JSON，请检查引号、逗号或转义字符。";
const FILE_BODY_ERROR = "暂不支持读取本地文件，请粘贴文件内容。";
const QUOTE_ERROR = "cURL 中存在未闭合的引号。";

function normalizeCurlInput(raw: string): string {
  return raw
    .trim()
    .replace(/\\\r?\n/g, " ")
    .replace(/`\r?\n/g, " ")
    .replace(/\^\r?\n/g, " ");
}

function tokenizeCurl(input: string): TokenizeResult {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += "\\";
  }

  if (quote) {
    return { ok: false, reason: QUOTE_ERROR };
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return { ok: true, tokens };
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isPotentialUrl(value: string) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function readOptionValue(tokens: string[], index: number, option: string) {
  const token = tokens[index];
  if (token.length > option.length && token.startsWith(option)) {
    return { nextIndex: index, value: token.slice(option.length) };
  }

  return { nextIndex: index + 1, value: tokens[index + 1] };
}

function parseHeader(value: string): CurlHeader | undefined {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    return undefined;
  }

  const name = value.slice(0, separator).trim();
  const headerValue = value.slice(separator + 1).trim();

  if (!name) {
    return undefined;
  }

  return { name, value: headerValue };
}

function scanCurlTokens(tokens: string[]): CurlScanResult {
  if (tokens[0]?.toLowerCase() !== "curl") {
    return { ok: false, reason: "请输入以 curl 开头的命令，或直接切换到表单模式填写。" };
  }

  const scan: CurlScan = {
    dataParts: [],
    dataAsQuery: false,
    formParts: [],
    headers: [],
    urls: [],
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "-X" || token === "--request") {
      const { nextIndex, value } = readOptionValue(tokens, index, token);
      if (value) {
        scan.explicitMethod = value.toUpperCase();
      }
      index = nextIndex;
      continue;
    }

    if (token.startsWith("--request=")) {
      scan.explicitMethod = token.slice("--request=".length).toUpperCase();
      continue;
    }

    if (token === "-I" || token === "--head") {
      scan.explicitMethod = "HEAD";
      continue;
    }

    if (token === "-G" || token === "--get") {
      scan.dataAsQuery = true;
      continue;
    }

    if (token === "-H" || token === "--header") {
      const { nextIndex, value } = readOptionValue(tokens, index, token);
      const header = value ? parseHeader(value) : undefined;
      if (!header) {
        return { ok: false, reason: HEADER_ERROR };
      }
      scan.headers.push(header);
      index = nextIndex;
      continue;
    }

    if (token.startsWith("--header=")) {
      const header = parseHeader(token.slice("--header=".length));
      if (!header) {
        return { ok: false, reason: HEADER_ERROR };
      }
      scan.headers.push(header);
      continue;
    }

    if (
      token === "-d" ||
      token === "--data" ||
      token === "--data-raw" ||
      token === "--data-binary" ||
      token === "--data-urlencode"
    ) {
      const { nextIndex, value } = readOptionValue(tokens, index, token);
      if (value?.startsWith("@")) {
        return { ok: false, reason: FILE_BODY_ERROR };
      }
      if (value) {
        scan.dataParts.push(value);
      }
      index = nextIndex;
      continue;
    }

    const dataOption = [
      "--data=",
      "--data-raw=",
      "--data-binary=",
      "--data-urlencode=",
    ].find((prefix) => token.startsWith(prefix));
    if (dataOption) {
      const value = token.slice(dataOption.length);
      if (value.startsWith("@")) {
        return { ok: false, reason: FILE_BODY_ERROR };
      }
      scan.dataParts.push(value);
      continue;
    }

    if (token === "-F" || token === "--form") {
      const { nextIndex, value } = readOptionValue(tokens, index, token);
      if (value) {
        scan.formParts.push(value);
      }
      index = nextIndex;
      continue;
    }

    if (token.startsWith("--form=")) {
      scan.formParts.push(token.slice("--form=".length));
      continue;
    }

    if (token === "--url") {
      const { nextIndex, value } = readOptionValue(tokens, index, token);
      if (value) {
        scan.urls.push(value);
      }
      index = nextIndex;
      continue;
    }

    if (token.startsWith("--url=")) {
      scan.urls.push(token.slice("--url=".length));
      continue;
    }

    if (isPotentialUrl(token)) {
      scan.urls.push(token);
    }
  }

  return { ok: true, value: scan };
}

function resolveMethod(scan: CurlScan): string {
  if (scan.explicitMethod) {
    return scan.explicitMethod;
  }

  if (scan.dataAsQuery) {
    return "GET";
  }

  if (scan.dataParts.length > 0 || scan.formParts.length > 0) {
    return "POST";
  }

  return "GET";
}

function resolveServerAndPath(url: URL): { serverUrl: string; path: string } {
  return {
    serverUrl: url.origin,
    path: url.pathname || "/",
  };
}

function inferSchemaFromValue(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferSchemaFromValue(value[0]) : {},
      example: value,
    };
  }

  if (value && typeof value === "object") {
    const properties: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = inferSchemaFromValue(item);
    }
    return { type: "object", properties };
  }

  if (typeof value === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number", example: value };
  }

  if (typeof value === "boolean") {
    return { type: "boolean", example: value };
  }

  return {
    type: "string",
    example:
      value === undefined || value === null
        ? ""
        : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
  };
}

function parseKeyValueData(value: string): Array<[string, string]> {
  const params = new URLSearchParams(value);
  return Array.from(params.entries());
}

function fieldsToSchema(fields: Array<[string, string]>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [name, value] of fields) {
    properties[name] = { type: "string", example: value };
  }
  return { type: "object", properties };
}

function fieldsToExample(fields: Array<[string, string]>): Record<string, string> {
  const example: Record<string, string> = {};
  for (const [name, value] of fields) {
    example[name] = value;
  }
  return example;
}

function headerValue(headers: CurlHeader[], name: string) {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;
}

function buildRequestBody(scan: CurlScan): RequestBodyResult {
  if (scan.formParts.length > 0) {
    const fields = scan.formParts.map((part): [string, string] => {
      const separator = part.indexOf("=");
      if (separator < 0) {
        return [part, ""];
      }
      return [part.slice(0, separator), part.slice(separator + 1)];
    });

    return {
      ok: true,
      value: {
        contentType: "multipart/form-data",
        example: fieldsToExample(fields),
        schema: fieldsToSchema(fields),
      },
    };
  }

  if (scan.dataParts.length === 0 || scan.dataAsQuery) {
    return { ok: true, value: undefined };
  }

  const raw = scan.dataParts.join("&");
  const contentType = headerValue(scan.headers, "content-type")?.split(";")[0].trim().toLowerCase();
  const trimmedRaw = raw.trimStart();
  const looksJson = trimmedRaw.startsWith("{") || trimmedRaw.startsWith("[");

  if (contentType === "application/json" || (!contentType && looksJson)) {
    try {
      const example = JSON.parse(raw) as unknown;
      return {
        ok: true,
        value: {
          contentType: "application/json",
          example,
          schema: inferSchemaFromValue(example),
        },
      };
    } catch {
      return { ok: false, reason: JSON_ERROR };
    }
  }

  if (contentType === "application/x-www-form-urlencoded" || raw.includes("=")) {
    const fields = parseKeyValueData(raw);
    return {
      ok: true,
      value: {
        contentType: "application/x-www-form-urlencoded",
        example: fieldsToExample(fields),
        schema: fieldsToSchema(fields),
      },
    };
  }

  return {
    ok: true,
    value: {
      contentType: contentType || "text/plain",
      raw,
      schema: { type: "string", example: raw },
    },
  };
}

function addQueryParamsFromUrl(url: URL, queryParams: QuickApiParameter[]) {
  url.searchParams.forEach((value, name) => {
    queryParams.push({
      name,
      in: "query",
      required: false,
      type: "string",
      example: value,
    });
  });
}

function addDataAsQueryParams(scan: CurlScan, queryParams: QuickApiParameter[]) {
  if (!scan.dataAsQuery) {
    return;
  }

  for (const part of scan.dataParts) {
    for (const [name, value] of parseKeyValueData(part)) {
      queryParams.push({
        name,
        in: "query",
        required: false,
        type: "string",
        example: value,
      });
    }
  }
}

function addHeaderParams(scan: CurlScan, queryParams: QuickApiParameter[]) {
  const skippedHeaders = new Set(["content-type", "content-length"]);

  for (const header of scan.headers) {
    if (skippedHeaders.has(header.name.toLowerCase())) {
      continue;
    }

    queryParams.push({
      name: header.name,
      in: "header",
      required: false,
      type: "string",
      example: header.value,
    });
  }
}

export function parseCurlCommand(raw: string): ParseCurlResult {
  const normalized = normalizeCurlInput(raw);
  const tokenized = tokenizeCurl(normalized);

  if (!tokenized.ok) {
    return tokenized;
  }

  const scanned = scanCurlTokens(tokenized.tokens);

  if (!scanned.ok) {
    return scanned;
  }

  const scan = scanned.value;
  const httpUrls = scan.urls.filter(isHttpUrl);

  if (httpUrls.length === 0) {
    if (scan.urls.length > 0) {
      return { ok: false, reason: "仅支持 http/https 地址。" };
    }
    return { ok: false, reason: "未识别到 http/https 地址，请检查是否遗漏 URL。" };
  }

  if (httpUrls.length > 1) {
    return { ok: false, reason: "检测到多个 URL，请保留一个接口地址。" };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(httpUrls[0]);
  } catch {
    return { ok: false, reason: "URL 格式无效，请检查空格、引号或特殊字符是否转义。" };
  }

  const requestBody = buildRequestBody(scan);

  if (!requestBody.ok) {
    return requestBody;
  }

  const { path, serverUrl } = resolveServerAndPath(parsedUrl);
  const queryParams: QuickApiParameter[] = [];
  addQueryParamsFromUrl(parsedUrl, queryParams);
  addDataAsQueryParams(scan, queryParams);
  addHeaderParams(scan, queryParams);

  const lastSegment = path.split("/").filter(Boolean).pop() ?? "api";
  const summary = decodeURIComponent(lastSegment).replace(/[-_]/g, " ");

  return {
    ok: true,
    value: {
      method: resolveMethod(scan),
      serverUrl,
      path,
      queryParams,
      summary: summary || "API",
      ...(requestBody.value ? { requestBody: requestBody.value } : {}),
    },
  };
}

export function buildOpenApiFromQuickApi(input: {
  method: string;
  serverUrl: string;
  path: string;
  summary: string;
  description?: string;
  queryParams?: QuickApiParameter[];
  requestBody?: QuickApiRequestBody;
}): string {
  const method = input.method.toLowerCase();
  const parameters = (input.queryParams ?? []).map((param) => ({
    name: param.name,
    in: param.in,
    description: param.description ?? "",
    required: param.required ?? false,
    schema: {
      type: param.type ?? "string",
      ...(param.example !== undefined ? { example: param.example } : {}),
    },
  }));

  const operation: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? input.summary,
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
  };

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (input.requestBody) {
    operation.requestBody = {
      required: true,
      content: {
        [input.requestBody.contentType]: {
          schema: input.requestBody.schema ?? { type: "string" },
          ...(input.requestBody.example !== undefined
            ? { example: input.requestBody.example }
            : {}),
        },
      },
    };
  }

  const document = {
    openapi: "3.0.3",
    info: {
      title: input.summary,
      description: input.description ?? input.summary,
      version: "1.0.0",
    },
    servers: [{ url: input.serverUrl }],
    paths: {
      [input.path]: {
        [method]: operation,
      },
    },
  };

  return JSON.stringify(document, null, 2);
}

export function parseQuickApiUrl(rawUrl: string): ParseCurlResult {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return { ok: false, reason: "请填写 API 地址。" };
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "API 地址格式无效。" };
  }

  if (!/^https?:$/i.test(url.protocol)) {
    return { ok: false, reason: "仅支持 http 或 https 地址。" };
  }

  const { path, serverUrl } = resolveServerAndPath(url);
  const queryParams: QuickApiParameter[] = [];
  addQueryParamsFromUrl(url, queryParams);

  const lastSegment = path.split("/").filter(Boolean).pop() ?? "api";

  return {
    ok: true,
    value: {
      method: "GET",
      serverUrl,
      path,
      queryParams,
      summary: decodeURIComponent(lastSegment).replace(/[-_]/g, " ") || "API",
    },
  };
}
