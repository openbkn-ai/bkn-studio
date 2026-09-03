/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { isSuperAdmin } from "@/framework/auth/super-admin";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";

type RequireSuperAdminProps = {
  children: ReactNode;
};

/** Route-level guard for functionality reserved for the controlled super_admin role. */
export function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
  const runtimeConfig = useRuntimeConfig();

  return isSuperAdmin(runtimeConfig.currentUser.roles) ? <>{children}</> : <Navigate replace to={DEFAULT_APP_ENTRY_PATH} />;
}
