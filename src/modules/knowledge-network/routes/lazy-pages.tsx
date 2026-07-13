/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { lazy, type ComponentType, type LazyExoticComponent } from "react";

import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";

function lazyNamedExport(loader: () => Promise<Record<string, ComponentType>>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

export const KnowledgeNetworkListPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/KnowledgeNetworkListPage"),
  "KnowledgeNetworkListPage",
);

export const ExperiencePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ExperiencePage"),
  "ExperiencePage",
);

export const KnowledgeNetworkWorkspaceStandalonePage = lazy(async () => {
  const module = await import(
    "@/modules/knowledge-network/pages/KnowledgeNetworkWorkspaceStandalonePage"
  );
  return { default: module.KnowledgeNetworkWorkspaceStandalonePage };
}) as LazyExoticComponent<ComponentType<{ section: KnowledgeNetworkWorkspaceSection }>>;

export const ConceptGroupCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ConceptGroupCreatePage"),
  "ConceptGroupCreatePage",
);

export const ConceptGroupEditPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ConceptGroupEditPage"),
  "ConceptGroupEditPage",
);

export const ConceptGroupDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ConceptGroupDetailPage"),
  "ConceptGroupDetailPage",
);

export const ObjectTypeIndexSettingsPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ObjectTypeIndexSettingsPage"),
  "ObjectTypeIndexSettingsPage",
);

export const ObjectTypeCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ObjectTypeCreatePage"),
  "ObjectTypeCreatePage",
);

export const ObjectTypeEditPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ObjectTypeEditPage"),
  "ObjectTypeEditPage",
);

export const ObjectTypeDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ObjectTypeDetailPage"),
  "ObjectTypeDetailPage",
);

export const RelationTypeMappingPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/RelationTypeMappingPage"),
  "RelationTypeMappingPage",
);

export const RelationTypeCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/RelationTypeCreatePage"),
  "RelationTypeCreatePage",
);

export const RelationTypeEditPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/RelationTypeEditPage"),
  "RelationTypeEditPage",
);

export const RelationTypeDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/RelationTypeDetailPage"),
  "RelationTypeDetailPage",
);

export const ActionTypeExecutionPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ActionTypeExecutionPage"),
  "ActionTypeExecutionPage",
);

export const ActionTypeCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ActionTypeCreatePage"),
  "ActionTypeCreatePage",
);

export const ActionTypeEditPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ActionTypeEditPage"),
  "ActionTypeEditPage",
);

export const ActionTypeDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/ActionTypeDetailPage"),
  "ActionTypeDetailPage",
);

export const MetricCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/MetricCreatePage"),
  "MetricCreatePage",
);

export const MetricEditPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/MetricEditPage"),
  "MetricEditPage",
);

export const MetricDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/MetricDetailPage"),
  "MetricDetailPage",
);

export const MetricDataQueryPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/MetricDataQueryPage"),
  "MetricDataQueryPage",
);

export const TaskCreatePage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/TaskCreatePage"),
  "TaskCreatePage",
);

export const TaskDetailPage = lazyNamedExport(
  () => import("@/modules/knowledge-network/pages/TaskDetailPage"),
  "TaskDetailPage",
);

export function workspaceSectionPage(section: KnowledgeNetworkWorkspaceSection) {
  return <KnowledgeNetworkWorkspaceStandalonePage section={section} />;
}
