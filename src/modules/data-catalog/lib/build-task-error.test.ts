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

  it("summarizes data-too-long errors with localized column interpolation", () => {
    const summary = summarizeBuildTaskError(
      "Data too long for column 'f_error_detail' at row 1",
      "en-US",
    );

    expect(summary?.title).toBe("Build checkpoint write failed");
    expect(summary?.message).toContain("Column f_error_detail received a value longer");
    expect(summary?.suggestion).toBe("Check and increase the column length, then rebuild.");
  });

  it("summarizes duplicate entry errors in Chinese", () => {
    const summary = summarizeBuildTaskError("Duplicate entry 'task-001' for key 'uniq'", "zh-CN");

    expect(summary?.title).toBe("任务状态写入冲突");
    expect(summary?.suggestion).toContain("请刷新任务列表");
  });
});
