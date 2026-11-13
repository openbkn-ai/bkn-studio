/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";

import { http } from "@/framework/request/http";
import { defaultDevRuntimeUser } from "@/framework/runtime/dev-profile";
import {
  type BackendRequirements,
  mapRequirements,
} from "@/modules/bkn-project/services/requirements.service";
import type {
  AskConversation,
  AskItemKind,
  AskPage,
  AskPerson,
  AskRef,
  AskTurn,
  Proposal,
  ProposalItem,
  ProposalOp,
  Supplement,
} from "@/modules/bkn-project/types/conversations";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const requirementsPath = (projectId: string) =>
  `/bkn-project/v1/projects/${encodeURIComponent(projectId)}/requirements`;
const conversationsPath = (projectId: string) => `${requirementsPath(projectId)}/conversations`;

/** How often a conversation waiting for its answer is read again. */
export const ASK_POLL_MS = 2000;

/** The most characters the supplement note takes. */
export const SUPPLEMENT_MAX = 2000;

/** The most list items one question may refer to. */
export const ASK_MAX_REFS = 20;

/* ------------------------------- Backend shapes ------------------------------- */

type BackendPerson = { id?: string; name?: string } | null | undefined;

type BackendItem = {
  actor?: string;
  decision?: string;
  definition?: string;
  knowledge?: string[] | null;
  logic_kind?: string;
  logic_need_ids?: string[] | null;
  name?: string;
  object_type_ids?: string[] | null;
  scenario_ids?: string[] | null;
  statement?: string;
  text?: string;
  trigger?: string;
};

type BackendProposal = {
  before?: BackendItem | null;
  into_before?: BackendItem | null;
  into_id?: string;
  item?: BackendItem | null;
  kind: string;
  network_item?: { kind?: string; name?: string; type?: string } | null;
  op: string;
  parts?: BackendItem[] | null;
  reason?: string;
  result_id?: string;
  status?: string;
  target_id?: string;
};

type BackendTurn = {
  answer?: string;
  create_time?: number;
  dropped?: number;
  error?: string;
  id: string;
  proposals?: BackendProposal[] | null;
  question: string;
  refs?: { id: string; kind: string; name?: string }[] | null;
  status: string;
};

export type BackendConversation = {
  create_time?: number;
  id: string;
  page: string;
  title?: string;
  turns?: BackendTurn[] | null;
  update_time?: number;
};

type BackendSupplement = { by?: BackendPerson; text?: string; time?: number };

/* ----------------------------------- Mapping ----------------------------------- */

const mapPerson = (person: BackendPerson): AskPerson | null =>
  person?.id ? { id: person.id, name: person.name ?? "" } : null;

/** An item as a proposal gives it; fields it leaves out stay out. */
export function mapProposalItem(item: BackendItem): ProposalItem {
  const mapped: ProposalItem = {};
  if (item.actor !== undefined) mapped.actor = item.actor;
  if (item.decision !== undefined) mapped.decision = item.decision;
  if (item.definition !== undefined) mapped.definition = item.definition;
  if (item.knowledge) mapped.knowledge = item.knowledge;
  if (item.logic_kind !== undefined) mapped.logicKind = item.logic_kind;
  if (item.logic_need_ids) mapped.logicNeedIds = item.logic_need_ids;
  if (item.name !== undefined) mapped.name = item.name;
  if (item.object_type_ids) mapped.objectTypeIds = item.object_type_ids;
  if (item.scenario_ids) mapped.scenarioIds = item.scenario_ids;
  if (item.statement !== undefined) mapped.statement = item.statement;
  if (item.text !== undefined) mapped.text = item.text;
  if (item.trigger !== undefined) mapped.trigger = item.trigger;
  return mapped;
}

const OPS: readonly string[] = ["add", "delete", "link", "merge", "modify", "split"];
const KINDS: readonly string[] = ["logic_needs", "questions", "rules", "scenarios"];

const mapProposal = (proposal: BackendProposal): Proposal => ({
  before: proposal.before ? mapProposalItem(proposal.before) : null,
  intoBefore: proposal.into_before ? mapProposalItem(proposal.into_before) : null,
  intoId: proposal.into_id ?? "",
  item: proposal.item ? mapProposalItem(proposal.item) : null,
  kind: (KINDS.includes(proposal.kind) ? proposal.kind : "logic_needs") as AskItemKind,
  networkItem: proposal.network_item
    ? {
        kind: proposal.network_item.kind ?? "",
        name: proposal.network_item.name ?? "",
        type: proposal.network_item.type ?? "",
      }
    : null,
  op: (OPS.includes(proposal.op) ? proposal.op : "modify") as ProposalOp,
  parts: (proposal.parts ?? []).map(mapProposalItem),
  reason: proposal.reason ?? "",
  resultId: proposal.result_id ?? "",
  status: proposal.status === "adopted" || proposal.status === "declined" ? proposal.status : "",
  targetId: proposal.target_id ?? "",
});

const mapTurn = (turn: BackendTurn): AskTurn => ({
  answer: turn.answer ?? "",
  createTime: turn.create_time ?? 0,
  dropped: turn.dropped ?? 0,
  error: turn.error ?? "",
  id: turn.id,
  proposals: (turn.proposals ?? []).map(mapProposal),
  question: turn.question,
  refs: (turn.refs ?? []).map((ref) => ({
    id: ref.id,
    kind: ref.kind as AskItemKind,
    name: ref.name ?? "",
  })),
  status: turn.status === "pending" || turn.status === "failed" ? turn.status : "ready",
});

export const mapConversation = (conversation: BackendConversation): AskConversation => ({
  createTime: conversation.create_time ?? 0,
  id: conversation.id,
  page: conversation.page === "scenarios" ? "scenarios" : "kinetic",
  title: conversation.title ?? "",
  turns: (conversation.turns ?? []).map(mapTurn),
  updateTime: conversation.update_time ?? 0,
});

const mapSupplement = (supplement: BackendSupplement): Supplement => ({
  by: mapPerson(supplement.by),
  text: supplement.text ?? "",
  time: supplement.time ?? 0,
});

const refsBody = (refs: AskRef[]) => refs.map(({ id, kind }) => ({ id, kind }));

/* ------------------------------------ API ------------------------------------ */

/** The project's supplement note; empty text when none was written. */
export async function getSupplement(projectId: string): Promise<Supplement> {
  if (useMock) {
    return wait({ ...mockSupplement });
  }
  const response = await http.get<BackendSupplement>(`${requirementsPath(projectId)}/supplement`, {
    skipErrorToast: true,
  });
  return mapSupplement(response.data);
}

/** Writes the supplement note; empty text clears it. */
export async function saveSupplement(projectId: string, text: string): Promise<Supplement> {
  if (useMock) {
    if ([...text].length > SUPPLEMENT_MAX) {
      throw refused(400, "Requirement.InvalidSupplement");
    }
    mockSupplement = {
      by: text ? { id: mockUser, name: mockUser } : null,
      text,
      time: text ? Date.now() : 0,
    };
    return wait({ ...mockSupplement });
  }
  const response = await http.put<BackendSupplement>(
    `${requirementsPath(projectId)}/supplement`,
    { text },
    { skipErrorToast: true },
  );
  return mapSupplement(response.data);
}

/** A page's conversations, the one changed last first. */
export async function listConversations(
  projectId: string,
  page: AskPage,
): Promise<AskConversation[]> {
  if (useMock) {
    return wait(
      mockConversations
        .filter((conversation) => conversation.page === page)
        .map(mockSettle)
        .sort((a, b) => b.updateTime - a.updateTime),
    );
  }
  const response = await http.get<{ conversations?: BackendConversation[] | null }>(
    conversationsPath(projectId),
    { params: { page }, skipErrorToast: true },
  );
  return (response.data.conversations ?? []).map(mapConversation);
}

export async function getConversation(
  projectId: string,
  conversationId: string,
): Promise<AskConversation> {
  if (useMock) {
    const found = mockConversations.find((conversation) => conversation.id === conversationId);
    if (!found) {
      throw refused(404, "Requirement.ConversationNotFound");
    }
    return wait(mockSettle(found));
  }
  const response = await http.get<BackendConversation>(
    `${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}`,
    { skipErrorToast: true },
  );
  return mapConversation(response.data);
}

/** Starts a conversation with a question; it is answered in the background. */
export async function startConversation(
  projectId: string,
  page: AskPage,
  question: string,
  refs: AskRef[],
): Promise<AskConversation> {
  if (useMock) {
    const now = Date.now();
    const conversation: AskConversation = {
      createTime: now,
      id: `c${now}`,
      page,
      title: question.slice(0, 60),
      turns: [mockTurn(question, refs)],
      updateTime: now,
    };
    mockConversations = [conversation, ...mockConversations];
    return wait(structuredClone(conversation));
  }
  const response = await http.post<BackendConversation>(
    conversationsPath(projectId),
    { page, question, refs: refsBody(refs) },
    { skipErrorToast: true },
  );
  return mapConversation(response.data);
}

/** Asks again in a conversation; the new turn is answered in the background. */
export async function askInConversation(
  projectId: string,
  conversationId: string,
  question: string,
  refs: AskRef[],
): Promise<AskConversation> {
  if (useMock) {
    const found = mockConversations.find((conversation) => conversation.id === conversationId);
    if (!found) {
      throw refused(404, "Requirement.ConversationNotFound");
    }
    if (found.turns.some((turn) => turn.status === "pending")) {
      throw refused(409, "Requirement.AskPending");
    }
    found.turns.push(mockTurn(question, refs));
    found.updateTime = Date.now();
    return wait(structuredClone(found));
  }
  const response = await http.post<BackendConversation>(
    `${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}/turns`,
    { question, refs: refsBody(refs) },
    { skipErrorToast: true },
  );
  return mapConversation(response.data);
}

/** Deletes a whole conversation; what was adopted from it stays in the lists. */
export async function deleteConversation(projectId: string, conversationId: string): Promise<void> {
  if (useMock) {
    mockConversations = mockConversations.filter(
      (conversation) => conversation.id !== conversationId,
    );
    await wait(null);
    return;
  }
  await http.delete(`${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}`, {
    skipErrorToast: true,
  });
}

/**
 * Adopts and declines a turn's proposals by their place, on the specification read at
 * `updateTime`. Adopting writes into the specification at once; `requirements` is the
 * specification after, null when nothing was adopted.
 */
export async function decideProposals(
  projectId: string,
  conversationId: string,
  turnId: string,
  decision: { adopt: number[]; decline: number[]; updateTime: number },
): Promise<{ conversation: AskConversation; requirements: Requirements | null }> {
  if (useMock) {
    const found = mockConversations.find((conversation) => conversation.id === conversationId);
    const turn = found?.turns.find((item) => item.id === turnId);
    if (!found || !turn) {
      throw refused(404, "Requirement.ConversationNotFound");
    }
    for (const [indexes, status] of [
      [decision.adopt, "adopted"],
      [decision.decline, "declined"],
    ] as const) {
      for (const index of indexes) {
        const proposal = turn.proposals[index];
        if (!proposal || proposal.status) {
          throw refused(400, "Requirement.InvalidItem");
        }
        proposal.status = status;
      }
    }
    return wait({ conversation: structuredClone(found), requirements: null });
  }
  const response = await http.put<{
    conversation: BackendConversation;
    requirement?: BackendRequirements | null;
  }>(
    `${conversationsPath(projectId)}/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/proposals`,
    { adopt: decision.adopt, decline: decision.decline, update_time: decision.updateTime },
    { skipErrorToast: true },
  );
  return {
    conversation: mapConversation(response.data.conversation),
    requirements: response.data.requirement ? mapRequirements(response.data.requirement) : null,
  };
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

const mockUser = defaultDevRuntimeUser.id ?? "mock-user";
/** How long the mock takes to answer. */
const MOCK_ANSWER_MS = 4000;

let mockSupplement: Supplement = { by: null, text: "", time: 0 };
let mockConversations: AskConversation[] = [];

const mockTurn = (question: string, refs: AskRef[]): AskTurn => ({
  answer: "",
  createTime: Date.now(),
  dropped: 0,
  error: "",
  id: `t${Date.now()}`,
  proposals: [],
  question,
  refs,
  status: "pending",
});

/** The mock answers a pending turn once it has waited long enough, without proposals. */
function mockSettle(conversation: AskConversation): AskConversation {
  for (const turn of conversation.turns) {
    if (turn.status === "pending" && Date.now() - turn.createTime >= MOCK_ANSWER_MS) {
      turn.status = "ready";
      turn.answer = "The mock does not analyse: connect bkn-project to get answers and proposals.";
    }
  }
  return structuredClone(conversation);
}
