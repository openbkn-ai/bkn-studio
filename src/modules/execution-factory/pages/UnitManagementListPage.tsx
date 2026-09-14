/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty } from "antd";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { canAccessExecutionUnitManagement } from "@/modules/execution-factory/permissions";
import { UnitManagementListScene } from "@/modules/execution-factory/scenes/UnitManagementListScene";

export function UnitManagementListPage() {
  const { t } = useTranslation();
  const runtimeConfig = useRuntimeConfig();

  if (!canAccessExecutionUnitManagement(runtimeConfig.currentUser.permissions)) {
    return <Empty description={t("common.noPermission")} style={{ marginTop: 96 }} />;
  }

  return <UnitManagementListScene />;
}
