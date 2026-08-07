/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import type { AppRouteContribution } from "@/app/router/types";

const BusinessProvenancePage = lazy(async () => {
  const module = await import("@/modules/bkn-trace/pages/BusinessProvenancePage");
  return { default: module.BusinessProvenancePage };
});
const TraceAnalysisPage = lazy(async () => {
  const module = await import("@/modules/bkn-trace/pages/TraceAnalysisPage");
  return { default: module.TraceAnalysisPage };
});
const ObservabilityLogsPage = lazy(async () => {
  const module = await import("@/modules/bkn-trace/pages/ObservabilityLogsPage");
  return { default: module.ObservabilityLogsPage };
});
const ObservabilitySettingsPage = lazy(async () => {
  const module = await import("@/modules/bkn-trace/pages/ObservabilitySettingsPage");
  return { default: module.ObservabilitySettingsPage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const bknTraceRoutes: RouteObject[] = [
  {
    path: "observability/business-provenance",
    handle: {
      console: {
        descriptionKey: "bknTrace.businessProvenance.description",
        menuKey: "business-provenance",
        titleKey: "bknTrace.businessProvenance.title",
      },
    },
    element: (
      <RequireEdition
        capability={CAPABILITIES.BUSINESS_PROVENANCE}
        minEdition="enterprise"
      >
        withRouteLoading(<BusinessProvenancePage />)
      </RequireEdition>
    ),
  },
  {
    path: "observability/traces",
    handle: { console: { descriptionKey: "bknTrace.traceAnalysis.description", menuKey: "trace-analysis", titleKey: "bknTrace.traceAnalysis.title" } },
    element: withRouteLoading(<TraceAnalysisPage />),
  },
  {
    path: "observability/logs",
    handle: { console: { descriptionKey: "bknTrace.logs.description", menuKey: "observability-logs", titleKey: "bknTrace.logs.title" } },
    element: withRouteLoading(<ObservabilityLogsPage />),
  },
  {
    path: "observability/settings",
    handle: { console: { descriptionKey: "bknTrace.settings.description", menuKey: "observability-settings", titleKey: "bknTrace.settings.title" } },
    element: withRouteLoading(<ObservabilitySettingsPage />),
  },
  {
    path: "system/bkn-trace",
    element: <Navigate replace to="/observability/business-provenance" />,
  },
];

export const bknTraceRouteContribution: AppRouteContribution = {
  moduleId: "bkn-trace",
  routes: bknTraceRoutes,
};
