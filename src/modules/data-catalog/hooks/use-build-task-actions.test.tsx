/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

const { modalConfirmMock, pauseBuildTaskMock } = vi.hoisted(() => ({
  modalConfirmMock: vi.fn(),
  pauseBuildTaskMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
  resumeBuildTask: vi.fn(),
  retryBuildTask: vi.fn(),
}));

import { useBuildTaskActions } from "./use-build-task-actions";

const runningTask = {
  id: "task-1",
  mode: "batch",
  status: "running",
} as BuildTask;

describe("useBuildTaskActions", () => {
  beforeEach(() => {
    modalConfirmMock.mockReset();
    pauseBuildTaskMock.mockReset();
    pauseBuildTaskMock.mockResolvedValue(undefined);
  });

  it("requires confirmation before pausing a build task", async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useBuildTaskActions(onRefresh));

    result.current.pauseOrResume(runningTask);

    expect(modalConfirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "dataCatalog.task.pauseResumeConfirmPauseTitle",
    }));
    expect(pauseBuildTaskMock).not.toHaveBeenCalled();

    const config = modalConfirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await config.onOk();

    expect(pauseBuildTaskMock).toHaveBeenCalledWith(runningTask.id);
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
