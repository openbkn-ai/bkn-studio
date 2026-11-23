/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import { extractRequestErrorMessage } from "@/framework/request/error-message";

import {
  buildTaskStartErrorMessage,
  extractBuildTaskErrorDetails,
  summarizeBuildTaskError,
} from "./build-task-error";

describe("build-task request errors", () => {
  it("gives the shared request toast localized full-build guidance", async () => {
    const previousLanguage = i18n.language;
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error_code: "VegaBackend.BuildTask.IncrementalBaselineUnavailable",
          description: "The saved incremental cursor is invalid.",
        },
      },
    };

    try {
      await i18n.changeLanguage("en-US");
      expect(extractRequestErrorMessage(error)).toBe(
        "There is no usable incremental baseline. Complete a full build with the current incremental keys, then start an incremental build.",
      );
      await i18n.changeLanguage("zh-CN");
      expect(extractRequestErrorMessage(error)).toBe(
        "增量构建缺少可用的基线。请按当前增量键配置完成一次全量构建，再执行增量构建。",
      );
    } finally {
      await i18n.changeLanguage(previousLanguage);
    }
  });

  it("retains structured diagnostics ahead of the backend description", () => {
    const code = "VegaBackend.BuildTask.IncrementalBaselineUnavailable";
    const metadata = { task_id: "task-1" };
    const error = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error_code: code,
          description: "The saved incremental cursor is invalid.",
          error_details: "The cursor field no longer matches the task configuration.",
          metadata,
        },
      },
    };

    expect(extractBuildTaskErrorDetails(error)).toEqual({
      code,
      description: i18n.t("dataCatalog.build.incrementalBaselineUnavailable"),
      descriptionSource: undefined,
      details: error.response.data.error_details,
      metadata,
    });
  });

  it("keeps generic guidance for other build start conflicts", () => {
    const error = {
      isAxiosError: true,
      response: { status: 409, data: { description: "The task configuration changed." } },
    };

    expect(buildTaskStartErrorMessage(error)).toBe(i18n.t("dataCatalog.task.startRejected"));
  });
});

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
      suggestion: "Make sure an incremental key is configured, then run a full build.",
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
      suggestion: "请确认已配置增量键，再运行一次全量构建。",
    },
  ])("explains recovery failure: $raw", ({ raw, language, title, message, suggestion }) => {
    expect(summarizeBuildTaskError(raw, language)).toEqual({ raw, title, message, suggestion });
  });
});
