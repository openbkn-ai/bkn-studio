/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { NavigateFunction } from "react-router-dom";

import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";
import { UpdateSkillPackageModal } from "@/modules/execution-factory/components/create-menu/UpdateSkillPackageModal";
import { InstallFromCatalogModal } from "@/modules/execution-factory/components/InstallFromCatalogModal";
import { InstallSkillFromCatalogModal } from "@/modules/execution-factory/components/InstallSkillFromCatalogModal";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { PublishedPermModal } from "@/modules/execution-factory/components/PublishedPermModal";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import { invalidateLocalResourceIdsCache } from "@/modules/execution-factory/utils/collect-local-resource-ids";

export type ExecutionUnitListOverlaysProps = {
  activeTab: ExecutionUnitTab;
  detailBoxId: string | null;
  detailMcpId: string | null;
  detailOperatorId: string | null;
  detailSkillId: string | null;
  editMcpId: string | null;
  installTarget: {
    id: string;
    name: string;
    type: ImpexComponentType;
    alreadyInstalled: boolean;
  } | null;
  marketMode: boolean;
  navigate: NavigateFunction;
  onCloseDetailBox: () => void;
  onCloseDetailMcp: () => void;
  onCloseDetailOperator: () => void;
  onCloseDetailSkill: () => void;
  onCloseEditMcp: () => void;
  onCloseInstallTarget: () => void;
  onClosePublishedPerm: () => void;
  onCloseSkillInstallTarget: () => void;
  onCloseUpdateSkillPackage: () => void;
  onReloadInstalledResourceIds: (options?: { manual?: boolean }) => void;
  onReloadList: () => void;
  publishedPermTarget: { name: string } | null;
  skillInstallTarget: {
    id: string;
    name: string;
    alreadyInstalled: boolean;
  } | null;
  updateSkillPackageTarget: { id: string; name: string } | null;
};

export function ExecutionUnitListOverlays({
  activeTab,
  detailBoxId,
  detailMcpId,
  detailOperatorId,
  detailSkillId,
  editMcpId,
  installTarget,
  marketMode,
  navigate,
  onCloseDetailBox,
  onCloseDetailMcp,
  onCloseDetailOperator,
  onCloseDetailSkill,
  onCloseEditMcp,
  onCloseInstallTarget,
  onClosePublishedPerm,
  onCloseSkillInstallTarget,
  onCloseUpdateSkillPackage,
  onReloadInstalledResourceIds,
  onReloadList,
  publishedPermTarget,
  skillInstallTarget,
  updateSkillPackageTarget,
}: ExecutionUnitListOverlaysProps) {
  return (
    <>
      <OperatorDetailDrawer
        marketMode={marketMode}
        onClose={onCloseDetailOperator}
        onEdit={(id) => {
          onCloseDetailOperator();
          void navigate(`/execution-factory/units/${id}/edit`);
        }}
        open={Boolean(detailOperatorId)}
        operatorId={detailOperatorId}
      />
      {/* 本域列表点卡片直接进详情页，这三个抽屉只留给市场态的引入前预览。 */}
      {marketMode ? (
        <>
          <ToolboxDetailDrawer
            boxId={detailBoxId}
            marketMode
            onClose={onCloseDetailBox}
            open={Boolean(detailBoxId)}
          />
          <McpDetailDrawer
            marketMode
            mcpId={detailMcpId}
            onClose={onCloseDetailMcp}
            onViewDetail={(id) => {
              onCloseDetailMcp();
              void navigate(`/execution-factory/mcp/${id}?from=catalog`);
            }}
            open={Boolean(detailMcpId)}
          />
          <SkillDetailDrawer
            marketMode
            onClose={onCloseDetailSkill}
            onViewDetail={(id) => {
              onCloseDetailSkill();
              void navigate(`/execution-factory/skills/${id}?from=catalog`);
            }}
            open={Boolean(detailSkillId)}
            skillId={detailSkillId}
          />
        </>
      ) : null}
      <InstallFromCatalogModal
        alreadyInstalled={installTarget?.alreadyInstalled ?? false}
        componentId={installTarget?.id ?? ""}
        componentName={installTarget?.name ?? ""}
        componentType={installTarget?.type ?? "operator"}
        onClose={onCloseInstallTarget}
        onSuccess={() => {
          invalidateLocalResourceIdsCache(activeTab);
          onReloadList();
          onReloadInstalledResourceIds();
        }}
        open={Boolean(installTarget)}
      />
      <InstallSkillFromCatalogModal
        alreadyInstalled={skillInstallTarget?.alreadyInstalled ?? false}
        onClose={onCloseSkillInstallTarget}
        onSuccess={() => {
          invalidateLocalResourceIdsCache(activeTab);
          onReloadList();
          onReloadInstalledResourceIds();
        }}
        open={Boolean(skillInstallTarget)}
        skillId={skillInstallTarget?.id ?? ""}
        skillName={skillInstallTarget?.name ?? ""}
      />
      <PublishedPermModal
        activeTab={activeTab}
        onClose={onClosePublishedPerm}
        open={Boolean(publishedPermTarget)}
        resourceName={publishedPermTarget?.name ?? ""}
      />
      <CreateMcpDrawer
        mcpId={editMcpId}
        onClose={onCloseEditMcp}
        onUpdated={onReloadList}
        open={Boolean(editMcpId)}
      />
      <UpdateSkillPackageModal
        onClose={onCloseUpdateSkillPackage}
        onUpdated={onReloadList}
        open={Boolean(updateSkillPackageTarget)}
        skillId={updateSkillPackageTarget?.id ?? null}
        skillName={updateSkillPackageTarget?.name}
      />
    </>
  );
}
