/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sharedStyles from "@/modules/data-catalog/components/shared.module.css";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const {
  createResourceSemanticUnderstandingTaskMock,
  listResourceSemanticUnderstandingTasksMock,
} = vi.hoisted(() => ({
  createResourceSemanticUnderstandingTaskMock: vi.fn(),
  listResourceSemanticUnderstandingTasksMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));

vi.mock("@/framework/entitlement/EditionBadge", () => ({
  EditionBadge: () => null,
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/modules/data-catalog/services/semantic-understanding-task.service", () => ({
  createResourceSemanticUnderstandingTask: createResourceSemanticUnderstandingTaskMock,
  deleteSemanticUnderstandingTask: vi.fn(),
  listResourceSemanticUnderstandingTasks: listResourceSemanticUnderstandingTasksMock,
}));

import { ResourceSemanticUnderstandingPanel } from "./ResourceSemanticUnderstandingPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
  expectedUpdateTime: 0,
};

describe("ResourceSemanticUnderstandingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listResourceSemanticUnderstandingTasksMock.mockResolvedValue([]);
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

  it("initializes the semantic task defaults before opening the creation dialog", async () => {
    createResourceSemanticUnderstandingTaskMock.mockResolvedValue({ id: "task-1" });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.create/ }));

    await waitFor(() => expect(screen.getByText("dataCatalog.taskManagement.applyMode.fillEmpty")).toBeTruthy());
    expect(screen.getByRole("spinbutton").getAttribute("value")).toBe("0.75");

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.start/ }));

    await waitFor(() => expect(createResourceSemanticUnderstandingTaskMock).toHaveBeenCalledWith({
      applyMode: "fill_empty",
      confidenceThreshold: 0.75,
      includeSampleRows: false,
      resourceId: "resource-1",
    }));
  });

  it("shows finish time before create time", async () => {
    listResourceSemanticUnderstandingTasksMock.mockResolvedValue([{
      agentId: "resource-semantic-understanding",
      applied: false,
      applyMode: "dry_run",
      catalogId: resource.catalogId,
      confidence: 0.8,
      confidenceThreshold: 0.75,
      createTime: 100,
      creator: { id: "user-1", name: "User", type: "user" },
      finishTime: 200,
      id: "semantic-task-1",
      resourceId: resource.id,
      scope: "resource",
      status: "completed",
    }]);

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    await screen.findByText("semantic-task-1");
    const finishTime = screen.getByText("dataCatalog.task.finishedAt");
    const createTime = screen.getByText("dataCatalog.task.createTime");
    const applicationState = screen.getByText("dataCatalog.taskManagement.applied.notApplied");
    expect(finishTime.compareDocumentPosition(createTime) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(finishTime.closest("th")?.classList.contains("ant-table-column-has-sorters")).toBe(true);
    expect(createTime.closest("th")?.classList.contains("ant-table-column-has-sorters")).toBe(true);
    expect(document.querySelector('col[style*="width: 160px"]')).not.toBeNull();
    expect(document.querySelectorAll('col[style*="width: 180px"]')).toHaveLength(2);
    expect(applicationState.classList.contains(sharedStyles.tag)).toBe(true);
  });

  it("paginates the complete history and disables active task selection", async () => {
    listResourceSemanticUnderstandingTasksMock.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        agentId: "resource-semantic-understanding",
        applied: false,
        applyMode: "dry_run",
        catalogId: resource.catalogId,
        confidence: 0.8,
        confidenceThreshold: 0.75,
        createTime: 11 - index,
        creator: { id: "user-1", name: "User", type: "user" },
        id: `semantic-task-${index + 1}`,
        resourceId: resource.id,
        scope: "resource",
        status: index === 0 ? "running" : "completed",
      })),
    );

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    await screen.findByText("semantic-task-1");
    expect(screen.queryByText("semantic-task-11")).toBeNull();
    expect(screen.getByText("semantic-task-1").closest("tr")?.querySelector("input[type=checkbox]")?.hasAttribute("disabled")).toBe(true);
    const selectedOnFirstPage = screen.getByText("semantic-task-2").closest("tr")?.querySelector("input[type=checkbox]") as HTMLInputElement;
    fireEvent.click(selectedOnFirstPage);
    expect(selectedOnFirstPage.checked).toBe(true);

    fireEvent.click(screen.getByTitle("2"));

    await screen.findByText("semantic-task-11");
    expect(screen.queryByText("semantic-task-1")).toBeNull();

    fireEvent.click(screen.getByTitle("1"));

    await screen.findByText("semantic-task-2");
    expect((screen.getByText("semantic-task-2").closest("tr")?.querySelector("input[type=checkbox]") as HTMLInputElement).checked).toBe(false);
  });

  it("returns to the first page after creating a task", async () => {
    const tasks = Array.from({ length: 11 }, (_, index) => ({
      agentId: "resource-semantic-understanding",
      applied: false,
      applyMode: "dry_run" as const,
      catalogId: resource.catalogId,
      confidence: 0.8,
      confidenceThreshold: 0.75,
      createTime: 11 - index,
      creator: { id: "user-1", name: "User", type: "user" as const },
      id: `semantic-task-${index + 1}`,
      resourceId: resource.id,
      scope: "resource" as const,
      status: "completed" as const,
    }));
    listResourceSemanticUnderstandingTasksMock.mockResolvedValue(tasks);
    createResourceSemanticUnderstandingTaskMock.mockResolvedValue({ id: "new-task" });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);
    await screen.findByText("semantic-task-1");
    fireEvent.click(screen.getByTitle("2"));
    await screen.findByText("semantic-task-11");

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.create/ }));
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.start/ }));

    await screen.findByText("semantic-task-1");
    expect(screen.queryByText("semantic-task-11")).toBeNull();
  });
});
