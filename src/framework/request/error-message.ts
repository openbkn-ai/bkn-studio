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
  error_link?: string;
  message?: string;
  description?: string;
  detail?: unknown;
  details?: unknown;
  solution?: string;
};

export type RequestErrorDetails = {
  code?: string;
  description: string;
  details?: string;
  errorLink?: string;
  solution?: string;
};

function formatErrorDetails(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function extractRequestErrorDetails(error: unknown): RequestErrorDetails {
  if (axios.isAxiosError<BackendErrorResponseBody>(error)) {
    const data = error.response?.data;
    const description = optionalString(data?.description);
    const details = formatErrorDetails(data?.error_details);
    const fallbackDetails = formatErrorDetails(data?.details ?? data?.detail);
    const common = {
      code: optionalString(data?.error_code),
      details: details ?? fallbackDetails,
      errorLink: optionalString(data?.error_link),
      solution: optionalString(data?.solution),
    };
    const responseMessage = optionalString(data?.message);
    const responseError = optionalString(data?.error);

    if (description) {
      return { ...common, description };
    }

    if (fallbackDetails) {
      return { ...common, description: fallbackDetails };
    }

    if (responseMessage) {
      return { ...common, description: responseMessage };
    }

    if (responseError) {
      return { ...common, description: responseError };
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return { description: error.message };
  }

  return { description: i18n.t("common.requestFailed") };
}

export function extractRequestErrorMessage(error: unknown) {
  const { description, details } = extractRequestErrorDetails(error);
  return details ? `${description}: ${details}` : description;
}
