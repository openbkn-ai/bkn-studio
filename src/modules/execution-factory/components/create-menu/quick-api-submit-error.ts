/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { extractRequestErrorMessage } from "@/framework/request/error-message";
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
  const isUrlError =
    /OpenAPIInvalidURLFormat|URL cannot be empty|url format|invalid url|URL格式|URL/i.test(
      combined,
    );

  if (!isUrlError) {
    return {
      message: messageParts.join("：") || extractRequestErrorMessage(error),
    };
  }

  return {
    field: "curlText" as const,
    message:
      "保存失败：未能提交有效的服务地址。请检查 cURL 命令中的完整 URL，并重新点击“识别接口信息”后再保存。" +
      (rawDetail ? ` 后端返回：${rawDetail}` : ""),
  };
}
