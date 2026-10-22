/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook } from "@testing-library/react";
import { createInstance } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";
import { dataCatalogZhCN } from "@/modules/data-catalog/locales/zh-CN";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

const { modalConfirmMock, pauseBuildTaskMock, resumeBuildTaskMock, translateMock } = vi.hoisted(
  () => ({
    modalConfirmMock: vi.fn(),
    pauseBuildTaskMock: vi.fn(),
    resumeBuildTaskMock: vi.fn(),
    translateMock: vi.fn(),
  }),
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translateMock }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: modalConfirmMock },
  }),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  deleteBuildTask: vi.fn(),
  pauseBuildTask: pauseBuildTaskMock,
  resumeBuildTask: resumeBuildTaskMock,
  retryBuildTask: vi.fn(),
}));

import { useBuildTaskActions } from "./use-build-task-actions";

describe.each([
  {
    language: "en-US",
    batchTitle: "Stop build task?",
    batchContent: "This stops the current batch build.",
    streamingTitle: "Pause listening?",
    streamingContent: "This pauses the streaming task's listening for data changes.",
    resumeTitle: "Resume build task?",
    resumeContent: "This changes the task state and resumes processing.",
  },
  {
    language: "zh-CN",
    batchTitle: "停止构建？",
    batchContent: "将停止当前批量构建。",
    streamingTitle: "暂停监听？",
    streamingContent: "将暂停流式任务对数据变更的监听。",
    resumeTitle: "继续构建任务？",
    resumeContent: "将变更任务状态并恢复处理。",
  },
])("useBuildTaskActions ($language)", (copy) => {
  beforeEach(async () => {
    vi.clearAllMocks();
    pauseBuildTaskMock.mockResolvedValue(undefined);
    resumeBuildTaskMock.mockResolvedValue(undefined);
    const i18n = createInstance();
    await i18n.init({
      lng: copy.language,
      resources: {
        "en-US": { translation: dataCatalogEnUS },
        "zh-CN": { translation: dataCatalogZhCN },
      },
    });
    translateMock.mockImplementation((key: string) => i18n.t(key));
  });

  it.each([
    ["batch", "pending"],
    ["batch", "running"],
    ["streaming", "pending"],
    ["streaming", "running"],
  ] as const)("confirms the correct action for a %s task that is %s", async (mode, status) => {
    const onRefresh = vi.fn();
    const task = { id: "task-1", mode, status } as BuildTask;
    const { result } = renderHook(() => useBuildTaskActions(onRefresh));

    result.current.pauseOrResume(task);

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: mode === "batch" ? copy.batchTitle : copy.streamingTitle,
        content: mode === "batch" ? copy.batchContent : copy.streamingContent,
      }),
    );
    expect(pauseBuildTaskMock).not.toHaveBeenCalled();
    expect(resumeBuildTaskMock).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();

    const config = modalConfirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await config.onOk();

    expect(pauseBuildTaskMock).toHaveBeenCalledExactlyOnceWith(task.id);
    expect(resumeBuildTaskMock).not.toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it.each(["batch", "streaming"] as const)(
    "preserves resume confirmation for a stopped %s task",
    async (mode) => {
      const onRefresh = vi.fn();
      const task = { id: "task-1", mode, status: "stopped" } as BuildTask;
      const { result } = renderHook(() => useBuildTaskActions(onRefresh));

      result.current.pauseOrResume(task);

      expect(modalConfirmMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: copy.resumeTitle, content: copy.resumeContent }),
      );
      expect(resumeBuildTaskMock).not.toHaveBeenCalled();
      expect(pauseBuildTaskMock).not.toHaveBeenCalled();
      expect(onRefresh).not.toHaveBeenCalled();

      const config = modalConfirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
      await config.onOk();

      expect(resumeBuildTaskMock).toHaveBeenCalledExactlyOnceWith(task.id);
      expect(pauseBuildTaskMock).not.toHaveBeenCalled();
      expect(onRefresh).toHaveBeenCalledOnce();
    },
  );
});
