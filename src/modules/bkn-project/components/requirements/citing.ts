/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext } from "react";

/** What a quote needs from the page: document names, and a way to open one at a passage. */
export type CitationContext = {
  documentName: (documentId: string) => string;
  openDocument: (documentId: string, range?: { end: number; start: number }) => void;
};

export const Citing = createContext<CitationContext>({
  documentName: (documentId) => documentId,
  openDocument: () => undefined,
});
