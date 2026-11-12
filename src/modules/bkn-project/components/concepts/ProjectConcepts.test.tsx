/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import type { ReactElement } from "react";
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
  reviseConcept: vi.fn(),
}));
const assistant = vi.hoisted(() => ({ askConcepts: vi.fn(), understandCatalogs: vi.fn() }));
vi.mock("@/modules/bkn-project/services/ask.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/ask.service")>()),
  askConcepts: assistant.askConcepts,
}));
vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  understandCatalogs: assistant.understandCatalogs,
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

// The edition's panel for extracting a model from the knowledge-base files.
const slots = vi.hoisted(() => ({
  kbModel: null as null | ((props: { canEdit: boolean; draftUpdateTime: number }) => ReactElement),
}));
vi.mock("@/framework/extension/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/extension/registry")>()),
  extensionProjectConceptSource: () => undefined,
  extensionProjectKnowledgeBaseModel: () => slots.kbModel ?? undefined,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectConcepts } from "./ProjectConcepts";

const project = { archived: false, id: "p1", knId: "orders" } as Project;

function concept(extra: Partial<Concept>): Concept {
  return {
    ai: false,
    aliases: [],
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
    notUnderstood: 0,
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

/** The alert a text is shown in. */
function alertOf(text: HTMLElement) {
  const alert = text.closest<HTMLElement>('[role="alert"]');
  if (!alert) {
    throw new Error("not in an alert");
  }
  return alert;
}

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
    slots.kbModel = null;
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

  it("shows what the network already has as found there, read only and marked", async () => {
    service.getConcepts.mockResolvedValue(
      concepts({
        concepts: [
          concept({
            item: { adopted: true, id: "supply_sales_order", kind: "object_types" },
            key: "object_types/supply_sales_order",
            name: "销售订单",
            sources: [
              { documentIds: [], id: "supply_sales_order", kind: "network", name: "销售订单" },
              { documentIds: [], id: "t_orders", kind: "table", name: "orders" },
            ],
            state: "in_model",
            suggestedBecause: "network",
          }),
        ],
      }),
    );
    renderConcepts();

    const order = await row("销售订单");
    expect(order.getByText(/^bknProject\.concepts\.source\.network/)).toBeInTheDocument();
    expect(order.getByText("bknProject.concepts.because.network")).toBeInTheDocument();
    expect(order.getAllByRole("img", { name: "bknProject.model.existing.mark" })).toHaveLength(2);
    // Judged and merged in the knowledge network, not here.
    expect(order.queryByRole("combobox", { name: /verdictOf/ })).toBeNull();
    expect(order.queryByRole("combobox", { name: /mergeIntoOf/ })).toBeNull();
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

  it("offers a value list to a concept of the knowledge-base files, with drafting's reason", async () => {
    service.getConcepts.mockResolvedValue(
      concepts({
        concepts: [
          concept({
            key: "document_concepts/c1",
            name: "Ward status",
            reason: "A fixed list of states",
            sources: [{ documentIds: [], id: "f1", kind: "document", name: "" }],
            suggested: "values",
            suggestedBecause: "document_concept",
            verdict: "values",
          }),
        ],
      }),
    );
    renderConcepts();

    const ward = await row("Ward status");
    expect(ward.getByText("A fixed list of states")).toBeInTheDocument();
    fireEvent.mouseDown(ward.getByRole("combobox", { name: /verdictOf.*Ward status/ }));
    await screen.findByRole("listbox");
    expect(
      [...document.querySelectorAll(".ant-select-item-option")].map((option) => option.textContent),
    ).toContain("bknProject.concepts.verdict.values");
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

  it("keeps a stale refusal on the page and reads again only when asked", async () => {
    service.judgeConcept.mockRejectedValue(conflict("Stale"));
    renderConcepts();

    fireEvent.mouseDown((await row("Orders")).getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));

    const alert = alertOf(await screen.findByText("bknProject.concepts.stale"));
    expect(messageMock.warning).not.toHaveBeenCalled();
    expect(service.getConcepts).toHaveBeenCalledTimes(1);
    expect(service.judgeConcept).toHaveBeenCalledTimes(1);

    fireEvent.click(within(alert).getByRole("button", { name: "bknProject.concepts.reload" }));
    await waitFor(() => expect(service.getConcepts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("bknProject.concepts.stale")).toBeNull());
    expect(service.judgeConcept).toHaveBeenCalledTimes(1);
  });

  it("keeps the stale refusal when reading again fails", async () => {
    service.judgeConcept.mockRejectedValue(conflict("Stale"));
    renderConcepts();

    fireEvent.mouseDown((await row("Orders")).getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));
    const alert = alertOf(await screen.findByText("bknProject.concepts.stale"));

    service.getConcepts.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(within(alert).getByRole("button", { name: "bknProject.concepts.reload" }));
    await waitFor(() => expect(service.getConcepts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("bknProject.concepts.stale")).toBeInTheDocument());
  });

  it("says a concept of a knowledge-base selection no longer in use cannot be judged, offering no reload", async () => {
    service.judgeConcept.mockRejectedValue(conflict("DocumentSourceChanged"));
    renderConcepts();

    fireEvent.mouseDown((await row("Orders")).getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));

    const alert = alertOf(await screen.findByText("bknProject.concepts.sourceChanged"));
    // Reading again would be refused the same way.
    expect(within(alert).queryByRole("button", { name: "bknProject.concepts.reload" })).toBeNull();
  });

  it("keeps a refusal while the page reads itself again during an extraction", async () => {
    withRun({ extracted: true, status: "running" });
    const polls: Array<() => void> = [];
    const realSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    setTimeoutSpy.mockImplementation(((handler: () => void, delay?: number) => {
      if (delay === 5000) {
        polls.push(handler);
        return 0;
      }
      return realSetTimeout(handler, delay);
    }) as typeof window.setTimeout);
    service.judgeConcept.mockRejectedValue(conflict("DocumentSourceChanged"));
    renderConcepts();

    fireEvent.mouseDown((await row("Orders")).getByRole("combobox", { name: /verdictOf.*Orders/ }));
    fireEvent.click(await screen.findByTitle("bknProject.concepts.verdict.none"));
    await screen.findByText("bknProject.concepts.sourceChanged");

    const reads = service.getConcepts.mock.calls.length;
    act(() => {
      polls.splice(0).forEach((poll) => poll());
    });
    await waitFor(() => expect(service.getConcepts.mock.calls.length).toBeGreaterThan(reads));
    expect(screen.getByText("bknProject.concepts.sourceChanged")).toBeInTheDocument();
    setTimeoutSpy.mockRestore();
  });

  it("keeps a refused merge on the page in the server's words", async () => {
    service.mergeConcept.mockRejectedValue(
      new AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "合并没有保存", error_code: "BknProject.Draft.InvalidRequestBody" },
        status: 400,
      } as AxiosResponse),
    );
    renderConcepts();

    fireEvent.mouseDown(
      (await row("Orders")).getByRole("combobox", { name: /mergeIntoOf.*Orders/ }),
    );
    fireEvent.click(await screen.findByTitle("Visits"));

    expect(alertOf(await screen.findByText("合并没有保存"))).toBeInTheDocument();
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

  it("names a table's concept as semantic understanding did, marked lightly, with the table as an alias", async () => {
    service.getConcepts.mockResolvedValue(
      concepts({
        concepts: [
          concept({
            ai: true,
            aliases: ["erp_material"],
            description: "Material master data",
            item: { adopted: true, id: "erp_material", kind: "object_types" },
            key: "object_types/erp_material",
            name: "Material",
            suggestedBecause: "table_understood",
          }),
        ],
      }),
    );
    renderConcepts();

    expect(await screen.findByText("Material")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "bknProject.concepts.aiMark" })).toBeInTheDocument();
    expect(
      screen.getByText(`bknProject.concepts.aliases:${JSON.stringify({ names: "erp_material" })}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `bknProject.concepts.understoodWith:${JSON.stringify({ description: "Material master data" })}`,
      ),
    ).toBeInTheDocument();
  });

  it("says tables are not understood yet, and understands them before extracting again", async () => {
    service.getConcepts.mockResolvedValue(concepts({ notUnderstood: 2 }));
    assistant.understandCatalogs.mockResolvedValue([]);
    service.generateDraft.mockResolvedValue({ items: { decisions: [] }, status: "drafting" });
    renderConcepts();

    expect(
      await screen.findByText(`bknProject.concepts.notUnderstood:${JSON.stringify({ count: 2 })}`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.concepts.reextract" }));
    await waitFor(() => expect(service.generateDraft).toHaveBeenCalledWith("p1", {}));
    expect(assistant.understandCatalogs).toHaveBeenCalledWith("p1");
  });

  it("asks AI about the concepts and adopts the chosen changes one by one as decisions", async () => {
    const define = {
      field: "define",
      reason: "A business name",
      value: { description: "", key: "object_types/orders", name: "Sales order" },
    };
    const verdict = {
      field: "verdict",
      reason: "",
      value: { key: "object_types/orders", verdict: "event" },
    };
    assistant.askConcepts.mockResolvedValue({
      answer: "Rename it.",
      dropped: [],
      revisions: [define, verdict],
    });
    const next = concepts({ draftUpdateTime: 6 });
    service.reviseConcept
      .mockResolvedValueOnce(next)
      .mockResolvedValueOnce(concepts({ draftUpdateTime: 7 }));
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.ask" }));
    fireEvent.change(screen.getByRole("textbox", { name: "bknProject.model.ask.question" }), {
      target: { value: "Name them" },
    });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.submit" }));
    expect(await screen.findByText("Rename it.")).toBeInTheDocument();
    expect(assistant.askConcepts).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", question: "Name them" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.adoptSelected" }));
    await waitFor(() => expect(service.reviseConcept).toHaveBeenCalledTimes(2));
    expect(service.reviseConcept).toHaveBeenNthCalledWith(1, "p1", 5, define);
    // The second is written over the draft the first left.
    expect(service.reviseConcept).toHaveBeenNthCalledWith(2, "p1", 6, verdict);
    await waitFor(() =>
      expect(messageMock.success).toHaveBeenCalledWith("bknProject.model.ask.adopted"),
    );
  });

  it("asks nothing new while the chosen changes are being adopted", async () => {
    assistant.askConcepts.mockResolvedValue({
      answer: "Rename it.",
      dropped: [],
      revisions: [
        { field: "verdict", reason: "", value: { key: "object_types/orders", verdict: "event" } },
      ],
    });
    let finish: (value: Concepts) => void = () => undefined;
    service.reviseConcept.mockReturnValue(
      new Promise<Concepts>((resolve) => {
        finish = resolve;
      }),
    );
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.ask" }));
    const question = screen.getByRole("textbox", { name: "bknProject.model.ask.question" });
    fireEvent.change(question, { target: { value: "Name them" } });
    fireEvent.click(screen.getByRole("button", { name: "bknProject.model.ask.submit" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.model.ask.adoptSelected" }),
    );

    await waitFor(() => expect(question).toBeDisabled());
    expect(
      screen.getByRole("button", { name: "bknProject.model.ask.newConversation" }),
    ).toBeDisabled();
    act(() => {
      finish(concepts({ draftUpdateTime: 6 }));
    });
    await waitFor(() => expect(question).not.toBeDisabled());
  });

  it("shows others the judgments without letting them change any", async () => {
    renderConcepts(false);

    expect(await screen.findByText("bknProject.concepts.readOnly")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "bknProject.concepts.acceptAll" })).toBeNull();
  });

  it("counts what is in the model as the modeling page does, confirmed or not", async () => {
    renderConcepts();

    // Orders, adopted by drafting and not yet confirmed, and Currency, confirmed.
    const stat = (await screen.findByText("bknProject.concepts.stats.inModel")).closest(
      "div",
    ) as HTMLElement;
    expect(within(stat).getByText("2")).toBeInTheDocument();
    expect(
      within(stat).getByText('bknProject.concepts.stats.inModelPending:{"count":1}'),
    ).toBeInTheDocument();
  });

  it("says when drafting found a concept but left it out, and what it could be judged", async () => {
    const base = concepts();
    service.getConcepts.mockResolvedValue({
      ...base,
      concepts: [
        ...base.concepts,
        concept({
          item: { adopted: false, id: "orders_to_products", kind: "relation_types" },
          key: "relation_types/orders_to_products",
          name: "Products of order",
          suggested: "relation",
          suggestedBecause: "name_match",
          verdict: "none",
        }),
      ],
    });
    renderConcepts();

    expect(
      (await row("Products of order")).getByText(
        'bknProject.concepts.notAdopted:{"because":"bknProject.concepts.because.name_match","verdict":"bknProject.concepts.verdict.relation"}',
      ),
    ).toBeInTheDocument();
  });

  it("starts extracting from the knowledge-base files here, also before any concept", async () => {
    kb.mode = "enabled";
    slots.kbModel = ({ canEdit, draftUpdateTime }) => (
      <span>{`kb-model:${canEdit}:${draftUpdateTime}`}</span>
    );
    service.getConcepts.mockResolvedValue({
      concepts: [],
      counts: {},
      draftUpdateTime: 0,
      requirementUpdateTime: 0,
    });
    service.getDraft.mockResolvedValue(null);
    renderConcepts();

    expect(await screen.findByText("kb-model:true:0")).toBeInTheDocument();
    expect(screen.getByText("bknProject.concepts.empty.title")).toBeInTheDocument();
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
