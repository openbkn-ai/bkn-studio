/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { Suspense } from "react";
import type { RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";

const KNOWLEDGE_NETWORK_MANAGEMENT_MENU_KEY = "domain-knowledge-network-management";

type KnowledgeNetworkRouteMeta = {
  descriptionKey: string;
  menuKey?: string;
  titleKey: string;
};

export function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export function createKnowledgeNetworkRoute(
  path: string,
  meta: KnowledgeNetworkRouteMeta,
  element: ReactNode,
): RouteObject {
  return {
    path,
    handle: {
      console: {
        descriptionKey: meta.descriptionKey,
        menuKey: meta.menuKey ?? KNOWLEDGE_NETWORK_MANAGEMENT_MENU_KEY,
        titleKey: meta.titleKey,
      },
    },
    element: withRouteLoading(element),
  };
}
