import { Result } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
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
 * 路由级权限守卫。无权限时渲染 403，不渲染 children——
 * 被守卫的页面因此不会 mount,也就不会触发其拉数据的副作用(避免无权限页狂刷错误 toast)。
 */
export function RequirePermission({
  children,
  fallback,
  mode = "any",
  permissions,
}: RequirePermissionProps) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
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
