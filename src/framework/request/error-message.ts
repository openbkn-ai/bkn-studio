/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import i18n from "@/app/locales/i18n";

type BackendErrorResponseBody = {
  error?: string;
  error_code?: string;
  error_details?: unknown;
  metadata?: unknown;
  message?: string;
  description?: string;
  detail?: unknown;
  details?: unknown;
};

export type RequestErrorDetails = {
  code?: string;
  description: string;
  descriptionSource?: "response";
  details?: string;
  metadata?: Record<string, unknown>;
};

export function formatErrorDetails(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join("；") || undefined;
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function extractRequestErrorDetails(error: unknown): RequestErrorDetails {
  let responseDetails: Omit<RequestErrorDetails, "description"> = {};
  if (axios.isAxiosError<BackendErrorResponseBody>(error)) {
    const data = error.response?.data;
    const description = optionalString(data?.description);
    const details = formatErrorDetails(data?.error_details);
    const fallbackDetails = formatErrorDetails(data?.details ?? data?.detail);
    const common = {
      code: optionalString(data?.error_code),
      details: details ?? fallbackDetails,
      ...(data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? { metadata: data.metadata as Record<string, unknown> }
        : {}),
    };
    responseDetails = common;
    const responseMessage = optionalString(data?.message);
    const responseError = optionalString(data?.error);

    if (description) {
      return { ...common, description, descriptionSource: "response" };
    }

    // Blank shared descriptions use the stable code; details remain available separately.
    if (common.code) {
      return { ...common, description: common.code, descriptionSource: "response" };
    }

    if (fallbackDetails) {
      return { ...common, description: fallbackDetails, descriptionSource: "response" };
    }

    if (responseMessage) {
      return { ...common, description: responseMessage, descriptionSource: "response" };
    }

    if (responseError) {
      return { ...common, description: responseError, descriptionSource: "response" };
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return { ...responseDetails, description: error.message };
  }

  return { ...responseDetails, description: i18n.t("common.requestFailed") };
}

export function extractRequestErrorMessage(error: unknown) {
  return extractRequestErrorDetails(error).description;
}

export function isRequestConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

/** The caller is authenticated but not allowed to do this. */
export function isRequestForbidden(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

/** The target, or the endpoint itself on an older backend, does not exist. */
export function isRequestNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
