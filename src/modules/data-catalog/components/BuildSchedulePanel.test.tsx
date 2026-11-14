/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BuildSchedule,
  BuildScheduleInput,
} from "@/modules/data-catalog/types/build-schedule";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggle: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    modal: { confirm: mocks.confirm },
    runtimeConfig: { currentUser: { permissions: ["catalog:task_manage"] } },
  }),
}));
vi.mock("@/modules/data-catalog/services/build-schedule.service", () => ({
  listBuildSchedulePage: mocks.list,
  getBuildSchedule: mocks.get,
  createBuildSchedule: mocks.create,
  updateBuildSchedule: mocks.update,
  setBuildScheduleEnabled: mocks.toggle,
  deleteBuildSchedule: mocks.remove,
}));
vi.mock("@/modules/data-catalog/components/BuildScheduleFormModal", () => ({
  BuildScheduleFormModal: ({
    open,
    initialValue,
    resource,
    onSubmit,
    error,
  }: {
    open: boolean;
    initialValue?: BuildSchedule;
    resource: CatalogResource;
    error?: string;
    onSubmit: (input: BuildScheduleInput) => Promise<void>;
  }) =>
    open ? (
      <div data-testid="schedule-form">
        {error ? <span>{error}</span> : null}
        <button
          type="button"
          onClick={() =>
            void onSubmit({
              name: "saved",
              resourceId: initialValue?.resourceId ?? resource.id,
              cronExpr: "0 2 * * *",
              executeType: "full",
              enabled: initialValue?.enabled ?? false,
            })
          }
        >
          save schedule
        </button>
      </div>
    ) : null,
}));

import { BuildSchedulePanel } from "./BuildSchedulePanel";

const resource = {
  id: "resource-1",
  catalogId: "catalog-1",
  name: "orders",
  category: "table",
} as CatalogResource;
const catalog = {
  id: "catalog-1",
  name: "warehouse",
  builtin: false,
  operations: ["task_manage"],
} as CatalogRecord;
const schedule: BuildSchedule = {
  id: "schedule-1",
  name: "nightly",
  resourceId: resource.id,
  catalogId: catalog.id,
  cronExpr: "0 2 * * *",
  executeType: "full",
  enabled: false,
  startTime: 0,
  endTime: 0,
  lastRun: 1000,
  nextRun: 0,
  lastStatus: "failed",
  lastMessage: "Cannot create task: permission denied.",
  updateTime: 10,
};
function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function renderPanel(owner = catalog) {
  return render(
    <MemoryRouter>
      <BuildSchedulePanel resource={resource} catalog={owner} />
      <Location />
    </MemoryRouter>,
  );
}

describe("BuildSchedulePanel", () => {
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
    mocks.list.mockResolvedValue({ items: [schedule], total: 1 });
    mocks.get.mockResolvedValue({ ...schedule, updateTime: 20 });
    mocks.create.mockResolvedValue("new-schedule");
    mocks.update.mockResolvedValue(undefined);
    mocks.toggle.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
  });

  it("opens row actions from a more menu instead of inline buttons", async () => {
    renderPanel();
    await screen.findByText("nightly");
    expect(screen.queryByRole("button", { name: "common.edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "dataCatalog.buildSchedule.tasks" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "common.detail",
      "common.edit",
      "dataCatalog.buildSchedule.tasks",
      "common.delete",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "common.detail" }));
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(schedule.id, { skipErrorToast: true }),
    );
    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  it("loads only the bound resource and shows a failure before any task exists", async () => {
    renderPanel();
    expect(await screen.findByText(schedule.lastMessage)).toBeVisible();
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ resourceId: resource.id }), {
      skipErrorToast: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "dataCatalog.buildSchedule.tasks" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "tab=index-build&schedule_id=schedule-1",
    );
  });

  it("creates another disabled schedule for the resource without replacing the existing one", async () => {
    renderPanel();
    await screen.findByText("nightly");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog\.buildSchedule\.create/ }));
    fireEvent.click(screen.getByRole("button", { name: "save schedule" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: resource.id, enabled: false }),
        { skipErrorToast: true },
      ),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("schedule-form")).not.toBeInTheDocument());
  });

  it("edits against the latest version and keeps a conflict visible without overwriting", async () => {
    mocks.update.mockRejectedValue(new Error("Schedule changed; reload it."));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "common.edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "save schedule" }));
    expect(await screen.findByText("Schedule changed; reload it.")).toBeVisible();
    expect(mocks.update).toHaveBeenCalledWith(
      schedule.id,
      expect.objectContaining({ enabled: false, resourceId: resource.id }),
      20,
      { skipErrorToast: true },
    );
    expect(screen.getByTestId("schedule-form")).toBeVisible();
  });

  it("changes enabled state only through the enable action and preserves the last result", async () => {
    renderPanel();
    await screen.findByText("nightly");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(mocks.toggle).toHaveBeenCalledWith(schedule.id, true, { skipErrorToast: true }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByText(schedule.lastMessage)).toBeVisible();
  });

  it("keeps unauthorized rows read-only", async () => {
    renderPanel({ ...catalog, operations: ["view_detail"] });
    await screen.findByText("nightly");
    expect(
      screen.queryByRole("button", { name: /dataCatalog\.buildSchedule\.create/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.actions.more" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "common.detail",
      "dataCatalog.buildSchedule.tasks",
    ]);
    expect(screen.queryByRole("menuitem", { name: "common.edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "common.delete" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("confirms schedule deletion without requesting task deletion", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "common.delete" }));
    const confirmation = mocks.confirm.mock.calls[0][0] as {
      content: string;
      onOk: () => Promise<void>;
    };
    expect(confirmation.content).toBe("dataCatalog.buildSchedule.deleteHint");
    await act(() => confirmation.onOk());
    expect(mocks.remove).toHaveBeenCalledWith(schedule.id, { skipErrorToast: true });
  });

  it("ignores an old list response after switching resources", async () => {
    let resolveOld!: (result: { items: BuildSchedule[]; total: number }) => void;
    const oldResponse = new Promise<{ items: BuildSchedule[]; total: number }>((resolve) => {
      resolveOld = resolve;
    });
    mocks.list.mockReturnValueOnce(oldResponse);
    const { rerender } = renderPanel();
    const nextResource = { ...resource, id: "resource-2" };
    mocks.list.mockResolvedValue({
      items: [
        { ...schedule, id: "schedule-2", name: "new resource plan", resourceId: nextResource.id },
      ],
      total: 1,
    });
    rerender(
      <MemoryRouter>
        <BuildSchedulePanel resource={nextResource} catalog={catalog} />
        <Location />
      </MemoryRouter>,
    );
    await screen.findByText("new resource plan");
    await act(async () => {
      resolveOld({ items: [schedule], total: 1 });
      await oldResponse;
    });
    expect(screen.queryByText("nightly")).not.toBeInTheDocument();
    expect(screen.getByText("new resource plan")).toBeVisible();
  });

  it("does not open an old edit form in another resource", async () => {
    let resolveOld!: (result: BuildSchedule) => void;
    const oldResponse = new Promise<BuildSchedule>((resolve) => {
      resolveOld = resolve;
    });
    mocks.get.mockReturnValueOnce(oldResponse);
    const { rerender } = renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "common.edit" }));
    rerender(
      <MemoryRouter>
        <BuildSchedulePanel resource={{ ...resource, id: "resource-2" }} catalog={catalog} />
      </MemoryRouter>,
    );
    await act(async () => {
      resolveOld(schedule);
      await oldResponse;
    });
    expect(screen.queryByTestId("schedule-form")).not.toBeInTheDocument();
  });

  it("invalidates an open deletion confirmation when the resource changes", async () => {
    const { rerender } = renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "dataCatalog.actions.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "common.delete" }));
    const confirmation = mocks.confirm.mock.calls[0][0] as { onOk: () => Promise<void> };
    mocks.list.mockReturnValueOnce(new Promise(() => {}));
    rerender(
      <MemoryRouter>
        <BuildSchedulePanel resource={{ ...resource, id: "resource-2" }} catalog={catalog} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("nightly")).not.toBeInTheDocument();
    await act(() => confirmation.onOk());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps the current resource scope even when the URL names another resource", async () => {
    render(
      <MemoryRouter initialEntries={["/?resource_id=resource-2"]}>
        <BuildSchedulePanel resource={resource} catalog={catalog} />
      </MemoryRouter>,
    );
    await screen.findByText("nightly");
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ resourceId: resource.id }), {
      skipErrorToast: true,
    });
    expect(
      screen.queryByRole("searchbox", { name: "dataCatalog.taskManagement.columns.resource" }),
    ).not.toBeInTheDocument();
  });

  it("does not fetch schedules when its tab is inactive", () => {
    render(
      <MemoryRouter>
        <BuildSchedulePanel active={false} resource={resource} catalog={catalog} />
      </MemoryRouter>,
    );
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
