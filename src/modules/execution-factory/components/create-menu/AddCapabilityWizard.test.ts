/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildQuickApiSubmitError } from "./quick-api-submit-error";

describe("buildQuickApiSubmitError", () => {
  it("maps backend URL validation details to the cURL field", () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          code: "AgentOperatorIntegration.BadRequest.OpenAPIInvalidURLFormat",
          description: "URL格式错误，请检查URL是否符合规范",
          details: "URL cannot be empty",
        },
      },
    };

    const result = buildQuickApiSubmitError(error);

    expect(result.field).toBe("curlText");
    expect(result.message).toContain("服务地址");
    expect(result.message).toContain("URL cannot be empty");
  });
});
