/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The page a conversation belongs to: kinetic modeling or business scenarios. */
export type AskPage = "kinetic" | "scenarios";

/** What a proposal is of, as the specification names its lists. */
export type AskItemKind = "logic_needs" | "questions" | "rules" | "scenarios";

export type AskPerson = { id: string; name: string };

/** The project's one paragraph of extra direction, shared by both pages. */
export type Supplement = {
  by: AskPerson | null;
  text: string;
  /** When it was last written; 0 when it never was. */
  time: number;
};

/** A list item a question refers to, as it was ticked on the page. */
export type AskRef = { id: string; kind: AskItemKind; name: string };

/**
 * An item as a proposal gives it: only the fields of its kind, and on a change only those that
 * change. Ids name object types, scenarios and kinetic needs.
 */
export type ProposalItem = {
  actor?: string;
  decision?: string;
  definition?: string;
  knowledge?: string[];
  logicKind?: string;
  logicNeedIds?: string[];
  name?: string;
  objectTypeIds?: string[];
  scenarioIds?: string[];
  statement?: string;
  text?: string;
  trigger?: string;
};

export type ProposalOp = "add" | "delete" | "link" | "merge" | "modify" | "split";

/** A change AI proposes; the person adopts or declines it. */
export type Proposal = {
  /** The target as it was when asked. */
  before: ProposalItem | null;
  /** Merge: the one kept, as it was when asked. */
  intoBefore: ProposalItem | null;
  intoId: string;
  item: ProposalItem | null;
  kind: AskItemKind;
  /** Link: what the network already has that implements the target. */
  networkItem: { kind: string; name: string; type: string } | null;
  op: ProposalOp;
  /** Split: part 0 replaces the target, part 1 is added. */
  parts: ProposalItem[];
  reason: string;
  /** After adopting an add or a split: the item made. */
  resultId: string;
  status: "" | "adopted" | "declined";
  targetId: string;
};

export type AskTurn = {
  answer: string;
  createTime: number;
  /** How many proposals were left out as not valid. */
  dropped: number;
  /** Why it was not answered, as a code, when it failed. */
  error: string;
  id: string;
  proposals: Proposal[];
  question: string;
  refs: AskRef[];
  status: "failed" | "pending" | "ready";
};

export type AskConversation = {
  createTime: number;
  id: string;
  page: AskPage;
  title: string;
  turns: AskTurn[];
  updateTime: number;
};
