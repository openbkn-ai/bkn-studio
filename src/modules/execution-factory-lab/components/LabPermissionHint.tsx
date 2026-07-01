/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tooltip } from "antd";

import type { PropsWithChildren, ReactElement } from "react";

import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";

type LabPermissionHintProps = PropsWithChildren<{
  permissions: string | string[];
}>;

export function LabPermissionHint({ permissions, children }: LabPermissionHintProps) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const allowed = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions ?? [],
    requiredPermissions: permissions,
  });

  if (allowed) {
    return children;
  }

  return (
    <Tooltip title={t("executionFactoryLab.permissionDeniedHint")}>
      <span style={{ cursor: "not-allowed", display: "inline-block" }}>
        <span style={{ display: "inline-block", opacity: 0.45, pointerEvents: "none" }}>
          {children as ReactElement}
        </span>
      </span>
    </Tooltip>
  );
}
