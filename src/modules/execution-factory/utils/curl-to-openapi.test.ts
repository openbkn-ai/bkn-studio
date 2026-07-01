/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildOpenApiFromQuickApi,
  parseCurlCommand,
  parseQuickApiUrl,
} from "@/modules/execution-factory/utils/curl-to-openapi";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

describe("curl-to-openapi", () => {
  it("parses a simple curl command", () => {
    const result = parseCurlCommand(
      "curl 'https://uapis.cn/api/v1/misc/weather?city=北京'",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.method).toBe("GET");
      expect(result.value.serverUrl).toBe("https://uapis.cn");
      expect(result.value.path).toBe("/api/v1/misc/weather");
      expect(result.value.queryParams).toHaveLength(1);
    }
  });

  it("builds a valid openapi document from quick api input", () => {
    const spec = buildOpenApiFromQuickApi({
      method: "GET",
      serverUrl: "https://uapis.cn",
      path: "/api/v1/misc/weather",
      summary: "查询天气",
      queryParams: [{ name: "city", in: "query", required: false, type: "string" }],
    });

    const validation = validateOpenApiDocumentText(spec);
    expect(validation.ok).toBe(true);
  });

  it("parses a plain api url", () => {
    const result = parseQuickApiUrl("https://example.com/api/v1/items?page=1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe("/api/v1/items");
      expect(result.value.queryParams[0]?.name).toBe("page");
    }
  });
});
