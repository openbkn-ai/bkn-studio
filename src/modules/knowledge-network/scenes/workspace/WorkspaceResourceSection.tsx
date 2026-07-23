/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import type { KnowledgeNetworkWorkspaceSection } from "@/modules/knowledge-network/contracts/scenes";
import { ActionTypeListPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeListPanel";
import { ConceptGroupListPanel } from "@/modules/knowledge-network/components/concept-group/ConceptGroupListPanel";
import { MetricListPanel } from "@/modules/knowledge-network/components/metric/MetricListPanel";
import { ObjectTypeListPanel } from "@/modules/knowledge-network/components/object-type/ObjectTypeListPanel";
import { RelationTypeListPanel } from "@/modules/knowledge-network/components/relation-type/RelationTypeListPanel";
import { TaskListPanel } from "@/modules/knowledge-network/components/task/TaskListPanel";
import {
  deleteKnowledgeNetworkActionType,
  deleteKnowledgeNetworkConceptGroup,
  deleteKnowledgeNetworkMetric,
  deleteKnowledgeNetworkObjectType,
  deleteKnowledgeNetworkRelationType,
  deleteKnowledgeNetworkTask,
  importKnowledgeNetworkConceptGroup,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";

type WorkspaceData = ReturnType<typeof useWorkspaceData>;

type WorkspaceResourceSectionProps = {
  data: WorkspaceData;
  networkId: string;
  section: KnowledgeNetworkWorkspaceSection;
};

export function WorkspaceResourceSection({
  data,
  networkId,
  section,
}: WorkspaceResourceSectionProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  switch (section) {
    case "concept-groups":
      return (
        <ConceptGroupListPanel
          items={data.conceptGroups}
          loading={data.sectionLoading}
          networkId={networkId}
          onDelete={async (records) => {
            await Promise.all(
              records.map((record) =>
                deleteKnowledgeNetworkConceptGroup(networkId, record.id),
              ),
            );
            void message.success(t("common.success"));
            await data.reloadConceptGroups();
          }}
          onImport={(payload, importMode) =>
            importKnowledgeNetworkConceptGroup(networkId, payload, importMode)
          }
          onRefresh={data.reloadConceptGroups}
        />
      );
    case "object-types":
      return (
        <ObjectTypeListPanel
          items={data.objectTypes}
          loading={data.sectionLoading}
          networkId={networkId}
          onDelete={async (records) => {
            await Promise.all(
              records.map((record) =>
                deleteKnowledgeNetworkObjectType(networkId, record.id),
              ),
            );
            void message.success(t("common.success"));
            await data.reloadObjectTypes();
          }}
          onRefresh={data.reloadObjectTypes}
        />
      );
    case "relation-types":
      return (
        <RelationTypeListPanel
          items={data.relationTypes}
          loading={data.sectionLoading}
          networkId={networkId}
          objectTypes={data.objectTypes}
          onDelete={async (records) => {
            await Promise.all(
              records.map((record) =>
                deleteKnowledgeNetworkRelationType(networkId, record.id),
              ),
            );
            void message.success(t("common.success"));
            await data.reloadRelationTypes();
          }}
          onRefresh={data.reloadRelationTypes}
        />
      );
    case "action-types":
      return (
        <ActionTypeListPanel
          items={data.actionTypes}
          loading={data.sectionLoading}
          networkId={networkId}
          objectTypes={data.objectTypes}
          onDelete={async (records) => {
            await Promise.all(
              records.map((record) =>
                deleteKnowledgeNetworkActionType(networkId, record.id),
              ),
            );
            void message.success(t("common.success"));
            await data.reloadActionTypes();
          }}
          onRefresh={data.reloadActionTypes}
        />
      );
    case "metrics":
      return (
        <MetricListPanel
          loading={data.sectionLoading}
          metrics={data.metrics}
          networkId={networkId}
          onDelete={async (metricId) => {
            await deleteKnowledgeNetworkMetric(networkId, metricId);
          }}
          onRefresh={data.reloadMetrics}
          unsupported={data.metricApiUnavailable}
        />
      );
    case "tasks":
      return (
        <TaskListPanel
          networkId={networkId}
          onDelete={async (taskId) => {
            await deleteKnowledgeNetworkTask(networkId, taskId);
          }}
          onRefresh={data.reloadTasks}
          tasks={data.tasks}
        />
      );
    default:
      return null;
  }
}
