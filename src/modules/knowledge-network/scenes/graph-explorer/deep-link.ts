/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExpandDirection } from "@/modules/knowledge-network/services/graph-explorer.service";
import { LAYOUTS, type ExplorerLayout } from "@/modules/knowledge-network/utils/graph-explorer-cache";

/**
 * Query-string contract of the explorer page, so a subgraph can be handed over as a URL:
 *   ?ids=product-abc,fact-123        instance ids (the explorer's `<object type>-<key>` form)
 *   &cypher=MATCH (k:knowledge)...   a MATCH / WHERE fragment, run like the Cypher tab
 *   &expand=out|in|both              expand every loaded node one hop in that direction
 *   &layout=force|dagre|radial|circular|grid
 * A link with ids or cypher opens on a fresh canvas instead of the locally cached one.
 */
export type DeepLink = {
  ids: string[];
  cypher: string | null;
  expand: ExpandDirection | null;
  layout: ExplorerLayout | null;
};

const EXPAND_ALIASES: Record<string, ExpandDirection> = {
  out: "forward",
  forward: "forward",
  in: "backward",
  backward: "backward",
  both: "bidirectional",
  bidirectional: "bidirectional",
};

/** Ids are joined with commas; keys containing a comma cannot be shared this way. */
export function parseDeepLink(search: string): DeepLink | null {
  const params = new URLSearchParams(search);
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const cypher = (params.get("cypher") ?? "").trim() || null;
  const expandRaw = (params.get("expand") ?? "").trim().toLowerCase();
  const expand = expandRaw ? EXPAND_ALIASES[expandRaw] ?? null : null;
  const layoutRaw = (params.get("layout") ?? "").trim().toLowerCase();
  const layout = (LAYOUTS as string[]).includes(layoutRaw) ? (layoutRaw as ExplorerLayout) : null;
  if (ids.length === 0 && !cypher) return null;
  return { ids: [...new Set(ids)], cypher, expand, layout };
}

export const SHARE_ID_LIMIT = 300;

/**
 * Builds the shareable URL for a canvas. `base` is origin + pathname of the explorer page.
 * Beyond SHARE_ID_LIMIT ids the list is cut and the count of dropped ids is returned, because
 * browsers and chat clients start truncating URLs around 8 KB.
 */
export function buildShareUrl(base: string, ids: string[], options: { layout?: ExplorerLayout } = {}): { url: string; dropped: number } {
  const unique = [...new Set(ids)];
  const kept = unique.slice(0, SHARE_ID_LIMIT);
  const params = new URLSearchParams();
  // URLSearchParams encodes the value once; a comma inside a key is not supported.
  if (kept.length > 0) params.set("ids", kept.join(","));
  if (options.layout) params.set("layout", options.layout);
  const query = params.toString();
  return { url: query ? `${base}?${query}` : base, dropped: unique.length - kept.length };
}
