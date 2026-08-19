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
      details: "Resource has no primary key",
      errorLink: "暂无",
      solution: "请联系管理员",
    });
    expect(extractRequestErrorMessage(error)).toBe("创建构建任务失败");
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

    expect(extractRequestErrorDetails(error).details).toBe(
      '{"missing_fields":["id"]}',
    );
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
