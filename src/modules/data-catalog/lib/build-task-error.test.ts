/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { summarizeBuildTaskError } from "./build-task-error";

describe("summarizeBuildTaskError", () => {
  it("summarizes repeated missing document id errors", () => {
    const summary = summarizeBuildTaskError(
      "create documents failed: Validation Failed: 1: id is missing;2: id is missing;",
      "zh-CN",
    );

    expect(summary?.title).toBe("索引文档缺少 ID");
    expect(summary?.message).toContain("写入索引失败");
    expect(summary?.raw).toContain("id is missing");
  });
});
