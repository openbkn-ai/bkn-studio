// 对象级授权开放的对象类型 —— 对接 bkn-safe 的 type 词表
// (frontend-object-grants-integration.md 第三节)。授权粒度到「整个对象实例」
// （如整个 Catalog），不做单条数据资源(resource)的细粒度授权。类型 label /
// 操作词表统一复用 resource-catalog。
import { resourceTypeLabel } from "@/modules/system-admin/utils/resource-catalog";

export const AUTHZ_OBJECT_TYPES = [
  "catalog",
  "knowledge_network",
  "small_model",
  "large_model",
  "operator",
  "tool_box",
  "mcp",
  "skill",
] as const;

/** 对象授权 UI 里隐藏的「类型级」操作（在具体实例上无意义）。 */
export const HIDDEN_INSTANCE_OPS = new Set(["create"]);

export type AuthzObjectType = (typeof AUTHZ_OBJECT_TYPES)[number];

export function isAuthzObjectType(type: string): type is AuthzObjectType {
  return (AUTHZ_OBJECT_TYPES as readonly string[]).includes(type);
}

/** 对象类型下拉项（{value,label}）。 */
export function authzObjectTypeOptions(): Array<{ label: string; value: string }> {
  return AUTHZ_OBJECT_TYPES.map((type) => ({ label: resourceTypeLabel(type), value: type }));
}
