/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import type {
  FunctionAiGenerateInput,
  FunctionAiGenerateResult,
  FunctionAiGenerateType,
  FunctionExecuteInput,
  FunctionExecuteResult,
  InferredFunctionSchema,
} from "@/modules/execution-factory/types/function";

const API_PREFIX = "/agent-operator-integration/v1";
const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BUSINESS_DOMAIN = "bd_public";

function getBusinessDomainHeaders() {
  const businessDomainId =
    getRuntimeConfig().currentUser.businessDomainId ?? DEFAULT_BUSINESS_DOMAIN;

  return { "x-business-domain": businessDomainId };
}

/**
 * Sandbox dependency installation defaults to 300s, so leave a small margin.
 * Plain executions without dependencies keep the regular http timeout.
 */
const DEPENDENCY_INSTALL_TIMEOUT_MS = 330_000;

/**
 * Normalizes dependency rows into the backend contract shape.
 *
 * Empty names are unfinished placeholders and would produce 400 responses.
 * Empty versions mean latest, so omit the field instead of sending an empty string.
 */
export function normalizeExecuteDependencies(
  dependencies: FunctionExecuteInput["dependencies"],
): Array<{ name: string; version?: string }> {
  return (dependencies ?? [])
    .map((item) => ({
      name: item.name?.trim() ?? "",
      ...(item.version?.trim() ? { version: item.version.trim() } : {}),
    }))
    .filter((item) => item.name.length > 0);
}

export async function executeFunction(
  input: FunctionExecuteInput,
): Promise<FunctionExecuteResult> {
  if (useMock) {
    return {
      output: { echo: input.event ?? {}, status: "ok" },
      durationMs: 84,
    };
  }

  const dependencies = normalizeExecuteDependencies(input.dependencies);

  const response = await http.post<BackendFunctionExecute>(
    `${API_PREFIX}/function/execute`,
    {
      code: input.code,
      event: input.event,
      timeout: input.timeout,
      // Omit dependencies_url so execution uses the same backend default as version lookup.
      ...(dependencies.length > 0 ? { dependencies } : {}),
    },
    {
      headers: getBusinessDomainHeaders(),
      // Dependency installs happen before sandbox execution and can exceed the default http timeout.
      ...(dependencies.length > 0 ? { timeout: DEPENDENCY_INSTALL_TIMEOUT_MS } : {}),
    },
  );

  return mapFunctionExecuteResult(response.data);
}

type BackendFunctionExecute = {
  data?: unknown;
  duration_ms?: number;
  error?: string;
  error_message?: string;
  execution_time_ms?: number;
  exit_code?: number;
  metrics?: { cpu_time_ms?: number; duration_ms?: number; memory_peak_mb?: number };
  result?: unknown;
  session_id?: string;
  stderr?: string;
  stdout?: string;
};

function asExecuteEnvelope(value: unknown): BackendFunctionExecute | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record: BackendFunctionExecute = value;
  const hasEnvelopeShape =
    "stdout" in record || "stderr" in record || "metrics" in record || "result" in record;

  return hasEnvelopeShape ? record : null;
}

/**
 * Sandbox results can be top-level or nested under `data`; both shapes are accepted.
 * Unknown shapes are treated as the handler return value.
 */
export function mapFunctionExecuteResult(payload: BackendFunctionExecute): FunctionExecuteResult {
  const nested = asExecuteEnvelope(payload.data);
  const envelope = nested ?? payload;
  const metrics = envelope.metrics;

  return {
    output: nested ? nested.result : (payload.result ?? payload.data),
    error: envelope.error ?? envelope.error_message ?? payload.error ?? payload.error_message,
    durationMs:
      envelope.duration_ms ??
      envelope.execution_time_ms ??
      metrics?.duration_ms ??
      payload.duration_ms ??
      payload.execution_time_ms,
    exitCode: envelope.exit_code ?? payload.exit_code,
    sessionId: envelope.session_id ?? payload.session_id,
    metrics: metrics
      ? {
          cpuTimeMs: metrics.cpu_time_ms,
          durationMs: metrics.duration_ms,
          memoryPeakMb: metrics.memory_peak_mb,
        }
      : undefined,
    stderr: envelope.stderr,
    stdout: envelope.stdout,
  };
}

/**
 * Infers the function contract from code on the backend.
 * This is more deterministic than AI generation and does not consume model quota.
 */
export async function inferFunctionSchema(code: string): Promise<InferredFunctionSchema> {
  if (useMock) {
    return {
      supported: true,
      name: "generated_handler",
      description: "Inferred from code.",
      inputs: [{ name: "event", type: "object", required: true }],
      outputs: [{ name: "result", type: "object", required: true }],
    };
  }

  const response = await http.post<{
    supported?: boolean;
    reason?: string;
    name?: string;
    description?: string;
    inputs?: FunctionParameterDef[];
    outputs?: FunctionParameterDef[];
  }>(
    `${API_PREFIX}/function/infer-schema`,
    { code },
    { headers: getBusinessDomainHeaders() },
  );

  return {
    supported: response.data.supported !== false,
    reason: response.data.reason,
    name: response.data.name,
    description: response.data.description,
    inputs: response.data.inputs,
    outputs: response.data.outputs,
  };
}

/** The backend returns versions sorted by semver and filtered by requires_python. */
export async function listDependencyVersions(
  packageName: string,
  options?: { pypiRepoUrl?: string; pythonVersion?: string },
): Promise<string[]> {
  if (useMock) {
    return ["2.2.2", "2.1.4", "1.5.3"];
  }

  const response = await http.get<{ package_name?: string; versions?: string[] }>(
    `${API_PREFIX}/function/dependency-versions/${encodeURIComponent(packageName)}`,
    {
      headers: getBusinessDomainHeaders(),
      params: {
        pypi_repo_url: options?.pypiRepoUrl || undefined,
        python_version: options?.pythonVersion || undefined,
      },
      skipErrorToast: true,
    },
  );

  return Array.isArray(response.data.versions) ? response.data.versions : [];
}

/**
 * The backend prompt may still teach the old `def handler(event)` style.
 * Append style constraints so generated code follows sandbox_sdk signatures.
 */
const PYTHON_TOOL_STYLE_DIRECTIVE = `

## Code style requirements (mandatory)
- Use sandbox_sdk @tool style: import with \`from sandbox_sdk import tool\`, then decorate the target function with \`@tool\`.
- Do not use the legacy \`def handler(event)\` style that extracts values from a dict.
- Every parameter must have a type annotation and a self-explanatory name. Parameters with defaults are optional.
- The platform infers input declarations from the function signature, so the signature is the parameter contract. Do not parse inputs again inside the function body.
- For nested or large input structures, use a pydantic BaseModel as the type of a single parameter.
- The first docstring line must state what the function does and what it returns so agents know when to call it.
- Use a meaningful snake_case function name. Do not use placeholders such as my_function or handler.
- Return values must be JSON-serializable. Prefer returning dict objects.
- Do not generate an \`if __name__ == '__main__':\` test block; the executor runs the code directly.
- Output only plain Python code. Do not output Markdown fences or explanatory text.

## Safety requirements (mandatory)
- Implement only the function explicitly requested by the user. Do not add unrelated side effects.
- Do not perform destructive file operations such as deleting, clearing, or overwriting existing files or directories.
- Do not execute system commands or start subprocesses. Do not use os.system, subprocess, popen, pty, eval, exec, compile, or \`__import__\`.
- Do not perform disk or system-level dangerous operations such as formatting disks, changing ownership or permissions, touching /etc /sys /proc /dev, or writing startup items.
- Do not perform covert networking or data exfiltration, including unrelated network requests, reverse shells, port scans, or downloading and executing remote code.
- Do not read credentials or secrets such as ~/.ssh, environment secrets, or cloud credential files. Do not hard-code or return any secrets.
- Do not exhaust resources with infinite loops, fork bombs, unbounded recursion, or huge memory allocation.
- If the requested task is itself destructive or dangerous, do not implement it. Return an error dict explaining the refusal reason.`;

/** Models have no real-time clock, so relative-date requests need an explicit current time. */
function currentTimeNote(): string {
  const now = new Date();
  // dateStyle/timeStyle cannot be combined with year/month or timeZoneName.
  const stamp = new Intl.DateTimeFormat(getRuntimeConfig().locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(now);

  return `\n\n## Current time\n${stamp} (ISO: ${now.toISOString()}). Use this as the baseline for date calculations.`;
}

/** Only natural-language-to-code generation needs correction; metadata inference reads existing code. */
export function buildQuery(input: FunctionAiGenerateInput): string | undefined {
  if (input.type !== "python_function_generator" || !input.query) {
    return input.query;
  }

  return `${input.query}${PYTHON_TOOL_STYLE_DIRECTIVE}${currentTimeNote()}`;
}

export async function generateFunction(
  input: FunctionAiGenerateInput,
): Promise<FunctionAiGenerateResult> {
  if (useMock) {
    if (input.type === "metadata_param_generator") {
      return {
        content: {
          description: "Generated function metadata from code.",
          inputs: [{ name: "event", type: "object" }],
          name: "generated_handler",
          outputs: [{ name: "result", type: "object" }],
          use_rule: "Pass event payload as input.",
        },
      };
    }

    return {
      content: `def handler(event):\n    """${input.query ?? "Generated function"}"""\n    return event`,
    };
  }

  const response = await http.post<{
    content?: unknown;
  }>(
    `${API_PREFIX}/ai_generate/function/${input.type}`,
    {
      code: input.code,
      query: buildQuery(input),
    },
    {
      headers: getBusinessDomainHeaders(),
      // LLM generation can exceed 40s, so the default 15s/30s timeout is too short.
      timeout: 120_000,
    },
  );

  return { content: response.data.content };
}

export type FunctionAiStreamHandlers = {
  /** Called for official model content, usually code. */
  onContentDelta?: (delta: string) => void;
  /** Called for model reasoning content. */
  onReasoningDelta?: (delta: string) => void;
};

type ChatCompletionChunk = {
  choices?: {
    delta?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }[];
};

function extractStreamErrorMessage(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["description", "details", "message"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  } catch {
    // Non-JSON error body; use raw text or fallback.
  }

  return raw.trim() || fallback;
}

/**
 * Streaming generation: body uses stream:true and the backend returns OpenAI-style SSE chunks.
 * Browser axios cannot read streams, so this uses fetch and ReadableStream.
 */
export async function generateFunctionStream(
  input: FunctionAiGenerateInput,
  handlers: FunctionAiStreamHandlers = {},
  signal?: AbortSignal,
): Promise<FunctionAiGenerateResult> {
  if (useMock) {
    const mockResult = await generateFunction(input);
    if (typeof mockResult.content === "string") {
      handlers.onContentDelta?.(mockResult.content);
    }
    return mockResult;
  }

  const runtimeConfig = getRuntimeConfig();
  const requestOnce = (token: string | null) =>
    fetch(`${runtimeConfig.apiBaseUrl}${API_PREFIX}/ai_generate/function/${input.type}`, {
      body: JSON.stringify({ code: input.code, query: buildQuery(input), stream: true }),
      headers: {
        "Accept-Language": runtimeConfig.locale,
        "Content-Type": "application/json",
        ...getBusinessDomainHeaders(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      method: "POST",
      signal,
    });

  let response = await requestOnce(runtimeConfig.auth.tokenManager.getAccessToken());
  if (response.status === 401) {
    const refreshedToken = await runtimeConfig.auth.tokenManager.refreshAccessToken();
    if (refreshedToken) {
      response = await requestOnce(refreshedToken);
    }
  }

  if (!response.ok || !response.body) {
    const raw = await response.text().catch(() => "");
    throw new Error(
      extractStreamErrorMessage(raw, `AI generate failed with status ${response.status}`),
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let content = "";
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (!line) {
        eventName = "";
        continue;
      }
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
        continue;
      }
      if (!line.startsWith("data:")) {
        continue;
      }

      const data = line.slice("data:".length).trim();
      if (eventName === "error") {
        throw new Error(extractStreamErrorMessage(data, "AI generate stream failed"));
      }
      if (data === "[DONE]") {
        finished = true;
        break;
      }

      let chunk: ChatCompletionChunk;
      try {
        chunk = JSON.parse(data) as ChatCompletionChunk;
      } catch {
        continue;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (delta?.reasoning_content) {
        handlers.onReasoningDelta?.(delta.reasoning_content);
      }
      if (delta?.content) {
        content += delta.content;
        handlers.onContentDelta?.(delta.content);
      }
    }
  }

  return { content };
}

export async function getFunctionPrompt(
  type: FunctionAiGenerateType,
): Promise<FunctionAiGenerateResult> {
  if (useMock) {
    return {
      prompt:
        "Describe the Python function you want to generate. Include inputs, outputs, and behavior.",
    };
  }

  const response = await http.get<{
    description?: string;
    system_prompt?: string;
  }>(`${API_PREFIX}/ai_generate/prompt/${type}`, {
    headers: getBusinessDomainHeaders(),
  });

  return {
    prompt: response.data.system_prompt ?? response.data.description,
  };
}
