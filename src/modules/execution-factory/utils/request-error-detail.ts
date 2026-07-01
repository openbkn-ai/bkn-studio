/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { extractRequestErrorMessage } from "@/framework/request/error-message";

export type RequestErrorDetail = {
  message: string;
  code?: string;
  description?: string;
  detail?: unknown;
  solution?: string;
  link?: string;
};

type BackendErrorBody = {
  code?: string;
  description?: string;
  detail?: unknown;
  error?: string;
  message?: string;
  solution?: string;
  link?: string;
};

export function extractRequestErrorDetail(error: unknown): RequestErrorDetail {
  const message = extractRequestErrorMessage(error);

  if (!axios.isAxiosError<BackendErrorBody>(error)) {
    return { message };
  }

  const data = error.response?.data;

  return {
    message: data?.description ?? data?.message ?? message,
    code: data?.code,
    description: data?.description,
    detail: data?.detail,
    solution: data?.solution,
    link: data?.link,
  };
}
