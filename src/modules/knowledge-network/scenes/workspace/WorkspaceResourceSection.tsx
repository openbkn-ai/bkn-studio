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
import { CapabilityListPanel } from "@/modules/knowledge-network/components/capability/CapabilityListPanel";
import { ConceptGroupListPanel } from "@/modules/knowledge-network/components/concept-group/ConceptGroupListPanel";
import { MetricListPanel } from "@/modules/knowledge-network/components/metric/MetricListPanel";
import { ObjectTypeListPanel } from "@/modules/knowledge-network/components/object-type/ObjectTypeListPanel";
import { RelationTypeListPanel } from "@/modules/knowledge-network/components/relation-type/RelationTypeListPanel";
import {
  deleteKnowledgeNetworkActionType,
  deleteKnowledgeNetworkConceptGroup,
  deleteKnowledgeNetworkMetric,
  deleteKnowledgeNetworkObjectType,
  deleteKnowledgeNetworkRelationType,
  importKnowledgeNetworkConceptGroup,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  attachKnowledgeNetworkCapabilities,
  detachKnowledgeNetworkCapabilities,
} from "@/modules/knowledge-network/services/capability-binding.service";
import { useWorkspaceData } from "@/modules/knowledge-network/scenes/workspace/useWorkspaceData";

type WorkspaceData = ReturnType<typeof useWorkspaceData>;

/** The three capability sections differ only in what they mount; one panel serves all of them. */
const CAPABILITY_SECTION_KIND = {
  apis: "api",
  functions: "function",
  mcp: "mcp",
  skills: "skill",
} as const;

const CAPABILITY_SECTION_TYPE = {
  apis: "function",
  functions: "function",
  mcp: "mcp_tool",
  skills: "skill",
} as const;

type WorkspaceResourceSectionProps = {
  canDelete: boolean;
  canModify: boolean;
  data: WorkspaceData;
  networkId: string;
  section: KnowledgeNetworkWorkspaceSection;
};

export function WorkspaceResourceSection({
  canDelete,
  canModify,
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
          canModify={canModify}
          canDelete={canDelete}
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
          canModify={canModify}
          canDelete={canDelete}
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
          canModify={canModify}
          canDelete={canDelete}
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
          canModify={canModify}
          canDelete={canDelete}
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
          canModify={canModify}
          canDelete={canDelete}
          metrics={data.metrics}
          networkId={networkId}
          onDelete={async (metricId) => {
            await deleteKnowledgeNetworkMetric(networkId, metricId);
          }}
          onRefresh={data.reloadMetrics}
          unsupported={data.metricApiUnavailable}
        />
      );
    case "functions":
    case "apis":
    case "mcp":
    case "skills": {
      const kind = CAPABILITY_SECTION_KIND[section];
      const capabilityType = CAPABILITY_SECTION_TYPE[section];
      const sectionData =
        section === "skills"
          ? data.skills
          : section === "mcp"
            ? data.mcpTools
            : section === "apis"
              ? data.apis
              : data.functions;

      return (
        <CapabilityListPanel
          canDelete={canModify}
          canModify={canModify}
          data={sectionData}
          kind={kind}
          loading={data.sectionLoading}
          onDetach={async (bindingIds) => {
            await detachKnowledgeNetworkCapabilities(networkId, bindingIds);
            await data.reloadCapabilities(capabilityType);
          }}
          onMount={async (inputs) => {
            const created = await attachKnowledgeNetworkCapabilities(networkId, inputs);
            await data.reloadCapabilities(capabilityType);
            return created.length;
          }}
          onRefresh={async () => {
            await data.reloadCapabilities(capabilityType);
          }}
        />
      );
    }
    default:
      return null;
  }
}
