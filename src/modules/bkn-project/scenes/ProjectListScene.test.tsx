/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const listProjectsMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const listNetworksMock = vi.hoisted(() => vi.fn());
const setArchivedMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const getNetworkInUseMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
// Stable like the real `t`; options are appended so counts can be asserted.
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: messageMock,
    modal: { confirm: confirmMock },
    runtimeConfig: { currentUser: { id: "me" } },
  }),
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  createProject: createProjectMock,
  listProjectNetworks: listNetworksMock,
  listProjects: listProjectsMock,
  setProjectArchived: setArchivedMock,
}));

vi.mock("@/modules/bkn-project/services/release.service", () => ({
  getNetworkInUse: getNetworkInUseMock,
}));

vi.mock("@/shared/catalog", () => ({
  catalogListAllQuery: (overrides: object) => overrides,
  listCatalogs: listCatalogsMock,
}));

import { ProjectListScene } from "./ProjectListScene";

function NetworkOpened() {
  return <div>opened {useParams().networkId}</div>;
}

function renderScene() {
  return render(
    <MemoryRouter initialEntries={["/bkn-project"]}>
      <Routes>
        <Route element={<ProjectListScene />} path="/bkn-project" />
        <Route element={<div>opened overview</div>} path="/bkn-project/:projectId/overview" />
        <Route
          element={<NetworkOpened />}
          path="/knowledge-network/workspace/:networkId/overview"
        />
      </Routes>
    </MemoryRouter>,
  );
}

function project(overrides: Partial<Project>): Project {
  return {
    archived: false,
    baselineNetworkId: "orders",
    branch: "project/p1",
    catalogIds: [],
    createTime: 1,
    id: "p1",
    knId: "orders",
    name: "Orders",
    otherProjects: 0,
    owner: { id: "me", type: "user" },
    updateTime: 1,
    ...overrides,
  };
}

function axiosError(code: string) {
  return { isAxiosError: true, response: { data: { error_code: code, description: code } } };
}

describe("ProjectListScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
    listNetworksMock.mockResolvedValue([{ id: "orders", name: "Orders network" }]);
    listCatalogsMock.mockResolvedValue({ items: [{ id: "c1", name: "ERP" }], total: 1 });
  });

  it("shows network and catalog names, the same-network tag, and archive for the owner only", async () => {
    listProjectsMock.mockResolvedValue({
      items: [
        project({ catalogIds: ["c1"], otherProjects: 1 }),
        project({ id: "p2", name: "Receipts", owner: { id: "someone", type: "user" } }),
      ],
      nextCursor: null,
      total: 2,
    });
    renderScene();

    const mine = (await screen.findByText("Orders")).closest("tr") as HTMLElement;
    expect(within(mine).getByText("Orders network")).toBeInTheDocument();
    expect(within(mine).getByText("ERP")).toBeInTheDocument();
    expect(within(mine).getByText('bknProject.list.sameNetwork:{"count":1}')).toBeInTheDocument();
    expect(within(mine).getByText("bknProject.list.archive")).toBeInTheDocument();

    const theirs = screen.getByText("Receipts").closest("tr") as HTMLElement;
    expect(within(theirs).queryByText("bknProject.list.archive")).toBeNull();
    expect(within(theirs).getByText("someone")).toBeInTheDocument();
    expect(listProjectsMock).toHaveBeenCalledWith({
      archived: "false",
      cursor: undefined,
      limit: 20,
      name: "",
    });
  });

  it("opens the network the project's consumers use from its network name", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], nextCursor: null, total: 1 });
    getNetworkInUseMock.mockResolvedValue({
      base: false,
      networkId: "orders_v1_0_0",
      version: "1.0.0",
    });
    renderScene();

    const link = await screen.findByRole("link", { name: "Orders network" });
    // Without script, the link still leads to the base network.
    expect(link).toHaveAttribute("href", "/knowledge-network/workspace/orders/overview");
    fireEvent.click(link);
    expect(await screen.findByText("opened orders_v1_0_0")).toBeInTheDocument();
    expect(getNetworkInUseMock).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("searches by name and shows archived projects on request, from the first page", async () => {
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderScene();
    await waitFor(() => expect(listProjectsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("bknProject.list.searchPlaceholder"), {
      target: { value: " ord " },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("bknProject.list.searchPlaceholder"), {
      key: "Enter",
      keyCode: 13,
    });
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ name: "ord" })),
    );

    fireEvent.click(screen.getByText("bknProject.list.showArchived"));
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ archived: "all", cursor: undefined }),
      ),
    );
    expect(await screen.findByText("bknProject.list.emptyFiltered")).toBeInTheDocument();
  });

  it("keeps the newest result when an older request answers last", async () => {
    let answerFirst: (value: unknown) => void = () => undefined;
    listProjectsMock
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({
        items: [project({ id: "p2", name: "Newest" })],
        nextCursor: null,
        total: 1,
      });
    renderScene();

    fireEvent.click(screen.getByText("bknProject.list.showArchived"));
    expect(await screen.findByText("Newest")).toBeInTheDocument();

    answerFirst({ items: [project({ name: "Stale" })], nextCursor: null, total: 1 });
    await waitFor(() => expect(screen.queryByText("Stale")).toBeNull());
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("opens the new project's overview after creating it", async () => {
    createProjectMock.mockResolvedValue(project({ id: "p9", name: "Created" }));
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.create"));
    fireEvent.click(await screen.findByText("bknProject.create.newNetwork"));
    fireEvent.change(screen.getByPlaceholderText("bknProject.create.namePlaceholder"), {
      target: { value: "Created" },
    });
    fireEvent.change(screen.getByPlaceholderText("bknProject.create.newNetworkNamePlaceholder"), {
      target: { value: "Net" },
    });
    fireEvent.click(screen.getByText("bknProject.create.submit"));

    expect(await screen.findByText("opened overview")).toBeInTheDocument();
  });

  it("links each project name to its overview", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], nextCursor: null, total: 1 });
    renderScene();

    expect((await screen.findByText("Orders")).closest("a")).toHaveAttribute(
      "href",
      "/bkn-project/p1/overview",
    );
  });

  it("pages with the cursor the backend returns, and back", async () => {
    listProjectsMock
      .mockResolvedValueOnce({ items: [project({})], nextCursor: "c2", total: 21 })
      .mockResolvedValueOnce({
        items: [project({ id: "p9", name: "Last" })],
        nextCursor: null,
        total: 21,
      })
      .mockResolvedValueOnce({ items: [project({})], nextCursor: "c2", total: 21 });
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.nextPage"));
    expect(await screen.findByText("Last")).toBeInTheDocument();
    expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "c2" }));

    fireEvent.click(screen.getByText("bknProject.list.prevPage"));
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: undefined }),
      ),
    );
  });

  it("goes back to the first page when the cursor is refused", async () => {
    listProjectsMock
      .mockResolvedValueOnce({ items: [project({})], nextCursor: "stale", total: 21 })
      .mockRejectedValueOnce(axiosError("BknProject.InvalidParameter.Cursor"))
      .mockResolvedValueOnce({ items: [project({})], nextCursor: "c2", total: 21 });
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.nextPage"));

    await waitFor(() => expect(listProjectsMock).toHaveBeenCalledTimes(3));
    expect(listProjectsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: undefined }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads the catalogs once for the list and the new-project dialog", async () => {
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.create"));

    expect(await screen.findByText("bknProject.create.title")).toBeInTheDocument();
    expect(listCatalogsMock).toHaveBeenCalledTimes(1);
  });

  it("reads the catalogs again when the dialog opens after they failed", async () => {
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    listCatalogsMock
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ items: [{ id: "c1", name: "ERP" }], total: 1 });
    renderScene();
    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("bknProject.list.create"));

    await waitFor(() => expect(listCatalogsMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("bknProject.create.catalogsLoadFailed")).toBeNull(),
    );
  });

  it("shows a load failure with a retry, and no stale total", async () => {
    listProjectsMock
      .mockResolvedValueOnce({ items: [project({})], nextCursor: null, total: 7 })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ items: [], nextCursor: null, total: 0 });
    renderScene();
    expect(await screen.findByText('bknProject.list.total:{"count":7}')).toBeInTheDocument();

    fireEvent.click(screen.getByText("bknProject.list.refresh"));
    expect(await screen.findByText("bknProject.list.loadFailed")).toBeInTheDocument();
    expect(screen.getByText('bknProject.list.total:{"count":0}')).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.retry"));

    await waitFor(() => expect(listProjectsMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("bknProject.list.emptyTitle")).toBeInTheDocument();
  });

  it("archives after confirmation and restores an archived project directly", async () => {
    listProjectsMock.mockResolvedValue({
      items: [project({}), project({ archived: true, id: "p2", name: "Old" })],
      nextCursor: null,
      total: 2,
    });
    setArchivedMock.mockResolvedValue(project({}));
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.archive"));
    const { onOk } = confirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await onOk();
    expect(setArchivedMock).toHaveBeenCalledWith("p1", true);

    fireEvent.click(screen.getByText("bknProject.list.unarchive"));
    await waitFor(() => expect(setArchivedMock).toHaveBeenLastCalledWith("p2", false));
    expect(messageMock.success).toHaveBeenCalledWith("bknProject.list.unarchiveSuccess");
  });
});
