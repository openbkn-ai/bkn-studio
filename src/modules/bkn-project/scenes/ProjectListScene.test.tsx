/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const listProjectsMock = vi.hoisted(() => vi.fn());
const createProjectMock = vi.hoisted(() => vi.fn());
const listNetworksMock = vi.hoisted(() => vi.fn());
const setArchivedMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const getStatusMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
const newProjectModalRenderMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/modules/bkn-project/services/publish.service", () => ({
  getProjectStatus: getStatusMock,
}));

vi.mock("@/shared/catalog", () => ({
  catalogListAllQuery: (overrides: object) => overrides,
  listCatalogs: listCatalogsMock,
}));

vi.mock("@/modules/bkn-project/components/NewProjectModal", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/bkn-project/components/NewProjectModal")>();
  return {
    ...original,
    NewProjectModal: (props: Parameters<typeof original.NewProjectModal>[0]) => {
      newProjectModalRenderMock(props);
      return <original.NewProjectModal {...props} />;
    },
  };
});

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

function card(name: string) {
  return screen.getByText(name).closest("article") as HTMLElement;
}

/** Opens a card's menu and returns the names of its actions. */
async function openMenu(name: string) {
  fireEvent.click(within(card(name)).getByRole("button", { name: "bknProject.list.card.more" }));
  const menus = await screen.findAllByRole("menu");
  return menus[menus.length - 1];
}

function axiosError(code: string) {
  return { isAxiosError: true, response: { data: { error_code: code, description: code } } };
}

describe("ProjectListScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "admin");
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
    getStatusMock.mockResolvedValue({ release: null, stage: "deciding" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides project creation and does not mount its modal for a mock viewer", async () => {
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    listProjectsMock.mockResolvedValue({ items: [project({})], nextCursor: null, total: 1 });
    renderScene();

    expect(await screen.findByText("Orders")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bknProject\.list\.create/ })).toBeNull();
    expect(newProjectModalRenderMock).not.toHaveBeenCalled();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: "mock admin", useMock: "true", role: "admin", dev: true },
    { name: "real-backend viewer selector", useMock: "false", role: "viewer", dev: true },
    { name: "production viewer selector", useMock: "true", role: "viewer", dev: false },
  ])("preserves project creation for $name", async ({ useMock, role, dev }) => {
    vi.stubEnv("DEV", dev);
    vi.stubEnv("VITE_USE_MOCK", useMock);
    vi.stubEnv("VITE_MOCK_USER", role);
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderScene();

    fireEvent.click(screen.getByRole("button", { name: /bknProject\.list\.create/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(newProjectModalRenderMock).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it("shows network and catalog names, the same-network tag, and archive for the owner only", async () => {
    listProjectsMock.mockResolvedValue({
      items: [
        project({ catalogIds: ["c1"], otherProjects: 1 }),
        project({
          id: "p2",
          name: "Receipts",
          owner: { id: "someone", type: "user" },
          ownerName: "张三",
        }),
      ],
      nextCursor: null,
      total: 2,
    });
    renderScene();

    await screen.findByText("Orders");
    const mine = card("Orders");
    expect(within(mine).getByText("Orders network")).toBeInTheDocument();
    expect(within(mine).getByText("ERP")).toBeInTheDocument();
    expect(within(mine).getByText('bknProject.list.sameNetwork:{"count":1}')).toBeInTheDocument();
    expect(
      await within(mine).findByText("bknProject.list.card.stages.deciding"),
    ).toBeInTheDocument();
    expect(
      within(await openMenu("Orders")).getByText("bknProject.list.archive"),
    ).toBeInTheDocument();

    const theirs = card("Receipts");
    expect(within(theirs).getByText("张三")).toBeInTheDocument();
    expect(within(theirs).queryByText("someone")).toBeNull();
    expect(within(await openMenu("Receipts")).queryByText("bknProject.list.archive")).toBeNull();
    expect(listProjectsMock).toHaveBeenCalledWith({
      archived: "false",
      cursor: undefined,
      limit: 24,
      name: "",
    });
  });

  it("opens the project's network from its name: one network keeps every version", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], nextCursor: null, total: 1 });
    renderScene();

    const link = await screen.findByRole("link", { name: "Orders network" });
    expect(link).toHaveAttribute("href", "/knowledge-network/workspace/orders/overview");
    fireEvent.click(link);
    expect(await screen.findByText("opened orders")).toBeInTheDocument();
  });

  it("searches by name and shows archived projects on request, from the first page", async () => {
    listProjectsMock.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderScene();
    await waitFor(() => expect(listProjectsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("bknProject.list.searchPlaceholder"), {
      target: { value: " ord " },
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

  it("opens a project's overview from its card", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], nextCursor: null, total: 1 });
    renderScene();

    fireEvent.click(await screen.findByText("Orders"));
    expect(await screen.findByText("opened overview")).toBeInTheDocument();
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

  it("names a catalog past the first page, and never says one is unreadable when the list failed", async () => {
    listProjectsMock.mockResolvedValue({
      items: [project({ catalogIds: ["c501"] })],
      nextCursor: null,
      total: 1,
    });
    const first = Array.from({ length: 500 }, (_, index) => ({
      id: `c${index}`,
      name: `C${index}`,
    }));
    listCatalogsMock.mockResolvedValueOnce({ items: first, total: 502 }).mockResolvedValueOnce({
      items: [
        { id: "c501", name: "MES" },
        { id: "c502", name: "WMS" },
      ],
      total: 502,
    });
    const view = renderScene();

    expect(await within(await waitFor(() => card("Orders"))).findByText("MES")).toBeInTheDocument();
    expect(listCatalogsMock).toHaveBeenCalledTimes(2);
    expect(listCatalogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 500 }),
      expect.anything(),
    );
    view.unmount();

    listCatalogsMock.mockReset().mockRejectedValue(new Error("down"));
    renderScene();
    expect(
      await screen.findByText('bknProject.list.card.catalogNamesUnavailable:{"count":1}'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unreadableCatalogs|c501/)).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: "bknProject.list.refresh" }));
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

    await screen.findByText("Orders");
    fireEvent.click(within(await openMenu("Orders")).getByText("bknProject.list.archive"));
    const { onOk } = confirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await onOk();
    expect(setArchivedMock).toHaveBeenCalledWith("p1", true);

    fireEvent.click(within(await openMenu("Old")).getByText("bknProject.list.unarchive"));
    await waitFor(() => expect(setArchivedMock).toHaveBeenLastCalledWith("p2", false));
    expect(messageMock.success).toHaveBeenCalledWith("bknProject.list.unarchiveSuccess");
  });
});
