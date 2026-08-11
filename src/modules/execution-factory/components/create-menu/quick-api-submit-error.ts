/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import i18n from "@/app/locales/i18n";
import { extractRequestErrorDetail } from "@/modules/execution-factory/utils/request-error-detail";

export function buildQuickApiSubmitError(error: unknown) {
  const detail = extractRequestErrorDetail(error);
  const rawDetail =
    typeof detail.detail === "string"
      ? detail.detail
      : detail.detail
        ? JSON.stringify(detail.detail)
        : "";
  const messageParts = [detail.message, rawDetail].filter(Boolean);
  const combined = [detail.code, detail.message, rawDetail].filter(Boolean).join(" ");
  const urlFormatPattern = new RegExp(
    "OpenAPIInvalidURLFormat|URL cannot be empty|url format|invalid url|URL\\u683c\\u5f0f|URL",
    "i",
  );
  const isUrlError = urlFormatPattern.test(combined);

  if (!isUrlError) {
    return {
      message: messageParts.join("：") || extractRequestErrorMessage(error),
    };
  }

  return {
    field: "curlText" as const,
    message: i18n.t("executionFactory.quickApiUrlSubmitError", {
      defaultValue:
        "Save failed: could not submit a valid service URL. Check the full URL in the cURL command, then click Detect API again before saving.{{detailSuffix}}",
      detailSuffix: rawDetail
        ? i18n.t("executionFactory.quickApiUrlSubmitErrorDetailSuffix", {
            defaultValue: " Backend returned: {{detail}}",
            detail: rawDetail,
          })
        : "",
    }),
  };
}
