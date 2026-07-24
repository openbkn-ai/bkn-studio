/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import i18n from "@/app/locales/i18n";

type ErrorResponseBody = {
  error?: string;
  error_code?: string;
  error_details?: unknown;
  error_link?: string;
  message?: string;
  description?: string;
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
  if (axios.isAxiosError<ErrorResponseBody>(error)) {
    const data = error.response?.data;
    const description = data?.description;
    const details = formatErrorDetails(data?.error_details);
    const common = {
      code: optionalString(data?.error_code),
      details,
      errorLink: optionalString(data?.error_link),
      solution: optionalString(data?.solution),
    };
    const responseMessage = optionalString(data?.message);
    const responseError = optionalString(data?.error);

    if (typeof description === "string" && description.trim()) {
      return {
        ...common,
        description,
      };
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
  return extractRequestErrorDetails(error).description;
}
