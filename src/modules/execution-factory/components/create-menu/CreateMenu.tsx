/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DownOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PermissionGate } from "@/framework/permission/PermissionGate";
import { AppButton } from "@/framework/ui/common/AppButton";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";
import type { CapabilityUxMode } from "@/modules/execution-factory/utils/capability-ux";
import { isCapabilityUxV2 } from "@/modules/execution-factory/utils/capability-ux";
import {
  getCapabilityCreateMenuSections,
  resolveCapabilityAdpImportTab,
  type CapabilityCreateMenuAction,
} from "@/modules/execution-factory/utils/capability-create-menu";

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
  variant?: "toolbar" | "empty";
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
  variant = "toolbar",
}: CreateMenuProps) {
  const { t } = useTranslation();
  const capabilityUxV2 = isCapabilityUxV2();
  const [legacyWizardOpen, setLegacyWizardOpen] = useState(false);
  const [capabilityWizardOpen, setCapabilityWizardOpen] = useState(false);
  const [capabilityInitialMode, setCapabilityInitialMode] = useState<CapabilityUxMode | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [importActiveTab, setImportActiveTab] = useState<ExecutionUnitTab>(activeTab);
  const [importInitialKind, setImportInitialKind] = useState<"openapi" | "adp" | undefined>();

  const useLegacyOperatorCreate = capabilityUxV2 && activeTab === "operator";
  const showAddCapabilityWizard = capabilityUxV2 && !useLegacyOperatorCreate;
  const showLegacyCreateWizard = !capabilityUxV2 || useLegacyOperatorCreate;
  const permission = capabilityUxV2
    ? useLegacyOperatorCreate
      ? "execution-factory:operator:create"
      : resolveCapabilityCreatePermission(activeTab)
    : getCreatePermission(activeTab);
  const importPermission = getImportPermission(activeTab);
  const menuSections = useMemo(() => getCapabilityCreateMenuSections(), []);

  useEffect(() => {
    if (!autoOpen || !permission) {
      return;
    }

    if (capabilityUxV2 && !useLegacyOperatorCreate) {
      setCapabilityInitialMode(
        activeTab === "mcp"
          ? "mcp"
          : activeTab === "skill"
            ? "skill"
            : "quick-api",
      );
      setCapabilityWizardOpen(true);
    } else {
      setLegacyWizardOpen(true);
    }
    onAutoOpenHandled?.();
  }, [
    activeTab,
    autoOpen,
    capabilityUxV2,
    onAutoOpenHandled,
    permission,
    useLegacyOperatorCreate,
  ]);

  if (!permission) {
    return null;
  }

  const handleResourceCreated = (payload: CreatedExecutionUnitPayload | CreatedCapabilityPayload) => {
    onResourceCreated?.(payload);
  };

  const openCapabilityMode = (mode: CapabilityUxMode) => {
    setCapabilityInitialMode(mode);
    setCapabilityWizardOpen(true);
  };

  const handleCapabilityAction = (action: CapabilityCreateMenuAction) => {
    if (action === "import-adp") {
      setImportActiveTab(resolveCapabilityAdpImportTab(activeTab));
      setImportInitialKind("adp");
      setImportOpen(true);
      return;
    }

    openCapabilityMode(action);
  };

  const capabilityMenuItems: MenuProps["items"] = menuSections.map((section) => ({
    key: section.titleKey,
    label: t(section.titleKey),
    type: "group" as const,
    children: section.items.map((item) => ({
      key: item.action,
      label: (
        <div className={styles.createMenuItem}>
          <div className={styles.createMenuItemTitle}>{t(item.titleKey)}</div>
          <div className={styles.createMenuItemDesc}>{t(item.descriptionKey)}</div>
        </div>
      ),
    })),
  }));

  const createButton = capabilityUxV2 && !useLegacyOperatorCreate ? (
    <Dropdown
      menu={{
        items: capabilityMenuItems,
        onClick: ({ key }) => handleCapabilityAction(key as CapabilityCreateMenuAction),
      }}
      placement="bottomRight"
      trigger={["click"]}
    >
      <AppButton icon={<PlusOutlined />} type="primary">
        {t("executionFactory.addCapabilityButton")}
        <DownOutlined />
      </AppButton>
    </Dropdown>
  ) : (
    <AppButton
      icon={<PlusOutlined />}
      onClick={() => {
        if (capabilityUxV2 && !useLegacyOperatorCreate) {
          openCapabilityMode(
            activeTab === "mcp"
              ? "mcp"
              : activeTab === "skill"
                ? "skill"
                : "quick-api",
          );
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
  );

  return (
    <>
      <PermissionGate permissions={permission}>
        <div className={variant === "empty" ? styles.emptyCreateRow : styles.toolbarRow}>
          {createButton}
          {variant === "toolbar" && importPermission ? (
            <PermissionGate permissions={importPermission}>
              <AppButton
                icon={<UploadOutlined />}
                onClick={() => {
                  setImportActiveTab(activeTab);
                  setImportInitialKind(undefined);
                  setImportOpen(true);
                }}
              >
                {t("executionFactory.importButton")}
              </AppButton>
            </PermissionGate>
          ) : null}
        </div>
      </PermissionGate>

      {showAddCapabilityWizard ? (
        <AddCapabilityWizard
          contextTab={activeTab}
          initialMode={capabilityInitialMode}
          lockInitialMode={Boolean(capabilityInitialMode)}
          onClose={() => {
            setCapabilityWizardOpen(false);
            setCapabilityInitialMode(undefined);
          }}
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
      {importPermission || capabilityUxV2 ? (
        <ImportResourceModal
          activeTab={importActiveTab}
          initialKind={importInitialKind}
          onClose={() => {
            setImportOpen(false);
            setImportInitialKind(undefined);
          }}
          onSuccess={() => {
            onRefresh?.();
          }}
          open={importOpen}
        />
      ) : null}
    </>
  );
}
