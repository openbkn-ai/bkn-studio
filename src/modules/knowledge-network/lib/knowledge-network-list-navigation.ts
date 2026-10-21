/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type KnowledgeNetworkListLocation = {
  keyword: string;
  page: number;
  pageSize: number;
  sortBy: "name" | "updateTime";
  sortDirection: "asc" | "desc";
  tag: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DEFAULT_LIST_LOCATION: KnowledgeNetworkListLocation = {
  keyword: "",
  page: 1,
  pageSize: 12,
  sortBy: "updateTime",
  sortDirection: "desc",
  tag: "all",
};
const LIST_PATH = "/knowledge-network";
const LIST_RETURN_STORAGE_KEY = "knowledge-network:list-return-path";
const VALID_PAGE_SIZES = new Set([12, 24, 36]);

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeListPath(candidate: unknown) {
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return undefined;
  }

  try {
    const url = new URL(candidate, "http://knowledge-network-navigation.local");
    if (url.origin !== "http://knowledge-network-navigation.local" || url.pathname !== LIST_PATH) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

function browserSessionStorage() {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readKnowledgeNetworkListLocation(search: string): KnowledgeNetworkListLocation {
  const params = new URLSearchParams(search);
  const pageSize = positiveInteger(params.get("pageSize"), DEFAULT_LIST_LOCATION.pageSize);
  const sortBy = params.get("sortBy");
  const sortDirection = params.get("sortDirection");

  return {
    keyword: params.get("keyword") ?? DEFAULT_LIST_LOCATION.keyword,
    page: positiveInteger(params.get("page"), DEFAULT_LIST_LOCATION.page),
    pageSize: VALID_PAGE_SIZES.has(pageSize) ? pageSize : DEFAULT_LIST_LOCATION.pageSize,
    sortBy: sortBy === "name" ? "name" : DEFAULT_LIST_LOCATION.sortBy,
    sortDirection: sortDirection === "asc" ? "asc" : DEFAULT_LIST_LOCATION.sortDirection,
    tag: params.get("tag") || DEFAULT_LIST_LOCATION.tag,
  };
}

export function buildKnowledgeNetworkListPath(location: KnowledgeNetworkListLocation) {
  const params = new URLSearchParams();
  const keyword = location.keyword.trim();
  if (location.page !== DEFAULT_LIST_LOCATION.page) params.set("page", String(location.page));
  if (location.pageSize !== DEFAULT_LIST_LOCATION.pageSize) {
    params.set("pageSize", String(location.pageSize));
  }
  if (keyword) params.set("keyword", keyword);
  if (location.tag !== DEFAULT_LIST_LOCATION.tag) params.set("tag", location.tag);
  if (location.sortBy !== DEFAULT_LIST_LOCATION.sortBy) params.set("sortBy", location.sortBy);
  if (location.sortDirection !== DEFAULT_LIST_LOCATION.sortDirection) {
    params.set("sortDirection", location.sortDirection);
  }
  const query = params.toString();
  return `${LIST_PATH}${query ? `?${query}` : ""}`;
}

export function rememberKnowledgeNetworkListPath(
  returnTo: string,
  storage: StorageLike | undefined = browserSessionStorage(),
) {
  const normalized = normalizeListPath(returnTo);
  if (!normalized || !storage) return;
  try {
    storage.setItem(LIST_RETURN_STORAGE_KEY, normalized);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function resolveKnowledgeNetworkListPath(
  locationState: unknown,
  storage: StorageLike | undefined = browserSessionStorage(),
) {
  const statePath = normalizeListPath(
    (locationState as { knowledgeNetworkListReturnTo?: unknown } | null)
      ?.knowledgeNetworkListReturnTo,
  );
  if (statePath) return statePath;

  try {
    return normalizeListPath(storage?.getItem(LIST_RETURN_STORAGE_KEY)) ?? LIST_PATH;
  } catch {
    return LIST_PATH;
  }
}

export function knowledgeNetworkListReturnState(returnTo: string) {
  return { knowledgeNetworkListReturnTo: normalizeListPath(returnTo) ?? LIST_PATH };
}
