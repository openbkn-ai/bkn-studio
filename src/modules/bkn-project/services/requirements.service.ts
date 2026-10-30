/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { isRequestNotFound } from "@/framework/request/error-message";
import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import type {
  RequirementCitation,
  RequirementDocument,
  RequirementDocumentContent,
  Requirements,
  RequirementSpec,
  UploadResult,
} from "@/modules/bkn-project/types/requirements";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const requirementsPath = (projectId: string) =>
  `/bkn-project/v1/projects/${encodeURIComponent(projectId)}/requirements`;

/** How often a specification being drafted is read again. */
export const REQUIREMENTS_POLL_MS = 5000;

/** What bkn-project takes per document and per project. */
export const DOCUMENT_LIMITS = { extensions: [".md", ".markdown", ".txt"], maxBytes: 1 << 20 };

/* ------------------------------- Backend shapes ------------------------------- */

type BackendDocument = {
  blocks?: { end: number; heading?: string; id: string; start: number }[] | null;
  content?: string;
  create_time: number;
  doc_type: string;
  format: string;
  id: string;
  name: string;
  size: number;
  uploader: { id: string } | null;
};

type BackendCitation = {
  block_id: string;
  document_id: string;
  end: number;
  quote: string;
  start: number;
};

type BackendCited = {
  citations?: BackendCitation[] | null;
  edited?: boolean;
  supplement_reason?: string;
};

type BackendSpec = {
  catalogs_unlisted?: string[] | null;
  choices?:
    | {
        citations?: BackendCitation[] | null;
        decision?: { basis: string; by: { id: string }; option_id: string; time: number } | null;
        id: string;
        options?: { consequence: string; id: string; label: string }[] | null;
        question: string;
        reason: string;
        recommended_option_id: string;
      }[]
    | null;
  concepts?:
    | (BackendCited & {
        category: string;
        definition: string;
        id: string;
        maps_to?: { id: string; kind: string } | null;
        not_ontology_reason?: string;
        term: string;
      })[]
    | null;
  conflicts?:
    | {
        deferred: boolean;
        id: string;
        kind: string;
        resolution?: {
          by: { id: string };
          document_id?: string;
          reason: string;
          text?: string;
          time: number;
        } | null;
        sides?: (BackendCitation & { position: string })[] | null;
        suggested_document_id?: string;
        topic: string;
      }[]
    | null;
  questions?:
    | (BackendCited & {
        answer_shape: string;
        id: string;
        layer: string;
        needs?: { id: string; kind: string }[] | null;
        needs_source: string;
        scenario_ids?: string[] | null;
        template: string;
        text: string;
        type: string;
      })[]
    | null;
  rejected?: { kind: string; reason: string; text: string }[] | null;
  rules?: (BackendCited & { compiles_to: string; id: string; statement: string })[] | null;
  scenarios?:
    | (BackendCited & {
        actor: string;
        capabilities?: { definition?: string; kind: string; name: string }[] | null;
        decision: string;
        id: string;
        knowledge?: string[] | null;
        name: string;
        trigger: string;
      })[]
    | null;
  tables_omitted?: number;
};

type BackendRequirements = {
  error?: string;
  spec: BackendSpec;
  stale?: boolean;
  status: string;
  undecided_choices?: number;
  unresolved_conflicts?: number;
  update_time: number;
  version: number;
};

const mapDocument = (document: BackendDocument): RequirementDocument => ({
  createTime: document.create_time,
  docType: document.doc_type,
  format: document.format,
  id: document.id,
  name: document.name,
  size: document.size,
  uploaderId: document.uploader?.id ?? "",
});

const mapCitation = (citation: BackendCitation): RequirementCitation => ({
  blockId: citation.block_id,
  documentId: citation.document_id,
  end: citation.end,
  quote: citation.quote,
  start: citation.start,
});

const cited = (item: BackendCited) => ({
  citations: (item.citations ?? []).map(mapCitation),
  edited: item.edited ?? false,
  supplementReason: item.supplement_reason ?? "",
});

export function mapSpec(spec: BackendSpec): RequirementSpec {
  return {
    catalogsUnlisted: spec.catalogs_unlisted ?? [],
    choices: (spec.choices ?? []).map((choice) => ({
      citations: (choice.citations ?? []).map(mapCitation),
      decision: choice.decision
        ? {
            basis: choice.decision.basis,
            byId: choice.decision.by.id,
            optionId: choice.decision.option_id,
            time: choice.decision.time,
          }
        : null,
      id: choice.id,
      options: choice.options ?? [],
      question: choice.question,
      reason: choice.reason,
      recommendedOptionId: choice.recommended_option_id,
    })),
    concepts: (spec.concepts ?? []).map((concept) => ({
      ...cited(concept),
      category: concept.category,
      definition: concept.definition,
      id: concept.id,
      mapsTo: concept.maps_to ? { id: concept.maps_to.id, kind: concept.maps_to.kind } : null,
      notOntologyReason: concept.not_ontology_reason ?? "",
      term: concept.term,
    })),
    conflicts: (spec.conflicts ?? []).map((conflict) => ({
      deferred: conflict.deferred,
      id: conflict.id,
      kind: conflict.kind,
      resolution: conflict.resolution
        ? {
            byId: conflict.resolution.by.id,
            documentId: conflict.resolution.document_id ?? "",
            reason: conflict.resolution.reason,
            text: conflict.resolution.text ?? "",
            time: conflict.resolution.time,
          }
        : null,
      sides: (conflict.sides ?? []).map((side) => ({
        ...mapCitation(side),
        position: side.position,
      })),
      suggestedDocumentId: conflict.suggested_document_id ?? "",
      topic: conflict.topic,
    })),
    questions: (spec.questions ?? []).map((question) => ({
      ...cited(question),
      answerShape: question.answer_shape,
      id: question.id,
      layer: question.layer,
      needs: (question.needs ?? []).map(({ id, kind }) => ({ id, kind })),
      needsSource: question.needs_source,
      scenarioIds: question.scenario_ids ?? [],
      template: question.template,
      text: question.text,
      type: question.type,
    })),
    rejected: spec.rejected ?? [],
    rules: (spec.rules ?? []).map((rule) => ({
      citations: (rule.citations ?? []).map(mapCitation),
      compilesTo: rule.compiles_to,
      edited: rule.edited ?? false,
      id: rule.id,
      statement: rule.statement,
    })),
    scenarios: (spec.scenarios ?? []).map((scenario) => ({
      ...cited(scenario),
      actor: scenario.actor,
      capabilities: (scenario.capabilities ?? []).map((capability) => ({
        definition: capability.definition ?? "",
        kind: capability.kind,
        name: capability.name,
      })),
      decision: scenario.decision,
      id: scenario.id,
      knowledge: scenario.knowledge ?? [],
      name: scenario.name,
      trigger: scenario.trigger,
    })),
    tablesOmitted: spec.tables_omitted ?? 0,
  };
}

export const mapRequirements = (requirements: BackendRequirements): Requirements => ({
  error: requirements.error ?? "",
  spec: mapSpec(requirements.spec ?? {}),
  stale: requirements.stale ?? false,
  status: requirements.status,
  undecidedChoices: requirements.undecided_choices ?? 0,
  unresolvedConflicts: requirements.unresolved_conflicts ?? 0,
  updateTime: requirements.update_time,
  version: requirements.version,
});

/* ------------------------------------ API ------------------------------------ */

/** The project's requirement documents, oldest first, without their content. */
export async function listDocuments(projectId: string): Promise<RequirementDocument[]> {
  if (useMock) {
    return wait(
      mockDocuments.map((document) => ({
        createTime: document.createTime,
        docType: document.docType,
        format: document.format,
        id: document.id,
        name: document.name,
        size: document.size,
        uploaderId: document.uploaderId,
      })),
    );
  }
  const response = await http.get<{ entries: BackendDocument[] | null }>(
    `${requirementsPath(projectId)}/documents`,
    { skipErrorToast: true },
  );
  return (response.data.entries ?? []).map(mapDocument);
}

/** One document with its content and blocks. */
export async function getDocument(
  projectId: string,
  documentId: string,
): Promise<RequirementDocumentContent> {
  if (useMock) {
    const found = mockDocuments.find((document) => document.id === documentId);
    if (!found) {
      throw refused(404, "Requirement.DocumentNotFound");
    }
    return wait(found);
  }
  const response = await http.get<BackendDocument>(
    `${requirementsPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
    { skipErrorToast: true },
  );
  return {
    ...mapDocument(response.data),
    blocks: (response.data.blocks ?? []).map((block) => ({
      end: block.end,
      heading: block.heading ?? "",
      id: block.id,
      start: block.start,
    })),
    content: response.data.content ?? "",
  };
}

/** Uploads documents; each file says how it went. */
export async function uploadDocuments(projectId: string, files: File[]): Promise<UploadResult[]> {
  if (useMock) {
    return wait(await mockUpload(files));
  }
  const form = new FormData();
  files.forEach((file) => form.append("files", file, file.name));
  const response = await http.post<{
    results: { code?: string; document_id?: string; name: string; outcome: string }[] | null;
  }>(`${requirementsPath(projectId)}/documents`, form, { skipErrorToast: true, timeout: 120_000 });
  return (response.data.results ?? []).map((result) => ({
    code: result.code ?? "",
    documentId: result.document_id ?? "",
    name: result.name,
    outcome: result.outcome,
  }));
}

/** Sets a document's type, which decides its authority in conflicts. */
export async function setDocumentType(
  projectId: string,
  documentId: string,
  docType: string,
): Promise<void> {
  if (useMock) {
    const found = mockDocuments.find((document) => document.id === documentId);
    if (found) {
      found.docType = docType;
    }
    await wait(null);
    return;
  }
  await http.patch(
    `${requirementsPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
    { doc_type: docType },
    { skipErrorToast: true },
  );
}

export async function deleteDocument(projectId: string, documentId: string): Promise<void> {
  if (useMock) {
    mockDocuments = mockDocuments.filter((document) => document.id !== documentId);
    await wait(null);
    return;
  }
  await http.delete(`${requirementsPath(projectId)}/documents/${encodeURIComponent(documentId)}`, {
    skipErrorToast: true,
  });
}

/** The specification, or null before the first drafting. */
export async function getRequirements(projectId: string): Promise<Requirements | null> {
  if (useMock) {
    return wait(mockRequirementsNow());
  }
  try {
    const response = await http.get<BackendRequirements>(requirementsPath(projectId), {
      skipErrorToast: true,
    });
    return mapRequirements(response.data);
  } catch (error) {
    // Requirement.NotFound before the first drafting.
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Drafts the specification from the documents in the background. `discardDecisions` agrees to
 * drop the conflict resolutions and choices made.
 */
export async function draftRequirements(
  projectId: string,
  discardDecisions = false,
): Promise<Requirements> {
  if (useMock) {
    mockDraftStart = Date.now();
    mockVersion += 1;
    return wait(mockRequirementsNow()!);
  }
  const response = await http.post<BackendRequirements>(
    `${requirementsPath(projectId)}:draft`,
    discardDecisions ? { discard_decisions: true } : undefined,
    { skipErrorToast: true },
  );
  return mapRequirements(response.data);
}

/* ----------------------------- Mock (local development) ----------------------------- */

const wait = async <T>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

const refused = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

const mockUploader = defaultDevRuntimeUser.id ?? "mock-user";
const PRD = "## Delivery delay warning\n\nSales needs to know which orders of a customer are late.";
const POLICY = "## Orders\n\nAn order is late when it ships after its promised date.";

let mockDocuments: RequirementDocumentContent[] = [
  {
    blocks: [
      { end: 26, heading: "Delivery delay warning", id: "b1", start: 0 },
      { end: PRD.length, heading: "", id: "b2", start: 28 },
    ],
    content: PRD,
    createTime: Date.parse("2026-10-25T09:00:00Z"),
    docType: "prd",
    format: "markdown",
    id: "d1",
    name: "delivery-prd.md",
    size: PRD.length,
    uploaderId: mockUploader,
  },
  {
    blocks: [
      { end: 9, heading: "Orders", id: "b1", start: 0 },
      { end: POLICY.length, heading: "", id: "b2", start: 11 },
    ],
    content: POLICY,
    createTime: Date.parse("2026-10-25T09:01:00Z"),
    docType: "policy",
    format: "markdown",
    id: "d2",
    name: "order-policy.md",
    size: POLICY.length,
    uploaderId: mockUploader,
  },
];

let mockDraftStart = Date.parse("2026-10-25T09:05:00Z");
let mockVersion = 1;
const MOCK_DRAFT_MS = 3000;

const quote = (documentId: string, text: string): RequirementCitation => {
  const document = mockDocuments.find((entry) => entry.id === documentId);
  const start = document?.content.indexOf(text) ?? -1;
  return {
    blockId: "b2",
    documentId,
    end: start < 0 ? 0 : start + text.length,
    quote: text,
    start: Math.max(start, 0),
  };
};

const mockSpec = (): RequirementSpec => ({
  catalogsUnlisted: [],
  choices: [
    {
      citations: [],
      decision: null,
      id: "f1",
      options: [
        {
          consequence: "One object type with a type property.",
          id: "o1",
          label: "One customer type",
        },
        { consequence: "An object type per customer kind.", id: "o2", label: "Split by kind" },
      ],
      question: "Should customers be modelled by kind?",
      reason: "The documents treat every customer the same.",
      recommendedOptionId: "o1",
    },
  ],
  concepts: [
    {
      category: "object",
      citations: [quote("d1", "which orders of a customer are late")],
      definition: "A sales order a customer placed.",
      edited: false,
      id: "c1",
      mapsTo: { id: "sales_orders", kind: "object_type" },
      notOntologyReason: "",
      supplementReason: "",
      term: "Order",
    },
    {
      category: "not_ontology",
      citations: [],
      definition: "How late an order is.",
      edited: false,
      id: "c2",
      mapsTo: null,
      notOntologyReason: "It is computed from the dates of an order.",
      supplementReason: "Needed to rank late orders.",
      term: "Delay",
    },
  ],
  conflicts: [
    {
      deferred: false,
      id: "k1",
      kind: "rule",
      resolution: null,
      sides: [
        { ...quote("d1", "which orders of a customer are late"), position: "Late by customer" },
        { ...quote("d2", "ships after its promised date"), position: "Late by promised date" },
      ],
      suggestedDocumentId: "d2",
      topic: "When an order is late",
    },
  ],
  questions: [
    {
      answerShape: "A list of orders",
      citations: [quote("d1", "which orders of a customer are late")],
      edited: false,
      id: "q1",
      layer: "knowledge",
      needs: [
        { id: "sales_orders", kind: "object_type" },
        { id: "customers", kind: "object_type" },
      ],
      needsSource: "concepts",
      scenarioIds: ["s1"],
      supplementReason: "",
      template: "Which orders of customer {customer} are late?",
      text: "Which orders of a customer are late?",
      type: "filter",
    },
  ],
  rejected: [{ kind: "rule", reason: "quote_not_found", text: "Orders ship in two days." }],
  rules: [
    {
      citations: [quote("d2", "ships after its promised date")],
      compilesTo: "constraint",
      edited: false,
      id: "r1",
      statement: "An order is late when it ships after its promised date.",
    },
  ],
  scenarios: [
    {
      actor: "Sales manager",
      capabilities: [{ definition: "", kind: "metric", name: "Late order rate" }],
      citations: [quote("d1", "which orders of a customer are late")],
      decision: "Whom to call first",
      edited: false,
      id: "s1",
      knowledge: ["Orders and their promised dates"],
      name: "Delivery delay warning",
      supplementReason: "",
      trigger: "Every morning",
    },
  ],
  tablesOmitted: 0,
});

function mockRequirementsNow(): Requirements | null {
  const drafting = Date.now() - mockDraftStart < MOCK_DRAFT_MS;
  return {
    error: "",
    spec: drafting ? mapSpec({}) : mockSpec(),
    stale: false,
    status: drafting ? "drafting" : "ready",
    undecidedChoices: drafting ? 0 : 1,
    unresolvedConflicts: drafting ? 0 : 1,
    updateTime: mockDraftStart,
    version: mockVersion,
  };
}

async function mockUpload(files: File[]): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const file of files) {
    if (!DOCUMENT_LIMITS.extensions.some((extension) => file.name.endsWith(extension))) {
      results.push({
        code: "Requirement.UnsupportedFormat",
        documentId: "",
        name: file.name,
        outcome: "rejected",
      });
      continue;
    }
    const content = await file.text();
    const same = mockDocuments.find((document) => document.content === content);
    if (same) {
      results.push({ code: "", documentId: same.id, name: file.name, outcome: "duplicate" });
      continue;
    }
    const id = `d${mockDocuments.length + 1}`;
    mockDocuments.push({
      blocks: [{ end: content.length, heading: "", id: "b1", start: 0 }],
      content,
      createTime: Date.now(),
      docType: "other",
      format: file.name.endsWith(".txt") ? "text" : "markdown",
      id,
      name: file.name,
      size: file.size,
      uploaderId: mockUploader,
    });
    results.push({ code: "", documentId: id, name: file.name, outcome: "created" });
  }
  return results;
}
