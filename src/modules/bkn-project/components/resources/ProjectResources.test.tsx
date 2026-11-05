/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { useEffect, useState, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import {
  registerExtension,
  resetExtensionsForTesting,
  type ProjectKnowledgeBaseResourceProps,
} from "@/framework/extension/registry";
import type { Project } from "@/modules/bkn-project/types/project";
import type { UnderstandingCatalog } from "@/modules/bkn-project/types/publish";

const mocks = vi.hoisted(() => ({
  addDraftCatalogs: vi.fn(),
  getDraft: vi.fn(),
  getProject: vi.fn(),
  getUnderstanding: vi.fn(),
  kb: ((): { mode: BknProjectKbMode } => ({ mode: "hidden" }))(),
  listCatalogs: vi.fn(),
  listDocuments: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  onGoToModel: vi.fn(),
  onProjectChange: vi.fn(),
  setProjectCatalogs: vi.fn(),
  t: (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message, modal: { confirm: vi.fn() } }),
}));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => mocks.kb.mode,
}));

// The three modes as the slot draws them: left out, a mask over the preview, or the content.
vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: ({ children }: { children: ReactNode }) =>
    mocks.kb.mode === "hidden" ? null : <>{children}</>,
  BknProjectKbSlot: ({ children, preview }: { children: ReactNode; preview?: ReactNode }) =>
    mocks.kb.mode === "hidden" ? null : mocks.kb.mode === "locked" ? (
      <div data-testid="kb-locked">{preview}</div>
    ) : (
      <>{children}</>
    ),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  addDraftCatalogs: mocks.addDraftCatalogs,
  getDraft: mocks.getDraft,
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getUnderstanding: mocks.getUnderstanding,
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  listDocuments: mocks.listDocuments,
}));

vi.mock("@/modules/bkn-project/services/project.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/project.service")>()),
  getProject: mocks.getProject,
  setProjectCatalogs: mocks.setProjectCatalogs,
}));

vi.mock("@/shared/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/catalog")>()),
  listCatalogs: mocks.listCatalogs,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { useUnsavedChanges } from "@/modules/bkn-project/components/unsaved/unsaved";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { UnsavedLeaveGuard } from "@/modules/bkn-project/components/unsaved/UnsavedLeaveGuard";

import { ProjectResources } from "./ProjectResources";

const project: Project = {
  archived: false,
  baselineNetworkId: "staff",
  branch: "project/p1",
  catalogIds: ["cat-001"],
  createTime: 1,
  id: "p1",
  knId: "staff",
  name: "Ward staffing",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

const ready = () => mapDraft(mockDraft("p1"));

function conflict(code: string) {
  return new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: `${code} described`, error_code: `BknProject.Draft.${code}` },
    status: 409,
  } as AxiosResponse);
}

const understanding = (tables: [string, string][]): UnderstandingCatalog[] => [
  {
    catalogId: "cat-001",
    counts: {},
    tables: tables.map(([name, status]) => ({
      applied: true,
      finishTime: null,
      name,
      resourceId: `res-${name}`,
      status: status as UnderstandingCatalog["tables"][number]["status"],
    })),
    visible: true,
  },
];

function renderPage(override: Partial<Project> = {}, ownerIsCaller = true, entry = "/") {
  const router = createMemoryRouter(
    [
      {
        element: (
          <UnsavedLeaveGuard>
            <ProjectResources
              onGoToModel={mocks.onGoToModel}
              onProjectChange={mocks.onProjectChange}
              ownerIsCaller={ownerIsCaller}
              project={{ ...project, ...override }}
            />
          </UnsavedLeaveGuard>
        ),
        path: "*",
      },
    ],
    { initialEntries: [entry] },
  );
  return Object.assign(renderWithoutAntdStyles(<RouterProvider router={router} />), { router });
}

const tab = (name: RegExp) => screen.findByRole("tab", { name });
const DOT = "bknProject.resources.tabs.needsAttention";

/** A panel saying what waits in it, as the professional extension does. */
function registerPanel(status: { fileCount: number | null; needsAttention: boolean }) {
  const Panel = ({ onStatusChange }: ProjectKnowledgeBaseResourceProps) => {
    useEffect(() => onStatusChange?.(status), [onStatusChange]);
    const [typed, setTyped] = useState("");
    return (
      <input
        aria-label="panel input"
        onChange={(event) => setTyped(event.target.value)}
        value={typed}
      />
    );
  };
  registerExtension({
    id: "kb",
    capability: "knowledge_base",
    projectKnowledgeBaseResources: Panel,
  });
}

const openDialog = async () => within(await screen.findByRole("dialog"));
const button = (name: string) => screen.findByRole("button", { name });

// Ant Design's tables read media queries, which jsdom lacks.
const originalMatchMedia = window.matchMedia;
beforeAll(() => {
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
afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

beforeEach(() => {
  resetExtensionsForTesting();
  vi.clearAllMocks();
  mocks.kb.mode = "hidden";
  mocks.getDraft.mockResolvedValue(ready());
  mocks.getUnderstanding.mockResolvedValue(understanding([]));
  mocks.listDocuments.mockResolvedValue([]);
  mocks.listCatalogs.mockResolvedValue({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
});

describe("ProjectResources", () => {
  it("lists each table with its semantic understanding and the object types that use it", async () => {
    mocks.getUnderstanding.mockResolvedValue(
      understanding([
        ["customers", "completed"],
        ["shift_log", "running"],
      ]),
    );
    renderPage();

    const customers = (await screen.findAllByText("customers"))[0].closest("tr")!;
    expect(within(customers).getByText("bknProject.understand.status.completed")).toBeVisible();
    // The draft's object type reading the table, by its name.
    expect(within(customers).getAllByText("customers")).toHaveLength(2);
    const log = screen.getByText("shift_log").closest("tr")!;
    expect(within(log).getByText("bknProject.understand.status.running")).toBeVisible();
    expect(within(log).getByText("bknProject.resources.tables.unused")).toBeVisible();
    // The catalog by its name.
    expect(screen.getAllByText("ERP").length).toBeGreaterThan(0);
  });

  it("lets the owner replace catalogs that are gone, keeping the ones still there", async () => {
    mocks.setProjectCatalogs.mockResolvedValue({ ...project, catalogIds: ["cat-001"] });
    renderPage({ catalogIds: ["cat-001", "old-catalog"] });

    expect(
      await screen.findByText('bknProject.resources.catalogs.gone:{"count":1}'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/old-catalog/)).toBeNull();
    fireEvent.click(await button("bknProject.model.catalogs.change"));
    const dialog = await openDialog();
    expect(await dialog.findByText(/bknProject.model.catalogs.removed/)).toHaveTextContent(
      "old-catalog",
    );
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.setProjectCatalogs).toHaveBeenCalledWith("p1", ["cat-001"]));
    expect(mocks.onProjectChange).toHaveBeenCalledWith(
      expect.objectContaining({ catalogIds: ["cat-001"] }),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("bknProject.model.catalogs.saved");
  });

  it("adds catalogs the project lacks to a ready draft, and says they are being added", async () => {
    mocks.listCatalogs.mockResolvedValue({
      items: [
        { id: "cat-001", name: "ERP" },
        { id: "cat-002", name: "CRM" },
      ],
      total: 2,
    });
    const adding = ready();
    adding.items.adding = { by: { id: "me", type: "user" }, catalogIds: ["cat-002"], since: 1 };
    mocks.addDraftCatalogs.mockResolvedValue(adding);
    mocks.getProject.mockResolvedValue({ ...project, catalogIds: ["cat-001", "cat-002"] });
    renderPage();

    fireEvent.click(await button("bknProject.model.catalogs.add"));
    const dialog = await openDialog();
    fireEvent.mouseDown(dialog.getByRole("combobox"));
    // Only the catalog the project does not have is offered.
    expect(screen.queryByTitle("ERP")).toBeNull();
    fireEvent.click(await screen.findByTitle("CRM"));
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.addDraftCatalogs).toHaveBeenCalledWith("p1", ["cat-002"]));
    await waitFor(() =>
      expect(mocks.onProjectChange).toHaveBeenCalledWith(
        expect.objectContaining({ catalogIds: ["cat-001", "cat-002"] }),
      ),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("bknProject.model.catalogs.added");
    expect(
      await screen.findByText('bknProject.model.catalogs.adding:{"count":1}'),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.add" })).toBeNull();
    // The candidates they bring are confirmed on the modeling page.
    fireEvent.click(
      screen.getByRole("button", { name: "bknProject.resources.catalogs.goToModel" }),
    );
    expect(mocks.onGoToModel).toHaveBeenCalled();
  });

  it("reads the draft again when adding found it changed", async () => {
    mocks.listCatalogs.mockResolvedValue({
      items: [
        { id: "cat-001", name: "ERP" },
        { id: "cat-002", name: "CRM" },
      ],
      total: 2,
    });
    mocks.addDraftCatalogs.mockRejectedValue(conflict("Stale"));
    renderPage();

    fireEvent.click(await button("bknProject.model.catalogs.add"));
    const dialog = await openDialog();
    fireEvent.mouseDown(dialog.getByRole("combobox"));
    fireEvent.click(await screen.findByTitle("CRM"));
    const reads = mocks.getDraft.mock.calls.length;
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    expect(
      await dialog.findByText("bknProject.model.catalogs.addRefused.Stale"),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.getDraft.mock.calls.length).toBeGreaterThan(reads));
  });

  it("offers adding only on a ready draft with a catalog left to add", async () => {
    const view = renderPage();
    expect(await button("bknProject.model.catalogs.change")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.add" })).toBeNull();
    view.unmount();

    mocks.getDraft.mockResolvedValue(null);
    mocks.listCatalogs.mockResolvedValue({
      items: [
        { id: "cat-001", name: "ERP" },
        { id: "cat-002", name: "CRM" },
      ],
      total: 2,
    });
    renderPage();
    expect(await button("bknProject.model.catalogs.change")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.add" })).toBeNull();
  });

  it("offers the owner of a project without catalogs to choose them, and nobody else", async () => {
    const view = renderPage({ catalogIds: [] });
    expect(await button("bknProject.model.catalogs.choose")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.empty.noCatalogs")).toBeInTheDocument();
    view.unmount();

    renderPage({ catalogIds: [] }, false);
    expect(
      await screen.findByText("bknProject.model.empty.noCatalogsAskOwner"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.choose" })).toBeNull();
  });

  it("keeps the catalog dialog open and says why when saving fails", async () => {
    mocks.setProjectCatalogs.mockRejectedValue(
      new AxiosError("403", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "Only the owner may.", error_code: "BknProject.Project.NotOwner" },
        status: 403,
      } as AxiosResponse),
    );
    renderPage({ catalogIds: ["cat-001", "old-catalog"] });

    fireEvent.click(await button("bknProject.model.catalogs.change"));
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    expect(await dialog.findByText("Only the owner may.")).toBeInTheDocument();
    expect(mocks.onProjectChange).not.toHaveBeenCalled();
  });

  it("tells the owner the catalog list failed to load and lets them retry", async () => {
    mocks.listCatalogs
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockResolvedValue({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
    renderPage({ catalogIds: [] });

    expect(await screen.findByText("bknProject.model.catalogs.loadFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    expect(await button("bknProject.model.catalogs.choose")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.model.catalogs.loadFailed")).not.toBeInTheDocument();
  });

  it("offers no change on an archived project", async () => {
    renderPage({ archived: true });

    expect(await screen.findByText("bknProject.resources.catalogs.title")).toBeInTheDocument();
    await waitFor(() => expect(mocks.listCatalogs).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.change" })).toBeNull();
    expect(screen.queryByRole("button", { name: "bknProject.model.catalogs.add" })).toBeNull();
  });

  it("holds the requirement documents on their own tab, as an optional input", async () => {
    mocks.listDocuments.mockResolvedValue([]);
    renderPage({}, true, "/?tab=documents");

    expect(await screen.findByText("bknProject.requirements.documents.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.resources.optional")).toBeInTheDocument();
    await waitFor(() => expect(mocks.listDocuments).toHaveBeenCalledWith("p1"));
  });

  it("keeps the tab in the URL, so going back and links land on it", async () => {
    const { router } = renderPage();

    fireEvent.click(await tab(/bknProject.resources.tabs.documents/));
    await waitFor(() => expect(router.state.location.search).toBe("?tab=documents"));
    expect(await screen.findByText("bknProject.requirements.documents.title")).toBeInTheDocument();

    await router.navigate(-1);
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /catalogs.title/ })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("shows the knowledge base by edition: left out, masked, or open", async () => {
    const title = /bknProject.resources.knowledgeBases.title/;
    const view = renderPage();
    expect(await tab(/catalogs.title/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: title })).toBeNull();
    view.unmount();

    // A link to the hidden tab opens the page where it would open anyway.
    const linked = renderPage({}, true, "/?tab=knowledge-base");
    expect(await tab(/catalogs.title/)).toHaveAttribute("aria-selected", "true");
    linked.unmount();

    mocks.kb.mode = "locked";
    const locked = renderPage({}, true, "/?tab=knowledge-base");
    expect(await tab(title)).toBeInTheDocument();
    expect(await screen.findByTestId("kb-locked")).toHaveTextContent(
      "bknProject.resources.knowledgeBases.preview",
    );
    locked.unmount();

    mocks.kb.mode = "enabled";
    renderPage({}, true, "/?tab=knowledge-base");
    expect(await tab(title)).toBeInTheDocument();
    expect(screen.queryByTestId("kb-locked")).toBeNull();
  });

  it("opens on the catalogs while nothing waits, and marks no tab", async () => {
    mocks.kb.mode = "enabled";
    registerPanel({ fileCount: 12, needsAttention: false });
    renderPage();

    expect(await tab(/knowledgeBases.title.*12/)).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /catalogs.title/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("img", { name: DOT })).toBeNull();
  });

  it("opens on the knowledge base when it alone waits, and marks its tab", async () => {
    mocks.kb.mode = "enabled";
    registerPanel({ fileCount: 12, needsAttention: true });
    renderPage();

    const kb = await tab(/knowledgeBases.title/);
    await waitFor(() => expect(kb).toHaveAttribute("aria-selected", "true"));
    expect(within(kb).getByRole("img", { name: DOT })).toBeInTheDocument();
  });

  it("opens on the catalogs first when none is chosen, and marks their tab", async () => {
    mocks.kb.mode = "enabled";
    registerPanel({ fileCount: 12, needsAttention: true });
    renderPage({ catalogIds: [] });

    const catalogs = await tab(/catalogs.title/);
    expect(catalogs).toHaveAttribute("aria-selected", "true");
    expect(within(catalogs).getByRole("img", { name: DOT })).toBeInTheDocument();
  });

  it("waits for the catalog list before settling on the opening tab", async () => {
    mocks.kb.mode = "enabled";
    registerPanel({ fileCount: 12, needsAttention: true });
    let answer!: (value: unknown) => void;
    mocks.listCatalogs.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPage({ catalogIds: ["cat-001", "old-catalog"] });

    await tab(/knowledgeBases.title/);
    answer({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
    const catalogs = await tab(/catalogs.title/);
    await waitFor(() => expect(within(catalogs).getByRole("img", { name: DOT })).toBeTruthy());
    expect(catalogs).toHaveAttribute("aria-selected", "true");
  });

  it("does not call a catalog unknown before its list is read", async () => {
    mocks.listCatalogs.mockRejectedValue(new Error("down"));
    mocks.getUnderstanding.mockResolvedValue(understanding([["orders", "completed"]]));
    renderPage();

    expect(await screen.findByText("orders")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.resources.catalogs.unnamed")).toBeNull();
    expect(screen.getByText("bknProject.resources.catalogs.nameUnread")).toBeInTheDocument();
  });

  it("says catalogs it cannot name only once", async () => {
    mocks.listCatalogs.mockResolvedValue({ items: [], total: 0 });
    mocks.getUnderstanding.mockResolvedValue([
      { catalogId: "a", counts: {}, tables: [], visible: false },
      { catalogId: "b", counts: {}, tables: [], visible: false },
    ]);
    renderPage({ catalogIds: ["a", "b"] });

    expect(await screen.findAllByText(/understand.progress.invisible/)).toHaveLength(1);
  });

  it("keeps the panel's state across tabs", async () => {
    mocks.kb.mode = "enabled";
    registerPanel({ fileCount: 1, needsAttention: false });
    renderPage({}, true, "/?tab=knowledge-base");

    fireEvent.change(await screen.findByLabelText("panel input"), { target: { value: "kept" } });
    fireEvent.click(await tab(/tabs.documents/));
    fireEvent.click(await tab(/knowledgeBases.title/));
    expect(screen.getByLabelText("panel input")).toHaveValue("kept");
  });

  it("does not ask before switching tabs, and still asks before leaving the page", async () => {
    mocks.kb.mode = "enabled";
    const Editing = () => {
      useUnsavedChanges(true, () => Promise.resolve(true));
      return <p>editing</p>;
    };
    registerExtension({
      id: "kb",
      capability: "knowledge_base",
      projectKnowledgeBaseResources: Editing,
    });
    const { router } = renderPage({}, true, "/bkn-project/p1/resources?tab=knowledge-base");
    await screen.findByText("editing");

    fireEvent.click(await tab(/tabs.documents/));
    await waitFor(() => expect(router.state.location.search).toBe("?tab=documents"));
    expect(screen.queryByText("bknProject.leaveUnsaved.title")).toBeNull();

    void router.navigate("/bkn-project/p1/model");
    expect(await screen.findByText("bknProject.leaveUnsaved.title")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/bkn-project/p1/resources");
  });

  it("mounts the registered panel only when enabled and preserves archived-owner cleanup", async () => {
    const panel = vi.fn(
      ({ canEdit, canManageHolds }: { canEdit: boolean; canManageHolds: boolean }) => (
        <p>{`edit:${String(canEdit)} cleanup:${String(canManageHolds)}`}</p>
      ),
    );
    registerExtension({
      id: "kb",
      capability: "knowledge_base",
      projectKnowledgeBaseResources: panel,
    });
    mocks.kb.mode = "locked";
    const locked = renderPage({}, true, "/?tab=knowledge-base");
    expect(await screen.findByTestId("kb-locked")).toBeInTheDocument();
    expect(panel).not.toHaveBeenCalled();
    locked.unmount();
    mocks.kb.mode = "enabled";
    const archived = renderPage({ archived: true });
    expect(await screen.findByText("edit:false cleanup:true")).toBeInTheDocument();
    archived.unmount();
    renderPage({}, false);
    expect(await screen.findByText("edit:false cleanup:false")).toBeInTheDocument();
  });
});
