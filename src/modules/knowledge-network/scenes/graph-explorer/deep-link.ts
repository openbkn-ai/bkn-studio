/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ExpandDirection } from "@/modules/knowledge-network/services/graph-explorer.service";
import { LAYOUTS, type ExplorerLayout } from "@/modules/knowledge-network/utils/graph-explorer-cache";

/**
 * Link contract of the explorer page, so a subgraph can be handed over as a URL:
 *   ids=product-abc,fact-123        instance ids (the explorer's `<object type>-<key>` form)
 *   g=product:abc,def;fact:123      the same ids grouped by object type, prefix written once
 *   cypher=MATCH (k:knowledge)...   a MATCH / WHERE fragment, run like the Cypher tab
 *   expand=out|in|both              expand every loaded node one hop in that direction
 *   layout=force|dagre|radial|circular|grid
 * A link with ids or cypher opens on a fresh canvas instead of the locally cached one.
 *
 * The parameters are read from the query string and from the fragment, and written into the
 * fragment: a fragment never reaches the server, so a long id list cannot hit the request-line
 * limit (nginx answers 414 above roughly 8 KB) and the page still reads every id.
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

/** Query string and fragment as one parameter source; the fragment wins on a repeated key. */
export function combineLinkSource(search: string, hash: string): string {
  const parts = [search.replace(/^\?/, ""), hash.replace(/^#/, "")].filter((part) => part !== "");
  return parts.join("&");
}

const GROUP_SEPARATOR = ";";
const KEY_SEPARATOR = ",";

/**
 * Writes the shared object-type prefix once per group: `squads:1,2;groups:7`. Ids whose object
 * type is not in `objectTypeIds` are left alone in a plain `ids` list by the caller. Keys must
 * not contain a comma or a semicolon, the same constraint the plain list already carries.
 */
export function packIds(ids: string[], objectTypeIds: string[]): { packed: string; plain: string[] } {
  const prefixes = [...objectTypeIds].sort((a, b) => b.length - a.length);
  const groups = new Map<string, string[]>();
  const plain: string[] = [];
  for (const id of ids) {
    const prefix = prefixes.find((otId) => id.startsWith(`${otId}-`) && id.length > otId.length + 1);
    const key = prefix ? id.slice(prefix.length + 1) : "";
    if (!prefix || key.includes(KEY_SEPARATOR) || key.includes(GROUP_SEPARATOR)) {
      plain.push(id);
      continue;
    }
    groups.set(prefix, [...(groups.get(prefix) ?? []), key]);
  }
  const packed = [...groups].map(([otId, keys]) => `${otId}:${keys.join(KEY_SEPARATOR)}`).join(GROUP_SEPARATOR);
  return { packed, plain };
}

/** Expands `squads:1,2;groups:7` back into full instance ids. A segment without a colon is dropped. */
export function unpackIds(text: string): string[] {
  const ids: string[] = [];
  for (const segment of text.split(GROUP_SEPARATOR)) {
    const trimmed = segment.trim();
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const otId = trimmed.slice(0, colon);
    for (const key of trimmed.slice(colon + 1).split(KEY_SEPARATOR)) {
      const value = key.trim();
      if (value !== "") ids.push(`${otId}-${value}`);
    }
  }
  return ids;
}

/** Ids are joined with commas; keys containing a comma cannot be shared this way. */
export function parseDeepLink(search: string): DeepLink | null {
  const params = new URLSearchParams(search.replace(/^[?#]/, ""));
  const plain = (params.get("ids") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const ids = [...plain, ...unpackIds(params.get("g") ?? "")];
  const cypher = (params.get("cypher") ?? "").trim() || null;
  const expandRaw = (params.get("expand") ?? "").trim().toLowerCase();
  const expand = expandRaw ? EXPAND_ALIASES[expandRaw] ?? null : null;
  const layoutRaw = (params.get("layout") ?? "").trim().toLowerCase();
  const layout = (LAYOUTS as string[]).includes(layoutRaw) ? (layoutRaw as ExplorerLayout) : null;
  if (ids.length === 0 && !cypher) return null;
  return { ids: [...new Set(ids)], cypher, expand, layout };
}

/**
 * Backstop on the whole URL. The fragment lifts the server's request-line limit, and the canvas
 * itself holds at most NODE_LIMIT nodes, so this only guards against a pathological key length;
 * chat clients are what start truncating far above the lengths a full canvas produces.
 */
export const SHARE_URL_LIMIT = 30_000;

/**
 * Builds the shareable URL for a canvas. `base` is origin + pathname of the explorer page.
 * Ids go into the fragment, grouped by object type, and the list is cut only if the URL would
 * exceed SHARE_URL_LIMIT; the number of ids left out is returned.
 */
export function buildShareUrl(
  base: string,
  ids: string[],
  options: { layout?: ExplorerLayout; objectTypeIds?: string[] } = {},
): { url: string; dropped: number } {
  const unique = [...new Set(ids)];
  const build = (kept: string[]) => {
    const { packed, plain } = packIds(kept, options.objectTypeIds ?? []);
    const params = new URLSearchParams();
    // URLSearchParams encodes the value once; a comma inside a key is not supported.
    if (plain.length > 0) params.set("ids", plain.join(","));
    if (packed) params.set("g", packed);
    if (options.layout) params.set("layout", options.layout);
    const query = params.toString();
    return query ? `${base}#${query}` : base;
  };
  let kept = unique;
  let url = build(kept);
  // Trim from the end until it fits; each pass drops the overshoot in one go rather than one id.
  while (kept.length > 0 && url.length > SHARE_URL_LIMIT) {
    const overshoot = url.length - SHARE_URL_LIMIT;
    const perId = Math.max(1, Math.ceil(url.length / kept.length));
    kept = kept.slice(0, Math.max(0, kept.length - Math.max(1, Math.ceil(overshoot / perId))));
    url = build(kept);
  }
  return { url, dropped: unique.length - kept.length };
}
