/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty } from "antd";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { CreateMenu } from "@/modules/execution-factory/components/create-menu/CreateMenu";
import {
  canAccessExecutionUnitManagement,
  canViewExecutionUnitManagement,
} from "@/modules/execution-factory/permissions";
import { UnitManagementListScene } from "@/modules/execution-factory/scenes/UnitManagementListScene";

export function UnitManagementListPage() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();

  if (!canAccessExecutionUnitManagement(runtimeConfig.currentUser.permissions)) {
    return <Empty description={t("common.noPermission")} style={{ marginTop: 96 }} />;
  }

  // A create-only role must not mount the list scene: it would issue a list request that
  // correctly requires `view`. Keep the management entry usable by presenting its permitted
  // creation menu instead.
  if (!canViewExecutionUnitManagement(runtimeConfig.currentUser.permissions)) {
    const permissions = runtimeConfig.currentUser.permissions;
    const hasFunctionCreate = permissions.includes("execution-factory:function:create");
    const hasToolboxCreate = permissions.includes("execution-factory:toolbox:create");
    const activeTab =
      hasFunctionCreate || hasToolboxCreate
        ? "toolbox"
        : permissions.includes("execution-factory:mcp:create")
          ? "mcp"
          : "skill";

    return (
      <Empty description={t("executionFactory.createOnlyDescription")} style={{ marginTop: 96 }}>
        <CreateMenu
          activeTab={activeTab}
          {...(activeTab === "toolbox"
            ? { toolboxView: hasFunctionCreate ? "function" : "openapi" }
            : {})}
          variant="empty"
        />
      </Empty>
    );
  }

  return <UnitManagementListScene />;
}
