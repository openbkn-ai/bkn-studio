/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer, Space, Steps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

import { CreateMcpDrawer } from "./CreateMcpDrawer";
import { CreateSkillForm } from "./CreateSkillForm";
import { CreateToolboxForm } from "./CreateToolboxForm";
import { CreateWizardTypeStep } from "./CreateWizardTypeStep";
import styles from "./create-menu.module.css";

export type CreatedExecutionUnitPayload = {
  id: string;
  tab: ExecutionUnitTab;
  toolId?: string;
};

type CreateExecutionUnitWizardProps = {
  allowedTabsOverride?: readonly ExecutionUnitTab[];
  initialTab: ExecutionUnitTab;
  onClose: () => void;
  onRefresh?: () => void;
  onResourceCreated?: (payload: CreatedExecutionUnitPayload) => void;
  open: boolean;
};

export function CreateExecutionUnitWizard({
  allowedTabsOverride,
  initialTab,
  onClose,
  onRefresh,
  onResourceCreated,
  open,
}: CreateExecutionUnitWizardProps) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const allowedMetadataTypes = (["openapi", "function"] as const).filter((kind) =>
    hasPermissions({
      currentPermissions: runtimeConfig.currentUser.permissions,
      requiredPermissions:
        kind === "function"
          ? "execution-factory:function:create"
          : "execution-factory:toolbox:create",
    }),
  );
  const allowedTabs = (["toolbox", "mcp", "skill"] as const).filter(
    (tab) =>
      (!allowedTabsOverride || allowedTabsOverride.includes(tab)) &&
      (tab === "toolbox"
        ? allowedMetadataTypes.length > 0
        : hasPermissions({
            currentPermissions: runtimeConfig.currentUser.permissions,
            requiredPermissions: `execution-factory:${tab}:create`,
          })),
  );
  const [step, setStep] = useState(0);
  const [selectedTab, setSelectedTab] = useState<ExecutionUnitTab>(initialTab);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep(0);
    setSelectedTab(initialTab);
  }, [initialTab, open]);

  const stepItems = useMemo(
    () => [
      { title: t("executionFactory.createWizardStepType") },
      { title: t("executionFactory.createWizardStepDetails") },
    ],
    [t],
  );

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const handleCreated = (tab: ExecutionUnitTab, id: string) => {
    onRefresh?.();
    onResourceCreated?.({ tab, id });
    handleClose();
  };

  const renderStepBody = () => {
    if (step === 0) {
      return (
        <CreateWizardTypeStep
          allowedTabs={allowedTabs}
          onChange={(tab) => {
            if (allowedTabs.includes(tab)) setSelectedTab(tab);
          }}
          value={selectedTab}
        />
      );
    }

    switch (selectedTab) {
      case "toolbox":
        return (
          <CreateToolboxForm
            formId="create-toolbox-form"
            allowedMetadataTypes={[...allowedMetadataTypes]}
            onCreated={(boxId) => handleCreated("toolbox", boxId)}
          />
        );
      case "mcp":
        return (
          <CreateMcpDrawer
            embedded
            onClose={() => setStep(0)}
            onCreated={(mcpId) => handleCreated("mcp", mcpId)}
            open
          />
        );
      case "skill":
        return (
          <CreateSkillForm
            formId="create-skill-form"
            onImported={(skillId) => handleCreated("skill", skillId)}
          />
        );
      default:
        return null;
    }
  };

  const renderFooter = () => {
    if (step === 0) {
      return (
        <Space>
          <AppButton onClick={handleClose}>{t("common.cancel")}</AppButton>
          <AppButton onClick={() => setStep(1)} type="primary">
            {t("common.next")}
          </AppButton>
        </Space>
      );
    }

    if (selectedTab === "mcp") {
      return <AppButton onClick={() => setStep(0)}>{t("common.back")}</AppButton>;
    }

    return (
      <Space>
        <AppButton onClick={() => setStep(0)}>{t("common.back")}</AppButton>
        <AppButton form={`create-${selectedTab}-form`} htmlType="submit" type="primary">
          {t("common.confirm")}
        </AppButton>
      </Space>
    );
  };

  if (!allowedTabs.includes(initialTab) || !allowedTabs.includes(selectedTab)) return null;

  return (
    <Drawer
      destroyOnHidden
      footer={<div className={styles.wizardFooter}>{renderFooter()}</div>}
      onClose={handleClose}
      open={open}
      title={t("executionFactory.createWizardTitle")}
      width={800}
    >
      <Steps className={styles.wizardSteps} current={step} items={stepItems} size="small" />
      {renderStepBody()}
    </Drawer>
  );
}
