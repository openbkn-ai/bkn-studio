/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Agent 对话的错误归一化：把大模型网关/SDK 抛出来的各种形态收敛成「一句人话 + 可展开原文」。
 *
 * 背景：模型工厂 `/api/mf-model-api/v1` 挂在 OpenAI 兼容路径上，但出错时返回的是自家 envelope
 * （`{code, description, detail, solution, link}`，且 description 是 JSON 字符串套 JSON），
 * 两边 schema 都不匹配 → AI SDK 抛 TypeValidationError，原始 body + zod 报错整段冒到 UI。
 * 见 bkn-foundry#620 / #621 / #622。网关按契约返错之前，这层兜底不能撤。
 */

import { APICallError, TypeValidationError } from "ai";

export type NormalizedAgentError = {
  /** 给用户看的一句话（中文）。 */
  message: string;
  /** 排障原文，UI 折叠展示；无额外信息时省略。 */
  detail?: string;
  /** 是否值得重试（上游忙 / 网络抖动）。 */
  retryable: boolean;
};

/**
 * 业务码 → 中文短文案。码可能是数字（模型工厂自己的 50508）也可能是字符串
 * （上游透传的 OpenAI 风格 `service_unavailable_error`），统一按字符串键查。
 * 只映射会打到用户脸上的高频码，其余直接用后端原文。
 */
const MF_MESSAGE_ZH: Record<string, string> = {
  "50508": "模型服务繁忙，请稍后重试",
  service_unavailable_error: "模型服务繁忙，上游建议暂时改用其他模型",
  rate_limit_exceeded: "模型服务被限流，请稍后重试",
  server_error: "模型服务内部错误，请稍后重试",
};

/** 值得重试的业务码（同样按字符串键）。 */
export const MF_RETRYABLE_CODES = new Set([
  "50508",
  "service_unavailable_error",
  "rate_limit_exceeded",
  "server_error",
  "overloaded_error",
]);

/** 值得重试的 HTTP 状态码。 */
export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** 浏览器/运行时各家的网络失败文案都不一样，统一按特征串识别。 */
const NETWORK_PATTERN = /network\s*error|failed to fetch|load failed|networkerror|econnreset|socket hang up|terminated/i;

/**
 * 只剩一句话时按文本认忙态。网关按契约返错后（bkn-foundry#624）流式 HTTP 仍是 200，
 * 错误走 SSE error 帧；而 AI SDK 的 chat 模型只把 `error.message` 透出来
 * （`controller.enqueue({ type: "error", error: chunk.value.error.message })`），
 * **业务码被丢掉了**。没有码就只能认文本，否则这类可重试的忙态会退化成一句英文原文、
 * 连重试入口都给不出来。
 */
// 词要收紧：tool-error 也走同一个归一化，`capacity` 这种宽词会让
// `column "capacity" does not exist` 的 SQL 报错被翻成「模型服务繁忙」。
const BUSY_PATTERN =
  /too busy|rate.?limit|overloaded|try again later|temporarily unavailable|service unavailable|over capacity|at capacity/i;

const DETAIL_MAX = 4000;
const MESSAGE_MAX = 200;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function stringifyDetail(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return truncate(value, DETAIL_MAX);
  try {
    return truncate(JSON.stringify(value, null, 2) ?? "", DETAIL_MAX) || undefined;
  } catch {
    // 循环引用之类序列化不了的：宁可不给原文，也别冒出一句 [object Object]。
    return undefined;
  }
}

type ModelFactoryError = { code?: number | string; message?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * 解模型工厂错误体。实测至少有这几种壳，且会互相嵌套（见 #620）：
 * - 自家 envelope：`description` / `detail` 是 JSON 字符串，里面可能是 `{code, message}`，
 *   也可能又裹一层上游透传的 `{error: {message, type, code}}`
 * - OpenAI 兼容：`{error: {message, code}}`（网关修好后就该是这个）
 * - 已经摊平的 `{code, message}`
 *
 * 由外向内逐层试，**深层优先**：envelope 最外层的 `code` 是
 * `"ModelFactory.ModelController.Model.Error"` 这种分类串，拿它当错误码毫无信息量。
 */
export function parseModelFactoryEnvelope(raw: unknown): ModelFactoryError | null {
  const root = asRecord(raw);
  if (!root) return null;

  const layers = [asRecord(root.description), asRecord(root.detail), root];
  const candidates = layers.flatMap((layer) => (layer ? [asRecord(layer.error), layer] : []));
  for (const candidate of candidates) {
    if (!candidate) continue;
    const code =
      typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : undefined;
    const message = typeof candidate.message === "string" && candidate.message ? candidate.message : undefined;
    // 只有字符串码没有 message 的层多半是分类串，跳过继续往里找。
    if (message !== undefined || typeof code === "number") return { code, message };
  }
  return null;
}

function fromModelFactory(mf: ModelFactoryError, detail?: string, retryable?: boolean): NormalizedAgentError {
  const key = mf.code !== undefined ? String(mf.code) : undefined;
  const base = (key !== undefined ? MF_MESSAGE_ZH[key] : undefined) ?? mf.message ?? "模型服务返回错误";
  return {
    // 码一并带上：客户截个图，支持就能直接对上后端日志。
    message: key !== undefined ? `${base}（${key}）` : base,
    detail,
    retryable: retryable ?? (key !== undefined && MF_RETRYABLE_CODES.has(key)),
  };
}

function fromStatus(status: number | undefined): string {
  if (status === 401 || status === 403) return "登录状态已失效，请刷新页面重新登录";
  if (status === 404) return "模型不存在或未上线，请在「模型工厂」确认模型配置";
  if (status === 429) return "模型服务繁忙（限流），请稍后重试";
  if (status !== undefined && status >= 500) return "模型服务暂时不可用，请稍后重试";
  return status !== undefined ? `模型服务请求失败（HTTP ${status}）` : "模型服务请求失败";
}

/**
 * 把任意错误收敛成 { message, detail, retryable }。
 * 识别顺序：TypeValidationError（响应体解不动，value 是原始 body）→ APICallError（非 2xx）→ 普通错误/裸串。
 */
export function normalizeAgentError(error: unknown): NormalizedAgentError {
  if (TypeValidationError.isInstance(error)) {
    const detail = stringifyDetail(error.value);
    const mf = parseModelFactoryEnvelope(error.value);
    if (mf) return fromModelFactory(mf, detail);
    return { message: "模型服务返回了无法解析的响应，请稍后重试或联系管理员", detail, retryable: false };
  }

  if (APICallError.isInstance(error)) {
    const detail = stringifyDetail(error.responseBody) ?? stringifyDetail(error.message);
    const mf = parseModelFactoryEnvelope(error.responseBody);
    const retryable = error.isRetryable || isRetryableStatus(error.statusCode);
    if (mf) return fromModelFactory(mf, detail, retryable);
    return { message: fromStatus(error.statusCode), detail, retryable };
  }

  // 纯对象先按结构解：SSE error 帧可能以对象到达（completion 模型透的是 `value.error` 本身），
  // 直接 String() 会变成 [object Object]。
  // 只认纯对象——Error 自带 `.message`，一起丢进结构解析会把普通异常也当成网关错误体。
  if (!(error instanceof Error) && typeof error !== "string") {
    const structured = parseModelFactoryEnvelope(error);
    if (structured) return fromModelFactory(structured, stringifyDetail(error));
  }

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : (stringifyDetail(error) ?? String(error));
  const mf = parseModelFactoryEnvelope(raw);
  if (mf) return fromModelFactory(mf, stringifyDetail(raw));
  if (NETWORK_PATTERN.test(raw)) {
    return { message: "与模型服务的连接中断，请重试", detail: stringifyDetail(raw), retryable: true };
  }
  // 码已经被 SDK 丢掉，只能按文本认忙态——否则重试入口就没了。
  if (BUSY_PATTERN.test(raw)) {
    return { message: "模型服务繁忙，请稍后重试", detail: stringifyDetail(raw), retryable: true };
  }
  return {
    message: truncate(raw, MESSAGE_MAX) || "对话执行失败",
    detail: raw.length > MESSAGE_MAX ? stringifyDetail(raw) : undefined,
    retryable: false,
  };
}
