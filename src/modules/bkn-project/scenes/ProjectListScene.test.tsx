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
    listProjectsMock.mockResolvedValue({ items: [project({})], total: 1 });
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
    listProjectsMock.mockResolvedValue({ items: [], total: 0 });
    renderScene();

    fireEvent.click(screen.getByRole("button", { name: /bknProject\.list\.create/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(newProjectModalRenderMock).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it("shows the network name, the same-network tag, and archive for the owner only", async () => {
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
      total: 2,
    });
    renderScene();

    await screen.findByText("Orders");
    const mine = card("Orders");
    expect(within(mine).getByText("Orders network")).toBeInTheDocument();
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
      limit: 12,
      name: "",
      offset: 0,
    });
  });

  it("opens the project's network from its name: one network keeps every version", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], total: 1 });
    renderScene();

    const link = await screen.findByRole("link", { name: "Orders network" });
    expect(link).toHaveAttribute("href", "/knowledge-network/workspace/orders/overview");
    fireEvent.click(link);
    expect(await screen.findByText("opened orders")).toBeInTheDocument();
  });

  it("searches by name and shows archived projects on request, from the first page", async () => {
    listProjectsMock.mockResolvedValue({ items: [], total: 0 });
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
        expect.objectContaining({ archived: "all", offset: 0 }),
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
        total: 1,
      });
    renderScene();

    fireEvent.click(screen.getByText("bknProject.list.showArchived"));
    expect(await screen.findByText("Newest")).toBeInTheDocument();

    answerFirst({ items: [project({ name: "Stale" })], total: 1 });
    await waitFor(() => expect(screen.queryByText("Stale")).toBeNull());
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("opens the new project's overview after creating it", async () => {
    createProjectMock.mockResolvedValue(project({ id: "p9", name: "Created" }));
    listProjectsMock.mockResolvedValue({ items: [], total: 0 });
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
    listProjectsMock.mockResolvedValue({ items: [project({})], total: 1 });
    renderScene();

    fireEvent.click(await screen.findByText("Orders"));
    expect(await screen.findByText("opened overview")).toBeInTheDocument();
  });

  it("pages by number, 12 a page, as the knowledge network list does", async () => {
    listProjectsMock.mockImplementation(({ offset }: { offset: number }) =>
      Promise.resolve({
        items: [project({ id: `p${offset}`, name: offset ? "Second page" : "Orders" })],
        total: 30,
      }),
    );
    renderScene();

    expect(await screen.findByText('common.total:{"total":30}')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("2"));

    expect(await screen.findByText("Second page")).toBeInTheDocument();
    expect(listProjectsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 12, offset: 12 }),
    );
  });

  it("goes back to the first page on search, the archived filter and refresh", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], total: 30 });
    renderScene();
    const toSecondPage = async () => {
      fireEvent.click(await screen.findByTitle("2"));
      await waitFor(() =>
        expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 12 })),
      );
    };

    await toSecondPage();
    fireEvent.change(screen.getByPlaceholderText("bknProject.list.searchPlaceholder"), {
      target: { value: "ord" },
    });
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "ord", offset: 0 }),
      ),
    );

    await toSecondPage();
    fireEvent.click(screen.getByText("bknProject.list.showArchived"));
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ archived: "all", offset: 0 }),
      ),
    );

    await toSecondPage();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.list.refresh" }));
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 })),
    );
  });

  it("keeps the page after archiving, and moves back when the page emptied", async () => {
    listProjectsMock.mockResolvedValue({ items: [project({})], total: 13 });
    setArchivedMock.mockResolvedValue(project({}));
    renderScene();
    fireEvent.click(await screen.findByTitle("2"));
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 12 })),
    );

    // The last project of page 2 is archived: page 2 reads empty, and page 1 is read instead.
    listProjectsMock.mockImplementation(({ offset }: { offset: number }) =>
      Promise.resolve(offset ? { items: [], total: 12 } : { items: [project({})], total: 12 }),
    );
    fireEvent.click(within(await openMenu("Orders")).getByText("bknProject.list.archive"));
    const { onOk } = confirmMock.mock.calls[0][0] as { onOk: () => Promise<void> };
    await onOk();

    const offsets = listProjectsMock.mock.calls.map(([query]) => (query as { offset: number }).offset);
    expect(offsets.slice(-1)).toEqual([12]);
    await waitFor(() =>
      expect(listProjectsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 })),
    );
    expect(await screen.findByText("Orders")).toBeInTheDocument();
  });

  it("reads the catalogs once for the list and the new-project dialog", async () => {
    listProjectsMock.mockResolvedValue({ items: [], total: 0 });
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.list.create"));

    expect(await screen.findByText("bknProject.create.title")).toBeInTheDocument();
    expect(listCatalogsMock).toHaveBeenCalledTimes(1);
  });

  it("reads the catalogs again when the dialog opens after they failed", async () => {
    listProjectsMock.mockResolvedValue({ items: [], total: 0 });
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
      .mockResolvedValueOnce({ items: [project({})], total: 7 })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ items: [], total: 0 });
    renderScene();
    expect(await screen.findByText('common.total:{"total":7}')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "bknProject.list.refresh" }));
    expect(await screen.findByText("bknProject.list.loadFailed")).toBeInTheDocument();
    expect(screen.queryByText(/common\.total/)).toBeNull();

    fireEvent.click(screen.getByText("common.retry"));

    await waitFor(() => expect(listProjectsMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("bknProject.list.emptyTitle")).toBeInTheDocument();
  });

  it("archives after confirmation and restores an archived project directly", async () => {
    listProjectsMock.mockResolvedValue({
      items: [project({}), project({ archived: true, id: "p2", name: "Old" })],
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
