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

export async function executeFunction(
  input: FunctionExecuteInput,
): Promise<FunctionExecuteResult> {
  if (useMock) {
    return {
      output: { echo: input.event ?? {}, status: "ok" },
      durationMs: 84,
    };
  }

  const response = await http.post<BackendFunctionExecute>(
    `${API_PREFIX}/function/execute`,
    {
      code: input.code,
      event: input.event,
      timeout: input.timeout,
    },
    { headers: getBusinessDomainHeaders() },
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
 * 沙箱回包有时直接在顶层，有时裹在 `data` 里（工具 debug 走的就是后者）。
 * 两种都认，认不出来的就当作 handler 返回值本身。
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
 * 由后端从代码推导函数契约（名称/描述/嵌套参数）。
 * 比走 AI 生成器确定性更高，也不消耗模型额度，所以「反推参数」走这条。
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

/** 后端已有接口，版本按 semver 排序并过滤过 requires_python。 */
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
 * 后端的系统提示词仍教 `def handler(event)` 老写法，生成出来的代码既不符合
 * sandbox_sdk 约定，也让后端无法从签名推导入参。在 query 上附一段风格约束把它掰回来，
 * 内容与「模版」按钮插入的 FUNCTION_TEMPLATES 保持一致。
 */
const PYTHON_TOOL_STYLE_DIRECTIVE = `

【代码风格要求（必须遵守）】
- 使用 sandbox_sdk 的 @tool 写法：先 \`from sandbox_sdk import tool\`，再用 \`@tool\` 装饰目标函数
- 严禁使用 \`def handler(event)\` 这种从字典取参的旧写法
- 每个形参必须带类型注解，参数名要能自解释；带默认值的形参即选填参数
- 平台按函数签名推导入参声明，所以签名就是参数契约，不要在函数体里二次解析入参
- 入参有嵌套结构或字段较多时，用 pydantic BaseModel 承载，作为单个形参的类型
- docstring 首行用一句话说清这个函数做什么、返回什么 —— Agent 靠它判断何时调用
- 函数名用有意义的小写下划线命名，不要用 my_function、handler 这类占位名
- 返回值必须可 JSON 序列化，优先返回 dict
- 严禁生成 \`if __name__ == '__main__':\` 测试块，执行器会直接运行代码，写了会重复执行一次
- 只输出纯 Python 代码，不要 Markdown 代码块标记，不要解释文字

【安全红线（必须遵守）】
- 只实现用户明确描述的功能，不得额外添加用户没要求的副作用
- 严禁任何破坏性文件操作：不删除、不清空、不覆盖已有文件或目录（如 os.remove、os.unlink、shutil.rmtree、open(path,"w") 覆盖既有文件、pathlib 的 unlink/rmdir）；确需写文件时只写临时目录且用明确的新文件名
- 严禁执行系统命令或起子进程：不使用 os.system、subprocess、popen、pty、eval、exec、compile、\`__import__\`
- 严禁磁盘/系统级危险操作：不格式化、不改权限属主（chmod/chown）、不动 /etc /sys /proc /dev 等系统路径、不写启动项或定时任务
- 严禁隐蔽外联与数据外传：不做与需求无关的网络请求、反弹 shell、端口扫描、下载并执行远程代码
- 严禁凭证与密钥操作：不读取 ~/.ssh、环境变量里的密钥、云凭证文件，不硬编码或回传任何密钥
- 严禁资源耗尽：不写死循环、fork 炸弹、无上限递归或申请巨量内存
- 如果用户需求本身就是破坏性或危险的，不要实现，返回一个说明拒绝原因的错误字典`;

/** 模型没有实时时钟，涉及「今天」「本月」的需求会写死一个训练期的旧日期。 */
function currentTimeNote(): string {
  const now = new Date();
  // 注意：dateStyle/timeStyle 与 year/month/... 或 timeZoneName 互斥，同传会抛
  // TypeError: Invalid option : option。这里用显式字段以便带上时区名。
  const stamp = new Intl.DateTimeFormat("zh-CN", {
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

  return `\n\n【当前时间】${stamp}（ISO: ${now.toISOString()}）。涉及日期计算时以此为基准。`;
}

/** 只有「自然语言 → 代码」需要纠偏；元数据推导读的是既有代码，附加约束反而是噪声。 */
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
      // LLM 生成实测 40s+，默认 15s/30s 超时会中断请求。
      timeout: 120_000,
    },
  );

  return { content: response.data.content };
}

export type FunctionAiStreamHandlers = {
  /** 模型输出正式内容（代码）时逐段回调。 */
  onContentDelta?: (delta: string) => void;
  /** 模型输出思考内容（qwen thinking）时逐段回调。 */
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
    // 非 JSON 错误体，用原文或兜底文案。
  }

  return raw.trim() || fallback;
}

/**
 * 流式生成：body 带 stream:true，后端返回 SSE（OpenAI chunk 格式，data: [DONE] 收尾）。
 * axios 不支持浏览器端流式读取，这里用 fetch + ReadableStream。
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
