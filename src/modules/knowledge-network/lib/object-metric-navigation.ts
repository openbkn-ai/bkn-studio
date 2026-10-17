/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ObjectMetricTypeV1 } from "@/modules/knowledge-network/types/object-metric";

export type ObjectMetricListLocation = {
  metricPage: number;
  metricQuery: string;
  metricType?: ObjectMetricTypeV1;
  objectPage: number;
  objectQuery: string;
  objectTypeId: string;
  sidebarCollapsed: boolean;
  view: "graph" | "list";
};

function positivePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function readObjectMetricListLocation(params: URLSearchParams): ObjectMetricListLocation {
  const type = params.get("metricType");
  return {
    metricPage: positivePage(params.get("metricPage")),
    metricQuery: params.get("metricQuery") ?? "",
    metricType: type === "atomic" || type === "derived" || type === "composite" ? type : undefined,
    objectPage: positivePage(params.get("objectPage")),
    objectQuery: params.get("objectQuery") ?? "",
    objectTypeId: params.get("objectTypeId") ?? "",
    sidebarCollapsed: params.get("sidebar") === "collapsed",
    view: params.get("view") === "list" ? "list" : "graph",
  };
}

export function objectMetricListPath(
  networkId: string,
  state: Partial<ObjectMetricListLocation> = {},
) {
  const params = new URLSearchParams();
  if (state.objectTypeId) params.set("objectTypeId", state.objectTypeId);
  if (state.objectQuery) params.set("objectQuery", state.objectQuery);
  if (state.objectPage && state.objectPage > 1) params.set("objectPage", String(state.objectPage));
  if (state.view === "list") params.set("view", "list");
  if (state.metricQuery) params.set("metricQuery", state.metricQuery);
  if (state.metricType) params.set("metricType", state.metricType);
  if (state.metricPage && state.metricPage > 1) params.set("metricPage", String(state.metricPage));
  if (state.sidebarCollapsed) params.set("sidebar", "collapsed");
  const query = params.toString();
  const path = `/knowledge-network/workspace/${encodeURIComponent(networkId)}/metrics`;
  return query ? `${path}?${query}` : path;
}

export function objectMetricReturnPath(
  networkId: string,
  locationState: unknown,
  fallbackObjectTypeId = "",
) {
  const fallback = objectMetricListPath(networkId, { objectTypeId: fallbackObjectTypeId });
  const candidate = (locationState as { knowledgeNetworkReturnTo?: unknown } | null)
    ?.knowledgeNetworkReturnTo;
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }
  try {
    const url = new URL(candidate, "http://metric-navigation.local");
    const workspacePath = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;
    const isMetricList = url.pathname === `${workspacePath}/metrics`;
    const objectDetailPrefix = `${workspacePath}/object-types/`;
    const objectDetailSuffix = url.pathname.startsWith(objectDetailPrefix)
      ? url.pathname.slice(objectDetailPrefix.length)
      : "";
    const isObjectDetail = /^[^/]+\/detail\/?$/.test(objectDetailSuffix);
    if (url.origin !== "http://metric-navigation.local" || (!isMetricList && !isObjectDetail)) {
      return fallback;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
