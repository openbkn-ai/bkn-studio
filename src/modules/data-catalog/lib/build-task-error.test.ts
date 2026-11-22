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

  it.each([
    {
      raw: "cannot recover incremental checkpoint: unsupported cursor field",
      language: "zh-CN",
      title: "增量游标恢复失败",
      message: "游标中有字段不支持自动恢复。",
      suggestion: "请确认已配置增量键，再运行一次全量构建。",
    },
    {
      raw: "cannot recover incremental checkpoint: published index query failed",
      language: "en-US",
      title: "Incremental cursor recovery failed",
      message: "Vega could not query the published index.",
      suggestion: "Check that the published index is available, then retry the incremental build.",
    },
    {
      raw: "cannot recover incremental checkpoint: invalid indexed cursor",
      language: "en-US",
      title: "Incremental cursor recovery failed",
      message: "The indexed values cannot form a valid incremental cursor.",
      suggestion: "Make sure an incremental key is configured, then run a full build.",
    },
    {
      raw: "cannot recover a compatible incremental checkpoint from the published index",
      language: "zh-CN",
      title: "增量游标恢复失败",
      message: "Vega 无法从已发布的索引恢复增量游标。",
      suggestion:
        "请确认已发布的索引可用，再重试增量构建。若仍无法恢复，请配置增量键并运行一次全量构建。",
    },
  ])("explains recovery failure: $raw", ({ raw, language, title, message, suggestion }) => {
    expect(summarizeBuildTaskError(raw, language)).toEqual({ raw, title, message, suggestion });
  });
});
