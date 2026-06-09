import type { ReactNode } from "react";
import { Suspense } from "react";
import type { RouteObject } from "react-router-dom";

import { RouteLoading } from "@/app/router/RouteLoading";

const KNOWLEDGE_NETWORK_MENU_KEY = "domain-knowledge-network";

type KnowledgeNetworkRouteMeta = {
  descriptionKey: string;
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
        menuKey: KNOWLEDGE_NETWORK_MENU_KEY,
        titleKey: meta.titleKey,
      },
    },
    element: withRouteLoading(element),
  };
}
