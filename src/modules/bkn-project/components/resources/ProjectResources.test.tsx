/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import type { ReactNode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { registerExtension, resetExtensionsForTesting } from "@/framework/extension/registry";
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
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

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

function renderPage(override: Partial<Project> = {}, ownerIsCaller = true) {
  return renderWithoutAntdStyles(
    <ProjectResources
      onGoToModel={mocks.onGoToModel}
      onProjectChange={mocks.onProjectChange}
      ownerIsCaller={ownerIsCaller}
      project={{ ...project, ...override }}
    />,
  );
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
      await screen.findByText('bknProject.resources.catalogs.gone:{"name":"old-catalog"}'),
    ).toBeInTheDocument();
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

  it("holds the requirement documents, as an optional input", async () => {
    mocks.listDocuments.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("bknProject.requirements.documents.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.resources.optional")).toBeInTheDocument();
    await waitFor(() => expect(mocks.listDocuments).toHaveBeenCalledWith("p1"));
  });

  it("shows the knowledge-base catalogs by edition: left out, masked, or open", async () => {
    const title = "bknProject.resources.knowledgeBases.title";
    const view = renderPage();
    expect(await screen.findByText("bknProject.resources.catalogs.title")).toBeInTheDocument();
    expect(screen.queryByText(title)).toBeNull();
    view.unmount();

    mocks.kb.mode = "locked";
    const locked = renderPage();
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByTestId("kb-locked")).toHaveTextContent(
      "bknProject.resources.knowledgeBases.preview",
    );
    locked.unmount();

    mocks.kb.mode = "enabled";
    renderPage();
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByTestId("kb-locked")).toBeNull();
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
    const locked = renderPage();
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
