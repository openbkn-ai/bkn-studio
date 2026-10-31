/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";

const getDraftMock = vi.hoisted(() => vi.fn());
const getProjectStatusMock = vi.hoisted(() => vi.fn());
const generateDraftMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const editDraftItemMock = vi.hoisted(() => vi.fn());
const chooseIdentityMock = vi.hoisted(() => vi.fn());
const restoreFieldMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const setProjectCatalogsMock = vi.hoisted(() => vi.fn());
const onProjectChange = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn<(config: { onOk: () => Promise<void> }) => void>());
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

// Names of other people need user administration; here nobody else can be named.
vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => new Map<string, string>(),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  chooseIdentity: chooseIdentityMock,
  editDraftItem: editDraftItemMock,
  restoreField: restoreFieldMock,
  generateDraft: generateDraftMock,
  getDraft: getDraftMock,
}));

// Semantic understanding and confirming have their own tests; here understanding never ran.
vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getUnderstanding: () => Promise.resolve([]),
  getProjectStatus: getProjectStatusMock,
  // What waits, with the question that needs it; the draft itself is read on its own.
  getProjectPending: () =>
    Promise.resolve({
      draftUpdateTime: 0,
      items: [
        {
          blocking: true,
          itemId: "material_bom",
          kind: "object_types",
          name: "material_bom",
          neededBy: [{ id: "q3", text: "Which products use part P-100?" }],
          reason: "needs_identity",
        },
      ],
    }),
}));

vi.mock("@/modules/bkn-project/services/project.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/project.service")>()),
  setProjectCatalogs: setProjectCatalogsMock,
}));

// G6 cannot draw in jsdom; the concept model's graph keeps its toolbar and draws nothing.
vi.mock("@/modules/knowledge-network/components/preview/OntologyG6Canvas", () => ({
  OntologyG6Canvas: () => <div data-testid="ontology-graph-canvas" />,
}));

vi.mock("@/shared/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/catalog")>()),
  listCatalogs: listCatalogsMock,
}));

import { DRAFT_POLL_MS, mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectModel } from "./ProjectModel";

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  catalogIds: ["cat-001"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
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

/** The draft after an edit: bkn-project replies it with a new update time. */
function edited(change: (draft: ReturnType<typeof ready>) => void) {
  const draft = ready();
  change(draft);
  draft.updateTime += 1;
  return draft;
}

/** The open dialog: queries inside it skip the page behind it. */
async function openDialog() {
  return within(await screen.findByRole("dialog"));
}

function projectStatus(nextActions: ProjectStatus["nextActions"]): ProjectStatus {
  return {
    blockers: [],
    check: null,
    confirmation: null,
    dataSources: null,
    hints: [],
    draft: null,
    nextActions,
    release: null,
    stage: "ready_to_confirm",
    stale: [],
    undecided: 0,
    unresolvedConflicts: 0,
  };
}

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderModel(
  override: Partial<Project> = {},
  ownerIsCaller = true,
  initialTab: string | null = null,
) {
  // Without Ant Design's injected styles, as a query by role matches each element against them
  // and would take seconds per query on this page.
  return renderWithoutAntdStyles(
    <MemoryRouter>
      <ProjectModel
        initialTab={initialTab}
        onConfirmed={vi.fn()}
        onProjectChange={onProjectChange}
        ownerIsCaller={ownerIsCaller}
        project={{ ...project, ...override }}
      />
      <Location />
    </MemoryRouter>,
  );
}

describe("ProjectModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's table reads breakpoints, which jsdom lacks.
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
    listCatalogsMock.mockResolvedValue({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
    // Confirming has its own tests; here it is offered only where a test says so.
    getProjectStatusMock.mockResolvedValue(projectStatus([]));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("offers to draft before the first draft, unless the project has no catalogs", async () => {
    getDraftMock.mockResolvedValue(null);
    const view = renderModel();

    expect(await screen.findByText("bknProject.model.empty.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.empty.description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.model.generate" })).toBeEnabled();
    // Semantic understanding names the tables drafting reads, so it is offered first.
    expect(
      await screen.findByText("bknProject.understand.progress.notStarted"),
    ).toBeInTheDocument();
    view.unmount();

    // Without catalogs there is nothing to draft from: the owner is offered to choose them.
    renderModel({ catalogIds: [] });
    expect(await screen.findByText("bknProject.model.empty.noCatalogs")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.generate" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("bknProject.understand.progress.notStarted")).toBeNull();
  });

  it("offers to confirm a ready draft, but not on an archived project", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1")));
    getProjectStatusMock.mockResolvedValue(
      projectStatus([
        { accepts: [], action: "confirm_draft", allowed: true, discardsDecisions: 0 },
      ]),
    );
    const view = renderModel();
    // A role query walks the whole modeling page: under load it takes longer than the default.
    expect(
      await screen.findByRole("button", { name: "bknProject.confirm.button" }, { timeout: 5000 }),
    ).toBeEnabled();
    view.unmount();

    renderModel({ archived: true });
    expect(await screen.findByText("bknProject.model.status.ready")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.confirm.button" })).toBeNull();
  });

  it("drafts and shows bkn-project's localized refusal when drafting cannot start", async () => {
    getDraftMock.mockResolvedValue(null);
    generateDraftMock.mockRejectedValue(
      new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
        data: {
          description: "Data Catalog Not Found.",
          error_code: "BknProject.Draft.CatalogMissing",
        },
        status: 409,
      } as AxiosResponse),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.generate" }));

    expect(await screen.findByText("bknProject.model.generateFailed")).toBeInTheDocument();
    expect(screen.getByText(/Data Catalog Not Found/)).toBeInTheDocument();
    expect(generateDraftMock).toHaveBeenCalledWith("p1");
  });

  it("reads a drafting draft again until it is done, and stops when the page goes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getDraftMock
      .mockResolvedValueOnce({ ...ready(), status: "drafting" })
      .mockResolvedValueOnce(ready());
    const view = renderModel();

    expect(await screen.findByText("bknProject.model.drafting.title")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/bknProject.model.summary/)).toBeInTheDocument();

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS * 3);
    });
    expect(getDraftMock).toHaveBeenCalledTimes(2);
  });

  it("keeps reading a drafting draft after a failed read, and says the read failed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getDraftMock
      .mockResolvedValueOnce({ ...ready(), status: "drafting" })
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockResolvedValueOnce(ready());
    renderModel();

    expect(await screen.findByText("bknProject.model.drafting.title")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    expect(await screen.findByText("bknProject.model.loadFailed")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    expect(await screen.findByText(/bknProject.model.summary/)).toBeInTheDocument();
    expect(getDraftMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("bknProject.model.loadFailed")).not.toBeInTheDocument();
  });

  it("explains a failed draft; only a data source's reply goes to the details", async () => {
    getDraftMock.mockResolvedValue({ ...ready(), error: "timeout", status: "failed" });
    const view = renderModel();
    expect(await screen.findByText("bknProject.model.failed.timeout")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.model.failed.details")).not.toBeInTheDocument();
    view.unmount();

    getDraftMock.mockResolvedValue({
      ...ready(),
      error: "vega-backend returned HTTP 500",
      status: "failed",
    });
    renderModel();
    expect(await screen.findByText("bknProject.model.failed.source")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.failed.details")).toBeInTheDocument();
  });

  it("marks a key that is not unique, translates a failed count, and counts what waits", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    expect(
      await screen.findByText(/bknProject.model.evidence.warning.notUnique/),
    ).toHaveTextContent('{"distinct":911,"rows":1972}');
    // What counting found is the identity's tooltip, not part of the cell.
    expect(screen.queryByText(/bknProject.model.evidence.countReason.query_failed/)).toBeNull();
    document
      .querySelectorAll('[class*="identityName"]')
      .forEach((element) => fireEvent.mouseEnter(element));
    expect(
      await screen.findByText(/bknProject.model.evidence.countReason.query_failed/),
    ).toBeInTheDocument();
    // A data source's raw reply means nothing to people here; the page only says counting did not finish.
    expect(screen.queryByText(/Public.Forbidden/)).not.toBeInTheDocument();
    // material_bom waits for its identity, and its adopted relation waits to be unadopted.
    expect(screen.getByRole("button", { name: /bknProject.model.pending/ })).toHaveTextContent(
      '{"count":2}',
    );
    expect(screen.getByText(/bknProject.model.notice.unadoptedEnds/)).toBeInTheDocument();
  });

  it("marks relations adopted while an end is not, with their evidence", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.relations/));

    expect(await screen.findByText("bknProject.model.state.unadoptedEnd")).toBeInTheDocument();
    expect(screen.getAllByText(/bknProject.model.evidence.joinCount/)[0]).toHaveTextContent(
      '"rate":"99.5%"',
    );
    expect(screen.getByText(/bknProject.model.evidence.origin.name_match/)).toBeInTheDocument();
  });

  it("reports catalogs that are gone, and nothing when the catalogs cannot be listed", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    const view = renderModel({ catalogIds: ["old-catalog"] });
    expect(await screen.findByText(/bknProject.model.notice.missingCatalogs/)).toHaveTextContent(
      "old-catalog",
    );
    view.unmount();

    listCatalogsMock.mockRejectedValue(new Error("down"));
    renderModel({ catalogIds: ["old-catalog"] });
    await screen.findByText(/bknProject.model.summary/);
    expect(screen.queryByText(/bknProject.model.notice.missingCatalogs/)).not.toBeInTheDocument();
  });

  it("draws the concept model with every object type, also while nothing is adopted", async () => {
    getDraftMock.mockResolvedValue(ready());
    const view = renderModel();
    expect(await screen.findByText("bknProject.model.graph.legend")).toBeInTheDocument();
    view.unmount();

    // What is not adopted is drawn faded, not left out: the graph still shows the draft.
    getDraftMock.mockResolvedValue(
      edited((draft) => draft.items.objectTypes.forEach((item) => (item.adopted = false))),
    );
    renderModel();
    expect(await screen.findByText("bknProject.model.graph.legend")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.model.graph.emptyDescription")).not.toBeInTheDocument();
  });

  it("opens on the tab a link asks for, and on the objects for any other", async () => {
    getDraftMock.mockResolvedValue(ready());
    const view = renderModel({}, true, "changes");
    expect(await screen.findByText("bknProject.model.changes.waitingTitle")).toBeInTheDocument();
    // What waits says which scenario questions need it.
    expect(await screen.findByText("Which products use part P-100?")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.changes.neededBy")).toBeInTheDocument();
    view.unmount();

    renderModel({}, true, "nonsense");
    expect(await screen.findByRole("switch", { name: /"name":"customers"/ })).toBeInTheDocument();
  });

  it("opens an object type of a ready draft in the editor", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    // The graph lists the types beside it too; the table's row is the last.
    fireEvent.click((await screen.findAllByRole("button", { name: /^customers/ })).at(-1)!);
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/bkn-project/${project.id}/model/object-types/customers`,
    );
  });

  it("opens an object type with its identity, properties and the fields left out", async () => {
    getDraftMock.mockResolvedValue(ready());
    // An archived project is read only: its object types open in the details.
    renderModel({ archived: true });

    // The graph lists the types beside it too; the table's row is the last.
    fireEvent.click((await screen.findAllByRole("button", { name: /^customers/ })).at(-1)!);

    expect(await screen.findByText("bknProject.model.detail.propertiesTitle")).toBeInTheDocument();
    expect(screen.getByText("contact_phone")).toBeInTheDocument();
    expect(screen.getAllByText(/bknProject.model.excluded.reason.privacy/)[0]).toHaveTextContent(
      '"keyword":"phone"',
    );
  });

  it("unadopts with the draft's update time and says which relations went with it", async () => {
    const current = ready();
    getDraftMock.mockResolvedValue(current);
    editDraftItemMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[0].adopted = false;
        draft.items.relationTypes[0].adopted = false;
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() =>
      expect(editDraftItemMock).toHaveBeenCalledWith(
        "p1",
        "object_types",
        "customers",
        current.updateTime,
        { adopted: false },
      ),
    );
    expect(messageMock.info).toHaveBeenCalledWith(
      expect.stringContaining('bknProject.model.edit.cascade:{"count":1'),
    );
    expect(await screen.findByRole("switch", { name: /"name":"customers"/ })).not.toBeChecked();
  });

  it("does not offer adopting an object type that waits for its identity", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    expect(await screen.findByRole("switch", { name: /"name":"material_bom"/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /"name":"sales_orders"/ })).toBeEnabled();
  });

  it("reloads a draft someone else changed and does not replay the edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockRejectedValue(conflict("Stale"));
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    expect(messageMock.warning).toHaveBeenCalledWith("bknProject.model.edit.stale");
    expect(editDraftItemMock).toHaveBeenCalledTimes(1);
  });

  it("shows bkn-project's localized refusal of an edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockRejectedValue(conflict("ProjectArchived"));
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("ProjectArchived described"),
    );
    expect(getDraftMock).toHaveBeenCalledTimes(1);
  });

  it("renames an item with only what changed, and offers nothing for an empty edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[0].name = "Client";
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: /edit:.*"name":"customers"/ }));
    const save = (await openDialog()).getByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("bknProject.model.edit.name"), {
      target: { value: " Client " },
    });
    fireEvent.click(save);

    await waitFor(() =>
      expect(editDraftItemMock).toHaveBeenCalledWith(
        "p1",
        "object_types",
        "customers",
        expect.any(Number),
        { name: "Client" },
      ),
    );
  });

  it("asks before drafting again over decisions, and agrees to discard them", async () => {
    const current = ready();
    current.items.decisions = [
      {
        action: "unadopt",
        after: false,
        before: true,
        by: { id: "me", type: "user" },
        itemId: "customers",
        kind: "object_types",
        time: 1,
      },
    ];
    getDraftMock.mockResolvedValue(current);
    generateDraftMock.mockResolvedValue({ ...ready(), status: "drafting" });
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    expect(generateDraftMock).not.toHaveBeenCalled();
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'bknProject.model.regenerateConfirm.content:{"count":1}',
      }),
    );
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });
    expect(generateDraftMock).toHaveBeenCalledWith("p1", { discardDecisions: true });
  });

  it("drafts again without asking when nobody decided anything", async () => {
    getDraftMock.mockResolvedValue(ready());
    generateDraftMock.mockResolvedValue({ ...ready(), status: "drafting" });
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    await waitFor(() => expect(generateDraftMock).toHaveBeenCalledWith("p1"));
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("asks again when someone decided something since the draft was read", async () => {
    const decided = ready();
    decided.items.decisions = [
      {
        action: "rename",
        after: "Client",
        before: "customers",
        by: { id: "other", type: "user" },
        itemId: "customers",
        kind: "object_types",
        time: 2,
      },
    ];
    getDraftMock.mockResolvedValueOnce(ready()).mockResolvedValue(decided);
    generateDraftMock.mockRejectedValueOnce(conflict("HasDecisions"));
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(getDraftMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("bknProject.model.generateFailed")).not.toBeInTheDocument();
  });

  it("offers no edits on an archived project", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel({ archived: true });

    expect(await screen.findByRole("switch", { name: /"name":"customers"/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /edit:.*"name":"customers"/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "bknProject.model.regenerate" })).toBeDisabled();
  });

  it("says why a relation unadopted with its object type cannot be adopted again", async () => {
    getDraftMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[0].adopted = false;
        draft.items.relationTypes[0].adopted = false;
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.relations/));
    const relationSwitch = await screen.findByRole("switch", {
      name: /"name":"sales_orders_to_customers"/,
    });
    expect(relationSwitch).toBeDisabled();

    fireEvent.mouseEnter(relationSwitch.parentElement as HTMLElement);
    expect(
      await screen.findByText("bknProject.model.adoptBlocked.endsNotAdopted"),
    ).toBeInTheDocument();
  });

  it("asks without a number when the decisions cannot be read again", async () => {
    getDraftMock.mockResolvedValueOnce(ready()).mockRejectedValue(new Error("gateway timeout"));
    generateDraftMock.mockRejectedValueOnce(conflict("HasDecisions"));
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    // Never a made-up count on a confirmation that discards work.
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ content: "bknProject.model.regenerateConfirm.contentUncounted" }),
    );
  });

  it("lets the owner replace catalogs that are gone, keeping the ones still there", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    setProjectCatalogsMock.mockResolvedValue({ ...project, catalogIds: ["cat-001"] });
    renderModel({ catalogIds: ["cat-001", "old-catalog"] });

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.model.catalogs.change" }),
    );

    // The catalogs that are gone are named, so people know what saving removes.
    const dialog = await openDialog();
    expect(await dialog.findByText(/bknProject.model.catalogs.removed/)).toHaveTextContent(
      "old-catalog",
    );
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(setProjectCatalogsMock).toHaveBeenCalledWith("p1", ["cat-001"]));
    expect(onProjectChange).toHaveBeenCalledWith(
      expect.objectContaining({ catalogIds: ["cat-001"] }),
    );
    expect(messageMock.success).toHaveBeenCalledWith("bknProject.model.catalogs.saved");
  });

  it("asks someone else to contact the owner instead of offering the change", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    renderModel({ catalogIds: ["old-catalog"] }, false);

    expect(await screen.findByText("bknProject.model.notice.askOwner")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.catalogs.change" }),
    ).not.toBeInTheDocument();
  });

  it("offers the owner of a project without catalogs to choose them", async () => {
    getDraftMock.mockResolvedValue(null);
    const view = renderModel({ catalogIds: [] });
    expect(
      await screen.findByRole("button", { name: "bknProject.model.catalogs.choose" }),
    ).toBeInTheDocument();
    view.unmount();

    renderModel({ catalogIds: [] }, false);
    expect(
      await screen.findByText("bknProject.model.empty.noCatalogsAskOwner"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.catalogs.choose" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the catalog dialog open and says why when saving fails", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    setProjectCatalogsMock.mockRejectedValue(
      new AxiosError("403", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "Only the owner may.", error_code: "BknProject.Project.NotOwner" },
        status: 403,
      } as AxiosResponse),
    );
    renderModel({ catalogIds: ["cat-001", "old-catalog"] });

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.model.catalogs.change" }),
    );
    const dialog = await openDialog();
    fireEvent.click(dialog.getByRole("button", { name: "common.save" }));

    expect(await dialog.findByText("Only the owner may.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "common.save" })).toBeInTheDocument();
    expect(onProjectChange).not.toHaveBeenCalled();
  });

  it("tells the owner the catalog list failed to load and lets them retry", async () => {
    getDraftMock.mockResolvedValue(null);
    listCatalogsMock
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockResolvedValue({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
    renderModel({ catalogIds: [] });

    // Not a silently missing button: the owner learns why and can try again.
    expect(await screen.findByText("bknProject.model.catalogs.loadFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    expect(
      await screen.findByRole("button", { name: "bknProject.model.catalogs.choose" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("bknProject.model.catalogs.loadFailed")).not.toBeInTheDocument();
  });

  it("offers no catalog change on an archived project, as no other change", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    const view = renderModel({ archived: true, catalogIds: ["old-catalog"] });
    expect(await screen.findByText(/bknProject.model.notice.missingCatalogs/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.catalogs.change" }),
    ).not.toBeInTheDocument();
    view.unmount();

    getDraftMock.mockResolvedValue(null);
    renderModel({ archived: true, catalogIds: [] });
    expect(await screen.findByText("bknProject.model.empty.title")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.catalogs.choose" }),
    ).not.toBeInTheDocument();
  });

  it("asks to draft again when only the draft still reads a catalog that is gone", async () => {
    // The project's catalogs were already changed; the draft's tables still come from the old one.
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    renderModel({ catalogIds: ["cat-001"] });

    expect(await screen.findByText(/bknProject.model.notice.draftReadsMissing/)).toHaveTextContent(
      "old-catalog",
    );
    expect(screen.queryByText(/bknProject.model.notice.missingCatalogs/)).not.toBeInTheDocument();
    // Changing catalogs again would not help, so the notice does not offer it.
    expect(
      screen.getAllByRole("button", { name: "bknProject.model.catalogs.change" }),
    ).toHaveLength(1);
  });

  it("lets the owner change catalogs before the first draft", async () => {
    getDraftMock.mockResolvedValue(null);
    renderModel();

    expect(
      await screen.findByRole("button", { name: "bknProject.model.catalogs.change" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.model.generate" })).toBeEnabled();
  });

  it("chooses the identity of an object type waiting for it, then says it can be adopted", async () => {
    const current = ready();
    getDraftMock.mockResolvedValue(current);
    chooseIdentityMock.mockResolvedValue(
      edited((draft) => {
        const bom = draft.items.objectTypes[2];
        bom.needsIdentity = false;
        bom.primaryKeys = ["material_code"];
      }),
    );
    renderModel();

    fireEvent.click(
      await screen.findByRole("button", { name: /identity.choose:.*"name":"material_bom"/ }),
    );
    const dialog = await openDialog();
    const save = dialog.getByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();
    fireEvent.click(dialog.getByRole("checkbox", { name: /^material_code/ }));
    fireEvent.click(save);

    await waitFor(() =>
      expect(chooseIdentityMock).toHaveBeenCalledWith("p1", "material_bom", current.updateTime, [
        "material_code",
      ]),
    );
    expect(messageMock.success).toHaveBeenCalledWith(
      expect.stringContaining("bknProject.model.identity.savedAdopt"),
    );
  });

  it("says a key of several properties is not counted, and saves nothing unchanged", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    fireEvent.click(
      await screen.findByRole("button", { name: /identity.change:.*"name":"sales_orders"/ }),
    );
    // The current identity is chosen already, so there is nothing to save yet.
    const dialog = await openDialog();
    expect(dialog.getByRole("checkbox", { name: /^id/ })).toBeChecked();
    expect(dialog.getByRole("button", { name: "common.save" })).toBeDisabled();

    fireEvent.click(dialog.getByRole("checkbox", { name: /order_no/ }));
    expect(dialog.getByText("bknProject.model.identity.composite")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "common.save" })).toBeEnabled();
  });

  it("restores a field after saying what restoring it means", async () => {
    const current = ready();
    getDraftMock.mockResolvedValue(current);
    restoreFieldMock.mockResolvedValue(
      edited((draft) => {
        draft.items.excluded = draft.items.excluded.slice(1);
        draft.items.objectTypes[0].properties.push({
          description: "",
          displayName: "contact_phone",
          mappedField: "contact_phone",
          missingDescription: true,
          name: "contact_phone",
          sourceOfRecord: "table",
          type: "string",
        });
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.excluded/));
    fireEvent.click(
      await screen.findByRole("button", { name: /restore.action:.*"field":"contact_phone"/ }),
    );

    const confirm = confirmMock.mock.calls[0][0] as unknown as { content: string };
    expect(confirm.content).toContain('"keyword":"phone"');
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });
    expect(restoreFieldMock).toHaveBeenCalledWith(
      "p1",
      current.updateTime,
      "customers",
      "contact_phone",
    );
    expect(messageMock.success).toHaveBeenCalledWith(
      expect.stringContaining('"property":"contact_phone"'),
    );
  });

  it("says a field restored meanwhile is restored already, and reloads", async () => {
    getDraftMock.mockResolvedValue(ready());
    restoreFieldMock.mockRejectedValue(
      new AxiosError("404", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "Not found.", error_code: "BknProject.Draft.ItemNotFound" },
        status: 404,
      } as AxiosResponse),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.excluded/));
    fireEvent.click(
      await screen.findByRole("button", { name: /restore.action:.*"field":"contact_phone"/ }),
    );
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });

    expect(messageMock.warning).toHaveBeenCalledWith("bknProject.model.restore.already");
    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
  });

  it("offers neither choosing an identity nor restoring on an archived project", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel({ archived: true });

    expect(
      await screen.findByRole("button", { name: /identity.choose:.*"name":"material_bom"/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByText(/bknProject.model.tabs.excluded/));
    expect(
      await screen.findByRole("button", { name: /restore.action:.*"field":"contact_phone"/ }),
    ).toBeDisabled();
  });

  it("restores a field without a keyword, and never names a property it did not see", async () => {
    const current = ready();
    current.items.excluded[0].keyword = undefined;
    getDraftMock.mockResolvedValue(current);
    // The reply lacks the property: the page must not report a name it guessed.
    restoreFieldMock.mockResolvedValue(
      edited((draft) => {
        draft.items.excluded = draft.items.excluded.slice(1);
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.excluded/));
    fireEvent.click(
      await screen.findByRole("button", { name: /restore.action:.*"field":"contact_phone"/ }),
    );
    const confirm = confirmMock.mock.calls[0][0] as unknown as { content: string };
    expect(confirm.content).toContain("bknProject.model.restore.confirmNoKeyword");
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });

    expect(messageMock.success).toHaveBeenCalledWith(
      expect.stringContaining("bknProject.model.restore.savedNoName"),
    );
  });

  it("lists what waits for you first, each with the action that settles it", async () => {
    const current = ready();
    getDraftMock.mockResolvedValue(current);
    editDraftItemMock.mockResolvedValue(
      edited((draft) => {
        draft.items.relationTypes[1].adopted = false;
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.changes/));

    expect(
      await screen.findByRole("button", { name: /identity.choose:.*"name":"material_bom"/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /changes.unadoptItem:.*"name":"material_bom_to_sales_orders"/,
      }),
    );
    await waitFor(() =>
      expect(editDraftItemMock).toHaveBeenCalledWith(
        "p1",
        "relation_types",
        "material_bom_to_sales_orders",
        current.updateTime,
        { adopted: false },
      ),
    );
  });

  it("lists the decisions newest first and says who made them", async () => {
    const current = ready();
    current.items.decisions = [
      {
        action: "rename",
        after: "Client",
        before: "customers",
        by: { id: "me", type: "user" },
        itemId: "customers",
        kind: "object_types",
        time: 1,
      },
      {
        action: "adopt",
        after: true,
        before: false,
        by: { id: "u2", type: "user" },
        itemId: "sales_orders",
        kind: "object_types",
        time: 2,
      },
    ];
    getDraftMock.mockResolvedValue(current);
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.changes/));

    const entries = await screen.findAllByTestId("draft-change");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("bknProject.model.changes.action.adopt");
    expect(entries[0]).toHaveTextContent("bknProject.model.changes.someone");
    expect(entries[1]).toHaveTextContent("bknProject.model.changes.action.rename");
    expect(entries[1]).toHaveTextContent("bknProject.model.changes.you");
  });

  it("says nothing was changed yet when nothing waits and nobody decided", async () => {
    getDraftMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[2].needsIdentity = false;
        draft.items.relationTypes[1].adopted = false;
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.changes/));

    expect(await screen.findByText("bknProject.model.changes.none")).toBeInTheDocument();
  });

  it("takes people from the pending count to what waits for them", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: /bknProject.model.pending/ }));

    expect(await screen.findByText("bknProject.model.changes.waitingTitle")).toBeInTheDocument();
  });

  it("shows on the changes tab how many items wait, not only the decisions", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    // No decisions yet, two items wait: the tab says both, as the header does.
    const tab = await screen.findByText(/bknProject.model.tabs.changes/);
    expect(tab.closest(".ant-segmented-item")).toHaveTextContent(
      'bknProject.model.pending:{"count":2}',
    );
  });
});
