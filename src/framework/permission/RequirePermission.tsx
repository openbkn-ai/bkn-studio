/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import {
  hasPermissions,
  type PermissionCheckMode,
} from "@/framework/permission/has-permissions";

type RequirePermissionProps = {
  children: ReactNode;
  mode?: PermissionCheckMode;
  permissions: string | string[];
};

/** Route-level permission guard that redirects unauthorized users before guarded pages mount. */
export function RequirePermission({
  children,
  mode = "any",
  permissions,
}: RequirePermissionProps) {
  // Route guards also protect standalone routes, whose page-level Antd/App
  // providers are mounted inside the guarded element. Read only the runtime
  // context available above that boundary so the guard can redirect before a
  // protected page has a chance to mount.
  const runtimeConfig = useRuntimeConfig();
  const allowed = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode,
    requiredPermissions: permissions,
  });

  if (allowed) {
    return <>{children}</>;
  }

  return <Navigate replace to="/home" />;
}
