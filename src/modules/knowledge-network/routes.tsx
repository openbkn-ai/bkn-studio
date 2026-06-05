import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { RouteLoading } from "@/app/router/RouteLoading";

const KnowledgeNetworkListPage = lazy(async () => {
  const module = await import("@/modules/knowledge-network/pages/KnowledgeNetworkListPage");
  return { default: module.KnowledgeNetworkListPage };
});

const KnowledgeNetworkWorkspaceStandalonePage = lazy(async () => {
  const module = await import(
    "@/modules/knowledge-network/pages/KnowledgeNetworkWorkspaceStandalonePage"
  );
  return { default: module.KnowledgeNetworkWorkspaceStandalonePage };
});

function withRouteLoading(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const knowledgeNetworkRoutes: RouteObject[] = [
  {
    path: "knowledge-network",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.description",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.title",
      },
    },
    element: withRouteLoading(<KnowledgeNetworkListPage />),
  },
];

export const knowledgeNetworkStandaloneRoutes: RouteObject[] = [
  {
    path: "/knowledge-network/workspace/:networkId/overview",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.overviewDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspaceOverview",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="overview" />,
    ),
  },
  {
    path: "/knowledge-network/workspace/:networkId/preview",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.previewDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspacePreview",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="preview" />,
    ),
  },
  {
    path: "/knowledge-network/workspace/:networkId/concept-groups",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.conceptGroupsDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspaceConceptGroups",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="concept-groups" />,
    ),
  },
  {
    path: "/knowledge-network/workspace/:networkId/object-types",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.objectTypesDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspaceObjectTypes",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="object-types" />,
    ),
  },
  {
    path: "/knowledge-network/workspace/:networkId/relation-types",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.relationTypesDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspaceRelationTypes",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="relation-types" />,
    ),
  },
  {
    path: "/knowledge-network/workspace/:networkId/action-types",
    handle: {
      console: {
        descriptionKey: "knowledgeNetwork.actionTypesDescription",
        menuKey: "domain-knowledge-network",
        titleKey: "knowledgeNetwork.workspaceActionTypes",
      },
    },
    element: withRouteLoading(
      <KnowledgeNetworkWorkspaceStandalonePage section="action-types" />,
    ),
  },
];

export const knowledgeNetworkRouteContribution: AppRouteContribution = {
  defaultEntryPath: "/knowledge-network",
  moduleId: "knowledge-network",
  routes: knowledgeNetworkRoutes,
  standaloneRoutes: knowledgeNetworkStandaloneRoutes,
};
