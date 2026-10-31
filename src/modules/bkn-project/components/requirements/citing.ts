/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

import type {
  RequirementChoice,
  RequirementConcept,
  RequirementConflict,
  RequirementItemKind,
  ReviewedKind,
} from "@/modules/bkn-project/types/requirements";

/** What a quote needs from the page: document names, and a way to open one at a passage. */
export type CitationContext = {
  documentName: (documentId: string) => string;
  openDocument: (documentId: string, range?: { end: number; start: number }) => void;
};

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
  map: (concept: RequirementConcept) => void;
  remove: (kind: RequirementItemKind, itemId: string, label: string) => void;
  resolve: (conflict: RequirementConflict) => void;
  /** Accepts what AI generated, or takes it back. */
  review: (kind: ReviewedKind, itemId: string, accept: boolean) => void;
};

export const Editing = createContext<SpecEditing | null>(null);
