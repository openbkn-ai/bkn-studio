/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";
import type { ProjectSection } from "@/modules/bkn-project/types/workspace";

const getProjectMock = vi.hoisted(() => vi.fn());
const getNetworkMock = vi.hoisted(() => vi.fn());
const getLatestReleaseMock = vi.hoisted(() => vi.fn());
const getDraftMock = vi.hoisted(() => vi.fn());
const getProjectVersionsMock = vi.hoisted(() => vi.fn());
const getExistingDefinitionsMock = vi.hoisted(() => vi.fn());
const getExistingIndexMock = vi.hoisted(() => vi.fn());
const getNetworkBackgroundMock = vi.hoisted(() => vi.fn());
const getStatisticsMock = vi.hoisted(() => vi.fn());

/** The versions of the project's network, running the given one. */
const versionsRunning = (runningVersion: number, label = "") => ({
  entries: runningVersion ? [{ label, version: runningVersion }] : [],
  prepared: null,
  versioning: {
    draft: { baseVersion: runningVersion, hasChanges: false, outdated: false },
    fullHistory: true,
    previousVersion: 0,
    runningVersion,
  },
});
const directoryMock = vi.hoisted(() => new Map<string, string>());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => "hidden",
}));

vi.mock("@/framework/entitlement/BknProjectKbSlot", () => ({
  BknProjectKbBadge: () => null,
  // The slot's three states are tested on their own: here it lets its content through.
  BknProjectKbSlot: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/modules/bkn-project/components/ProjectModel", () => ({
  ProjectModel: ({
    initialTab,
    onConfirmed,
    onViewConfirmation,
    project,
  }: {
    initialTab?: string | null;
    onConfirmed: () => void;
    onViewConfirmation: () => void;
    project: { id: string };
  }) => (
    <div>
      model of {project.id} on {initialTab ?? "the first tab"}
      <button onClick={onConfirmed} type="button">
        confirm
      </button>
      <button onClick={onViewConfirmation} type="button">
        view confirmation
      </button>
    </div>
  ),
}));

vi.mock("@/modules/bkn-project/components/ProjectReleasePage", () => ({
  ProjectReleasePage: ({
    onGoToModel,
    onReleaseChanged,
  }: {
    onGoToModel: () => void;
    onReleaseChanged?: () => void;
  }) => (
    <>
      <button onClick={onGoToModel} type="button">
        release page
      </button>
      <button onClick={onReleaseChanged} type="button">
        publish
      </button>
    </>
  ),
}));

vi.mock("@/modules/bkn-project/components/requirements/ProjectRequirements", () => ({
  ProjectRequirements: ({
    onGoToResources,
    ownerIsCaller,
  }: {
    onGoToResources: (tab?: string) => void;
    ownerIsCaller: boolean;
  }) => (
    <div>
      requirements page {ownerIsCaller ? "owner" : "reader"}
      <button onClick={() => onGoToResources("documents")} type="button">
        go to resources
      </button>
    </div>
  ),
}));

vi.mock("@/modules/bkn-project/components/resources/ProjectResources", () => ({
  ProjectResources: ({ ownerIsCaller }: { ownerIsCaller: boolean }) => (
    <div>resources page {ownerIsCaller ? "owner" : "reader"}</div>
  ),
}));

// The data sources read the project's status, tested on their own.
vi.mock("@/modules/bkn-project/components/DataSourceHealth", () => ({
  DataSourceHealth: () => null,
}));

vi.mock("@/modules/bkn-project/services/release.service", () => ({
  getProjectVersions: getProjectVersionsMock,
}));

const getOntologyIndexMock = vi.hoisted(() => vi.fn());
const getUnderstandingMock = vi.hoisted(() => vi.fn());
const listDocumentsMock = vi.hoisted(() => vi.fn());
const getConceptsMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getExistingIndex: getExistingIndexMock,
  getOntologyIndex: getOntologyIndexMock,
  getUnderstanding: getUnderstandingMock,
}));

vi.mock("@/modules/knowledge-network/services/network.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/network.service")
  >()),
  getKnowledgeNetworkStatistics: getStatisticsMock,
}));

// Kinetic modeling is tested on its own.
vi.mock("@/modules/bkn-project/components/kinetic/ProjectKinetic", () => ({
  ProjectKinetic: ({
    onCount,
    onGoToRelease,
  }: {
    onCount?: (count: number | undefined) => void;
    onGoToRelease: () => void;
  }) => (
    <>
      <button onClick={onGoToRelease} type="button">
        kinetic page
      </button>
      <button onClick={() => onCount?.(5)} type="button">
        kinetic read
      </button>
    </>
  ),
}));

// The concept extraction page is tested on its own.
vi.mock("@/modules/bkn-project/components/concepts/ProjectConcepts", () => ({
  ProjectConcepts: ({
    onOpenItem,
  }: {
    onOpenItem: (item: { id: string; kind: string }) => void;
  }) => (
    <>
      <button onClick={() => onOpenItem({ id: "orders", kind: "object_types" })} type="button">
        open object
      </button>
      <button onClick={() => onOpenItem({ id: "r1", kind: "relation_types" })} type="button">
        open relation
      </button>
    </>
  ),
}));

// The build page's tabs are tested on their own.
vi.mock("@/modules/bkn-project/components/build/ProjectBuild", () => ({
  ProjectBuild: () => <div>build page</div>,
}));

vi.mock("@/modules/bkn-project/components/draft/DraftConceptGraph", () => ({
  DraftConceptGraph: () => <div>concept graph</div>,
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  getConcepts: getConceptsMock,
  getDraft: getDraftMock,
  getExistingDefinitions: getExistingDefinitionsMock,
}));

const getRequirementsMock = vi.hoisted(() => vi.fn());
const getLogicNeedsMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-project/services/kinetic.service", () => ({
  getLogicNeeds: getLogicNeedsMock,
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  getNetworkBackground: getNetworkBackgroundMock,
  getRequirements: getRequirementsMock,
  listDocuments: listDocumentsMock,
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => directoryMock,
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  getLatestRelease: getLatestReleaseMock,
  getProject: getProjectMock,
  getProjectNetwork: getNetworkMock,
}));

import { DRAFT_POLL_MS, mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { ProjectWorkspaceScene } from "./ProjectWorkspaceScene";

function Location() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  canManage: true,
  catalogIds: ["c1", "c2"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
  namingLanguage: "zh-CN",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

function renderScene(section: ProjectSection = "overview", entry = "/") {
  // A data router, as the app's: leaving with changes not saved is blocked through it.
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ProjectWorkspaceScene projectId="p1" section={section} />
            <Location />
          </>
        ),
        path: "*",
      },
    ],
    { initialEntries: [entry] },
  );
  return render(<RouterProvider router={router} />);
}

/** The mock draft, with one decision by someone else and one by the caller. */
function draftWithDecisions() {
  const draft = mapDraft(mockDraft("p1"));
  draft.items.decisions = [
    {
      action: "adopt",
      after: true,
      before: false,
      by: { id: "u2", type: "user" },
      itemId: "customers",
      kind: "object_types",
      time: 1,
    },
    {
      action: "rename",
      after: "Client",
      before: "customers",
      by: { id: "me", type: "user" },
      itemId: "customers",
      kind: "object_types",
      time: 2,
    },
  ];
  return draft;
}

describe("ProjectWorkspaceScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequirementsMock.mockResolvedValue(null);
    getLogicNeedsMock.mockRejectedValue(new Error("down"));
    getProjectMock.mockResolvedValue(project);
    getNetworkMock.mockResolvedValue({ id: "orders", name: "Orders network" });
    getLatestReleaseMock.mockResolvedValue({
      createTime: 1,
      networkId: "orders_v1_0_0",
      version: "1.0.0",
    });
    getDraftMock.mockResolvedValue(null);
    getOntologyIndexMock.mockResolvedValue(null);
    // Two tables in the project's catalog; one requirement document.
    getUnderstandingMock.mockResolvedValue([
      {
        catalogId: "c1",
        counts: {},
        missing: false,
        tables: [
          {
            applied: false,
            described: false,
            finishTime: null,
            name: "orders",
            networkObjectTypes: [],
            resourceId: "r1",
            status: "not_started",
          },
          {
            applied: false,
            described: false,
            finishTime: null,
            name: "lines",
            networkObjectTypes: [],
            resourceId: "r2",
            status: "not_started",
          },
        ],
        visible: true,
      },
    ]);
    listDocumentsMock.mockResolvedValue([{ id: "d1" }]);
    getConceptsMock.mockRejectedValue(new Error("down"));
    getProjectVersionsMock.mockResolvedValue(versionsRunning(1, "v1.0.0"));
    // A new network by default: it has nothing of its own.
    getExistingDefinitionsMock.mockResolvedValue({ objectTypes: [], relationTypes: [] });
    getExistingIndexMock.mockResolvedValue({ counts: {}, objectTypes: [], tasksVisible: true });
    getNetworkBackgroundMock.mockResolvedValue(null);
    getStatisticsMock.mockResolvedValue(null);
    directoryMock.clear();
  });

  it("counts what an existing network has with what the project adds, marked with a dot", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    getExistingDefinitionsMock.mockResolvedValue({
      objectTypes: [{ id: "regions" }, { id: "plants" }],
      relationTypes: [{ id: "plant_region" }],
    });
    getExistingIndexMock.mockResolvedValue({
      counts: {},
      objectTypes: [{ state: "ready" }, { state: "not_built" }],
      tasksVisible: true,
    });
    getNetworkBackgroundMock.mockResolvedValue({ id: "network" });
    getStatisticsMock.mockResolvedValue({ actionTypesTotal: 7, functionsTotal: 4, skillsTotal: 2 });
    getUnderstandingMock.mockResolvedValue([
      {
        catalogId: "c1",
        counts: {},
        missing: false,
        tables: [
          {
            applied: false,
            described: false,
            finishTime: null,
            name: "regions",
            networkObjectTypes: ["Region"],
            resourceId: "r1",
            status: "not_started",
          },
        ],
        visible: true,
      },
    ]);
    renderScene();

    // Two of the network's and the draft's two adopted object types, one relation of each.
    expect(
      await screen.findByText('bknProject.networkExisting.tiles.ontology:{"added":2,"existing":2}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.overview.tiles.ontologyValue:{"count":4}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.overview.tiles.ontologyRelations:{"count":2}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'bknProject.networkExisting.tiles.kinetic:{"actions":7,"functions":4,"skills":2}',
      ),
    ).toBeInTheDocument();
    // No kinetic need yet: the figure is the network's action types.
    expect(
      screen.getByText('bknProject.networkExisting.tiles.kineticValue:{"count":7}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.networkExisting.tiles.build:{"ready":1,"total":2}'),
    ).toBeInTheDocument();
    // The background is the network's on the sources card and among the project's sources.
    expect(screen.getAllByText("bknProject.networkExisting.tiles.sources")).toHaveLength(2);
    expect(
      screen.getByText('bknProject.overview.sources.tablesNetwork:{"count":1}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.networkExisting.tiles.release:{"version":"v1.0.0"}'),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("network-existing-dot")).toHaveLength(7);
  });

  it("shows an existing network's model before any draft, counted as the navigation counts it", async () => {
    getExistingDefinitionsMock.mockResolvedValue({
      objectTypes: [{ id: "regions" }, { id: "plants" }],
      relationTypes: [{ id: "plant_region", source: "plants", target: "regions" }],
    });
    renderScene();

    expect(await screen.findByText("concept graph")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.overview.model.empty")).toBeNull();
    expect(
      await screen.findByText('bknProject.overview.tiles.ontologyValue:{"count":2}'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "bknProject.workspace.sections.model" }),
      ).toHaveTextContent("2"),
    );
  });

  it("shows a project on a new network exactly as before: nothing marked as the network's", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    renderScene();

    expect(
      await screen.findByText('bknProject.overview.tiles.ontologyValue:{"count":2}'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getExistingDefinitionsMock).toHaveBeenCalledWith("p1"));
    expect(screen.queryByTestId("network-existing-line")).toBeNull();
    // Nothing else of the network is read for a new one.
    expect(getStatisticsMock).not.toHaveBeenCalled();
    expect(getExistingIndexMock).not.toHaveBeenCalled();
    expect(getNetworkBackgroundMock).not.toHaveBeenCalled();
  });

  it("links the network, its running version and the latest release to their workspaces", async () => {
    getProjectVersionsMock.mockResolvedValue(versionsRunning(3, "v0.9.0"));
    renderScene();

    const header = (await screen.findByText("Orders network")).closest("section") as HTMLElement;
    expect(within(header).getByRole("link", { name: "Orders network" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/orders/overview",
    );
    expect(within(header).getByText("bknProject.overview.fields.running:")).toBeInTheDocument();
    // One network keeps every version: the running one opens the same network.
    expect(await within(header).findByRole("link", { name: "v0.9.0" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/orders/overview",
    );
    expect(within(header).getByRole("link", { name: "v1.0.0" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/orders_v1_0_0/overview",
    );
    expect(getProjectVersionsMock).toHaveBeenCalledWith("p1");
  });

  it("says it cannot tell the running version when that cannot be read, rather than guess", async () => {
    getProjectVersionsMock.mockRejectedValue(new Error("down"));
    renderScene();

    const header = (await screen.findByText("Orders network")).closest("section") as HTMLElement;
    expect(
      await within(header).findByText("bknProject.overview.versions.runningUnknown"),
    ).toBeInTheDocument();
  });

  it("says nothing is published before any release", async () => {
    getLatestReleaseMock.mockResolvedValue(null);
    getProjectVersionsMock.mockResolvedValue(versionsRunning(0));
    renderScene();

    const header = (await screen.findByText("Orders network")).closest("section") as HTMLElement;
    await waitFor(() =>
      expect(within(header).getAllByText("bknProject.overview.versions.unpublished")).toHaveLength(
        2,
      ),
    );
  });

  it("names the page in the navigation only, and shows the network on the overview", async () => {
    renderScene();

    // The breadcrumb names the project; the page has no heading of its own.
    expect(await screen.findByText("Orders network")).toBeInTheDocument();
    expect(document.querySelector("h2")).toBeNull();
    expect(
      screen.getByRole("button", { name: /bknProject.workspace.sections.overview/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("lays the overview out as info, a card per step, the model and two columns, with no alert", async () => {
    const { container } = renderScene();
    await screen.findByText("Orders network");

    const regions = [...container.querySelectorAll("[data-region]")].map((node) =>
      node.getAttribute("data-region"),
    );
    expect(regions).toEqual(["info", "stats", "sources", "model", "columns"]);
    // One card per step of the flow, in its order, each leading to its page.
    expect(
      [...container.querySelectorAll('[data-region="stats"] dd > p:first-child')].map(
        (node) => node.textContent,
      ),
    ).toEqual([
      "bknProject.workspace.sections.resources",
      "bknProject.workspace.sections.concepts",
      "bknProject.workspace.sections.model",
      "bknProject.workspace.sections.kinetic",
      "bknProject.workspace.sections.scenarios",
      "bknProject.workspace.sections.build",
      "bknProject.workspace.sections.release",
    ]);
    expect(container.querySelectorAll('[data-region="stats"] button')).toHaveLength(7);
    expect(container.querySelector(".ant-alert")).toBeNull();
    expect(
      screen.getByText('bknProject.overview.tiles.sourcesValue:{"count":2}'),
    ).toBeInTheDocument();
    expect(screen.getByText("bknProject.list.ownerYou")).toBeInTheDocument();
    // The latest release and the running version, in the header and on the cards.
    await waitFor(() => expect(screen.getAllByText("v1.0.0")).toHaveLength(4));
  });

  it("counts the scenario questions of the drafted requirements", async () => {
    getRequirementsMock.mockResolvedValue({
      spec: { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] },
      status: "ready",
      version: 4,
    });
    renderScene();
    expect(
      await screen.findByText('bknProject.overview.tiles.questionsValue:{"count":3}'),
    ).toBeInTheDocument();
    // What a figure stands for is its card's tooltip.
    expect(
      screen.getByTitle('bknProject.overview.tiles.questionsReadySub:{"version":4}'),
    ).toBeInTheDocument();
  });

  it("counts kinetic items as what the network already has and the new needs", async () => {
    getLogicNeedsMock.mockResolvedValue({
      needs: [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
      networkItems: [
        { id: "a1", needIds: ["n1"], type: "action_type" },
        { id: "f1", needIds: [], type: "function" },
      ],
    });
    renderScene();
    const kinetic = await screen.findByRole("button", {
      name: "bknProject.workspace.sections.kinetic",
    });
    // Two in the network, and n2 and n3 new: n1 is covered by what the network has.
    await waitFor(() => expect(kinetic).toHaveTextContent("4"));
  });

  it("on kinetic modeling, counts what the page read instead of reading the needs again", async () => {
    renderScene("kinetic");
    const kinetic = await screen.findByRole("button", {
      name: "bknProject.workspace.sections.kinetic",
    });
    fireEvent.click(await screen.findByRole("button", { name: "kinetic read" }));
    await waitFor(() => expect(kinetic).toHaveTextContent("5"));
    expect(getLogicNeedsMock).not.toHaveBeenCalled();
  });

  it("leaves the kinetic count off when the needs cannot be read", async () => {
    renderScene();
    const kinetic = await screen.findByRole("button", {
      name: "bknProject.workspace.sections.kinetic",
    });
    await waitFor(() => expect(getLogicNeedsMock).toHaveBeenCalled());
    expect(kinetic).toHaveTextContent(/^bknProject\.workspace\.sections\.kinetic$/);
  });

  it("counts the tables whose structured index is ready, in community wording", async () => {
    getOntologyIndexMock.mockResolvedValue({
      counts: {},
      objectTypes: [{ state: "ready" }, { state: "building" }],
      tasksVisible: true,
    });
    renderScene();

    expect(
      await screen.findByText('bknProject.overview.tiles.buildValue:{"ready":1,"total":2}'),
    ).toBeInTheDocument();
    // The community image builds no instances and draws no concepts from a knowledge base.
    expect(screen.getByTitle("bknProject.overview.tiles.buildSubCore")).toBeInTheDocument();
    expect(screen.getByTitle("bknProject.overview.tiles.conceptsSubCore")).toBeInTheDocument();
  });

  it("says the questions come once the requirements are drafted", async () => {
    getRequirementsMock.mockResolvedValue(null);
    renderScene();
    expect(await screen.findByTitle("bknProject.overview.tiles.questionsSub")).toBeInTheDocument();
  });

  it("fills the ontology tile, the model and the recent changes from the draft", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    renderScene();

    // Two adopted object types and one relation between them; material_bom waits for its identity
    // and an adopted relation has an unadopted end.
    // The figure is the object types; the relations are the small line under it.
    expect(
      await screen.findByText('bknProject.overview.tiles.ontologyValue:{"count":2}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.overview.tiles.ontologyRelations:{"count":1}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.overview.tiles.ontologyPendingSub:{"count":2}'),
    ).toBeInTheDocument();
    expect(screen.getByText("concept graph")).toBeInTheDocument();

    const changes = screen.getAllByTestId("overview-change");
    expect(changes).toHaveLength(2);
    // Newest first, with who made it by name, never by account id.
    expect(changes[0]).toHaveTextContent("bknProject.model.changes.action.rename");
    expect(changes[0]).toHaveTextContent('"who":"bknProject.model.changes.you"');
    expect(changes[1]).toHaveTextContent('"who":"bknProject.model.changes.someone"');
    expect(screen.getByText(/bknProject.overview.versions.draftUpdated/)).toBeInTheDocument();
  });

  it("opens the changes tab from the overview, where what waits is listed first", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    renderScene();

    fireEvent.click(await screen.findByText("bknProject.overview.changes.all"));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model?tab=changes");
  });

  it("opens what waits from the ontology tile, and the model when nothing does", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    const view = renderScene();
    fireEvent.click(
      await screen.findByText('bknProject.overview.tiles.ontologyPendingSub:{"count":2}'),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model?tab=changes");
    view.unmount();

    const settled = draftWithDecisions();
    settled.items.objectTypes.forEach((item) => (item.needsIdentity = false));
    settled.items.relationTypes.forEach((item) => (item.adopted = false));
    getDraftMock.mockResolvedValue(settled);
    renderScene();
    // Once the draft is read, the card shows its relations beside the link.
    await screen.findByText('bknProject.overview.tiles.ontologyRelations:{"count":0}');
    fireEvent.click(screen.getByText("bknProject.overview.tiles.ontologyAction"));
    expect(screen.getByTestId("location")).toHaveTextContent(/\/bkn-project\/p1\/model$/);
  });

  it("lists at most five recent changes", async () => {
    const draft = draftWithDecisions();
    draft.items.decisions = Array.from({ length: 7 }, (_, index) => ({
      ...draft.items.decisions[0],
      time: index,
    }));
    getDraftMock.mockResolvedValue(draft);
    renderScene();

    expect(await screen.findAllByTestId("overview-change")).toHaveLength(5);
  });

  it("says when there is no draft yet, or it is still drafting", async () => {
    renderScene();
    expect(await screen.findByText("bknProject.overview.model.empty")).toBeInTheDocument();
    expect(screen.getByText("bknProject.overview.versions.noDraft")).toBeInTheDocument();
    expect(screen.getByText("bknProject.overview.changes.empty")).toBeInTheDocument();
  });

  it("shows a drafting draft's state rather than an empty model", async () => {
    getDraftMock.mockResolvedValue({ ...draftWithDecisions(), status: "drafting" });
    renderScene();

    expect(
      await screen.findByText("bknProject.overview.model.draftingDescription"),
    ).toBeInTheDocument();
    expect(screen.queryByText("concept graph")).toBeNull();
    expect(screen.queryAllByTestId("overview-change")).toHaveLength(0);
    // On the ontology tile, as the model's title, and on the draft's row of versions.
    expect(screen.getAllByText("bknProject.model.status.drafting")).toHaveLength(3);
  });

  it("offers to read the draft again when it cannot be read, and keeps the rest", async () => {
    getDraftMock.mockRejectedValueOnce(new Error("down")).mockResolvedValue(draftWithDecisions());
    renderScene();

    expect(await screen.findByText("bknProject.overview.model.loadFailed")).toBeInTheDocument();
    expect(screen.getByText("Orders network")).toBeInTheDocument();
    fireEvent.click(screen.getByText("common.retry"));
    expect(await screen.findByText("concept graph")).toBeInTheDocument();
  });

  it("reads a drafting draft again until it is done, as the modeling page does", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getDraftMock
        .mockResolvedValueOnce({ ...draftWithDecisions(), status: "drafting" })
        .mockResolvedValue(draftWithDecisions());
      renderScene();
      expect(
        await screen.findByText("bknProject.overview.model.draftingDescription"),
      ).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
      });
      expect(await screen.findByText("concept graph")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the warning up while a drafting draft is read again after failing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getDraftMock
        .mockResolvedValueOnce({ ...draftWithDecisions(), status: "drafting" })
        // The navigation's count reads it once too, after the overview.
        .mockResolvedValueOnce({ ...draftWithDecisions(), status: "drafting" })
        .mockRejectedValueOnce(new Error("down"))
        .mockReturnValue(new Promise(() => undefined));
      renderScene();
      await screen.findByText("bknProject.overview.model.draftingDescription");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
      });
      expect(await screen.findByText("bknProject.overview.model.loadFailed")).toBeInTheDocument();

      // The next read is under way: the warning stays rather than flashing back to "drafting".
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
      });
      expect(getDraftMock).toHaveBeenCalledTimes(4);
      expect(screen.getByText("bknProject.overview.model.loadFailed")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the model loading while the draft is read", async () => {
    getDraftMock.mockReturnValue(new Promise(() => undefined));
    const { container } = renderScene();
    await screen.findByText("Orders network");

    expect(container.querySelector('[data-region="model"] .ant-spin')).not.toBeNull();
  });

  it("says when the network has no release yet", async () => {
    getLatestReleaseMock.mockResolvedValue(null);
    renderScene();

    // On the release card and in the versions.
    expect(await screen.findAllByText("bknProject.overview.versions.unpublished")).toHaveLength(2);
  });

  it("falls back to the network id, and to no version, when they cannot be read", async () => {
    getNetworkMock.mockResolvedValue(null);
    getLatestReleaseMock.mockRejectedValue(new Error("down"));
    renderScene();

    expect(await screen.findByText("orders")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.overview.versions.unpublished")).toBeNull();
  });

  it("answers a project the caller cannot see as not found", async () => {
    getProjectMock.mockRejectedValue({ isAxiosError: true, response: { status: 404, data: {} } });
    renderScene();

    expect(await screen.findByText("bknProject.workspace.notFound")).toBeInTheDocument();
    expect(screen.getByText("bknProject.workspace.backToList")).toBeInTheDocument();
  });

  it("shows the concept modeling page of the project", async () => {
    renderScene("model");

    expect(await screen.findByText("model of p1 on the first tab")).toBeInTheDocument();
    expect(document.querySelector("h2")).toBeNull();
  });

  it("opens the modeling tab a link asks for", async () => {
    renderScene("model", "/bkn-project/p1/model?tab=changes");

    expect(await screen.findByText("model of p1 on changes")).toBeInTheDocument();
  });

  it("goes on to kinetic modeling after confirming, with the confirmation a link away", async () => {
    renderScene("model");

    fireEvent.click(await screen.findByRole("button", { name: "confirm" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/kinetic");
  });

  it("opens what a confirmation started on the release page", async () => {
    renderScene("model");

    fireEvent.click(await screen.findByRole("button", { name: "view confirmation" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/release");
  });

  it("offers the next step in the order a project is built", async () => {
    renderScene("scenarios");

    fireEvent.click(await screen.findByRole("button", { name: /bknProject\.workspace\.nextStep/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/build");
  });

  it("shows kinetic modeling, which leads to the release page", async () => {
    renderScene("kinetic");

    fireEvent.click(await screen.findByRole("button", { name: "kinetic page" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/release");
  });

  it("opens a concept's item on the concept modeling page", async () => {
    renderScene("concepts");

    fireEvent.click(await screen.findByRole("button", { name: "open object" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model?object=orders");
  });

  it("opens a concept's relation on the modeling page's relations", async () => {
    renderScene("concepts");

    fireEvent.click(await screen.findByRole("button", { name: "open relation" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model?tab=relations");
  });

  it("shows the build page, which goes on to the release", async () => {
    renderScene("build");

    expect(await screen.findByText("build page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /bknProject\.workspace\.nextStep/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/release");
  });

  it("says the term library is not in this version where no extension brings it", async () => {
    renderScene("terms");

    expect(await screen.findByText("bknProject.workspace.comingSoon")).toBeInTheDocument();
    // Governance is off the flow: no next step.
    expect(screen.queryByRole("button", { name: /bknProject\.workspace\.nextStep/ })).toBeNull();
  });

  it("offers no next step past the release", async () => {
    renderScene("release");

    await screen.findByRole("button", { name: "release page" });
    expect(screen.queryByRole("button", { name: /bknProject\.workspace\.nextStep/ })).toBeNull();
  });

  it("shows the confirmation on the release page, which leads back to modeling", async () => {
    renderScene("release");

    fireEvent.click(await screen.findByRole("button", { name: "release page" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/model");
  });

  it("reads the live version again once something is published", async () => {
    getLatestReleaseMock.mockResolvedValueOnce(null).mockResolvedValue({
      createTime: 2,
      networkId: "orders_v1_0_0",
      version: "1.0.0",
    });
    renderScene("release");

    fireEvent.click(await screen.findByRole("button", { name: "publish" }));
    await waitFor(() => expect(getLatestReleaseMock).toHaveBeenCalledTimes(2));
  });

  it("shows the business scenarios, with the documents a link away", async () => {
    renderScene("scenarios");

    expect(await screen.findByText(/requirements page/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "go to resources" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/bkn-project/p1/resources");
  });

  it("shows the requirements and resources, counting the tables in the navigation", async () => {
    renderScene("resources");

    expect(await screen.findByText(/resources page owner/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "bknProject.workspace.sections.resources" }),
    ).toHaveTextContent("2");
  });
});
