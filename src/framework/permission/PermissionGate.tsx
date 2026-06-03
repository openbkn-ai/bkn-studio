import type { PropsWithChildren, ReactNode } from "react";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  hasPermissions,
  type PermissionCheckMode,
} from "@/framework/permission/has-permissions";

type PermissionGateProps = PropsWithChildren<{
  fallback?: ReactNode;
  mode?: PermissionCheckMode;
  permissions: string | string[];
}>;

export function PermissionGate({
  children,
  fallback = null,
  mode = "all",
  permissions,
}: PermissionGateProps) {
  const { runtimeConfig } = useAppServices();
  const allowed = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode,
    requiredPermissions: permissions,
  });

  return allowed ? children : fallback;
}

