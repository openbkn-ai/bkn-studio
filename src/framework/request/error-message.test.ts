/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { describe, expect, it } from "vitest";

import {
  extractRequestErrorDetails,
  extractRequestErrorMessage,
  isRequestConflict,
  isRequestNotFound,
} from "./error-message";

function createAxiosLikeError(data: unknown) {
  return {
    isAxiosError: true,
    response: { data },
  };
}

describe("extractRequestErrorDetails", () => {
  it("preserves backend error code, description, and details", () => {
    const error = new axios.AxiosError("Request failed", undefined, undefined, undefined, {
      config: { headers: new axios.AxiosHeaders() },
      data: {
        description: "创建构建任务失败",
        error_code: "VegaBackend.BuildTask.InternalError.CreateFailed",
        error_details: "Resource has no primary key",
        error_link: "暂无",
        solution: "请联系管理员",
      },
      headers: {},
      status: 400,
      statusText: "Bad Request",
    });

    expect(extractRequestErrorDetails(error)).toEqual({
      code: "VegaBackend.BuildTask.InternalError.CreateFailed",
      description: "创建构建任务失败",
      descriptionSource: "response",
      details: "Resource has no primary key",
    });
    expect(extractRequestErrorMessage(error)).toBe("创建构建任务失败");
  });

  it("preserves structured metadata independently of diagnostic details", () => {
    const result = extractRequestErrorDetails(
      createAxiosLikeError({
        error_code: "VegaBackend.Resource.QueryValueExceedsKeywordLimit",
        description: "Keyword value too long",
        error_details: "unstructured diagnostic",
        metadata: { field: "status", limit: 256 },
      }),
    );
    expect(result.code).toBe("VegaBackend.Resource.QueryValueExceedsKeywordLimit");
    expect(result.metadata).toEqual({ field: "status", limit: 256 });
    expect(result.details).toBe("unstructured diagnostic");
  });

  it.each([null, [], "status:256", 256])("ignores invalid metadata %j", (metadata) => {
    expect(
      extractRequestErrorDetails(createAxiosLikeError({ description: "failed", metadata }))
        .metadata,
    ).toBeUndefined();
  });

  it("preserves an error code without treating the Axios fallback as response text", () => {
    const error = Object.assign(new Error("Request failed with status code 400"), {
      isAxiosError: true,
      response: { data: { error_code: "VegaBackend.Query.NoQueryableFields" }, status: 400 },
    });
    const details = extractRequestErrorDetails(error);
    expect(details.code).toBe("VegaBackend.Query.NoQueryableFields");
    expect(details.description).toBe("VegaBackend.Query.NoQueryableFields");
    expect(details.descriptionSource).toBe("response");
  });

  it.each([
    [{ description: "backend description" }, "backend description"],
    [{ details: "backend details" }, "backend details"],
    [{ detail: "backend detail" }, "backend detail"],
    [{ message: "backend message" }, "backend message"],
    [{ error: "backend error" }, "backend error"],
  ])("identifies a description extracted from response body %o", (body, description) => {
    expect(extractRequestErrorDetails(createAxiosLikeError(body))).toMatchObject({
      description,
      descriptionSource: "response",
    });
  });

  it("serializes structured error_details for a local error surface", () => {
    const error = new axios.AxiosError("Request failed", undefined, undefined, undefined, {
      config: { headers: new axios.AxiosHeaders() },
      data: {
        description: "创建构建任务失败",
        error_details: { missing_fields: ["id"] },
      },
      headers: {},
      status: 400,
      statusText: "Bad Request",
    });

    expect(extractRequestErrorDetails(error).details).toBe('{"missing_fields":["id"]}');
  });

  it("uses details when description is absent", () => {
    const details = extractRequestErrorDetails(
      createAxiosLikeError({
        details: "logic property[weather] result_path is invalid",
        message: "request failed",
      }),
    );

    expect(details.description).toBe("logic property[weather] result_path is invalid");
  });

  it("keeps description as the highest priority response message", () => {
    const message = extractRequestErrorMessage(
      createAxiosLikeError({
        description: "description message",
        details: "detail message",
      }),
    );

    expect(message).toBe("description message");
  });
});

describe("isRequestConflict", () => {
  it("only matches Axios 409 responses", () => {
    expect(isRequestConflict({ isAxiosError: true, response: { status: 409 } })).toBe(true);
    expect(isRequestConflict({ isAxiosError: true, response: { status: 400 } })).toBe(false);
    expect(isRequestConflict(new Error("conflict"))).toBe(false);
  });
});

describe("isRequestNotFound", () => {
  it("only matches Axios 404 responses", () => {
    expect(isRequestNotFound({ isAxiosError: true, response: { status: 404 } })).toBe(true);
    expect(isRequestNotFound({ isAxiosError: true, response: { status: 403 } })).toBe(false);
    expect(isRequestNotFound(new Error("not found"))).toBe(false);
  });
});

describe("shared error migration", () => {
  it.each(["", "  "])("uses the error code for blank description %j", (description) => {
    expect(
      extractRequestErrorDetails(
        createAxiosLikeError({
          error_code: "Vega.Query.Invalid",
          description,
          message: "generic",
          metadata: { field: "title" },
        }),
      ),
    ).toMatchObject({
      description: "Vega.Query.Invalid",
      descriptionSource: "response",
      metadata: { field: "title" },
    });
  });
  it("accepts new messages and ignores legacy guidance", () => {
    const current = extractRequestErrorDetails(
      createAxiosLikeError({
        error_code: "Vega.Query.Invalid",
        description: "Bad query. Check the limit.",
        error_details: "{{ literal }}",
      }),
    );
    expect(current.description).toBe("Bad query. Check the limit.");
    expect(current.details).toBe("{{ literal }}");
    expect(current).not.toHaveProperty("solution");
    const legacy = extractRequestErrorDetails(
      createAxiosLikeError({
        error_code: "Vega.Query.Invalid",
        description: "Bad query",
        solution: "Check the limit",
        error_link: "https://example.com/errors/query",
      }),
    );
    expect(legacy).not.toHaveProperty("solution");
    expect(legacy).not.toHaveProperty("errorLink");
    expect(
      extractRequestErrorDetails(
        createAxiosLikeError({
          description: "Bad query",
          solution: { unused: true },
          error_link: [],
        }),
      ),
    ).not.toHaveProperty("solution");
  });
});
