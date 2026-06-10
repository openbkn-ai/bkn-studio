import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import {
  CreateExecutionUnitWizard,
  type CreatedExecutionUnitPayload,
} from "./CreateExecutionUnitWizard";
import { ImportResourceModal } from "./ImportResourceModal";
import styles from "./create-menu.module.css";

type CreateMenuProps = {
  activeTab: ExecutionUnitTab;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  onRefresh?: () => void;
  onResourceCreated?: (payload: CreatedExecutionUnitPayload) => void;
};

function getCreatePermission(activeTab: ExecutionUnitTab) {
  switch (activeTab) {
    case "operator":
      return "execution-factory:operator:create";
    case "toolbox":
      return "execution-factory:toolbox:create";
    case "mcp":
      return "execution-factory:mcp:create";
    case "skill":
      return "execution-factory:skill:create";
    default:
      return undefined;
  }
}

function getImportPermission(activeTab: ExecutionUnitTab) {
  if (activeTab === "operator" || activeTab === "toolbox" || activeTab === "mcp") {
    return "execution-factory:impex:import";
  }

  return undefined;
}

function getCreateLabel(activeTab: ExecutionUnitTab, t: (key: string) => string) {
  switch (activeTab) {
    case "operator":
      return t("executionFactory.createOperatorButton");
    case "toolbox":
      return t("executionFactory.createToolboxButton");
    case "mcp":
      return t("executionFactory.createMcpButton");
    case "skill":
      return t("executionFactory.importSkillButton");
    default:
      return t("common.create");
  }
}

export function CreateMenu({
  activeTab,
  autoOpen = false,
  onAutoOpenHandled,
  onRefresh,
  onResourceCreated,
}: CreateMenuProps) {
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const permission = getCreatePermission(activeTab);
  const importPermission = getImportPermission(activeTab);

  useEffect(() => {
    if (!autoOpen || !permission) {
      return;
    }

    setWizardOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, onAutoOpenHandled, permission]);

  if (!permission) {
    return null;
  }

  return (
    <>
      <PermissionGate permissions={permission}>
        <div className={styles.toolbarRow}>
          <AppButton icon={<PlusOutlined />} onClick={() => setWizardOpen(true)} type="primary">
            {getCreateLabel(activeTab, t)}
          </AppButton>
          {importPermission ? (
            <PermissionGate permissions={importPermission}>
              <AppButton icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                {t("executionFactory.importButton")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </div>
      </PermissionGate>

      <CreateExecutionUnitWizard
        initialTab={activeTab}
        onClose={() => setWizardOpen(false)}
        onRefresh={onRefresh}
        onResourceCreated={onResourceCreated}
        open={wizardOpen}
      />
      {importPermission ? (
        <ImportResourceModal
          activeTab={activeTab}
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            onRefresh?.();
          }}
          open={importOpen}
        />
      ) : null}
    </>
  );
}
