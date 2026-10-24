/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import {
  extractRequestErrorDetails,
  extractRequestErrorMessage,
} from "@/framework/request/error-message";

export type RequestErrorDetail = {
  message: string;
  code?: string;
  description?: string;
  detail?: unknown;
};

type BackendErrorBody = {
  error_code?: string;
  error_details?: unknown;
  code?: string;
  description?: string;
  detail?: unknown;
  details?: unknown;
  error?: string;
  message?: string;
};

export function extractRequestErrorDetail(error: unknown): RequestErrorDetail {
  const message = extractRequestErrorMessage(error);

  if (!axios.isAxiosError<BackendErrorBody>(error)) {
    return { message };
  }

  const data = error.response?.data;
  if (data?.error_code) {
    const shared = extractRequestErrorDetails(error);
    return {
      message: shared.description,
      code: shared.code,
      description: shared.description,
      detail: data.error_details,
    };
  }

  return {
    message: data?.description?.trim() || data?.message?.trim() || data?.code || message,
    code: data?.code,
    description: data?.description,
    detail: data?.detail ?? data?.details,
  };
}
