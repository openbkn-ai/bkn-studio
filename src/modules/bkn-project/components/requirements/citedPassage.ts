/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** The attribute on a rendered block holding part of the quoted passage. */
export const CITED_ATTRIBUTE = "data-cited";

/** What a rendered Markdown document is made of, as far as marking a passage needs. */
type Node = {
  children?: Node[];
  position?: { end: { offset?: number }; start: { offset?: number } };
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
};

/** The blocks a passage is marked by: a paragraph, list item, table row, heading or code block. */
const BLOCKS = new Set(["p", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "dt", "dd"]);

function overlaps(node: Node, range: { end: number; start: number }) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start !== undefined && end !== undefined && start < range.end && end > range.start;
}

/** Marks the innermost blocks of the passage; true once one under node is marked. */
function mark(node: Node, range: { end: number; start: number }, className: string): boolean {
  let inner = false;
  for (const child of node.children ?? []) {
    inner = mark(child, range, className) || inner;
  }
  if (inner || node.type !== "element" || !BLOCKS.has(node.tagName ?? "")) {
    return inner;
  }
  if (!overlaps(node, range)) {
    return false;
  }
  const classes = node.properties?.className;
  node.properties = {
    ...node.properties,
    className: [...(Array.isArray(classes) ? (classes as unknown[]) : []), className],
    [CITED_ATTRIBUTE]: "",
  };
  return true;
}

/**
 * A rehype plugin marking the rendered blocks that hold the passage between two offsets of the
 * Markdown source, such as the table row a requirement quotes: the quote is found in the rendered
 * document, where the source's own characters are gone.
 */
export function citedPassage(range: { end: number; start: number }, className: string) {
  return () => (tree: Node) => {
    mark(tree, range, className);
  };
}

/** Whether a requirement document is Markdown, read rendered. */
export function isMarkdown(document: { format: string; name: string }) {
  return document.format === "markdown" || /\.(md|markdown)$/i.test(document.name);
}
