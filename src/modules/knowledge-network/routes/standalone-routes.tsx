import type { RouteObject } from "react-router-dom";

import {
  ActionTypeCreatePage,
  ActionTypeDetailPage,
  ActionTypeEditPage,
  ActionTypeExecutionPage,
  ExperiencePage,
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
  ObjectTypeIndexSettingsPage,
  RelationTypeCreatePage,
  RelationTypeDetailPage,
  RelationTypeEditPage,
  RelationTypeMappingPage,
  TaskCreatePage,
  TaskDetailPage,
  workspaceSectionPage,
} from "@/modules/knowledge-network/routes/lazy-pages";
import { createKnowledgeNetworkRoute } from "@/modules/knowledge-network/routes/route-factory";

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
      titleKey: "knowledgeNetwork.experienceTitle",
    },
    <ExperiencePage />,
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
    <ConceptGroupCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/edit",
    {
      descriptionKey: "knowledgeNetwork.conceptGroupEditDescription",
      titleKey: "knowledgeNetwork.conceptGroupEditTitle",
    },
    <ConceptGroupEditPage />,
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
    <MetricCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/metrics/:metricId/edit",
    {
      descriptionKey: "knowledgeNetwork.metricEditDescription",
      titleKey: "knowledgeNetwork.metricEditTitle",
    },
    <MetricEditPage />,
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
    <ObjectTypeCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.objectTypeEditDescription",
      titleKey: "knowledgeNetwork.objectTypeEditTitle",
    },
    <ObjectTypeEditPage />,
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
    "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/index-settings",
    {
      descriptionKey: "knowledgeNetwork.objectTypeIndexSettingsDescription",
      titleKey: "knowledgeNetwork.objectTypeIndexSettingsTitle",
    },
    <ObjectTypeIndexSettingsPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/create",
    {
      descriptionKey: "knowledgeNetwork.relationTypeCreateDescription",
      titleKey: "knowledgeNetwork.relationTypeCreateTitle",
    },
    <RelationTypeCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.relationTypeEditDescription",
      titleKey: "knowledgeNetwork.relationTypeEditTitle",
    },
    <RelationTypeEditPage />,
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
    <RelationTypeMappingPage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/create",
    {
      descriptionKey: "knowledgeNetwork.actionTypeCreateDescription",
      titleKey: "knowledgeNetwork.actionTypeCreateTitle",
    },
    <ActionTypeCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/action-types/:actionTypeId/edit",
    {
      descriptionKey: "knowledgeNetwork.actionTypeEditDescription",
      titleKey: "knowledgeNetwork.actionTypeEditTitle",
    },
    <ActionTypeEditPage />,
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
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/tasks",
    {
      descriptionKey: "knowledgeNetwork.tasksDescription",
      titleKey: "knowledgeNetwork.workspaceTaskManagement",
    },
    workspaceSectionPage("tasks"),
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/tasks/create",
    {
      descriptionKey: "knowledgeNetwork.taskCreateDescription",
      titleKey: "knowledgeNetwork.taskCreateTitle",
    },
    <TaskCreatePage />,
  ),
  createKnowledgeNetworkRoute(
    "/knowledge-network/workspace/:networkId/tasks/:taskId/detail",
    {
      descriptionKey: "knowledgeNetwork.taskDetailDescription",
      titleKey: "knowledgeNetwork.taskDetailTitle",
    },
    <TaskDetailPage />,
  ),
];
