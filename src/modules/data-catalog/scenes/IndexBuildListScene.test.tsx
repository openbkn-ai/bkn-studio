/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listBuildTaskPageMock } = vi.hoisted(() => ({ listBuildTaskPageMock: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
