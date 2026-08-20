/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";

import {
  ActionTypeCreatePage,
  ActionTypeDetailPage,
  ActionTypeEditPage,
  ActionTypeExecutionPage,
  ConceptGroupCreatePage,
  ConceptGroupDetailPage,
  ConceptGroupEditPage,
  MetricCreatePage,
  MetricDataQueryPage,
  MetricDetailPage,
  MetricEditPage,
  ObjectTypeCreatePage,
  ObjectTypeDetailPage,
  ObjectTypeEditPage,
  RelationTypeCreatePage,
  RelationTypeDetailPage,
  RelationTypeEditPage,
  RelationTypeMappingPage,
  workspaceSectionPage,
} from "@/modules/knowledge-network/routes/lazy-pages";
import { KnowledgeNetworkModifyRouteGate } from "@/modules/knowledge-network/routes/KnowledgeNetworkModifyRouteGate";
import { createKnowledgeNetworkRoute } from "@/modules/knowledge-network/routes/route-factory";

function modifyRoute(element: ReactNode) {
  return <KnowledgeNetworkModifyRouteGate>{element}</KnowledgeNetworkModifyRouteGate>;
}

export const knowledgeNetworkStandaloneRoutes: RouteObject[] = [
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/overview",
    {
      descriptionKey: "knowledgeNetwork.overviewDescription",
      titleKey: "knowledgeNetwork.workspaceOverview",
    },
    workspaceSectionPage("overview"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/experience",
    {
      descriptionKey: "knowledgeNetwork.experienceDescription",
      titleKey: "knowledgeNetwork.experienceAgentTitle",
    },
    workspaceSectionPage("experience-agent"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/experience/agent",
    {
      descriptionKey: "knowledgeNetwork.experienceDescription",
      titleKey: "knowledgeNetwork.experienceAgentTitle",
    },
    workspaceSectionPage("experience-agent"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/experience/mcp",
    {
      descriptionKey: "knowledgeNetwork.experienceMcpDescription",
      titleKey: "knowledgeNetwork.experienceMcpTitle",
    },
    workspaceSectionPage("experience-mcp"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/concept-groups",
    {
      descriptionKey: "knowledgeNetwork.conceptGroupsDescription",
      titleKey: "knowledgeNetwork.workspaceConceptGroups",
    },
    workspaceSectionPage("concept-groups"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/concept-groups/create",
    {
      descriptionKey: "knowledgeNetwork.conceptGroupCreateDescription",
      titleKey: "knowledgeNetwork.conceptGroupCreateTitle",
    },
    modifyRoute(<ConceptGroupCreatePage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/edit",
    {
      descriptionKey: "knowledgeNetwork.conceptGroupEditDescription",
      titleKey: "knowledgeNetwork.conceptGroupEditTitle",
    },
    modifyRoute(<ConceptGroupEditPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/detail",
    {
      descriptionKey: "knowledgeNetwork.conceptGroupDetailDescription",
      titleKey: "knowledgeNetwork.conceptGroupDetailTitle",
    },
    <ConceptGroupDetailPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/object-types",
    {
      descriptionKey: "knowledgeNetwork.objectTypesDescription",
      titleKey: "knowledgeNetwork.workspaceObjectTypes",
    },
    workspaceSectionPage("object-types"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types",
    {
      descriptionKey: "knowledgeNetwork.relationTypesDescription",
      titleKey: "knowledgeNetwork.workspaceRelationTypes",
    },
    workspaceSectionPage("relation-types"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types",
    {
      descriptionKey: "knowledgeNetwork.actionTypesDescription",
      titleKey: "knowledgeNetwork.workspaceActionTypes",
    },
    workspaceSectionPage("action-types"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics",
    {
      descriptionKey: "knowledgeNetwork.metricsDescription",
      titleKey: "knowledgeNetwork.workspaceMetrics",
    },
    workspaceSectionPage("metrics"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics/create",
    {
      descriptionKey: "knowledgeNetwork.metricCreateDescription",
      titleKey: "knowledgeNetwork.metricCreateTitle",
    },
    modifyRoute(<MetricCreatePage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics/:metricId/edit",
    {
      descriptionKey: "knowledgeNetwork.metricEditDescription",
      titleKey: "knowledgeNetwork.metricEditTitle",
    },
    modifyRoute(<MetricEditPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics/:metricId/detail",
    {
      descriptionKey: "knowledgeNetwork.metricDetailDescription",
      titleKey: "knowledgeNetwork.metricDetailTitle",
    },
    <MetricDetailPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics/:metricId/data-query",
    {
      descriptionKey: "knowledgeNetwork.metricDataQueryDescription",
      titleKey: "knowledgeNetwork.metricDataQueryTitle",
    },
    <MetricDataQueryPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/object-types/create",
    {
      descriptionKey: "knowledgeNetwork.objectTypeCreateDescription",
      titleKey: "knowledgeNetwork.objectTypeCreateTitle",
    },
    modifyRoute(<ObjectTypeCreatePage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.objectTypeEditDescription",
      titleKey: "knowledgeNetwork.objectTypeEditTitle",
    },
    modifyRoute(<ObjectTypeEditPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/detail",
    {
      descriptionKey: "knowledgeNetwork.objectTypeDetailDescription",
      titleKey: "knowledgeNetwork.objectTypeDetailTitle",
    },
    <ObjectTypeDetailPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/create",
    {
      descriptionKey: "knowledgeNetwork.relationTypeCreateDescription",
      titleKey: "knowledgeNetwork.relationTypeCreateTitle",
    },
    modifyRoute(<RelationTypeCreatePage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.relationTypeEditDescription",
      titleKey: "knowledgeNetwork.relationTypeEditTitle",
    },
    modifyRoute(<RelationTypeEditPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/detail",
    {
      descriptionKey: "knowledgeNetwork.relationTypeDetailDescription",
      titleKey: "knowledgeNetwork.relationTypeDetailTitle",
    },
    <RelationTypeDetailPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/mapping",
    {
      descriptionKey: "knowledgeNetwork.relationTypeMappingDescription",
      titleKey: "knowledgeNetwork.relationTypeMappingTitle",
    },
    modifyRoute(<RelationTypeMappingPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/create",
    {
      descriptionKey: "knowledgeNetwork.actionTypeCreateDescription",
      titleKey: "knowledgeNetwork.actionTypeCreateTitle",
    },
    modifyRoute(<ActionTypeCreatePage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/:actionTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.actionTypeEditDescription",
      titleKey: "knowledgeNetwork.actionTypeEditTitle",
    },
    modifyRoute(<ActionTypeEditPage />),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/:actionTypeId/detail",
    {
      descriptionKey: "knowledgeNetwork.actionTypeDetailDescription",
      titleKey: "knowledgeNetwork.actionTypeDetailTitle",
    },
    <ActionTypeDetailPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/:actionTypeId/execution",
    {
      descriptionKey: "knowledgeNetwork.actionTypeExecutionDescription",
      titleKey: "knowledgeNetwork.actionTypeExecutionTitle",
    },
    <ActionTypeExecutionPage />,
  ),
];
