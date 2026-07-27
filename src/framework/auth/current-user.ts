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
// instance_operations 只在 scope=type 下出现:该类型下「至少有一个实例持有、但未
// 类型级持有」的操作汇总(见 bkn-safe authz.typeWideGrants)。
type MePermissionsResponse = {
  is_admin?: boolean;
  permissions?: {
    instance_operations?: string[];
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
 * 同一套命名,需经 permission-map 翻译(见该文件注释)。
 *
 * 全量放行的判据是**资源通配授权**(`*:*` 行),不是 `is_admin`。两者不等价:
 * `is_admin` 来自后端 CanAdmin,判的是 `safe_admin:console:manage`——「可以进管理
 * API 面」,系统/安全/审计三员角色都持有它。若按 is_admin 放行全部权限,三员就都
 * 拿到全量权限点,按点位控制入口的门禁在他们身上直接失效(实测 14.103.77.23:三员
 * 的 /me/permissions 均为 is_admin=true,而 permissions 只含各自那几行)。超级管理员
 * 才持有资源通配,其 /me/permissions 折叠成单行 `{type:"*",id:"*",ops:["*"]}`。
 *
 * is_admin 仍然有用:它是 ADMIN_ONLY_SUFFIXES(跨租户运维页)的判据,与执行工厂后端
 * CheckAdminPermission 同口径,所以照常传给 deriveStudioPermissions。
 *
 * 两个请求各自独立降级(allSettled),互不牵连:身份拿不到不影响权限,权限拿不到
 * 一律按无权限处理。permissions 拉取失败绝不放行任何权限(fail-closed)——避免因为
 * 一次瞬时失败让前端沿用带全量权限的默认用户。
 */
export async function fetchCurrentUser(): Promise<RuntimeUser> {
  const [meResult, permResult] = await Promise.allSettled([
    http.get<MeResponse>("/safe/v1/me", { skipErrorToast: true }),
    // scope=type:启动只为渲染导航/菜单,只需类型级授权。响应从随逐对象授权数线性涨
    // 收敛到类型数量级(实测 500 对象授权:501 行 37101B → 1 行 101B)。类型级之外的
    // 操作由后端汇总进 instance_operations,flattenSafeGrants 一并折入,故入口可见性
    // 不受影响。老后端忽略未知参数,两侧可独立上线。
    http.get<MePermissionsResponse>("/safe/v1/me/permissions", {
      params: { scope: "type" },
      skipErrorToast: true,
    }),
  ]);

  const me: MeResponse = meResult.status === "fulfilled" ? meResult.value.data : {};
  // 权限接口失败 → 空授权集 → 推导出空权限,而不是保留调用方的默认(全量)权限。
  const perm: MePermissionsResponse =
    permResult.status === "fulfilled" ? permResult.value.data : {};

  const safeGrants = flattenSafeGrants(perm.permissions);
  const isAdmin = Boolean(perm.is_admin);
  // 资源通配 = 超级管理员,对每一类资源的每个操作都成立,没有逐点推导的必要。
  const hasResourceWildcard = safeGrants.has("*:*");

  return {
    businessDomainId: null,
    id: me.id ?? null,
    isAdmin,
    name: me.name || me.account || me.id || null,
    roles: me.roles ?? [],
    permissions: hasResourceWildcard
      ? [...defaultDevPermissions]
      : deriveStudioPermissions(defaultDevPermissions, safeGrants, isAdmin),
  };
}
