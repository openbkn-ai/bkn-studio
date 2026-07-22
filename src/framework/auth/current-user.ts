/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  deriveStudioPermissions,
  flattenSafeGrants,
} from "@/framework/auth/permission-map";
import { http } from "@/framework/request/http";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";
import type { RuntimeUser } from "@/framework/runtime/types";

// GET /api/safe/v1/me — caller identity and roles (token-gated by RequireUser).
type MeResponse = {
  account?: string;
  account_type?: string;
  departments?: string[];
  email?: string;
  id?: string;
  name?: string;
  role_ids?: string[];
  roles?: string[];
};

// GET /api/safe/v1/me/permissions — role-inherited grants, type:op pairs.
type MePermissionsResponse = {
  is_admin?: boolean;
  permissions?: {
    operations?: string[];
    resource?: { id?: string; type?: string };
  }[];
};

/**
 * 无身份、无权限的兜底用户。任何权限来源不可用时都退回它——fail-closed:
 * 宁可少给,不可错给。绝不能退回带全量权限的开发态默认用户(见 dev-profile),
 * 否则 /me/permissions 一抖动,普通用户就看到全部系统管理入口(#176)。
 */
export const anonymousRuntimeUser: RuntimeUser = {
  businessDomainId: null,
  id: null,
  isAdmin: false,
  name: null,
  permissions: [],
  roles: [],
};

/**
 * 登录后拉取当前用户身份 + 权限,组装成 RuntimeUser。
 *
 * bkn-safe 下发的是 `<resource_type>:<operation>`,与各模块 manifest 声明的权限点并非
 * 同一套命名,需经 permission-map 翻译(见该文件注释)。is_admin(超级管理员/admin)
 * 放行全部已注册权限。
 *
 * 两个请求各自独立降级(allSettled),互不牵连:身份拿不到不影响权限,权限拿不到
 * 一律按无权限处理。permissions 拉取失败绝不放行任何权限(fail-closed)——避免因为
 * 一次瞬时失败让前端沿用带全量权限的默认用户。
 */
export async function fetchCurrentUser(): Promise<RuntimeUser> {
  const [meResult, permResult] = await Promise.allSettled([
    http.get<MeResponse>("/safe/v1/me", { skipErrorToast: true }),
    http.get<MePermissionsResponse>("/safe/v1/me/permissions", {
      skipErrorToast: true,
    }),
  ]);

  const me: MeResponse = meResult.status === "fulfilled" ? meResult.value.data : {};
  // 权限接口失败 → 空授权集 → 推导出空权限,而不是保留调用方的默认(全量)权限。
  const perm: MePermissionsResponse =
    permResult.status === "fulfilled" ? permResult.value.data : {};

  const safeGrants = flattenSafeGrants(perm.permissions);

  return {
    businessDomainId: null,
    id: me.id ?? null,
    isAdmin: Boolean(perm.is_admin),
    name: me.name || me.account || me.id || null,
    roles: me.roles ?? [],
    permissions: perm.is_admin
      ? [...defaultDevPermissions]
      : deriveStudioPermissions(defaultDevPermissions, safeGrants, false),
  };
}
