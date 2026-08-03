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

/** 模型工厂业务码 → 中文短文案。只映射会打到用户脸上的高频码，其余用后端原文。 */
const MF_MESSAGE_ZH: Record<number, string> = {
  50508: "模型服务繁忙，请稍后重试",
};

/** 值得重试的模型工厂业务码。 */
export const MF_RETRYABLE_CODES = new Set([50508]);

/** 值得重试的 HTTP 状态码。 */
export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** 浏览器/运行时各家的网络失败文案都不一样，统一按特征串识别。 */
const NETWORK_PATTERN = /network\s*error|failed to fetch|load failed|networkerror|econnreset|socket hang up|terminated/i;

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

type ModelFactoryError = { code?: number; message?: string };

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
 * 解模型工厂错误体。认三种形态：
 * - 自家 envelope：`description` / `detail` 是 JSON 字符串套 `{code, message}`（双层编码，见 #620）
 * - OpenAI 兼容：`{error: {message, code}}`（网关修好后就是这个）
 * - 已经摊平的 `{code, message}`
 */
export function parseModelFactoryEnvelope(raw: unknown): ModelFactoryError | null {
  const root = asRecord(raw);
  if (!root) return null;

  const inner = asRecord(root.error) ?? asRecord(root.description) ?? asRecord(root.detail) ?? root;
  const code = typeof inner.code === "number" ? inner.code : undefined;
  const message = typeof inner.message === "string" && inner.message ? inner.message : undefined;
  if (code === undefined && message === undefined) return null;
  return { code, message };
}

function fromModelFactory(mf: ModelFactoryError, detail?: string, retryable?: boolean): NormalizedAgentError {
  const base = (mf.code !== undefined ? MF_MESSAGE_ZH[mf.code] : undefined) ?? mf.message ?? "模型服务返回错误";
  return {
    message: mf.code !== undefined ? `${base}（${mf.code}）` : base,
    detail,
    retryable: retryable ?? (mf.code !== undefined && MF_RETRYABLE_CODES.has(mf.code)),
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

  const raw = error instanceof Error ? error.message : String(error);
  const mf = parseModelFactoryEnvelope(raw);
  if (mf) return fromModelFactory(mf, stringifyDetail(raw));
  if (NETWORK_PATTERN.test(raw)) {
    return { message: "与模型服务的连接中断，请重试", detail: stringifyDetail(raw), retryable: true };
  }
  return {
    message: truncate(raw, MESSAGE_MAX) || "对话执行失败",
    detail: raw.length > MESSAGE_MAX ? stringifyDetail(raw) : undefined,
    retryable: false,
  };
}
