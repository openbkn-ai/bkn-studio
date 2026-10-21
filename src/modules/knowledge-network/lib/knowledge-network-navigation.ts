/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnowledgeNetworkGraphSelection = {
  id: string;
  kind: "action" | "metric" | "object" | "relation";
  version?: number;
};

const GRAPH_RESOURCE_ID = "graphResourceId";
const GRAPH_RESOURCE_KIND = "graphResourceKind";
const GRAPH_RESOURCE_VERSION = "graphResourceVersion";

export function readKnowledgeNetworkGraphSelection(
  params: URLSearchParams,
): KnowledgeNetworkGraphSelection | undefined {
  const kind = params.get(GRAPH_RESOURCE_KIND);
  const id = params.get(GRAPH_RESOURCE_ID) ?? "";
  if (!id || !["action", "metric", "object", "relation"].includes(kind ?? "")) {
    return undefined;
  }
  const rawVersion = Number(params.get(GRAPH_RESOURCE_VERSION));
  const version = Number.isSafeInteger(rawVersion) && rawVersion > 0 ? rawVersion : undefined;
  return {
    id,
    kind: kind as KnowledgeNetworkGraphSelection["kind"],
    ...(kind === "metric" && version ? { version } : {}),
  };
}

export function writeKnowledgeNetworkGraphSelection(
  params: URLSearchParams,
  selection?: KnowledgeNetworkGraphSelection,
) {
  params.delete(GRAPH_RESOURCE_ID);
  params.delete(GRAPH_RESOURCE_KIND);
  params.delete(GRAPH_RESOURCE_VERSION);
  if (!selection) return;
  params.set(GRAPH_RESOURCE_KIND, selection.kind);
  params.set(GRAPH_RESOURCE_ID, selection.id);
  if (selection.kind === "metric" && selection.version) {
    params.set(GRAPH_RESOURCE_VERSION, String(selection.version));
  }
}

export function knowledgeNetworkReturnPath(
  networkId: string,
  locationState: unknown,
  fallbackPath: string,
) {
  const candidate = (locationState as { knowledgeNetworkReturnTo?: unknown } | null)
    ?.knowledgeNetworkReturnTo;
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallbackPath;
  }
  try {
    const url = new URL(candidate, "http://knowledge-network-navigation.local");
    const workspacePath = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;
    if (
      url.origin !== "http://knowledge-network-navigation.local" ||
      (url.pathname !== workspacePath && !url.pathname.startsWith(`${workspacePath}/`))
    ) {
      return fallbackPath;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackPath;
  }
}

export function knowledgeNetworkReturnState(returnTo: string) {
  return { knowledgeNetworkReturnTo: returnTo };
}

export function clearKnowledgeNetworkGraphSelectionFromPath(path: string) {
  try {
    const url = new URL(path, "http://knowledge-network-navigation.local");
    writeKnowledgeNetworkGraphSelection(url.searchParams);
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
  } catch {
    return path;
  }
}
