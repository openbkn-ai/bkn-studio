/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Result } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  hasPermissions,
  type PermissionCheckMode,
} from "@/framework/permission/has-permissions";

type RequirePermissionProps = {
  children: ReactNode;
  fallback?: ReactNode;
  mode?: PermissionCheckMode;
  permissions: string | string[];
};

/**
 * Route-level permission guard. Renders 403 instead of children when unauthorized, so guarded
 * pages never mount or trigger data-fetching side effects that would repeatedly show error toasts.
 */
export function RequirePermission({
  children,
  fallback,
  mode = "any",
  permissions,
}: RequirePermissionProps) {
  const { t } = useTranslation();
  // Route guards also protect standalone routes, whose page-level Antd/App
  // providers are mounted inside the guarded element. Read only the runtime
  // context available above that boundary so the guard itself cannot fail
  // before it has a chance to render the permission result.
  const runtimeConfig = useRuntimeConfig();
  const allowed = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode,
    requiredPermissions: permissions,
  });

  if (allowed) {
    return <>{children}</>;
  }

  return (
    fallback ?? <Result status="403" subTitle={t("common.noPermission")} title="403" />
  );
}
