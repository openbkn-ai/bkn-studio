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
 * 登录后拉取当前用户身份 + 权限,组装成 RuntimeUser。
 * 权限展平成 `type:op`(对齐各模块 manifest 的权限点);
 * is_admin(超级管理员/admin)放行全部已注册权限。
 */
export async function fetchCurrentUser(): Promise<RuntimeUser> {
  const [meResult, permResult] = await Promise.all([
    http.get<MeResponse>("/safe/v1/me", { skipErrorToast: true }),
    http.get<MePermissionsResponse>("/safe/v1/me/permissions", {
      skipErrorToast: true,
    }),
  ]);

  const me = meResult.data;
  const perm = permResult.data;

  const flattened = (perm.permissions ?? []).flatMap((entry) => {
    const type = entry.resource?.type;
    if (!type) {
      return [];
    }
    return (entry.operations ?? []).map((operation) => `${type}:${operation}`);
  });

  return {
    businessDomainId: null,
    id: me.id ?? null,
    name: me.name || me.account || me.id || null,
    roles: me.roles ?? [],
    permissions: perm.is_admin
      ? [...defaultDevPermissions]
      : Array.from(new Set(flattened)),
  };
}
