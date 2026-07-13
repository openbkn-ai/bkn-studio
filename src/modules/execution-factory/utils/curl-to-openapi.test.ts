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

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

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

  it("parses JSON body and content type from a POST curl command", () => {
    const result = parseCurlCommand(`curl -X POST https://api.example.com/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"test","password":"123456"}'`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.method).toBe("POST");
    expect(result.value.serverUrl).toBe("https://api.example.com");
    expect(result.value.path).toBe("/login");
    expect(result.value.requestBody?.contentType).toBe("application/json");
    expect(result.value.requestBody?.example).toEqual({
      username: "test",
      password: "123456",
    });

    const spec = parseJson<{
      paths: {
        "/login": {
          post: {
            requestBody?: {
              content?: {
                "application/json"?: {
                  example?: unknown;
                  schema?: {
                    properties?: Record<string, { type?: string; example?: unknown }>;
                  };
                };
              };
            };
          };
        };
      };
    }>(buildOpenApiFromQuickApi(result.value));

    const jsonBody = spec.paths["/login"].post.requestBody?.content?.["application/json"];
    expect(jsonBody?.example).toEqual({ username: "test", password: "123456" });
    expect(jsonBody?.schema?.properties?.username).toEqual({
      type: "string",
      example: "test",
    });
    expect(jsonBody?.schema?.properties?.password).toEqual({
      type: "string",
      example: "123456",
    });
  });

  it("turns curl headers into header parameters except content type", () => {
    const result = parseCurlCommand(`curl -X GET "https://httpbin.org/get?customerId=1001&region=CN" \
  -H "accept: application/json" \
  -H "x-demo-source: openbkn-manual"`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.queryParams.map((item) => [item.name, item.in, item.example])).toEqual([
      ["customerId", "query", "1001"],
      ["region", "query", "CN"],
      ["accept", "header", "application/json"],
      ["x-demo-source", "header", "openbkn-manual"],
    ]);

    const spec = parseJson<{
      paths: {
        "/get": {
          get: {
            parameters?: Array<{ in?: string; name?: string; schema?: { example?: unknown } }>;
          };
        };
      };
    }>(buildOpenApiFromQuickApi(result.value));

    expect(spec.paths["/get"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "header",
          name: "x-demo-source",
          schema: expect.objectContaining({ example: "openbkn-manual" }) as unknown,
        }),
      ]),
    );
  });

  it("turns -G data fields into query parameters", () => {
    const result = parseCurlCommand(
      `curl -G --data-urlencode "city=北京" --data "unit=c" https://api.example.com/weather`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.method).toBe("GET");
      expect(result.value.queryParams.map((item) => [item.name, item.example])).toEqual([
        ["city", "北京"],
        ["unit", "c"],
      ]);
      expect(result.value.requestBody).toBeUndefined();
    }
  });

  it("parses form-urlencoded body fields", () => {
    const result = parseCurlCommand(
      `curl https://api.example.com/token -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=password&username=test"`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.method).toBe("POST");
      expect(result.value.requestBody?.contentType).toBe("application/x-www-form-urlencoded");
      expect(result.value.requestBody?.example).toEqual({
        grant_type: "password",
        username: "test",
      });
    }
  });

  it("parses multipart form fields", () => {
    const result = parseCurlCommand(
      `curl --request POST --form "name=avatar" --form "file=@avatar.png" https://api.example.com/upload`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.method).toBe("POST");
      expect(result.value.requestBody?.contentType).toBe("multipart/form-data");
      expect(result.value.requestBody?.example).toEqual({
        name: "avatar",
        file: "@avatar.png",
      });
    }
  });

  it("returns specific errors for common malformed curl input", () => {
    expect(parseCurlCommand(`curl -H "Content-Type application/json" https://api.example.com`).ok).toBe(
      false,
    );

    const invalidJson = parseCurlCommand(
      `curl https://api.example.com/login -H "Content-Type: application/json" -d '{"username":'`,
    );
    expect(invalidJson).toEqual({
      ok: false,
      reason: "请求体不是合法 JSON，请检查引号、逗号或转义字符。",
    });

    const fileBody = parseCurlCommand(`curl https://api.example.com/upload -d @payload.json`);
    expect(fileBody).toEqual({
      ok: false,
      reason: "暂不支持读取本地文件，请粘贴文件内容。",
    });

    const unclosedQuote = parseCurlCommand(`curl "https://api.example.com/login`);
    expect(unclosedQuote).toEqual({
      ok: false,
      reason: "cURL 中存在未闭合的引号。",
    });
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
