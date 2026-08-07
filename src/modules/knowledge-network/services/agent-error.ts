/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Agent chat error normalization for model gateway and SDK errors.
 *
 * Model Factory sits behind an OpenAI-compatible path but may return its own nested
 * envelope. Until the gateway returns contract-compliant errors, this fallback keeps
 * raw bodies and validation traces out of the primary UI.
 */

import { APICallError, TypeValidationError } from "ai";
import i18n from "@/app/locales/i18n";

export type NormalizedAgentError = {
  /** One short user-facing message. */
  message: string;
  /** Raw detail for troubleshooting; omitted when unavailable. */
  detail?: string;
  /** Whether retry is useful. */
  retryable: boolean;
};

/**
 * Business code to i18n key. Codes can be numeric or upstream OpenAI-style strings.
 * Only high-frequency user-facing codes are mapped; other messages fall back to backend text.
 */
const MF_MESSAGE_KEYS: Record<string, string> = {
  "50508": "knowledgeNetwork.agentChat.errors.modelBusy",
  service_unavailable_error: "knowledgeNetwork.agentChat.errors.modelUnavailableSwitch",
  rate_limit_exceeded: "knowledgeNetwork.agentChat.errors.modelRateLimited",
  server_error: "knowledgeNetwork.agentChat.errors.modelServerError",
};

/** Retryable business codes. */
export const MF_RETRYABLE_CODES = new Set([
  "50508",
  "service_unavailable_error",
  "rate_limit_exceeded",
  "server_error",
  "overloaded_error",
]);

/** Retryable HTTP statuses. */
export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** Runtime network errors vary, so they are matched by feature strings. */
const NETWORK_PATTERN = /network\s*error|failed to fetch|load failed|networkerror|econnreset|socket hang up|terminated/i;

/**
 * When the business code is lost, busy states are detected from text so retryable
 * gateway errors do not degrade into raw upstream messages.
 */
// Keep this tight because tool errors share the same normalization path.
const BUSY_PATTERN =
  /too busy|rate.?limit|overloaded|try again later|temporarily unavailable|service unavailable|over capacity|at capacity/i;

/** AI SDK parse-error text signatures used after errors are rewrapped. */
const PARSE_FAILURE_PATTERN = /type validation failed|json parsing failed|invalid_union|could not parse/i;

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
    // Prefer no detail over showing [object Object] for unserializable values.
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
 * Parses known Model Factory error envelopes, including nested native envelopes,
 * OpenAI-compatible errors, and flattened {code, message} objects.
 *
 * Deep layers win because the outer envelope code is often just a category string.
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
    // String-only codes are usually category strings, so keep looking inward.
    if (message !== undefined || typeof code === "number") return { code, message };
  }
  return null;
}

function fromModelFactory(mf: ModelFactoryError, detail?: string, retryable?: boolean): NormalizedAgentError {
  const key = mf.code !== undefined ? String(mf.code) : undefined;
  const base =
    (key !== undefined && MF_MESSAGE_KEYS[key] ? i18n.t(MF_MESSAGE_KEYS[key]) : undefined) ??
    mf.message ??
    i18n.t("knowledgeNetwork.agentChat.errors.modelReturnedError");
  return {
    // Include the code so support can match screenshots to backend logs.
    message: key !== undefined ? `${base}（${key}）` : base,
    detail,
    retryable: retryable ?? (key !== undefined && MF_RETRYABLE_CODES.has(key)),
  };
}

function fromStatus(status: number | undefined): string {
  if (status === 401 || status === 403) return i18n.t("knowledgeNetwork.agentChat.errors.authExpired");
  if (status === 404) return i18n.t("knowledgeNetwork.agentChat.errors.modelNotFound");
  if (status === 429) return i18n.t("knowledgeNetwork.agentChat.errors.modelRateLimited");
  if (status !== undefined && status >= 500) return i18n.t("knowledgeNetwork.agentChat.errors.modelTemporaryUnavailable");
  return status !== undefined
    ? i18n.t("knowledgeNetwork.agentChat.errors.requestFailedWithStatus", { status })
    : i18n.t("knowledgeNetwork.agentChat.errors.requestFailed");
}

/**
 * Normalizes arbitrary errors into { message, detail, retryable }.
 */
export function normalizeAgentError(error: unknown): NormalizedAgentError {
  if (TypeValidationError.isInstance(error)) {
    const detail = stringifyDetail(error.value);
    const mf = parseModelFactoryEnvelope(error.value);
    if (mf) return fromModelFactory(mf, detail);
    return { message: i18n.t("knowledgeNetwork.agentChat.errors.unparseableResponse"), detail, retryable: false };
  }

  if (APICallError.isInstance(error)) {
    const detail = stringifyDetail(error.responseBody) ?? stringifyDetail(error.message);
    const mf = parseModelFactoryEnvelope(error.responseBody);
    const retryable = error.isRetryable || isRetryableStatus(error.statusCode);
    if (mf) return fromModelFactory(mf, detail, retryable);
    return { message: fromStatus(error.statusCode), detail, retryable };
  }

  // Structured SSE errors may arrive as plain objects; parse them before String().
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
    return { message: i18n.t("knowledgeNetwork.agentChat.errors.connectionInterrupted"), detail: stringifyDetail(raw), retryable: true };
  }
  // The SDK dropped the code, so use text matching to keep the retry path available.
  if (BUSY_PATTERN.test(raw)) {
    return { message: i18n.t("knowledgeNetwork.agentChat.errors.modelBusy"), detail: stringifyDetail(raw), retryable: true };
  }
  // Rewrapped parse errors no longer pass isInstance, so match text before fallback.
  if (PARSE_FAILURE_PATTERN.test(raw)) {
    return { message: i18n.t("knowledgeNetwork.agentChat.errors.unparseableResponse"), detail: stringifyDetail(raw), retryable: false };
  }
  return {
    message: truncate(raw, MESSAGE_MAX) || i18n.t("knowledgeNetwork.agentChat.errors.chatFailed"),
    detail: raw.length > MESSAGE_MAX ? stringifyDetail(raw) : undefined,
    retryable: false,
  };
}
