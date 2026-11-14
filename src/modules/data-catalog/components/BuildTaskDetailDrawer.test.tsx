/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

const { getBuildTaskMock } = vi.hoisted(() => ({ getBuildTaskMock: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "en-US" }, t: (key: string) => key }),
}));
vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  getBuildTask: getBuildTaskMock,
  buildTaskStatusLabelKey: (status: string) => status,
}));

import { BuildTaskDetailDrawer } from "./BuildTaskDetailDrawer";

const task: BuildTask = {
  id: "task-1",
  createTime: 0,
  resourceId: "resource-1",
  mode: "batch",
  executeType: "full",
  status: "failed",
  primaryKeyFields: [],
  incrementalFields: [],
  embeddingFields: [],
  embeddingModel: "",
  modelDimensions: 0,
  fulltextFields: [],
  fulltextAnalyzer: "",
  error: null,
  finishTime: null,
  lastProgressTime: null,
  startTime: null,
  syncedCount: 0,
  totalCount: 0,
};

describe("BuildTaskDetailDrawer origin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it("shows the deleted schedule ID as read-only history separately from task failure", async () => {
    getBuildTaskMock.mockResolvedValue({
      ...task,
      triggerType: "scheduled",
      scheduleId: "deleted-schedule",
    });
    render(<BuildTaskDetailDrawer open resource={null} taskId="task-1" onClose={vi.fn()} />);

    expect(await screen.findByText("deleted-schedule")).toBeInTheDocument();
    expect(screen.getByText("dataCatalog.buildSchedule.scheduled")).toBeInTheDocument();
    expect(screen.getByText("dataCatalog.task.statuses.failed")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getBuildTaskMock).toHaveBeenCalledWith("task-1");
  });

  it.each(["manual", undefined] as const)(
    "shows a manual origin and empty schedule for %s",
    async (triggerType) => {
      getBuildTaskMock.mockResolvedValue({ ...task, triggerType });
      render(<BuildTaskDetailDrawer open resource={null} taskId="task-1" onClose={vi.fn()} />);

      expect(await screen.findByText("dataCatalog.buildSchedule.manual")).toBeInTheDocument();
      const scheduleRow = screen.getByText("dataCatalog.buildSchedule.scheduleId").closest("tr");
      expect(scheduleRow).not.toBeNull();
      expect(within(scheduleRow!).getByText("-")).toBeInTheDocument();
    },
  );
});
