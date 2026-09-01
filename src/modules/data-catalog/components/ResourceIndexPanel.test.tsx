/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import styles from "./shared.module.css";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ i18n: { language: "zh-CN" }, t: (key: string) => key }),
}));

vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));

vi.mock("@/framework/ui/common/AppTable", () => ({
  AppTable: ({ columns, dataSource }: {
    columns: Array<{
      dataIndex?: string;
      key?: string;
      render?: (value: unknown, record: BuildTask) => ReactNode;
      title?: ReactNode;
    }>;
    dataSource: BuildTask[];
  }) => (
    <div>
      <div>{columns.map((column) => <span key={column.key ?? column.dataIndex}>{column.title}</span>)}</div>
      {dataSource.flatMap((record) =>
        columns.map((column) => (
          <div key={`${record.id}-${column.key ?? column.dataIndex}`}>
            {column.render ? column.render(column.dataIndex ? record[column.dataIndex as keyof BuildTask] : undefined, record) : null}
          </div>
        )),
      )}
    </div>
  ),
}));

vi.mock("@/framework/ui/common/TablePaginationBar", () => ({ TablePaginationBar: () => null }));
vi.mock("@/framework/ui/common/TableSurface", () => ({ TableSurface: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/modules/data-catalog/components/BuildProgress", () => ({ BuildProgress: () => null }));
vi.mock("@/modules/data-catalog/components/BuildTaskDetailDrawer", () => ({ BuildTaskDetailDrawer: () => null }));
vi.mock("@/modules/data-catalog/components/BuildTaskLaunchPanel", () => ({ BuildTaskLaunchPanel: () => null }));
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
    buildKeyFields: [],
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
  it("uses the shared colored status tag and an overflow action menu", () => {
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
          tasks={[
            buildTask({ id: "completed-task", status: "completed" }),
            buildTask({ id: "stopping-task", status: "stopping" }),
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.task.statuses.completed").classList).toContain(
      styles.taskSucceeded,
    );
    expect(screen.getByText("dataCatalog.build.executeType")).toBeTruthy();
    expect(screen.getByText("dataCatalog.task.fields.lastProgressTime")).toBeTruthy();
    expect(screen.getByText("dataCatalog.task.finishedAt")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "dataConnect.moreActions" })).toHaveLength(2);
  });
});
