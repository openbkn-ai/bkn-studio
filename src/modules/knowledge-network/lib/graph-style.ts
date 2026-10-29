/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/*
 * The colours the knowledge-network graphs share, so the ontology graph and the instance views
 * read as one product. Canvas renderers cannot use CSS variables, so the theme's tokens are read
 * off the document and handed to them as plain colours.
 */

/** Colours for things that set none of their own (object types, concept groups), in order. */
export const GRAPH_PALETTE = [
  "#2e68ff",
  "#7c4dff",
  "#00b8a3",
  "#f5a623",
  "#eb5757",
  "#11a0d8",
  "#9b51e0",
  "#2bb673",
  "#d4380d",
  "#08979c",
  "#c41d7f",
  "#7cb305",
] as const;

/** Theme colours a graph canvas draws with. */
export type GraphTokens = {
  text: string;
  textSecondary: string;
  /** Lines, arrows and other quiet strokes. */
  faint: string;
  /** Text on a coloured disc. */
  inverse: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  link: string;
  surface: string;
  border: string;
};

/** The light theme's values, for when the document carries no tokens (tests, early render). */
const FALLBACK: GraphTokens = {
  text: "#111827",
  textSecondary: "#4b5563",
  faint: "#b4bed0",
  inverse: "#ffffff",
  primary: "#2563eb",
  primarySoft: "#eaf1ff",
  primaryBorder: "#bfd2ff",
  link: "#1d4ed8",
  surface: "#ffffff",
  border: "#e5eaf2",
};

const TOKEN_NAMES: Record<keyof GraphTokens, string> = {
  text: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  faint: "--color-text-faint",
  inverse: "--color-text-inverse",
  primary: "--color-primary-600",
  primarySoft: "--color-primary-100",
  primaryBorder: "--color-primary-border",
  link: "--color-text-link",
  surface: "--color-bg-raised",
  border: "--color-border",
};

/** The current theme's graph colours. Read again after the theme changes. */
export function readGraphTokens(element: Element = document.documentElement): GraphTokens {
  const style = getComputedStyle(element);
  const out = { ...FALLBACK };
  for (const key of Object.keys(TOKEN_NAMES) as (keyof GraphTokens)[]) {
    const value = style.getPropertyValue(TOKEN_NAMES[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}
