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
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./shared.module.css";

const { indexConfigFormPanelMock, listBuildTaskPageMock } = vi.hoisted(() => ({
  indexConfigFormPanelMock: vi.fn(),
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
  useAppServices: () => ({}),
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
  BuildTaskLaunchPanel: ({ disabled, onStarted }: { disabled?: boolean; onStarted: () => void }) => (
    <button disabled={disabled} onClick={onStarted} type="button">start task</button>
  ),
}));
vi.mock("@/modules/data-catalog/components/IndexConfigFormPanel", () => ({
  IndexConfigFormPanel: (props: { canViewTasks?: boolean; readOnly: boolean }) => {
    indexConfigFormPanelMock(props);
    return (
      <output data-testid="index-config-read-only">
        {String(props.readOnly)}
      </output>
    );
  },
}));
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
  operations: ["modify", "query_data", "view_detail"],
  rowCount: 1,
  schema: [{ name: "id", type: "string" }],
  sourceIdentifier: "orders",
  updateTime: "2026-08-11T00:00:00Z",
};

const manageableCatalog = {
  internal: false,
  operations: ["task_manage", "view_detail"],
} as CatalogRecord;

const modifiableCatalog = {
  internal: false,
  operations: ["resource_manage", "task_manage", "view_detail"],
} as CatalogRecord;

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

  it("renders index configuration read-only without catalog resource management", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
          indexView="config"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={{ ...resource, operations: ["view_detail"] }}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.build.configReadOnly").closest(".ant-alert")).toHaveClass(
      "ant-alert-warning",
    );
    expect(indexConfigFormPanelMock).toHaveBeenCalledWith(expect.objectContaining({
      hideBuildControls: true,
      readOnly: true,
    }));
  });

  it("keeps the config tab reachable but hides feature configuration without view_detail", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={modifiableCatalog}
          indexView="config"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={{ ...resource, operations: ["query_data"] }}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: "dataCatalog.indexWorkspace.viewConfig" })).toBeEnabled();
    expect(screen.getByText("dataCatalog.permissionRequired").closest(".ant-alert")).toHaveClass(
      "ant-alert-warning",
    );
    expect(indexConfigFormPanelMock).not.toHaveBeenCalled();
  });

  it("keeps index configuration editable with catalog resource management permission", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={modifiableCatalog}
          indexView="config"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dataCatalog.build.configReadOnly")).toBeNull();
    expect(indexConfigFormPanelMock).toHaveBeenCalledWith(expect.objectContaining({
      hideBuildControls: false,
      readOnly: false,
    }));
  });

  it("keeps configuration editable without task_manage while withholding task access", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={{ ...modifiableCatalog, operations: ["resource_manage", "view_detail"] }}
          indexView="config"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(indexConfigFormPanelMock).toHaveBeenCalledWith(expect.objectContaining({
      canViewTasks: false,
      readOnly: false,
    }));
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("keeps the task tab reachable without task_manage and skips task requests", () => {
    const onIndexViewChange = vi.fn();

    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={{ ...modifiableCatalog, operations: ["resource_manage", "view_detail"] }}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={onIndexViewChange}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: "dataCatalog.indexWorkspace.viewTasks" })).toBeEnabled();
    expect(screen.getByText("dataCatalog.permissionRequired").closest(".ant-alert")).toHaveClass(
      "ant-alert-warning",
    );
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
    expect(onIndexViewChange).not.toHaveBeenCalledWith("config");
  });

  it("keeps task management independent of resource view_detail", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={{ ...resource, operations: ["query_data"] }}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: "dataCatalog.indexWorkspace.viewTasks" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "start task" })).toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.permissionRequired")).toBeNull();
  });

  it("keeps the task tab disabled and redirects dataset task deep links to config", async () => {
    const onIndexViewChange = vi.fn();

    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={modifiableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={onIndexViewChange}
          onRefresh={vi.fn()}
          resource={{ ...resource, category: "dataset" }}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("tab", { name: "dataCatalog.indexWorkspace.viewTasks" })).toBeDisabled();
    await waitFor(() => expect(onIndexViewChange).toHaveBeenCalledWith("config"));
    expect(listBuildTaskPageMock).not.toHaveBeenCalled();
  });

  it("does not present a batch task total as the current index document count", () => {
    const { container } = render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
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
          catalog={manageableCatalog}
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
          catalog={manageableCatalog}
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
          catalog={manageableCatalog}
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

  it("reports the latest task from an unfiltered first history page", async () => {
    const latest = buildTask({ status: "running" });
    const onLatestTaskLoaded = vi.fn();
    listBuildTaskPageMock.mockResolvedValue({ items: [latest], total: 1 });

    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onLatestTaskLoaded={onLatestTaskLoaded}
          onRefresh={vi.fn()}
          resource={resource}
          taskStatusUnavailable
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(onLatestTaskLoaded).toHaveBeenCalledWith(resource.id, latest));
    expect(onLatestTaskLoaded).toHaveBeenCalledOnce();
  });

  it("does not replace the latest task with a later history page", async () => {
    const onLatestTaskLoaded = vi.fn();
    listBuildTaskPageMock.mockImplementation(({ page }: { page: number }) => Promise.resolve({
      items: [buildTask({ id: `page-${page}-task` })],
      total: 21,
    }));

    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onLatestTaskLoaded={onLatestTaskLoaded}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(onLatestTaskLoaded).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "page 3" }));
    await waitFor(() => expect(screen.getByTestId("task-page")).toHaveTextContent("3"));
    await screen.findByText("page-3-task");
    expect(onLatestTaskLoaded).toHaveBeenCalledOnce();
  });

  it("refreshes the first history page when a task is started", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 21 });
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={{ ...manageableCatalog, enabled: true }}
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
    const onLatestTaskLoaded = vi.fn();
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
          catalog={manageableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onLatestTaskLoaded={onLatestTaskLoaded}
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
    expect(onLatestTaskLoaded).toHaveBeenCalledOnce();
    expect(onLatestTaskLoaded).toHaveBeenCalledWith(resource.id, expect.objectContaining({
      id: "initial-page-1-task",
    }));
  });

  it("does not report a history response after the panel unmounts", async () => {
    let resolveHistory: (result: { items: BuildTask[]; total: number }) => void;
    const history = new Promise<{ items: BuildTask[]; total: number }>((resolve) => {
      resolveHistory = resolve;
    });
    const onLatestTaskLoaded = vi.fn();
    listBuildTaskPageMock.mockReturnValue(history);

    const { unmount } = render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onLatestTaskLoaded={onLatestTaskLoaded}
          onRefresh={vi.fn()}
          resource={resource}
          tasks={[]}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledOnce());
    unmount();
    resolveHistory!({ items: [buildTask({ id: "late-task" })], total: 1 });
    await history;
    expect(onLatestTaskLoaded).not.toHaveBeenCalled();
  });

  it("shows a manual refresh hint without a retry button when task history fails", async () => {
    listBuildTaskPageMock.mockRejectedValue(new Error("history unavailable"));
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={manageableCatalog}
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
    expect(screen.getByText("dataCatalog.resourceWorkspace.loadErrorRefreshHint")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.retry" })).toBeNull();
  });

  it("does not report an empty index state when the latest task status is unknown", () => {
    render(
      <MemoryRouter>
        <ResourceIndexPanel
          active
          catalog={{ ...manageableCatalog, enabled: true }}
          indexView="tasks"
          indexViewExplicit
          onIndexViewChange={vi.fn()}
          onRefresh={vi.fn()}
          resource={{ ...resource, localIndexStatus: "available" }}
          taskStatusUnavailable
          tasks={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.resourceWorkspace.indexStatusUnavailable")).toBeInTheDocument();
    expect(screen.queryByText("dataCatalog.resource.effectiveActive")).toBeNull();
    expect(screen.getByRole("button", { name: "start task" })).toBeDisabled();
  });

});
