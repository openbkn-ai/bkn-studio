/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listBuildTaskPageMock } = vi.hoisted(() => ({ listBuildTaskPageMock: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { id?: string }) => (values?.id ? `${key}: ${values.id}` : key),
  }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));
vi.mock("@/framework/permission/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/modules/data-catalog/services/build-task.service", () => ({
  buildTaskStatusLabelKey: (status: string) => status,
  deleteBuildTask: vi.fn(),
  getBuildTask: vi.fn(),
  listBuildTaskPage: listBuildTaskPageMock,
}));
vi.mock("@/modules/data-catalog/services/mock-db", () => ({
  subscribeMockDb: () => () => {},
}));
vi.mock("@/modules/data-catalog/hooks/use-build-task-actions", () => ({
  useBuildTaskActions: () => ({ pauseOrResume: vi.fn(), remove: vi.fn(), retry: vi.fn() }),
}));

import { IndexBuildListScene } from "./IndexBuildListScene";

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const runningTask = {
  createTime: 1,
  embeddingFields: [],
  embeddingModel: "",
  error: null,
  finishTime: null,
  fulltextAnalyzer: "",
  fulltextFields: [],
  id: "running-task",
  incrementalFields: [],
  lastProgressTime: null,
  mode: "batch",
  modelDimensions: 0,
  primaryKeyFields: [],
  resourceId: "resource-1",
  startTime: 1,
  status: "running",
  syncedCount: 0,
  totalCount: 1,
};

describe("IndexBuildListScene", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
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
    }));
  });

  it("keeps task status and progress ahead of schedule metadata", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [runningTask], total: 1 });
    render(
      <MemoryRouter>
        <IndexBuildListScene />
      </MemoryRouter>,
    );
    await screen.findByText("running-task");
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent ?? "");
    const status = headers.findIndex((text) =>
      text.includes("dataCatalog.task.detailSections.status"),
    );
    const progress = headers.findIndex((text) => text.includes("dataCatalog.task.progress"));
    const source = headers.findIndex((text) =>
      text.includes("dataCatalog.buildSchedule.taskSource"),
    );
    expect(status).toBeGreaterThan(-1);
    expect(progress).toBeGreaterThan(-1);
    expect(source).toBeGreaterThan(-1);
    expect(status).toBeLessThan(source);
    expect(progress).toBeLessThan(source);
  });

  it("shows the linked schedule scope even when no tasks have been created", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter initialEntries={["/?tab=index-build&schedule_id=deleted-schedule"]}>
        <IndexBuildListScene />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("dataCatalog.buildSchedule.taskScope: deleted-schedule"),
    ).toBeVisible();
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleId: "deleted-schedule" }),
        expect.anything(),
      ),
    );
  });

  it("restores task origin filters from the URL and preserves a deleted schedule ID", async () => {
    listBuildTaskPageMock.mockResolvedValue({
      items: [
        {
          ...runningTask,
          id: "scheduled-task",
          status: "failed",
          triggerType: "scheduled",
          scheduleId: "deleted-schedule",
        },
        { ...runningTask, id: "manual-task", triggerType: "manual" },
      ],
      total: 2,
    });
    render(
      <MemoryRouter
        initialEntries={[
          "/?tab=build&trigger_type=scheduled&schedule_id=deleted-schedule&mode=batch&status=failed",
        ]}
      >
        <IndexBuildListScene />
      </MemoryRouter>,
    );

    await screen.findByText("scheduled-task");
    expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scheduleId: "deleted-schedule",
        triggerType: "scheduled",
        mode: "batch",
        statuses: ["failed"],
      }),
      { skipErrorToast: true },
    );
    const scheduledRow = screen.getByRole("row", { name: /scheduled-task/ });
    expect(
      within(scheduledRow).getByText("dataCatalog.buildSchedule.scheduled"),
    ).toBeInTheDocument();
    expect(within(scheduledRow).getByText("deleted-schedule")).toBeInTheDocument();
    expect(within(scheduledRow).getByText("dataCatalog.task.statuses.failed")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /manual-task/ })).getByText(
        "dataCatalog.buildSchedule.manual",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("columnheader", { name: /dataCatalog.build.executeType/ })).getByRole(
        "button",
        { name: "filter" },
      ),
    );
    fireEvent.click(await screen.findByText("dataCatalog.build.executeFull"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          executeType: "full",
          scheduleId: "deleted-schedule",
          triggerType: "scheduled",
          statuses: ["failed"],
        }),
        expect.anything(),
      ),
    );
  });

  it("filters source from the header, resets pagination and keeps the linked plan scope", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [runningTask], total: 25 });
    render(
      <MemoryRouter
        initialEntries={[
          "/?tab=build&trigger_type=scheduled&schedule_id=deleted-schedule&mode=batch&execute_type=full&status=running",
        ]}
      >
        <IndexBuildListScene />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByText("running-task");
    expect(
      screen.queryByRole("combobox", { name: "dataCatalog.buildSchedule.taskSource" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "dataCatalog.buildSchedule.scheduleId" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "dataCatalog.buildSchedule.clearScheduleFilter" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
    const header = screen.getByRole("columnheader", {
      name: /dataCatalog.buildSchedule.taskSource/,
    });
    fireEvent.click(within(header).getByRole("button", { name: "filter" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "dataCatalog.buildSchedule.manual" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          scheduleId: "deleted-schedule",
          triggerType: "manual",
          mode: "batch",
          executeType: "full",
          statuses: ["running"],
        }),
        expect.anything(),
      ),
    );
    const params = new URLSearchParams(screen.getByTestId("location").textContent ?? "");
    expect(params.get("schedule_id")).toBe("deleted-schedule");
    expect(params.get("trigger_type")).toBe("manual");
    expect(params.get("tab")).toBe("build");
  });

  it("selects and resets the source header filter without changing the linked plan", async () => {
    listBuildTaskPageMock.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter initialEntries={["/?schedule_id=deleted-schedule"]}>
        <IndexBuildListScene />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByText("dataCatalog.task.empty");
    const header = screen.getByRole("columnheader", {
      name: /dataCatalog.buildSchedule.taskSource/,
    });
    fireEvent.click(within(header).getByRole("button", { name: "filter" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "dataCatalog.buildSchedule.scheduled" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          triggerType: "scheduled",
          scheduleId: "deleted-schedule",
          page: 1,
        }),
        expect.anything(),
      ),
    );
    fireEvent.click(within(header).getByRole("button", { name: "filter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          triggerType: undefined,
          scheduleId: "deleted-schedule",
          page: 1,
        }),
        expect.anything(),
      ),
    );
    const params = new URLSearchParams(screen.getByTestId("location").textContent ?? "");
    expect(params.has("trigger_type")).toBe(false);
    expect(params.get("schedule_id")).toBe("deleted-schedule");
  });

  it("ignores an older failed request after a successful refresh", async () => {
    const older = deferred<{ items: []; total: number }>();
    listBuildTaskPageMock
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({ items: [], total: 0 });
    render(
      <MemoryRouter>
        <IndexBuildListScene />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /common\.refresh/ }));
    await waitFor(() => expect(listBuildTaskPageMock).toHaveBeenCalledTimes(2));
    expect(listBuildTaskPageMock).toHaveBeenLastCalledWith(expect.any(Object), {
      skipErrorToast: true,
    });
    await act(async () => {
      older.reject(new Error("outdated failure"));
      await older.promise.catch(() => {});
    });

    await waitFor(() => expect(screen.queryByText("outdated failure")).toBeNull());
    expect(screen.getByText("dataCatalog.task.empty")).toBeInTheDocument();
  });

  it("does not schedule automatic refresh for a running task", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const { IndexBuildListScene: LiveScene } = await import("./IndexBuildListScene");
    listBuildTaskPageMock.mockResolvedValue({ items: [runningTask], total: 1 });
    render(
      <MemoryRouter>
        <LiveScene />
      </MemoryRouter>,
    );

    expect(await screen.findByText("running-task")).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 10_000);
    expect(listBuildTaskPageMock).toHaveBeenCalledTimes(1);
  });
});
