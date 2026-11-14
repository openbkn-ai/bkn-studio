/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { type ReactElement, useEffect } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ProjectKnowledgeBaseModelProps,
  ProjectKnowledgeBaseModelStatus,
} from "@/framework/extension/registry";
import type {
  Concept,
  Concepts,
  RequirementConceptMatch,
} from "@/modules/bkn-project/types/concepts";
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
const confirmMock = vi.hoisted(() => vi.fn<(config: { onOk: () => void }) => void>());
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

const service = vi.hoisted(() => ({
  addDraftCatalogs: vi.fn(),
  draftSourceChanges: vi.fn(),
  generateDraft: vi.fn(),
  getConcepts: vi.fn(),
  getDraft: vi.fn(),
  getSourceChanges: vi.fn(),
  judgeConcept: vi.fn(),
  mergeConcept: vi.fn(),
  reviseConcept: vi.fn(),
}));
vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  ...service,
}));
const publish = vi.hoisted(() => ({ getUnderstanding: vi.fn(), understandCatalogs: vi.fn() }));
vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  ...publish,
}));
const assistant = vi.hoisted(() => ({ askConcepts: vi.fn() }));
vi.mock("@/modules/bkn-project/services/ask.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/ask.service")>()),
  askConcepts: assistant.askConcepts,
}));
const requirements = vi.hoisted(() => ({
  extractRequirementConcepts: vi.fn(),
  getRequirements: vi.fn(),
  listDocuments: vi.fn(),
  matchRequirementConcept: vi.fn(),
}));
vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  ...requirements,
}));

// The edition's panel for extracting a model from the knowledge-base files.
const slots = vi.hoisted(() => ({
  kbModel: null as null | ((props: ProjectKnowledgeBaseModelProps) => ReactElement),
}));
vi.mock("@/framework/extension/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/extension/registry")>()),
  extensionProjectConceptSource: () => undefined,
  extensionProjectKnowledgeBaseModel: () => slots.kbModel ?? undefined,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectConcepts } from "./ProjectConcepts";

const project = {
  archived: false,
  catalogIds: ["c1"],
  contentLanguage: "zh-CN",
  id: "p1",
  knId: "orders",
} as unknown as Project;

function concept(extra: Partial<Concept>): Concept {
  return {
    ai: false,
    aliases: [],
    binding: { id: "", kind: "table", name: "" },
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

const table = (id: string) => ({ id, kind: "table" as const, name: id });
const dataset = { id: "ds", kind: "dataset" as const, name: "Contract extraction" };

function requirement(extra: Partial<RequirementConceptMatch>): RequirementConceptMatch {
  return {
    basis: "",
    by: "ai",
    category: "object",
    definition: "",
    id: "r",
    match: null,
    quote: "",
    state: "pending",
    term: "r",
    ...extra,
  };
}

function concepts(extra: Partial<Concepts> = {}): Concepts {
  return {
    concepts: [
      concept({
        binding: table("r_customers"),
        item: { adopted: true, id: "customers", kind: "object_types" },
        key: "object_types/customers",
        name: "Customer",
        sources: [{ documentIds: [], id: "r_customers", kind: "table", name: "customers" }],
      }),
      concept({
        binding: table("r_orders"),
        item: { adopted: true, id: "orders", kind: "object_types" },
        key: "object_types/orders",
        name: "Order",
        reason: "",
        sources: [{ documentIds: [], id: "r_orders", kind: "table", name: "orders" }],
        state: "in_model",
      }),
      concept({
        binding: table("r_supplier"),
        item: { adopted: true, id: "supplier", kind: "object_types" },
        key: "object_types/supplier",
        name: "Supplier",
        sources: [{ documentIds: [], id: "supplier", kind: "network", name: "Supplier" }],
        state: "in_model",
      }),
      concept({
        binding: dataset,
        item: { adopted: false, id: "certificate", kind: "object_types" },
        key: "object_types/certificate",
        name: "Certificate",
        sources: [{ documentIds: [], id: "f1", kind: "document", name: "" }],
        suggestedBecause: "document_entity",
      }),
      concept({
        binding: table("r_meta"),
        item: { adopted: false, id: "meta", kind: "object_types" },
        judged: { by: { id: "me", type: "user" }, time: 1 },
        key: "object_types/meta",
        name: "Sample meta",
        state: "judged",
        verdict: "none",
      }),
      // A requirement concept listed on its own belongs to the requirement tab.
      concept({
        binding: null,
        key: "requirement_concepts/k9",
        name: "Credit limit",
        sources: [{ documentIds: ["d1"], id: "k9", kind: "requirement", name: "Credit limit" }],
      }),
    ],
    counts: {},
    draftUpdateTime: 5,
    notUnderstood: 0,
    requirementUpdateTime: 9,
    requirements: [
      requirement({
        basis: "the customers table records clients",
        id: "k1",
        match: {
          binding: table("r_customers"),
          key: "object_types/customers",
          name: "Customer",
          target: { id: "r_customers", kind: "table" },
        },
        quote: "every client's orders",
        term: "Client",
      }),
      requirement({
        basis: "no table holds a limit",
        id: "k9",
        state: "unmatched",
        term: "Credit limit",
      }),
    ],
    ...extra,
  };
}

const onGoToResources = vi.fn();
const onOpenItem = vi.fn();

function renderConcepts(ownerIsCaller = true) {
  return renderWithoutAntdStyles(
    <ProjectConcepts
      onGoToKinetic={vi.fn()}
      onGoToModel={vi.fn()}
      onGoToResources={onGoToResources}
      onOpenItem={onOpenItem}
      ownerIsCaller={ownerIsCaller}
      project={project}
    />,
  );
}

const row = async (name: string) =>
  within((await screen.findByText(name)).closest("tr") as HTMLElement);

function refused(code: string, status = 409) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.Draft.${code}` },
    status,
  } as AxiosResponse);
}

/** Runs the confirmation the page asked for. */
async function confirmRun() {
  await waitFor(() => expect(confirmMock).toHaveBeenCalled());
  act(() => confirmMock.mock.calls.at(-1)![0].onOk());
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
    service.getDraft.mockResolvedValue({
      createTime: 1,
      items: { decisions: [], objectTypes: [] },
      status: "ready",
      updateTime: 5,
    });
    requirements.getRequirements.mockResolvedValue({
      spec: {
        conceptsRun: { error: "", extracted: true, stale: false, status: "ready" },
        runs: { concepts: { status: "ready", updateTime: 2 }, kinetic: null },
      },
      updateTime: 9,
    });
    requirements.listDocuments.mockResolvedValue([{ id: "d1" }]);
    publish.getUnderstanding.mockResolvedValue([
      { catalogId: "c1", tables: [{ resourceId: "r_customers" }, { resourceId: "r_orders" }] },
    ]);
  });

  it("lists the sources with what they hold and made, and the network's concepts", async () => {
    renderConcepts();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    const tables = within(sources.querySelector('[data-source="table"]') as HTMLElement);
    expect(tables.getByText('bknProject.concepts.sources.name.table:{"count":2}')).toBeTruthy();
    expect(
      tables.getByText(/bknProject.concepts.sources.produced.table:\{"count":3\}/),
    ).toBeTruthy();
    const documents = within(sources.querySelector('[data-source="document"]') as HTMLElement);
    expect(documents.getByText(/bknProject.concepts.sources.unmatched:\{"count":1\}/)).toBeTruthy();
    // No knowledge-base row without the edition's panel.
    expect(sources.querySelector('[data-source="knowledgeBase"]')).toBeNull();
    expect(
      within(sources).getByText(
        'bknProject.concepts.sources.network:{"count":1,"structured":1,"unstructured":0}',
      ),
    ).toBeTruthy();
  });

  const documentsRow = async () => {
    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    return sources.querySelector('[data-source="document"]') as HTMLElement;
  };

  const withConceptsRun = (run: Record<string, unknown>) =>
    requirements.getRequirements.mockResolvedValue({
      spec: {
        conceptsRun: { error: "", extracted: true, pendingParts: 0, stale: false, ...run },
        runs: { concepts: { status: run.status, updateTime: 2 }, kinetic: null },
      },
      updateTime: 9,
    });

  it("says why extracting the requirement documents failed, and what to do", async () => {
    withConceptsRun({ error: "output_too_long", status: "failed" });
    renderConcepts();

    const row = await documentsRow();
    await waitFor(() =>
      expect(row.textContent).toContain("bknProject.requirements.conceptsRunError.output_too_long"),
    );
    expect(row.textContent).toContain("bknProject.concepts.run.failed.document");
  });

  it("says how many parts of the documents are left and why, until the documents change", async () => {
    withConceptsRun({ error: "agent_timeout", pendingParts: 2, status: "ready" });
    const view = renderConcepts();

    let row = await documentsRow();
    await waitFor(() => expect(row.textContent).toContain("bknProject.concepts.run.partial"));
    expect(row.textContent).toContain("bknProject.requirements.conceptsRunError.agent_timeout");
    view.unmount();

    withConceptsRun({ error: "agent_timeout", pendingParts: 2, stale: true, status: "ready" });
    renderConcepts();
    row = await documentsRow();
    await waitFor(() => expect(requirements.getRequirements).toHaveBeenCalled());
    expect(row.textContent).not.toContain("bknProject.concepts.run.partial");
  });

  it("counts four figures over the data side and lists it grouped by its data", async () => {
    renderConcepts();

    const stats = (await screen.findByText("bknProject.concepts.stats.total")).closest("dl")!;
    const figure = (key: string) =>
      within(stats).getByText(`bknProject.concepts.stats.${key}`).nextElementSibling?.textContent;
    expect(figure("total")).toBe("5");
    expect(figure("pending")).toBe("2");
    expect(figure("confirmed")).toBe("2");
    expect(figure("excluded")).toBe("1");
    expect(within(stats).getByText('bknProject.concepts.stats.network:{"count":1}')).toBeTruthy();

    // At first only what waits for a person: the structured group, then the unstructured one.
    const groups = screen.getAllByText(/bknProject.concepts.group\./);
    expect(groups.map((group) => group.textContent)).toEqual([
      'bknProject.concepts.kind.structured bknProject.concepts.group.structured:{"count":1}',
      'bknProject.concepts.kind.unstructured bknProject.concepts.group.unstructured:{"count":1}',
    ]);
    expect(screen.queryByText("Credit limit")).toBeNull();
    expect(screen.queryByText("Order")).toBeNull();

    // All of them: the network's comes last of its group, with the blue dot.
    fireEvent.click(screen.getAllByText("bknProject.concepts.filter.all")[1]);
    const names = (await screen.findAllByText(/^(Customer|Order|Supplier|Sample meta)$/)).map(
      (node) => node.textContent,
    );
    expect(names.at(-1)).toBe("Supplier");
    expect((await row("Supplier")).getAllByRole("img").length).toBeGreaterThan(0);
  });

  it("confirms and leaves out a concept", async () => {
    service.judgeConcept.mockResolvedValue(concepts());
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("button", { name: /confirmOf.*Customer/ }));
    await waitFor(() =>
      expect(service.judgeConcept).toHaveBeenCalledWith("p1", 5, {
        key: "object_types/customers",
        reason: "",
        verdict: "object",
      }),
    );
    fireEvent.click((await row("Customer")).getByRole("button", { name: /excludeOf.*Customer/ }));
    await waitFor(() =>
      expect(service.judgeConcept).toHaveBeenLastCalledWith("p1", 5, {
        key: "object_types/customers",
        reason: "",
        verdict: "none",
      }),
    );
  });

  it("says a knowledge-base concept of earlier samples cannot change, and offers to extract again", async () => {
    service.judgeConcept.mockRejectedValue(refused("DocumentSourceChanged"));
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("button", { name: /confirmOf.*Customer/ }));
    expect(await screen.findByText("bknProject.concepts.sourceChanged")).toBeInTheDocument();
    expect(messageMock.warning).toHaveBeenCalledWith("bknProject.concepts.sourceChanged");
    expect(screen.getByRole("button", { name: "bknProject.concepts.extractAgain" })).toBeEnabled();
  });

  it("merges only into objects bound to the same kind of data", async () => {
    service.mergeConcept.mockResolvedValue(concepts());
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("button", { name: /mergeIntoOf.*Customer/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Order")).toBeTruthy();
    expect(within(dialog).getByText("Supplier")).toBeTruthy();
    expect(within(dialog).queryByText("Certificate")).toBeNull();
    expect(within(dialog).queryByText("Sample meta")).toBeNull();
    expect(within(dialog).getByText("bknProject.concepts.mergeOther.structured")).toBeTruthy();

    fireEvent.click(within(dialog).getByText("Order"));
    await waitFor(() =>
      expect(service.mergeConcept).toHaveBeenCalledWith(
        "p1",
        5,
        "object_types/customers",
        "object_types/orders",
      ),
    );
  });

  it("says why ticked concepts of both kinds are not merged, and offers a relation instead", async () => {
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("checkbox", { name: /tick.*Customer/ }));
    fireEvent.click(
      (await row("Certificate")).getByRole("checkbox", { name: /tick.*Certificate/ }),
    );
    expect(screen.getByText('bknProject.concepts.selection.count:{"count":2}')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.concepts.mergeTicked.action" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("bknProject.concepts.cross.title")).toBeTruthy();
    expect(within(dialog).getByText("bknProject.concepts.cross.why")).toBeTruthy();
    expect(service.mergeConcept).not.toHaveBeenCalled();
  });

  it("says a merge across kinds was refused", async () => {
    service.mergeConcept.mockRejectedValue(refused("CrossBindingMerge", 400));
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("button", { name: /mergeIntoOf.*Customer/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByText("Order"));
    expect(await screen.findByText("bknProject.concepts.cross.refused")).toBeTruthy();
  });

  it("keeps ticks across pages", async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      concept({
        binding: table(`r_${index}`),
        item: { adopted: true, id: `t${index}`, kind: "object_types" },
        key: `object_types/t${index}`,
        name: `Table ${index}`,
      }),
    );
    service.getConcepts.mockResolvedValue(concepts({ concepts: many, requirements: [] }));
    renderConcepts();

    fireEvent.click((await row("Table 0")).getByRole("checkbox"));
    expect(screen.queryByText("Table 20")).toBeNull();
    fireEvent.click(screen.getByTitle("2"));
    fireEvent.click((await row("Table 20")).getByRole("checkbox"));
    expect(screen.getByText('bknProject.concepts.selection.count:{"count":2}')).toBeTruthy();
  });

  it("shows one notice, tables not understood before requirement concepts not in the data", async () => {
    service.getConcepts.mockResolvedValue(concepts({ notUnderstood: 2 }));
    const { unmount } = renderConcepts();
    expect(
      await screen.findByText('bknProject.concepts.notice.notUnderstood:{"count":2}'),
    ).toBeTruthy();
    expect(screen.queryByText(/bknProject.concepts.notice.unmatched/)).toBeNull();
    unmount();

    service.getConcepts.mockResolvedValue(concepts());
    renderConcepts();
    expect(
      await screen.findByText(
        'bknProject.concepts.notice.unmatched:{"count":1,"names":"Credit limit"}',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "bknProject.concepts.notice.settle" }));
    expect(await screen.findByText("bknProject.concepts.requirement.notInData")).toBeTruthy();
  });

  it("confirms, changes and leaves out a requirement concept's match", async () => {
    requirements.matchRequirementConcept.mockResolvedValue({ updateTime: 10 });
    renderConcepts();
    fireEvent.click(await screen.findByText('bknProject.concepts.tabs.requirement:{"count":2}'));

    const client = await row("Client");
    expect(client.getByText("Customer")).toBeTruthy();
    fireEvent.click(client.getByRole("button", { name: /requirement.confirmOf/ }));
    await waitFor(() =>
      expect(requirements.matchRequirementConcept).toHaveBeenCalledWith(
        "p1",
        "k1",
        { target: { id: "r_customers", kind: "table" } },
        9,
      ),
    );

    // One nothing in the data is cannot be confirmed: it is matched by hand, given data, or left out.
    const limit = await row("Credit limit");
    expect(limit.queryByRole("button", { name: /requirement.confirmOf/ })).toBeNull();
    fireEvent.click(limit.getByText("bknProject.concepts.requirement.addCatalog"));
    expect(onGoToResources).toHaveBeenCalledWith("catalogs");

    fireEvent.click(limit.getByRole("button", { name: /requirement.changeOf/ }));
    const dialog = await screen.findByRole("dialog");
    // Only objects to match to: a table's or a knowledge-base extraction's, never a new one.
    expect(within(dialog).queryByText("Sample meta")).toBeNull();
    expect(within(dialog).getByText("Certificate")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Certificate"));
    await waitFor(() =>
      expect(requirements.matchRequirementConcept).toHaveBeenLastCalledWith(
        "p1",
        "k9",
        { target: { id: "certificate", kind: "object_type" } },
        9,
      ),
    );

    fireEvent.click((await row("Client")).getByRole("button", { name: /requirement.excludeOf/ }));
    await waitFor(() =>
      expect(requirements.matchRequirementConcept).toHaveBeenLastCalledWith(
        "p1",
        "k1",
        { excluded: true, target: { id: "r_customers", kind: "table" } },
        9,
      ),
    );
  });

  it("extracts from every source in turn, keeping what was decided", async () => {
    service.getConcepts.mockResolvedValue(concepts({ notUnderstood: 1 }));
    publish.understandCatalogs.mockResolvedValue([]);
    service.generateDraft.mockRejectedValue(refused("HasDecisions"));
    service.getSourceChanges.mockResolvedValue({ signature: "s1", state: "changed" });
    service.draftSourceChanges.mockResolvedValue({ status: "ready" });
    requirements.extractRequirementConcepts.mockResolvedValue({});
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.reextract" }));
    await confirmRun();

    await waitFor(() =>
      expect(messageMock.success).toHaveBeenCalledWith("bknProject.concepts.run.doneAll"),
    );
    expect(publish.understandCatalogs).toHaveBeenCalledWith("p1");
    expect(service.draftSourceChanges).toHaveBeenCalledWith("p1", "s1");
    expect(requirements.extractRequirementConcepts).toHaveBeenCalledWith("p1");
    expect(service.generateDraft.mock.invocationCallOrder[0]).toBeLessThan(
      requirements.extractRequirementConcepts.mock.invocationCallOrder[0],
    );
  });

  it("shows each source's progress while a run goes on", async () => {
    service.generateDraft.mockReturnValue(new Promise(() => undefined));
    renderConcepts();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.concepts.reextract" }));
    await confirmRun();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    const tables = within(sources.querySelector('[data-source="table"]') as HTMLElement);
    expect(
      await tables.findByText("bknProject.concepts.sources.steps.table.candidates"),
    ).toBeTruthy();
    expect(tables.getByText("bknProject.concepts.sources.running")).toBeTruthy();
    const documents = within(sources.querySelector('[data-source="document"]') as HTMLElement);
    expect(documents.getByText("bknProject.concepts.sources.waiting")).toBeTruthy();
    // No source may be started alone meanwhile.
    expect(documents.getByRole("button", { name: /runOne.againOf/ })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("adds the tables to a draft a knowledge-base extraction made, keeping what it holds", async () => {
    service.getDraft.mockResolvedValue({
      createTime: 1,
      items: {
        adding: null,
        decisions: [],
        draftedCatalogIds: [],
        objectTypes: [{ document: { role: "entity" }, existing: false, id: "invoice" }],
      },
      status: "ready",
      updateTime: 5,
    });
    service.addDraftCatalogs.mockResolvedValue({ status: "ready" });
    renderConcepts();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    const tables = within(sources.querySelector('[data-source="table"]') as HTMLElement);
    fireEvent.click(tables.getByRole("button", { name: /runOne.againOf/ }));
    await confirmRun();

    await waitFor(() => expect(service.addDraftCatalogs).toHaveBeenCalledWith("p1", ["c1"]));
    expect(service.generateDraft).not.toHaveBeenCalled();
  });

  it("keeps the sources card for a project with only knowledge-base files", async () => {
    kb.mode = "enabled";
    slots.kbModel = () => <span>panel</span>;
    service.getConcepts.mockResolvedValue(concepts({ concepts: [], requirements: [] }));
    requirements.listDocuments.mockResolvedValue([]);
    publish.getUnderstanding.mockResolvedValue([{ catalogId: "c1", tables: [] }]);
    renderConcepts();

    expect(
      await screen.findByRole("region", { name: "bknProject.concepts.sources.title" }),
    ).toBeTruthy();
    expect(screen.getByText("panel")).toBeTruthy();
    expect(screen.queryByText("bknProject.concepts.empty.title")).toBeNull();
  });

  it("names a knowledge-base concept's files, and warns of one named as a table's object", async () => {
    const base = concepts();
    base.concepts.push(
      concept({
        binding: dataset,
        item: { adopted: false, id: "customer_doc", kind: "object_types" },
        key: "object_types/customer_doc",
        name: "customer",
        sources: [
          { documentIds: [], id: "f1", kind: "document", name: "" },
          { documentIds: [], id: "f2", kind: "document", name: "" },
        ],
      }),
    );
    service.getConcepts.mockResolvedValue(base);
    renderConcepts();

    const doc = await row("customer");
    expect(doc.getByText('bknProject.concepts.origin.knowledgeBaseFiles:{"count":2}')).toBeTruthy();
    expect(doc.getByText('bknProject.concepts.sameName:{"name":"Customer"}')).toBeTruthy();
  });

  it("says why extracting the documents failed right after this page extracted them", async () => {
    requirements.extractRequirementConcepts.mockResolvedValue({});
    renderConcepts();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    const documents = sources.querySelector('[data-source="document"]') as HTMLElement;
    requirements.getRequirements.mockResolvedValue({
      spec: {
        conceptsRun: {
          error: "output_too_long",
          extracted: false,
          pendingParts: 0,
          stale: false,
          status: "failed",
        },
        runs: { concepts: { status: "failed", updateTime: 3 }, kinetic: null },
      },
      updateTime: 9,
    });
    fireEvent.click(within(documents).getByRole("button", { name: /runOne.againOf/ }));
    await confirmRun();

    await waitFor(() =>
      expect(documents.textContent).toContain(
        "bknProject.requirements.conceptsRunError.output_too_long",
      ),
    );
  });

  it("extracts one source alone from its row", async () => {
    requirements.extractRequirementConcepts.mockResolvedValue({});
    renderConcepts();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    const documents = within(sources.querySelector('[data-source="document"]') as HTMLElement);
    fireEvent.click(documents.getByRole("button", { name: /runOne.againOf/ }));
    await confirmRun();

    await waitFor(() =>
      expect(messageMock.success).toHaveBeenCalledWith("bknProject.concepts.run.doneOne"),
    );
    expect(requirements.extractRequirementConcepts).toHaveBeenCalledTimes(1);
    expect(service.generateDraft).not.toHaveBeenCalled();
  });

  it("asks the edition's panel to extract the knowledge-base files last, and waits for it", async () => {
    kb.mode = "enabled";
    const status = (extra: Partial<ProjectKnowledgeBaseModelStatus>) => ({
      added: 0,
      debugFiles: 6,
      finishTime: null,
      handledRequest: 0,
      phase: null,
      state: "idle" as const,
      ...extra,
    });
    const seen: number[] = [];
    slots.kbModel = function Panel({ onStatus, runRequest = 0 }: ProjectKnowledgeBaseModelProps) {
      useEffect(() => {
        seen.push(runRequest);
        onStatus?.(
          runRequest
            ? status({ finishTime: 3, handledRequest: runRequest, state: "succeeded" })
            : status({}),
        );
      }, [onStatus, runRequest]);
      return <span>panel</span>;
    };
    service.generateDraft.mockResolvedValue({ status: "ready" });
    requirements.extractRequirementConcepts.mockResolvedValue({});
    renderConcepts();

    const sources = await screen.findByRole("region", {
      name: "bknProject.concepts.sources.title",
    });
    await waitFor(() =>
      expect(
        within(sources).getByText('bknProject.concepts.sources.name.knowledgeBase:{"count":6}'),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "bknProject.concepts.reextract" }));
    await confirmRun();

    await waitFor(() =>
      expect(messageMock.success).toHaveBeenCalledWith("bknProject.concepts.run.doneAll"),
    );
    expect(seen).toContain(1);
  });

  it("asks AI about the ticked concepts once the assistant is opened, collapsed at first", async () => {
    assistant.askConcepts.mockResolvedValue({ answer: "ok", dropped: [], revisions: [] });
    renderConcepts();

    fireEvent.click((await row("Customer")).getByRole("checkbox", { name: /tick.*Customer/ }));
    // Docked open, the assistant would squeeze the list: it waits to be opened.
    expect(screen.queryByText('bknProject.concepts.refs:{"names":"Customer"}')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /bknProject\.ask\.button\.selected/ }));
    expect(await screen.findByText('bknProject.concepts.refs:{"names":"Customer"}')).toBeTruthy();
  });

  it("is read only for others", async () => {
    renderConcepts(false);

    expect(await screen.findByText("bknProject.concepts.readOnly")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /confirmOf/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /runOne/ })).toBeNull();
  });
});
