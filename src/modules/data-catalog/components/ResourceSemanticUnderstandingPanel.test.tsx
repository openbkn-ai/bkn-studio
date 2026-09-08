/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FormInstance } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sharedStyles from "@/modules/data-catalog/components/shared.module.css";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

const {
  createResourceSemanticUnderstandingTaskMock,
  listSemanticUnderstandingTasksMock,
} = vi.hoisted(() => ({
  createResourceSemanticUnderstandingTaskMock: vi.fn(),
  listSemanticUnderstandingTasksMock: vi.fn(),
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
  listSemanticUnderstandingTasks: listSemanticUnderstandingTasksMock,
}));

import { ResourceSemanticUnderstandingPanel } from "./ResourceSemanticUnderstandingPanel";
import { semanticUnderstandingTaskFormDefaults, useSemanticUnderstandingTaskFormDefaults } from "./semantic-understanding-task-form";

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

function SemanticUnderstandingTaskFormDefaultsHarness({ form, open }: {
  form: Pick<FormInstance, "setFieldsValue">;
  open: boolean;
}) {
  useSemanticUnderstandingTaskFormDefaults(form, open);
  return null;
}

describe("ResourceSemanticUnderstandingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSemanticUnderstandingTasksMock.mockResolvedValue({ items: [], total: 0 });
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

  it("resets sample rows to ten each time the creation dialog opens", () => {
    const form = { setFieldsValue: vi.fn() } as unknown as Pick<FormInstance, "setFieldsValue">;
    const { rerender } = render(<SemanticUnderstandingTaskFormDefaultsHarness form={form} open={false} />);

    rerender(<SemanticUnderstandingTaskFormDefaultsHarness form={form} open />);
    expect(form.setFieldsValue).toHaveBeenCalledWith(semanticUnderstandingTaskFormDefaults);

    vi.mocked(form.setFieldsValue).mockClear();
    rerender(<SemanticUnderstandingTaskFormDefaultsHarness form={form} open={false} />);
    rerender(<SemanticUnderstandingTaskFormDefaultsHarness form={form} open />);
    expect(form.setFieldsValue).toHaveBeenCalledWith(semanticUnderstandingTaskFormDefaults);
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

  it("lets users choose up to twenty sample rows", async () => {
    createResourceSemanticUnderstandingTaskMock.mockResolvedValue({ id: "task-1" });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.create/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "dataCatalog.semanticWorkspace.includeSamples" }));

    const sampleRowsInput = (await screen.findAllByRole("spinbutton")).at(-1);
    expect(sampleRowsInput?.getAttribute("value")).toBe("10");
    fireEvent.change(sampleRowsInput!, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.start/ }));

    await waitFor(() => expect(createResourceSemanticUnderstandingTaskMock).toHaveBeenCalledWith({
      applyMode: "fill_empty",
      confidenceThreshold: 0.75,
      includeSampleRows: true,
      resourceId: "resource-1",
      sampleMaxRows: 20,
    }));
  });

  it("keeps table header filters available when no task matches", async () => {
    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    await waitFor(() => expect(listSemanticUnderstandingTasksMock).toHaveBeenCalled());
    const calls = listSemanticUnderstandingTasksMock.mock.calls as unknown as Array<
      [unknown, { limit: number; offset: number }]
    >;
    expect(calls.filter(([, window]) => window.limit === 10)).toHaveLength(1);
    expect(screen.getByText("dataCatalog.taskManagement.columns.applyMode").closest("th")).not.toBeNull();
    expect(document.querySelectorAll(".ant-table-filter-trigger").length).toBeGreaterThan(0);
  });

  it("shows finish time before create time", async () => {
    listSemanticUnderstandingTasksMock.mockResolvedValue({ items: [{
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
    }], total: 1 });

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
    const tasks = Array.from({ length: 11 }, (_, index) => ({
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
      }));
    listSemanticUnderstandingTasksMock.mockImplementation((_filters: unknown, window: { limit: number; offset: number }) => Promise.resolve({
      items: tasks.slice(window.offset, window.offset + window.limit), total: tasks.length,
    }));

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

  it("loads the summary independently from the paginated task history", async () => {
    listSemanticUnderstandingTasksMock.mockImplementation((filters: { applied?: boolean }) => {
      if (filters.applied) {
        return Promise.resolve({
          items: [{
            agentId: "resource-semantic-understanding",
            applied: true,
            applyMode: "fill_empty",
            catalogId: resource.catalogId,
            confidence: 0.8,
            confidenceThreshold: 0.75,
            createTime: 1,
            creator: { id: "user-1", name: "User", type: "user" },
            id: "applied-task",
            resourceId: resource.id,
            scope: "resource",
            status: "completed",
          }],
          total: 1,
        });
      }
      return Promise.resolve({ items: [], total: 20 });
    });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);

    await waitFor(() => expect(listSemanticUnderstandingTasksMock).toHaveBeenCalledWith(
      expect.objectContaining({ applied: true, resourceId: resource.id, statuses: ["completed"] }),
      { limit: 1, offset: 0 },
    ));
    expect(screen.getByText("dataCatalog.semanticWorkspace.applied")).toBeTruthy();
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
    listSemanticUnderstandingTasksMock.mockImplementation((_filters: unknown, window: { limit: number; offset: number }) => Promise.resolve({
      items: tasks.slice(window.offset, window.offset + window.limit), total: tasks.length,
    }));
    createResourceSemanticUnderstandingTaskMock.mockResolvedValue({ id: "new-task" });

    render(<ResourceSemanticUnderstandingPanel active resource={resource} />);
    await screen.findByText("semantic-task-1");
    fireEvent.click(screen.getByTitle("2"));
    await screen.findByText("semantic-task-11");

    listSemanticUnderstandingTasksMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.create/ }));
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.semanticWorkspace\.start/ }));

    await screen.findByText("semantic-task-1");
    expect(screen.queryByText("semantic-task-11")).toBeNull();
    const calls = listSemanticUnderstandingTasksMock.mock.calls as unknown as Array<
      [unknown, { limit: number; offset: number }]
    >;
    expect(calls.every(([, window]) => window.offset === 0)).toBe(true);
  });
});
