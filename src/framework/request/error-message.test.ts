/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { describe, expect, it } from "vitest";

import { extractRequestErrorDetails } from "./error-message";

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
  });
});
