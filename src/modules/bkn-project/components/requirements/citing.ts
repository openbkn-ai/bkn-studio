/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { createContext } from "react";

import {
  KNOWLEDGE_DOCUMENT_ID,
  NETWORK_DOCUMENT_ID,
} from "@/modules/bkn-project/services/requirements.service";

import type {
  RequirementChoice,
  RequirementConflict,
  RequirementItemKind,
  ReviewedKind,
} from "@/modules/bkn-project/types/requirements";

/** What a quote needs from the page: document names, and a way to open one at a passage. */
export type CitationContext = {
  documentName: (documentId: string) => string;
  openDocument: (documentId: string, range?: { end: number; start: number }) => void;
};

/**
 * The name a citation shows for a document: the network's background and the knowledge base's
 * rules by what they are, an uploaded document by its name, and `missing` for one no longer there.
 */
export function citedDocumentName(
  t: TFunction,
  documentId: string,
  documents: { id: string; name: string }[] | null | undefined,
  missing: string,
) {
  if (documentId === NETWORK_DOCUMENT_ID) {
    return t("bknProject.networkExisting.background.name");
  }
  if (documentId === KNOWLEDGE_DOCUMENT_ID) {
    return t("bknProject.requirements.knowledgeDocument");
  }
  return documents?.find((document) => document.id === documentId)?.name ?? missing;
}

export const Citing = createContext<CitationContext>({
  documentName: (documentId) => documentId,
  openDocument: () => undefined,
});

/**
 * What the owner may do to the specification from where an item shows. Absent for others and on
 * an archived project: the views then only read.
 */
export type SpecEditing = {
  add: (kind: RequirementItemKind) => void;
  decide: (choice: RequirementChoice) => void;
  edit: (kind: RequirementItemKind, itemId: string) => void;
  remove: (kind: RequirementItemKind, itemId: string, label: string) => void;
  resolve: (conflict: RequirementConflict) => void;
  /** Accepts what AI generated, or takes it back. */
  review: (kind: ReviewedKind, itemId: string, accept: boolean) => void;
  /** An edit is being sent: another one would go on the version it replaces. */
  saving: boolean;
};

export const Editing = createContext<SpecEditing | null>(null);

/**
 * Ticking items to ask AI about, and the items just changed from a conversation; absent where
 * nothing is asked about.
 */
export type SpecAsking = {
  /** Items just changed from Ask AI, marked for a moment. */
  flash: ReadonlySet<string>;
  /** Ticked items, by id. */
  selected: ReadonlySet<string>;
  toggle: (kind: "questions" | "scenarios", itemId: string) => void;
};

export const Asking = createContext<SpecAsking | null>(null);
