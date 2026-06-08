import type { NavigateFunction } from "react-router-dom";

import { CreateMcpDrawer } from "@/modules/execution-factory/components/create-menu/CreateMcpDrawer";
import { UpdateSkillPackageModal } from "@/modules/execution-factory/components/create-menu/UpdateSkillPackageModal";
import { InstallFromCatalogModal } from "@/modules/execution-factory/components/InstallFromCatalogModal";
import { InstallSkillFromCatalogModal } from "@/modules/execution-factory/components/InstallSkillFromCatalogModal";
import { McpDetailDrawer } from "@/modules/execution-factory/components/McpDetailDrawer";
import { OperatorDetailDrawer } from "@/modules/execution-factory/components/OperatorDetailDrawer";
import { PublishedPermModal } from "@/modules/execution-factory/components/PublishedPermModal";
import { SkillDetailDrawer } from "@/modules/execution-factory/components/SkillDetailDrawer";
import { SkillHistoryDrawer } from "@/modules/execution-factory/components/SkillHistoryDrawer";
import { ToolboxDetailDrawer } from "@/modules/execution-factory/components/ToolboxDetailDrawer";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import type { ImpexComponentType } from "@/modules/execution-factory/types/impex";
import { invalidateLocalResourceIdsCache } from "@/modules/execution-factory/utils/collect-local-resource-ids";

export type ExecutionUnitListOverlaysProps = {
  activeTab: ExecutionUnitTab;
  detailBoxId: string | null;
  detailBoxEditMode: boolean;
  detailMcpId: string | null;
  detailOperatorId: string | null;
  detailSkillId: string | null;
  editMcpId: string | null;
  historySkillId: string | null;
  installTarget: {
    id: string;
    name: string;
    type: ImpexComponentType;
    alreadyInstalled: boolean;
  } | null;
  marketMode: boolean;
  navigate: NavigateFunction;
  onCloseDetailBox: () => void;
  onCloseDetailBoxEditMode: () => void;
  onCloseDetailMcp: () => void;
  onCloseDetailOperator: () => void;
  onCloseDetailSkill: () => void;
  onCloseEditMcp: () => void;
  onCloseHistorySkill: () => void;
  onCloseInstallTarget: () => void;
  onClosePublishedPerm: () => void;
  onCloseSkillInstallTarget: () => void;
  onCloseUpdateSkillPackage: () => void;
  onOpenHistorySkill: (skillId: string) => void;
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
  detailBoxEditMode,
  detailMcpId,
  detailOperatorId,
  detailSkillId,
  editMcpId,
  historySkillId,
  installTarget,
  marketMode,
  navigate,
  onCloseDetailBox,
  onCloseDetailBoxEditMode,
  onCloseDetailMcp,
  onCloseDetailOperator,
  onCloseDetailSkill,
  onCloseEditMcp,
  onCloseHistorySkill,
  onCloseInstallTarget,
  onClosePublishedPerm,
  onCloseSkillInstallTarget,
  onCloseUpdateSkillPackage,
  onOpenHistorySkill,
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
      <ToolboxDetailDrawer
        boxId={detailBoxId}
        initialEditMode={detailBoxEditMode}
        marketMode={marketMode}
        onClose={() => {
          onCloseDetailBoxEditMode();
          onCloseDetailBox();
        }}
        onManageTools={(id) => {
          onCloseDetailBoxEditMode();
          onCloseDetailBox();
          void navigate(
            `/execution-factory/toolboxes/${id}/tools?action=${marketMode ? "view" : "edit"}`,
          );
        }}
        onUpdated={onReloadList}
        open={Boolean(detailBoxId)}
      />
      <McpDetailDrawer
        marketMode={marketMode}
        mcpId={detailMcpId}
        onClose={onCloseDetailMcp}
        open={Boolean(detailMcpId)}
      />
      <SkillDetailDrawer
        marketMode={marketMode}
        onClose={onCloseDetailSkill}
        onEdit={(skillId) => {
          onCloseDetailSkill();
          void navigate(`/execution-factory/skills/${skillId}/edit`);
        }}
        onOpenHistory={(skillId) => {
          onCloseDetailSkill();
          onOpenHistorySkill(skillId);
        }}
        open={Boolean(detailSkillId)}
        skillId={detailSkillId}
      />
      <SkillHistoryDrawer
        onClose={onCloseHistorySkill}
        onUpdated={onReloadList}
        open={Boolean(historySkillId)}
        skillId={historySkillId}
      />
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
