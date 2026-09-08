/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

const { listBuildTaskPageMock } = vi.hoisted(() => ({
  listBuildTaskPageMock: vi.fn(),
}));

vi.mock("@/modules/data-catalog/services/build-task.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/data-catalog/services/build-task.service")>()),
  deleteBuildTask: vi.fn(),
  listBuildTaskPage: listBuildTaskPageMock,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Dropdown: ({ children, menu }: {
      children: ReactNode;
      menu: { items?: Array<{ key?: string | number; label?: ReactNode } | null> };
    }) => (
      <div>
        {children}
        {menu.items?.map((item) => item ? <span key={item.key}>{item.label}</span> : null)}
      </div>
    ),
  };
});

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource, rowSelection }: {
    columns: Array<{
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: BuildTask) => ReactNode;
      title?: ReactNode;
    }>;
    dataSource: BuildTask[];
    rowSelection?: { getCheckboxProps?: (task: BuildTask) => { disabled?: boolean } };
  }) => (
    <div>
      <div>{columns.map((column) => <span key={column.key ?? column.dataIndex}>{column.title}</span>)}</div>
      {dataSource.flatMap((record) => [
        <output data-testid={`selection-${record.id}`} key={`${record.id}-selection`}>
          {String(rowSelection?.getCheckboxProps?.(record).disabled ?? false)}
        </output>,
        ...columns.map((column) => (
          <div key={`${record.id}-${column.key ?? column.dataIndex}`}>
            {column.render ? column.render(column.dataIndex ? record[column.dataIndex as keyof BuildTask] : undefined, record) : null}
          </div>
        )),
      ])}
    </div>
  ),
}));

vi.mock("@/framework/ui/common/TablePaginationBar", () => ({
  TablePaginationBar: ({ current, onChange }: { current: number; onChange: (page: number, pageSize: number) => void }) => (
    <div>
      <output data-testid="task-page">{current}</output>
      <button onClick={() => onChange(3, 10)} type="button">page 3</button>
    </div>
  ),
}));
vi.mock("@/framework/ui/common/TableSurface", () => ({ TableSurface: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/modules/data-catalog/components/BuildProgress", () => ({ BuildProgress: () => null }));
vi.mock("@/modules/data-catalog/components/BuildTaskDetailDrawer", () => ({ BuildTaskDetailDrawer: () => null }));
vi.mock("@/modules/data-catalog/components/BuildTaskLaunchPanel", () => ({
  BuildTaskLaunchPanel: ({ onStarted }: { onStarted: () => void }) => (
    <button onClick={onStarted} type="button">start task</button>
  ),
}));
vi.mock("@/modules/data-catalog/components/IndexConfigFormPanel", () => ({ IndexConfigFormPanel: () => null }));
vi.mock("@/modules/data-catalog/hooks/use-build-task-actions", () => ({
  useBuildTaskActions: () => ({ pauseOrResume: vi.fn(), remove: vi.fn(), retry: vi.fn() }),
}));

import { ResourceIndexPanel } from "./ResourceIndexPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  category: "table",
  columnCount: 1,
  description: "",
  expectedUpdateTime: 0,
  id: "resource-1",
  localIndexStatus: "unavailable",
  name: "orders",
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
};

function buildTask(overrides: Partial<BuildTask>): BuildTask {
  return {
    primaryKeyFields: [],
    incrementalFields: [],
    createTime: 100,
    embeddingFields: [],
    embeddingModel: "",
    error: null,
    finishTime: null,
    fulltextAnalyzer: "",
    fulltextFields: [],
    id: "task-1",
    lastProgressTime: null,
    mode: "batch",
    modelDimensions: 0,
    resourceId: resource.id,
    startTime: null,
    status: "completed",
    syncedCount: 1,
    totalCount: 1,
    ...overrides,
  };
}

describe("ResourceIndexPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
  });

  it("does not present a batch task total as the current index document count", () => {
    const { container } = render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={{ ...resource, localIndexStatus: "available" }}
          tasks={[buildTask({ totalCount: 72000 })]}
        />
      </MemoryRouter>,
    );

    expect(container.textContent).not.toContain("dataCatalog.indexWorkspace.indexedRowsShort");
  });

  it("does not present a task as effective before the resource index is available", () => {
    const { container } = render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[buildTask({ mode: "batch", status: "running" })]}
        />
      </MemoryRouter>,
    );

    expect(container.textContent).toContain("dataCatalog.resource.noEffectiveIndex");
    expect(container.textContent).not.toContain("dataCatalog.resource.effectiveActive");
  });

  it("uses the shared colored status tag and an overflow action menu", async () => {
    const historyTasks = [
      buildTask({ id: "completed-task", status: "completed" }),
      buildTask({ id: "stopping-task", status: "stopping" }),
      buildTask({ id: "stopped-task", status: "stopped" }),
    ];
    listBuildTaskPageMock.mockResolvedValue({ items: historyTasks, total: historyTasks.length });
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={historyTasks}
        />
      </MemoryRouter>,
    );

    await screen.findByText("dataCatalog.task.statuses.completed");
    expect(screen.getByText("dataCatalog.task.statuses.completed").classList).toContain(
      styles.taskSucceeded,
    );
    expect(screen.getByText("dataCatalog.build.executeType")).toBeTruthy();
    expect(screen.getByText("dataCatalog.task.fields.lastProgressTime")).toBeTruthy();
    expect(screen.getByText("dataCatalog.task.finishedAt")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "dataConnect.moreActions" })).toHaveLength(3);
    expect(screen.getAllByText("common.delete")).toHaveLength(2);
    expect(screen.getByTestId("selection-stopping-task").textContent).toBe("true");
    expect(screen.getByTestId("selection-completed-task").textContent).toBe("false");
  });

  it("loads the selected history page from Vega with the resource filter", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 21 });
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 10,
      resourceId: resource.id,
    })));
    expect(listBuildTaskPageMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "page 3" }));
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 3,
      pageSize: 10,
      resourceId: resource.id,
    })));
  });

  it("refreshes the first history page when a task is started", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 21 });
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "page 3" }));
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
    listBuildTaskPageMock.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "start task" }));

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
    const calls = listBuildTaskPageMock.mock.calls as unknown as Array<[{ page: number }]>;
    expect(calls.every(([query]) => query.page === 1)).toBe(true);
  });

  it("keeps the newest history page when an earlier request resolves late", async () => {
    let resolveFirstPage: (result: { items: BuildTask[]; total: number }) => void;
    let resolveThirdPage: (result: { items: BuildTask[]; total: number }) => void;
    const firstPage = new Promise<{ items: BuildTask[]; total: number }>((resolve) => {
      resolveFirstPage = resolve;
    });
    const thirdPage = new Promise<{ items: BuildTask[]; total: number }>((resolve) => {
      resolveThirdPage = resolve;
    });
    listBuildTaskPageMock.mockResolvedValue({ items: [buildTask({ id: "initial-page-1-task" })], total: 21 });

    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
    await screen.findByRole("button", { name: "page 3" });
    listBuildTaskPageMock.mockClear();
    listBuildTaskPageMock.mockImplementation(({ page }: { page: number }) =>
      page === 1 ? firstPage : thirdPage,
    );
    fireEvent.click(screen.getByRole("button", { name: "reloadcommon.refresh" }));
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })));
    fireEvent.click(screen.getByRole("button", { name: "page 3" }));
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledWith(expect.objectContaining({ page: 3 })));
    resolveThirdPage!({ items: [buildTask({ id: "page-3-task" })], total: 21 });
    await screen.findByText("page-3-task");

    resolveFirstPage!({ items: [buildTask({ id: "stale-page-1-task" })], total: 21 });

    await waitFor(() => expect(screen.queryByText("stale-page-1-task")).toBeNull());
    expect(screen.getByText("page-3-task")).toBeTruthy();
  });

  it("shows a retryable error when loading task history fails", async () => {
    listBuildTaskPageMock.mockRejectedValue(new Error("history unavailable"));
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={null}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await screen.findByText("history unavailable");
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
    const callsBeforeRetry = listBuildTaskPageMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    await waitFor(() => expect(listBuildTaskPageMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });
});
