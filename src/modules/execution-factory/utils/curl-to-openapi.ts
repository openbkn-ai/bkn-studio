export type QuickApiParameter = {
  name: string;
  in: "query" | "header" | "path";
  description?: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "integer";
  example?: string;
};

export type ParsedQuickApi = {
  method: string;
  serverUrl: string;
  path: string;
  queryParams: QuickApiParameter[];
  summary: string;
};

export type ParseCurlResult =
  | { ok: true; value: ParsedQuickApi }
  | { ok: false; reason: string };

function normalizeCurlInput(raw: string): string {
  return raw
    .trim()
    .replace(/\\\r?\n/g, " ")
    .replace(/\s+/g, " ");
}

function extractQuotedSegments(input: string): string[] {
  const segments: string[] = [];
  const pattern = /'([^']*)'|"([^"]*)"/g;
  let match = pattern.exec(input);

  while (match) {
    segments.push(match[1] ?? match[2] ?? "");
    match = pattern.exec(input);
  }

  return segments;
}

function extractMethod(normalized: string): string {
  const explicit = normalized.match(/(?:^|\s)-X\s+([A-Za-z]+)/i);
  if (explicit?.[1]) {
    return explicit[1].toUpperCase();
  }

  if (/\s-d\s/.test(normalized) || /--data(?:-raw|-binary)?\s/.test(normalized)) {
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

export function parseCurlCommand(raw: string): ParseCurlResult {
  const normalized = normalizeCurlInput(raw);

  if (!/^curl\b/i.test(normalized)) {
    return { ok: false, reason: "请输入以 curl 开头的命令，或直接切换到表单模式填写。" };
  }

  const method = extractMethod(normalized);
  const quoted = extractQuotedSegments(normalized);
  const urlCandidate =
    quoted.find((segment) => /^https?:\/\//i.test(segment)) ??
    normalized.match(/https?:\/\/[^\s'"]+/i)?.[0];

  if (!urlCandidate) {
    return { ok: false, reason: "未在 cURL 中识别到 http(s) 地址。" };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlCandidate);
  } catch {
    return { ok: false, reason: "cURL 中的 URL 格式无效。" };
  }

  const { path, serverUrl } = resolveServerAndPath(parsedUrl);
  const queryParams: QuickApiParameter[] = [];

  parsedUrl.searchParams.forEach((value, name) => {
    queryParams.push({
      name,
      in: "query",
      required: false,
      type: "string",
      example: value,
    });
  });

  const lastSegment = path.split("/").filter(Boolean).pop() ?? "api";
  const summary = decodeURIComponent(lastSegment).replace(/[-_]/g, " ");

  return {
    ok: true,
    value: {
      method,
      serverUrl,
      path,
      queryParams,
      summary: summary || "API",
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

  url.searchParams.forEach((value, name) => {
    queryParams.push({
      name,
      in: "query",
      required: false,
      type: "string",
      example: value,
    });
  });

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
