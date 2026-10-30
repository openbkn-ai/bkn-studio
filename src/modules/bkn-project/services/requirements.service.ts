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
  QuestionDev,
  QuestionInput,
  RequirementCitation,
  RequirementItemKind,
  RequirementItemRef,
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
        inputs?:
          | { concept_id: string; name: string; property?: string; role: string }[]
          | null;
        layer: string;
        needs?: { id: string; kind: string }[] | null;
        needs_source: string;
        notes?: string[] | null;
        relative_window?: boolean;
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
      // Absent means nothing is said about inputs; an empty list means none.
      inputs: question.inputs
        ? question.inputs.map((input) => ({
            conceptId: input.concept_id,
            name: input.name,
            property: input.property ?? "",
            role: input.role,
          }))
        : null,
      layer: question.layer,
      needs: (question.needs ?? []).map(({ id, kind }) => ({ id, kind })),
      needsSource: question.needs_source,
      notes: question.notes ?? [],
      relativeWindow: question.relative_window ?? false,
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

/* --------------------------- Test questions and guidance --------------------------- */

/** How often guidance being generated is read again. */
export const GUIDANCE_POLL_MS = 5000;

type BackendDev = {
  current?: boolean;
  deleted_tests?: number;
  error?: string;
  guidance?: string;
  left_out_tests?: number;
  no_tests_reason?: string;
  ontology_changed?: boolean | null;
  out_of_scope?: string[] | null;
  status: string;
  tests_note?: string;
  tests?:
    | {
        by_server?: boolean;
        check?: { outcome: string; reason?: string } | null;
        edited?: boolean;
        expect: string;
        id: string;
        kind?: string;
        text: string;
      }[]
    | null;
  update_time: number;
};

export const mapDev = (dev: BackendDev): QuestionDev => ({
  current: dev.current ?? true,
  deletedTests: dev.deleted_tests ?? 0,
  error: dev.error ?? "",
  guidance: dev.guidance ?? "",
  leftOutTests: dev.left_out_tests ?? 0,
  noTestsReason: dev.no_tests_reason ?? "",
  ontologyChanged: dev.ontology_changed ?? null,
  outOfScope: dev.out_of_scope ?? [],
  status: dev.status,
  tests: (dev.tests ?? []).map((test) => ({
    byServer: test.by_server ?? false,
    check: { outcome: test.check?.outcome ?? "not_checked", reason: test.check?.reason ?? "" },
    edited: test.edited ?? false,
    expect: test.expect,
    id: test.id,
    kind: test.kind ?? "",
    text: test.text,
  })),
  testsNote: dev.tests_note ?? "",
  updateTime: dev.update_time,
});

const devPath = (projectId: string, questionId: string) =>
  `${requirementsPath(projectId)}/questions/${encodeURIComponent(questionId)}`;

/** A question's test questions and guidance, or null before they were first generated. */
export async function getQuestionDev(
  projectId: string,
  questionId: string,
): Promise<QuestionDev | null> {
  if (useMock) {
    return wait(mockDevNow(questionId));
  }
  try {
    const response = await http.get<BackendDev>(`${devPath(projectId, questionId)}/dev`, {
      skipErrorToast: true,
    });
    return mapDev(response.data);
  } catch (error) {
    // Requirement.TestNotFound before the first generation.
    if (isRequestNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Generates the question's test questions and guidance again, in the background. */
export async function generateQuestionDev(
  projectId: string,
  questionId: string,
): Promise<QuestionDev> {
  if (useMock) {
    mockDevStarts[questionId] = Date.now();
    return wait(mockDevNow(questionId)!);
  }
  const response = await http.post<BackendDev>(
    `${devPath(projectId, questionId)}/dev:generate`,
    undefined,
    { skipErrorToast: true },
  );
  return mapDev(response.data);
}

/** Changes a test question's text or what it expects; it is checked against the data again. */
export async function editTest(
  projectId: string,
  questionId: string,
  testId: string,
  change: { expect?: string; text?: string },
  updateTime: number,
): Promise<QuestionDev> {
  if (useMock) {
    const dev = mockDevNow(questionId);
    const test = dev?.tests.find((entry) => entry.id === testId);
    if (test) {
      mockDevEdits[`${questionId}/${testId}`] = { ...change, edited: true };
    }
    return wait(mockDevNow(questionId)!);
  }
  const response = await http.put<BackendDev>(
    `${devPath(projectId, questionId)}/tests/${encodeURIComponent(testId)}`,
    { ...change, update_time: updateTime },
    { skipErrorToast: true },
  );
  return mapDev(response.data);
}

export async function deleteTest(
  projectId: string,
  questionId: string,
  testId: string,
  updateTime: number,
): Promise<QuestionDev> {
  if (useMock) {
    mockDevEdits[`${questionId}/${testId}`] = { deleted: true };
    return wait(mockDevNow(questionId)!);
  }
  const response = await http.delete<BackendDev>(
    `${devPath(projectId, questionId)}/tests/${encodeURIComponent(testId)}`,
    { params: { update_time: updateTime }, skipErrorToast: true },
  );
  return mapDev(response.data);
}

/** What a person sets on an item: only the fields of its kind. */
export type RequirementItemFields = {
  actor?: string;
  answerShape?: string;
  category?: string;
  decision?: string;
  definition?: string;
  /** Gives a question's needs back to its concepts. */
  followConcepts?: boolean;
  /** A question's inputs; an empty list says it is asked about no given value. */
  inputs?: QuestionInput[];
  knowledge?: string[];
  layer?: string;
  name?: string;
  needs?: RequirementItemRef[];
  relativeWindow?: boolean;
  scenarioIds?: string[];
  statement?: string;
  template?: string;
  term?: string;
  text?: string;
  trigger?: string;
};

const itemBody = (fields: RequirementItemFields) => ({
  ...(fields.actor === undefined ? {} : { actor: fields.actor }),
  ...(fields.answerShape === undefined ? {} : { answer_shape: fields.answerShape }),
  ...(fields.category === undefined ? {} : { category: fields.category }),
  ...(fields.decision === undefined ? {} : { decision: fields.decision }),
  ...(fields.definition === undefined ? {} : { definition: fields.definition }),
  ...(fields.followConcepts ? { follow_concepts: true } : {}),
  ...(fields.inputs === undefined
    ? {}
    : {
        inputs: fields.inputs.map((input) => ({
          concept_id: input.conceptId,
          name: input.name,
          property: input.property,
          role: input.role,
        })),
      }),
  ...(fields.knowledge === undefined ? {} : { knowledge: fields.knowledge }),
  ...(fields.layer === undefined ? {} : { layer: fields.layer }),
  ...(fields.name === undefined ? {} : { name: fields.name }),
  ...(fields.needs === undefined ? {} : { needs: fields.needs }),
  ...(fields.relativeWindow === undefined ? {} : { relative_window: fields.relativeWindow }),
  ...(fields.scenarioIds === undefined ? {} : { scenario_ids: fields.scenarioIds }),
  ...(fields.statement === undefined ? {} : { statement: fields.statement }),
  ...(fields.template === undefined ? {} : { template: fields.template }),
  ...(fields.term === undefined ? {} : { term: fields.term }),
  ...(fields.text === undefined ? {} : { text: fields.text }),
  ...(fields.trigger === undefined ? {} : { trigger: fields.trigger }),
});

const sendEdit = async (
  method: "delete" | "patch" | "post" | "put",
  path: string,
  body: Record<string, unknown> | undefined,
  params?: Record<string, number>,
) => {
  const response =
    method === "delete"
      ? await http.delete<BackendRequirements>(path, { params, skipErrorToast: true })
      : await http[method]<BackendRequirements>(path, body, { skipErrorToast: true });
  return mapRequirements(response.data);
};

/** Adds an item a person writes. Every edit sends the update time read and replies the spec. */
export async function addItem(
  projectId: string,
  kind: RequirementItemKind,
  fields: RequirementItemFields,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(mockEdit(updateTime, (spec) => mockAdd(spec, kind, fields)));
  }
  return sendEdit("post", `${requirementsPath(projectId)}/items/${kind}`, {
    ...itemBody(fields),
    update_time: updateTime,
  });
}

export async function editItem(
  projectId: string,
  kind: RequirementItemKind,
  itemId: string,
  fields: RequirementItemFields,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(mockEdit(updateTime, (spec) => mockChange(spec, kind, itemId, fields)));
  }
  return sendEdit(
    "patch",
    `${requirementsPath(projectId)}/items/${kind}/${encodeURIComponent(itemId)}`,
    { ...itemBody(fields), update_time: updateTime },
  );
}

export async function removeItem(
  projectId: string,
  kind: RequirementItemKind,
  itemId: string,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(
      mockEdit(updateTime, (spec) => {
        const list = spec[kind] as { id: string }[];
        list.splice(
          list.findIndex((item) => item.id === itemId),
          1,
        );
      }),
    );
  }
  return sendEdit(
    "delete",
    `${requirementsPath(projectId)}/items/${kind}/${encodeURIComponent(itemId)}`,
    undefined,
    { update_time: updateTime },
  );
}

/** Sets the drafted item a concept is, or clears it with null. */
export async function setConceptMapping(
  projectId: string,
  conceptId: string,
  mapsTo: RequirementItemRef | null,
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(
      mockEdit(updateTime, (spec) => {
        const concept = spec.concepts.find((item) => item.id === conceptId);
        if (concept) {
          concept.mapsTo = mapsTo;
        }
      }),
    );
  }
  return sendEdit(
    "put",
    `${requirementsPath(projectId)}/concepts/${encodeURIComponent(conceptId)}/maps-to`,
    { maps_to: mapsTo, update_time: updateTime },
  );
}

/**
 * Rules on a conflict: by one side (`documentId`) or a conclusion of its own (`text`), with a
 * reason; or hands it to the business (`deferred`), which keeps it unresolved.
 */
export async function resolveConflict(
  projectId: string,
  conflictId: string,
  ruling: { deferred: boolean; documentId: string; reason: string; text: string },
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(
      mockEdit(updateTime, (spec) => {
        const conflict = spec.conflicts.find((item) => item.id === conflictId);
        if (conflict) {
          conflict.deferred = ruling.deferred;
          conflict.resolution = ruling.deferred
            ? null
            : {
                byId: mockUploader,
                documentId: ruling.documentId,
                reason: ruling.reason,
                text: ruling.text,
                time: Date.now(),
              };
        }
      }),
    );
  }
  return sendEdit(
    "put",
    `${requirementsPath(projectId)}/conflicts/${encodeURIComponent(conflictId)}`,
    {
      deferred: ruling.deferred,
      document_id: ruling.documentId,
      reason: ruling.reason,
      text: ruling.text,
      update_time: updateTime,
    },
  );
}

/** Decides a modelling choice by one of its options. */
export async function decideChoice(
  projectId: string,
  choiceId: string,
  decision: { basis: string; optionId: string },
  updateTime: number,
): Promise<Requirements> {
  if (useMock) {
    return wait(
      mockEdit(updateTime, (spec) => {
        const choice = spec.choices.find((item) => item.id === choiceId);
        if (choice) {
          choice.decision = { ...decision, byId: mockUploader, time: Date.now() };
        }
      }),
    );
  }
  return sendEdit("put", `${requirementsPath(projectId)}/choices/${encodeURIComponent(choiceId)}`, {
    basis: decision.basis,
    option_id: decision.optionId,
    update_time: updateTime,
  });
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
    {
      category: "object",
      citations: [],
      definition: "A company that buys from us.",
      edited: false,
      id: "c3",
      mapsTo: { id: "customers", kind: "object_type" },
      notOntologyReason: "",
      supplementReason: "",
      term: "Customer",
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
      inputs: [{ conceptId: "c3", name: "customer", property: "customer_id", role: "record" }],
      needsSource: "concepts",
      notes: [],
      relativeWindow: false,
      scenarioIds: ["s1"],
      supplementReason: "",
      template: "Which orders of customer {customer} are late?",
      text: "Which orders of a customer are late?",
      type: "filter",
    },
    {
      answerShape: "A count of orders",
      citations: [],
      edited: false,
      id: "q2",
      inputs: [
        { conceptId: "c3", name: "customer", property: "customer_id", role: "record" },
        { conceptId: "c1", name: "as_of", property: "signed_at", role: "reference_time" },
      ],
      layer: "knowledge",
      needs: [{ id: "sales_orders", kind: "object_type" }],
      needsSource: "concepts",
      notes: [],
      relativeWindow: true,
      scenarioIds: ["s1"],
      supplementReason: "Asked by the sales team in the kick-off meeting.",
      template: "How many orders did customer {customer} sign in the 30 days up to {as_of}?",
      text:
        "How many orders did a customer sign in the last thirty days before a given date, counting only orders that were not cancelled and whose delivery was promised within the same quarter?",
      type: "count",
    },
    {
      answerShape: "The late-order rate",
      citations: [],
      edited: false,
      id: "q3",
      inputs: [],
      layer: "capability",
      needs: [],
      needsSource: "concepts",
      notes: ["capability_without_basis"],
      relativeWindow: false,
      scenarioIds: [],
      supplementReason: "",
      template: "What share of orders is late?",
      text: "What share of orders is late?",
      type: "metric",
    },
    {
      answerShape: "Orders",
      citations: [],
      edited: false,
      id: "q4",
      // Drafted before questions had inputs: nothing is said about them.
      inputs: null,
      layer: "knowledge",
      needs: [{ id: "sales_orders", kind: "object_type" }],
      needsSource: "person",
      notes: [],
      relativeWindow: false,
      scenarioIds: [],
      supplementReason: "",
      template: "",
      text: "Which orders shipped late last week?",
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

/** The mock's specification as people edited it since it was drafted. */
let mockCurrent: { draftStart: number; spec: RequirementSpec; updateTime: number } | null = null;

function mockRequirementsNow(): Requirements | null {
  const drafting = Date.now() - mockDraftStart < MOCK_DRAFT_MS;
  if (drafting) {
    return {
      error: "",
      spec: mapSpec({}),
      stale: false,
      status: "drafting",
      undecidedChoices: 0,
      unresolvedConflicts: 0,
      updateTime: mockDraftStart,
      version: mockVersion,
    };
  }
  if (mockCurrent?.draftStart !== mockDraftStart) {
    mockCurrent = { draftStart: mockDraftStart, spec: mockSpec(), updateTime: mockDraftStart };
  }
  const { spec, updateTime } = mockCurrent;
  return {
    error: "",
    spec: structuredClone(spec),
    stale: false,
    status: "ready",
    undecidedChoices: spec.choices.filter((choice) => !choice.decision).length,
    unresolvedConflicts: spec.conflicts.filter((conflict) => !conflict.resolution).length,
    updateTime,
    version: mockVersion,
  };
}

/** Applies an edit to the mock's specification read at `updateTime`, as bkn-project would. */
function mockEdit(updateTime: number, apply: (spec: RequirementSpec) => void): Requirements {
  const now = mockRequirementsNow();
  if (!now || now.status !== "ready" || !mockCurrent) {
    throw refused(409, "Requirement.Drafting");
  }
  if (updateTime !== mockCurrent.updateTime) {
    throw refused(409, "Requirement.Stale");
  }
  apply(mockCurrent.spec);
  mockCurrent.updateTime = Date.now();
  return mockRequirementsNow()!;
}

const nextId = (prefix: string, items: { id: string }[]) =>
  `${prefix}${Math.max(0, ...items.map((item) => Number(item.id.slice(1)) || 0)) + 1}`;

function mockAdd(spec: RequirementSpec, kind: RequirementItemKind, fields: RequirementItemFields) {
  const base = { citations: [], edited: true, supplementReason: "" };
  if (kind === "scenarios") {
    spec.scenarios.push({
      ...base,
      actor: fields.actor ?? "",
      capabilities: [],
      decision: fields.decision ?? "",
      id: nextId("s", spec.scenarios),
      knowledge: fields.knowledge ?? [],
      name: fields.name ?? "",
      trigger: fields.trigger ?? "",
    });
  } else if (kind === "concepts") {
    spec.concepts.push({
      ...base,
      category: fields.category ?? "object",
      definition: fields.definition ?? "",
      id: nextId("c", spec.concepts),
      mapsTo: null,
      notOntologyReason: "",
      term: fields.term ?? "",
    });
  } else if (kind === "questions") {
    spec.questions.push({
      ...base,
      answerShape: fields.answerShape ?? "",
      id: nextId("q", spec.questions),
      inputs: fields.inputs ?? null,
      layer: fields.layer ?? "knowledge",
      needs: fields.needs ?? [],
      needsSource: fields.needs ? "person" : "concepts",
      notes: [],
      relativeWindow: fields.relativeWindow ?? false,
      scenarioIds: fields.scenarioIds ?? [],
      template: fields.template ?? "",
      text: fields.text ?? "",
      type: "",
    });
  } else {
    spec.rules.push({
      citations: [],
      compilesTo: "other",
      edited: true,
      id: nextId("r", spec.rules),
      statement: fields.statement ?? "",
    });
  }
}

function mockChange(
  spec: RequirementSpec,
  kind: RequirementItemKind,
  itemId: string,
  fields: RequirementItemFields,
) {
  const item = (spec[kind] as { id: string }[]).find((entry) => entry.id === itemId);
  if (!item) {
    throw refused(404, "Requirement.ItemNotFound");
  }
  const { followConcepts, ...rest } = fields;
  Object.assign(item, rest, { edited: true });
  if (kind === "questions" && (fields.needs || followConcepts)) {
    Object.assign(item, { needsSource: followConcepts ? "concepts" : "person" });
  }
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

/** When the mock's guidance was generated, by question; none for a question never generated. */
const mockDevStarts: Record<string, number> = { q1: Date.parse("2026-10-25T09:10:00Z") };
const mockDevEdits: Record<
  string,
  { deleted?: boolean; edited?: boolean; expect?: string; text?: string }
> = {};
const MOCK_GENERATE_MS = 3000;

function mockDevNow(questionId: string): QuestionDev | null {
  const start = mockDevStarts[questionId];
  if (start === undefined) {
    return null;
  }
  const generating = Date.now() - start < MOCK_GENERATE_MS;
  const tests = [
    {
      byServer: true,
      check: { outcome: "passed", reason: "" },
      edited: false,
      expect: "exists",
      id: "t1",
      kind: "template",
      text: "Which orders of customer C-001 are late?",
    },
    {
      byServer: true,
      check: { outcome: "passed", reason: "" },
      edited: false,
      expect: "not_exists",
      id: "t2",
      kind: "not_exist",
      text: "Which orders of customer C-999 are late?",
    },
    {
      byServer: false,
      check: { outcome: "failed", reason: "different_records" },
      edited: false,
      expect: "same_record",
      id: "t3",
      kind: "variant",
      text: "Which orders of the customer named Northwind are late?",
    },
  ]
    .filter((test) => !mockDevEdits[`${questionId}/${test.id}`]?.deleted)
    .map((test) => {
      const found = mockDevEdits[`${questionId}/${test.id}`];
      const edit = found
        ? {
            ...(found.edited ? { edited: true } : {}),
            ...(found.expect ? { expect: found.expect } : {}),
            ...(found.text ? { text: found.text } : {}),
          }
        : {};
      return {
        ...test,
        ...edit,
        ...(edit.edited ? { check: { outcome: "passed", reason: "" } } : {}),
      };
    });
  return {
    current: true,
    deletedTests: Object.keys(mockDevEdits).filter(
      (key) => key.startsWith(`${questionId}/`) && mockDevEdits[key].deleted,
    ).length,
    error: "",
    guidance: generating ? "" : "Find the customer by **customer code**, then its sales orders.",
    leftOutTests: 1,
    noTestsReason: "",
    ontologyChanged: false,
    outOfScope: generating ? [] : ["How late are the orders on average? It needs a metric."],
    status: generating ? "generating" : "ready",
    tests: generating ? [] : tests,
    testsNote: "",
    updateTime: start + Object.keys(mockDevEdits).length,
  };
}
