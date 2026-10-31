/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const getProjectMock = vi.hoisted(() => vi.fn());
const getNetworkMock = vi.hoisted(() => vi.fn());
const getLatestReleaseMock = vi.hoisted(() => vi.fn());
const getDraftMock = vi.hoisted(() => vi.fn());
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
  BknProjectKbSlot: () => null,
}));

vi.mock("@/modules/bkn-project/components/ProjectModel", () => ({
  ProjectModel: ({
    initialTab,
    project,
  }: {
    initialTab?: string | null;
    project: { id: string };
  }) => (
    <div>
      model of {project.id} on {initialTab ?? "the first tab"}
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
  ProjectRequirements: ({ ownerIsCaller }: { ownerIsCaller: boolean }) => (
    <div>requirements page {ownerIsCaller ? "owner" : "reader"}</div>
  ),
}));

// The data sources read the project's status, tested on their own.
vi.mock("@/modules/bkn-project/components/DataSourceHealth", () => ({
  DataSourceHealth: () => null,
}));

vi.mock("@/modules/bkn-project/components/draft/DraftConceptGraph", () => ({
  DraftConceptGraph: () => <div>concept graph</div>,
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  getDraft: getDraftMock,
}));

const getRequirementsMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  getRequirements: getRequirementsMock,
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
  catalogIds: ["c1", "c2"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

function renderScene(
  section: "model" | "overview" | "release" | "requirements" = "overview",
  entry = "/",
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProjectWorkspaceScene projectId="p1" section={section} />
      <Location />
    </MemoryRouter>,
  );
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
    getProjectMock.mockResolvedValue(project);
    getNetworkMock.mockResolvedValue({ id: "orders", name: "Orders network" });
    getLatestReleaseMock.mockResolvedValue({
      createTime: 1,
      networkId: "orders_v1_0_0",
      version: "1.0.0",
    });
    getDraftMock.mockResolvedValue(null);
    directoryMock.clear();
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

  it("lays the overview out as info, four tiles, the model and two columns, with no alert", async () => {
    const { container } = renderScene();
    await screen.findByText("Orders network");

    const regions = [...container.querySelectorAll("[data-region]")].map((node) =>
      node.getAttribute("data-region"),
    );
    expect(regions).toEqual(["info", "stats", "model", "columns"]);
    expect(container.querySelectorAll('[data-region="stats"] > *')).toHaveLength(4);
    // The instance tile has no page in the community image, so only three tiles open one.
    expect(container.querySelectorAll('[data-region="stats"] > button')).toHaveLength(3);
    expect(container.querySelector(".ant-alert")).toBeNull();
    expect(
      screen.getByText('bknProject.overview.tiles.sourcesValue:{"count":2}'),
    ).toBeInTheDocument();
    expect(screen.getByText("bknProject.list.ownerYou")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("counts the scenario questions of the drafted requirements, and says why instances show none", async () => {
    getRequirementsMock.mockResolvedValue({
      spec: { questions: [{ id: "q1" }, { id: "q2" }, { id: "q3" }] },
      status: "ready",
      version: 4,
    });
    renderScene();
    expect(
      await screen.findByText('bknProject.overview.tiles.questionsValue:{"count":3}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.overview.tiles.questionsReadySub:{"version":4}'),
    ).toBeInTheDocument();
    expect(screen.getByText("bknProject.overview.tiles.instancesValue")).toBeInTheDocument();
    expect(screen.getByText("bknProject.overview.tiles.instancesSub")).toBeInTheDocument();
  });

  it("says the questions come once the requirements are drafted", async () => {
    getRequirementsMock.mockResolvedValue(null);
    renderScene();
    expect(await screen.findByText("bknProject.overview.tiles.questionsSub")).toBeInTheDocument();
  });

  it("fills the ontology tile, the model and the recent changes from the draft", async () => {
    getDraftMock.mockResolvedValue(draftWithDecisions());
    renderScene();

    // Two adopted object types and one relation between them; material_bom waits for its identity
    // and an adopted relation has an unadopted end.
    expect(
      await screen.findByText(
        'bknProject.overview.tiles.ontologyValue:{"objects":2,"relations":1}',
      ),
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
    fireEvent.click(await screen.findByText("bknProject.overview.tiles.ontologyAdoptedSub"));
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

    expect(await screen.findByText("bknProject.overview.versions.unpublished")).toBeInTheDocument();
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

  it("shows the ontology modeling page of the project", async () => {
    renderScene("model");

    expect(await screen.findByText("model of p1 on the first tab")).toBeInTheDocument();
    expect(document.querySelector("h2")).toBeNull();
  });

  it("opens the modeling tab a link asks for", async () => {
    renderScene("model", "/bkn-project/p1/model?tab=changes");

    expect(await screen.findByText("model of p1 on changes")).toBeInTheDocument();
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

  it("shows the requirements of the project", async () => {
    renderScene("requirements");

    expect(await screen.findByText(/requirements page/)).toBeInTheDocument();
  });
});
