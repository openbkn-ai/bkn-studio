/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Concept, Concepts } from "@/modules/bkn-project/types/concepts";
import type { Project } from "@/modules/bkn-project/types/project";

const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

const kb = vi.hoisted(() => ({ mode: "hidden" }));
vi.mock("@/framework/entitlement/bkn-project-kb-mode", () => ({
  useBknProjectKbMode: () => kb.mode,
}));

const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const confirmMock = vi.hoisted(() => vi.fn<(config: { onOk: () => Promise<void> }) => void>());
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

const service = vi.hoisted(() => ({
  acceptDraftSuggestions: vi.fn(),
  generateDraft: vi.fn(),
  getConcepts: vi.fn(),
  getDraft: vi.fn(),
  judgeConcept: vi.fn(),
  mergeConcept: vi.fn(),
}));
const requirements = vi.hoisted(() => ({
  editItem: vi.fn(),
  extractRequirementConcepts: vi.fn(),
  getRequirements: vi.fn(),
}));
vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  ...requirements,
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  ...service,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectConcepts } from "./ProjectConcepts";

const project = { archived: false, id: "p1", knId: "orders" } as Project;

function concept(extra: Partial<Concept>): Concept {
  return {
    blocked: null,
    description: "",
    item: null,
    judged: null,
    key: "k",
    merged: [],
    name: "k",
    reason: "",
    sources: [],
    state: "pending",
    suggested: "object",
    suggestedBecause: "table_entity",
    verdict: "object",
    ...extra,
  };
}

function concepts(extra: Partial<Concepts> = {}): Concepts {
  return {
    concepts: [
      concept({
        item: { adopted: true, id: "orders", kind: "object_types" },
        key: "object_types/orders",
        name: "Orders",
        sources: [
          { documentIds: [], id: "r_orders", kind: "table", name: "orders" },
          { documentIds: ["d1"], id: "k1", kind: "requirement", name: "Order" },
        ],
      }),
      concept({
        blocked: "needs_identity",
        item: { adopted: false, id: "visits", kind: "object_types" },
        judged: { by: { id: "me", type: "user" }, time: 1 },
        key: "object_types/visits",
        name: "Visits",
        state: "blocked",
      }),
      concept({
        item: { adopted: true, id: "currency", kind: "value_types" },
        key: "value_types/currency",
        name: "Currency",
        state: "in_model",
        suggested: "values",
        suggestedBecause: "code_table",
        verdict: "values",
      }),
      concept({
        key: "requirement_concepts/k3",
        name: "On-time rate",
        reason: "Computed from deliveries",
        sources: [{ documentIds: ["d1"], id: "k3", kind: "requirement", name: "On-time rate" }],
        state: "judged",
        verdict: "kinetic",
      }),
    ],
    counts: { blocked: 1, in_model: 1, judged: 1, pending: 1, "verdict:object": 2 },
    draftUpdateTime: 5,
    requirementUpdateTime: 9,
    ...extra,
  };
}

const onGoToKinetic = vi.fn();
const onGoToModel = vi.fn();
const onGoToResources = vi.fn();
const onOpenItem = vi.fn();

function renderConcepts(ownerIsCaller = true) {
  return renderWithoutAntdStyles(
    <ProjectConcepts
      onGoToKinetic={onGoToKinetic}
      onGoToModel={onGoToModel}
      onGoToResources={onGoToResources}
      onOpenItem={onOpenItem}
      ownerIsCaller={ownerIsCaller}
      project={project}
    />,
  );
}

const row = async (name: string) =>
  within((await screen.findByText(name)).closest("tr") as HTMLElement);

function conflict(code: string) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.Draft.${code}` },
    status: 409,
  } as AxiosResponse);
}

describe("ProjectConcepts", () => {
  beforeAll(() => {
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
    kb.mode = "hidden";
    service.getConcepts.mockResolvedValue(concepts());
    requirements.getRequirements.mockResolvedValue(null);
    service.getDraft.mockResolvedValue({
      items: { decisions: [] },
      status: "ready",
      updateTime: 5,
    });
  });

  const withRun = (run: { error?: string; extracted: boolean; stale?: boolean; status: string }) =>
    requirements.getRequirements.mockResolvedValue({
      spec: { conceptsRun: { error: "", stale: false, ...run } },
    });

  it("judges a requirement concept in the specification, as its category", async () => {
    requirements.editItem.mockResolvedValue({});
    renderConcepts();

    const rate = await row("On-time rate");
    fireEvent.mouseDown(rate.getByRole("combobox", { name: /verdictOf.*On-time rate/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));

    await waitFor(() =>
      expect(requirements.editItem).toHaveBeenCalledWith(
        "p1",
        "concepts",
        "k3",
        { category: "not_ontology" },
        9,
      ),
    );
    // Not through the draft: the kinetic needs read the specification.
    expect(service.judgeConcept).not.toHaveBeenCalled();
    await waitFor(() => expect(service.getConcepts).toHaveBeenCalledTimes(2));
  });

  it("leads from a kinetic concept to kinetic modeling", async () => {
    renderConcepts();

    fireEvent.click(
      (await row("On-time rate")).getByRole("button", {
        name: "bknProject.concepts.destination.kinetic",
      }),
    );
    expect(onGoToKinetic).toHaveBeenCalled();
  });

  it("extracts the requirement documents' concepts, and says when there are no documents", async () => {
    requirements.extractRequirementConcepts.mockRejectedValueOnce(
      new AxiosError("no", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "no", error_code: "BknProject.Requirement.NoDocuments" },
        status: 400,
      } as AxiosResponse),
    );
    renderConcepts();

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.concepts.requirements.extract" }),
    );
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith(
        "bknProject.concepts.requirements.noDocuments",
      ),
    );

    requirements.extractRequirementConcepts.mockResolvedValue({
      spec: { conceptsRun: { error: "", extracted: false, stale: false, status: "running" } },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "bknProject.concepts.requirements.extract" }),
    );
    expect(await screen.findByText("bknProject.concepts.requirements.running")).toBeInTheDocument();
    // While it runs, its concepts wait: none is judged meanwhile.
    expect((await row("On-time rate")).queryByRole("combobox", { name: /verdictOf/ })).toBeNull();
  });

  it("keeps the last extracted concepts when extracting again failed, and says so", async () => {
    withRun({ extracted: true, status: "failed" });
    renderConcepts();

    expect(
      await screen.findByText("bknProject.concepts.requirements.failedKept"),
    ).toBeInTheDocument();
  });

  it("says when the requirement documents changed since their concepts were extracted", async () => {
    withRun({ extracted: true, stale: true, status: "ready" });
    renderConcepts();

    expect(await screen.findByText("bknProject.concepts.requirements.stale")).toBeInTheDocument();
  });

  it("says what the concepts come from, without knowledge-base wording in the community image", async () => {
    renderConcepts();

    expect(
      await screen.findByText('bknProject.concepts.summaryCore:{"requirements":2,"tables":1}'),
    ).toBeInTheDocument();
    const orders = await row("Orders");
    expect(
      orders.getByText('bknProject.concepts.source.table:{"name":"orders"}'),
    ).toBeInTheDocument();
    expect(
      orders.getByText('bknProject.concepts.source.requirement:{"name":"Order"}'),
    ).toBeInTheDocument();
    // Drafting's reason, worded, where no person gave one.
    expect(orders.getByText("bknProject.concepts.because.table_entity")).toBeInTheDocument();
    expect((await row("On-time rate")).getByText("Computed from deliveries")).toBeInTheDocument();
  });

  it("counts the knowledge-base files where the edition has them", async () => {
    kb.mode = "enabled";
    renderConcepts();

    expect(
      await screen.findByText(
        'bknProject.concepts.summary:{"documents":0,"requirements":2,"tables":1}',
      ),
    ).toBeInTheDocument();
  });

  it("judges a concept over the draft read, which is the adoption", async () => {
    const judged = concepts();
    judged.concepts[0] = { ...judged.concepts[0], state: "in_model", verdict: "event" };
    service.judgeConcept.mockResolvedValue(judged);
    renderConcepts();

    const orders = await row("Orders");
    fireEvent.mouseDown(orders.getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.event"));

    await waitFor(() =>
      expect(service.judgeConcept).toHaveBeenCalledWith("p1", 5, {
        key: "object_types/orders",
        reason: "",
        verdict: "event",
      }),
    );
    expect(
      (await row("Orders")).getByText("bknProject.concepts.state.in_model"),
    ).toBeInTheDocument();
  });

  it("confirms a pending concept as suggested", async () => {
    service.judgeConcept.mockResolvedValue(concepts());
    renderConcepts();

    fireEvent.click((await row("Orders")).getByRole("button", { name: /confirmOf.*Orders/ }));
    await waitFor(() =>
      expect(service.judgeConcept).toHaveBeenCalledWith("p1", 5, {
        key: "object_types/orders",
        reason: "",
        verdict: "object",
      }),
    );
    // Judged concepts have nothing left to confirm.
    expect((await row("Visits")).queryByRole("button", { name: /confirmOf/ })).toBeNull();
  });

  it("keeps a saved judgment saved when reading the draft again fails", async () => {
    service.judgeConcept.mockResolvedValue(concepts());
    service.getDraft
      .mockResolvedValueOnce({ items: { decisions: [] }, status: "ready", updateTime: 5 })
      .mockRejectedValue(new Error("down"));
    renderConcepts();

    fireEvent.click((await row("Orders")).getByRole("button", { name: /confirmOf.*Orders/ }));
    await waitFor(() => expect(service.getDraft).toHaveBeenCalledTimes(2));
    expect(messageMock.error).not.toHaveBeenCalled();
  });

  it("offers only the verdicts a concept's item can take", async () => {
    renderConcepts();

    fireEvent.mouseDown(
      (await row("Currency")).getByRole("combobox", { name: /verdictOf.*Currency/ }),
    );
    await screen.findByRole("listbox");
    expect(
      [...document.querySelectorAll(".ant-select-item-option")].map((option) => option.textContent),
    ).toEqual([
      "bknProject.concepts.verdict.values",
      "bknProject.concepts.verdict.property",
      "bknProject.concepts.verdict.none",
    ]);
  });

  it("says what a blocked concept waits for and leads to where it is settled", async () => {
    renderConcepts();

    const visits = await row("Visits");
    expect(visits.getByText("bknProject.concepts.blocked.needs_identity")).toBeInTheDocument();
    fireEvent.click(visits.getByRole("button", { name: "bknProject.concepts.blocked.action" }));
    expect(onOpenItem).toHaveBeenCalledWith({ adopted: false, id: "visits", kind: "object_types" });
    // A requirement concept with no item to be says so.
    expect(
      (await row("On-time rate")).getByText("bknProject.concepts.destination.kinetic"),
    ).toBeInTheDocument();
  });

  it("accepts all suggestions, saying how many wait for a person", async () => {
    service.acceptDraftSuggestions.mockResolvedValue({ accepted: 3, draft: {}, skipped: 1 });
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.acceptAll" }));
    // Asked first: nothing is judged until the person agrees.
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(service.acceptDraftSuggestions).not.toHaveBeenCalled();
    await confirmMock.mock.calls[0][0].onOk();
    expect(service.acceptDraftSuggestions).toHaveBeenCalledWith("p1", 5);
    expect(messageMock.success).toHaveBeenCalledWith(
      'bknProject.concepts.acceptedSkipped:{"accepted":3,"count":1}',
    );
  });

  it("merges a concept into another and takes it out again", async () => {
    const merged = concepts();
    merged.concepts = [
      {
        ...merged.concepts[0],
        merged: [{ key: "requirement_concepts/k3", name: "On-time rate" }],
      },
      ...merged.concepts.slice(1, 3),
    ];
    service.mergeConcept.mockResolvedValue(merged);
    renderConcepts();

    fireEvent.mouseDown(
      (await row("On-time rate")).getByRole("combobox", { name: /mergeIntoOf.*On-time rate/ }),
    );
    fireEvent.click(await screen.findByTitle("Orders"));
    await waitFor(() =>
      expect(service.mergeConcept).toHaveBeenCalledWith(
        "p1",
        5,
        "requirement_concepts/k3",
        "object_types/orders",
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: 'bknProject.concepts.unmerge:{"name":"On-time rate"}',
      }),
    );
    await waitFor(() =>
      expect(service.mergeConcept).toHaveBeenLastCalledWith("p1", 5, "requirement_concepts/k3", ""),
    );
  });

  it("reads again when someone changed the model meanwhile, without replaying the judgment", async () => {
    service.judgeConcept.mockRejectedValue(conflict("Stale"));
    renderConcepts();

    fireEvent.mouseDown((await row("Orders")).getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));

    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith("bknProject.concepts.stale"),
    );
    expect(service.getConcepts).toHaveBeenCalledTimes(2);
    expect(service.judgeConcept).toHaveBeenCalledTimes(1);
  });

  it("asks before extracting again over decisions, and discards them only when told", async () => {
    service.generateDraft.mockRejectedValueOnce(conflict("HasDecisions"));
    service.generateDraft.mockResolvedValue({ items: { decisions: [] }, status: "drafting" });
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.reextract" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    await confirmMock.mock.calls[0][0].onOk();
    expect(service.generateDraft).toHaveBeenLastCalledWith("p1", { discardDecisions: true });
  });

  it("shows others the judgments without letting them change any", async () => {
    renderConcepts(false);

    expect(await screen.findByText("bknProject.concepts.readOnly")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "bknProject.concepts.acceptAll" })).toBeNull();
  });

  it("leads to the sources while there is nothing to extract from", async () => {
    service.getConcepts.mockResolvedValue({
      concepts: [],
      counts: {},
      draftUpdateTime: 0,
      requirementUpdateTime: 0,
    });
    service.getDraft.mockResolvedValue(null);
    renderConcepts();

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.concepts.empty.action" }),
    );
    expect(onGoToResources).toHaveBeenCalled();
  });
});
