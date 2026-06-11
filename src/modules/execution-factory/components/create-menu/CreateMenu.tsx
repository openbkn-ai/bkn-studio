import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import { isCapabilityUxV2 } from "@/modules/execution-factory/utils/capability-ux";

import {
  AddCapabilityWizard,
  type CreatedCapabilityPayload,
} from "./AddCapabilityWizard";
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
  onResourceCreated?: (payload: CreatedExecutionUnitPayload | CreatedCapabilityPayload) => void;
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

  return null;
}

function getLegacyCreateLabel(activeTab: ExecutionUnitTab, t: (key: string) => string) {
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

function resolveCapabilityCreatePermission(activeTab: ExecutionUnitTab) {
  if (activeTab === "skill") {
    return "execution-factory:skill:create";
  }

  if (activeTab === "mcp") {
    return "execution-factory:mcp:create";
  }

  return "execution-factory:toolbox:create";
}

export function CreateMenu({
  activeTab,
  autoOpen = false,
  onAutoOpenHandled,
  onRefresh,
  onResourceCreated,
}: CreateMenuProps) {
  const { t } = useTranslation();
  const capabilityUxV2 = isCapabilityUxV2();
  const [legacyWizardOpen, setLegacyWizardOpen] = useState(false);
  const [capabilityWizardOpen, setCapabilityWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const useLegacyOperatorCreate = capabilityUxV2 && activeTab === "operator";
  const showAddCapabilityWizard = capabilityUxV2 && !useLegacyOperatorCreate;
  const showLegacyCreateWizard = !capabilityUxV2 || useLegacyOperatorCreate;
  const permission = capabilityUxV2
    ? useLegacyOperatorCreate
      ? "execution-factory:operator:create"
      : resolveCapabilityCreatePermission(activeTab)
    : getCreatePermission(activeTab);
  const importPermission = getImportPermission(activeTab);

  useEffect(() => {
    if (!autoOpen || !permission) {
      return;
    }

    if (capabilityUxV2 && !useLegacyOperatorCreate) {
      setCapabilityWizardOpen(true);
    } else {
      setLegacyWizardOpen(true);
    }
    onAutoOpenHandled?.();
  }, [autoOpen, capabilityUxV2, onAutoOpenHandled, permission, useLegacyOperatorCreate]);

  if (!permission) {
    return null;
  }

  const handleResourceCreated = (payload: CreatedExecutionUnitPayload | CreatedCapabilityPayload) => {
    onResourceCreated?.(payload);
  };

  return (
    <>
      <PermissionGate permissions={permission}>
        <div className={styles.toolbarRow}>
          <AppButton
            icon={<PlusOutlined />}
            onClick={() => {
              if (capabilityUxV2 && !useLegacyOperatorCreate) {
                setCapabilityWizardOpen(true);
                return;
              }
              setLegacyWizardOpen(true);
            }}
            type="primary"
          >
            {useLegacyOperatorCreate
              ? t("executionFactory.createOperatorButton")
              : capabilityUxV2
                ? t("executionFactory.addCapabilityButton")
                : getLegacyCreateLabel(activeTab, t)}
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

      {showAddCapabilityWizard ? (
        <AddCapabilityWizard
          contextTab={activeTab}
          initialMode={
            activeTab === "mcp"
              ? "mcp"
              : activeTab === "skill"
                ? "skill"
                : "quick-api"
          }
          onClose={() => setCapabilityWizardOpen(false)}
          onCreated={handleResourceCreated}
          onRefresh={onRefresh}
          open={capabilityWizardOpen}
        />
      ) : null}
      {showLegacyCreateWizard ? (
        <CreateExecutionUnitWizard
          initialTab={activeTab}
          onClose={() => setLegacyWizardOpen(false)}
          onRefresh={onRefresh}
          onResourceCreated={handleResourceCreated}
          open={legacyWizardOpen}
        />
      ) : null}
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
