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
  message?: string;
  description?: string;
  detail?: unknown;
  details?: unknown;
};

export function extractRequestErrorMessage(error: unknown) {
  if (axios.isAxiosError<ErrorResponseBody>(error)) {
    const data = error.response?.data;
    const responseDescription = data?.description;
    const responseMessage = data?.message;
    const responseError = data?.error;
    const responseDetails = data?.details ?? data?.detail;

    if (typeof responseDescription === "string" && responseDescription.trim()) {
      return responseDescription;
    }

    if (typeof responseDetails === "string" && responseDetails.trim()) {
      return responseDetails;
    }

    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof responseError === "string" && responseError.trim()) {
      return responseError;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return i18n.t("common.requestFailed");
}

