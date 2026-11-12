/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticUnderstandingTask } from "@/modules/data-catalog/services/semantic-understanding-task.service";

const { getTask, applyTask, getCatalog, getResource } = vi.hoisted(() => ({
  getTask: vi.fn(),
  applyTask: vi.fn(),
  getCatalog: vi.fn(),
  getResource: vi.fn(),
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/modules/data-catalog/services/semantic-understanding-task.service", () => ({
  getSemanticUnderstandingTask: getTask,
  applySemanticUnderstandingTask: applyTask,
}));
vi.mock("@/shared/catalog", async (original) => ({
  ...(await original<typeof import("@/shared/catalog")>()),
  getCatalog,
}));
vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getResource,
}));
import { SemanticUnderstandingTaskDetailDrawer } from "./SemanticUnderstandingTaskDetailDrawer";

const task: SemanticUnderstandingTask = {
  id: "task-1",
  scope: "resource",
  catalogId: "cat-1",
  resourceId: "resource-1",
  agentId: "semantic-agent",
  status: "completed",
  applyMode: "dry_run",
  applied: false,
  confidence: 0.9,
  confidenceThreshold: 0.75,
  createTime: 1,
  creator: { id: "user-1", type: "user" },
  input: "",
  resultJson: '{"summary":"Reviewed result"}',
};
const buttonName = "dataCatalog.taskManagement.semantic.applyResult";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  getTask.mockResolvedValue({ ...task });
  getCatalog.mockResolvedValue({ operations: ["task_manage", "resource_manage"] });
  getResource.mockResolvedValue({ operations: ["view_detail", "modify"] });
  applyTask.mockResolvedValue({
    ...task,
    applied: true,
    applyDetailJson: '{"apply_mode":"fill_empty"}',
  });
});

describe("SemanticUnderstandingTaskDetailDrawer", () => {
  it("applies the saved result even when audited input is hidden and refreshes the owner", async () => {
    getCatalog.mockResolvedValue({ operations: ["task_manage"] });
    const onApplied = vi.fn();
    render(
      <SemanticUnderstandingTaskDetailDrawer
        onApplied={onApplied}
        onClose={vi.fn()}
        open
        taskId="task-1"
      />,
    );
    const button = await screen.findByRole("button", { name: buttonName });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(applyTask).toHaveBeenCalledWith("task-1", "fill_empty"));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
    expect(
      screen.getAllByText("dataCatalog.taskManagement.applyMode.dryRun").length,
    ).toBeGreaterThan(0);
  });

  it("sends the chosen force mode and shows its effect before application", async () => {
    render(
      <SemanticUnderstandingTaskDetailDrawer canApply onClose={vi.fn()} open taskId="task-1" />,
    );
    const select = await screen.findByRole("combobox", {
      name: "dataCatalog.taskManagement.semantic.applicationMode",
    });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByText("dataCatalog.taskManagement.applyMode.force"));
    expect(
      screen.getByText("dataCatalog.taskManagement.semantic.forceDescription"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    await waitFor(() => expect(applyTask).toHaveBeenCalledWith("task-1", "force"));
  });

  it.each([
    { catalogOperations: ["task_manage", "resource_manage"], resourceOperations: ["view_detail"] },
    { catalogOperations: ["resource_manage"], resourceOperations: ["modify"] },
  ])(
    "requires task management and effective Resource modify permission: %j",
    async ({ catalogOperations, resourceOperations }) => {
      getCatalog.mockResolvedValue({ operations: catalogOperations });
      getResource.mockResolvedValue({ operations: resourceOperations });
      render(<SemanticUnderstandingTaskDetailDrawer onClose={vi.fn()} open taskId="task-1" />);
      await screen.findByText("dataCatalog.taskManagement.semantic.fields.inputHash");
      await waitFor(() => expect(getResource).toHaveBeenCalledWith("resource-1"));
      expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
    },
  );

  it("keeps the result visible when Resource permission loading fails", async () => {
    getResource.mockRejectedValue(new Error("Cannot load Resource permissions"));
    render(<SemanticUnderstandingTaskDetailDrawer onClose={vi.fn()} open taskId="task-1" />);
    expect(await screen.findByText("Cannot load Resource permissions")).toBeInTheDocument();
    expect(screen.getByText(/Reviewed result/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
  });

  it("keeps the result visible when catalog permission loading fails", async () => {
    getCatalog.mockRejectedValue(new Error("Cannot load catalog permissions"));
    render(<SemanticUnderstandingTaskDetailDrawer onClose={vi.fn()} open taskId="task-1" />);
    expect(await screen.findByText("Cannot load catalog permissions")).toBeInTheDocument();
    expect(screen.getByText(/Reviewed result/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
  });

  it.each([
    { status: "running" },
    { scope: "catalog" },
    { applied: true },
    { applyMode: "fill_empty" },
    { resultJson: "" },
  ])("does not offer application for an ineligible task: %j", async (change) => {
    getTask.mockResolvedValue({ ...task, ...change });
    render(
      <SemanticUnderstandingTaskDetailDrawer canApply onClose={vi.fn()} open taskId="task-1" />,
    );
    await screen.findByText("dataCatalog.taskManagement.semantic.fields.inputHash");
    expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
  });

  it.each([
    '{"apply_mode":"fill_empty","reason":"no_resource_changes"}',
    '{"apply_mode":"force","resource_updated":false,"field_details":[{"name":"id","status":"skipped"}]}',
  ])("completes no-change application and hides the action: %s", async (applyDetailJson) => {
    applyTask.mockResolvedValue({
      ...task,
      applied: true,
      applyDetailJson,
    });
    render(
      <SemanticUnderstandingTaskDetailDrawer canApply onClose={vi.fn()} open taskId="task-1" />,
    );
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    expect(
      await screen.findByText("dataCatalog.taskManagement.semantic.applyUnchanged"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: buttonName })).not.toBeInTheDocument();
    expect(applyTask).toHaveBeenCalledTimes(1);
  });

  it("disables application below the original threshold", async () => {
    getTask.mockResolvedValue({ ...task, confidence: 0.6 });
    render(
      <SemanticUnderstandingTaskDetailDrawer canApply onClose={vi.fn()} open taskId="task-1" />,
    );
    expect(await screen.findByRole("button", { name: buttonName })).toBeDisabled();
    expect(
      screen.getByText("dataCatalog.taskManagement.semantic.belowThreshold"),
    ).toBeInTheDocument();
    expect(applyTask).not.toHaveBeenCalled();
  });

  it("keeps the saved result and shows schema conflicts without a successful refresh", async () => {
    applyTask.mockRejectedValue(new Error("Resource schema changed"));
    const onApplied = vi.fn();
    render(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={onApplied}
        onClose={vi.fn()}
        open
        taskId="task-1"
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    expect(await screen.findByText("Resource schema changed")).toBeInTheDocument();
    expect(screen.getByText(/Reviewed result/)).toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("prevents duplicate requests and refreshes the owner without replacing another task", async () => {
    let complete!: (value: SemanticUnderstandingTask) => void;
    applyTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const onApplied = vi.fn();
    const view = render(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={onApplied}
        onClose={vi.fn()}
        open
        taskId="task-1"
      />,
    );
    const button = await screen.findByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(applyTask).toHaveBeenCalledTimes(1);
    getTask.mockResolvedValue({ ...task, id: "task-2" });
    const refreshCurrentOwner = vi.fn();
    view.rerender(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={refreshCurrentOwner}
        onClose={vi.fn()}
        open
        taskId="task-2"
      />,
    );
    await screen.findByText(/task-2/);
    await act(async () => {
      complete({ ...task, applied: true });
      await Promise.resolve();
    });
    expect(onApplied).not.toHaveBeenCalled();
    expect(refreshCurrentOwner).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: buttonName })).toBeEnabled();
  });

  it("refreshes the owner after closing while application is pending", async () => {
    let complete!: (value: SemanticUnderstandingTask) => void;
    applyTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const onApplied = vi.fn();
    const view = render(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={onApplied}
        onClose={vi.fn()}
        open
        taskId="task-1"
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    view.rerender(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={onApplied}
        onClose={vi.fn()}
        open={false}
        taskId=""
      />,
    );
    await act(async () => {
      complete({ ...task, applied: true });
      await Promise.resolve();
    });
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("does not refresh a page that unmounted before application succeeded", async () => {
    let complete!: (value: SemanticUnderstandingTask) => void;
    applyTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const onApplied = vi.fn();
    const view = render(
      <SemanticUnderstandingTaskDetailDrawer
        canApply
        onApplied={onApplied}
        onClose={vi.fn()}
        open
        taskId="task-1"
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: buttonName }));
    view.unmount();
    await act(async () => {
      complete({ ...task, applied: true });
      await Promise.resolve();
    });
    expect(onApplied).not.toHaveBeenCalled();
  });
});
