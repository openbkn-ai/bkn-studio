import type { AdminPermission } from "@/modules/system-admin/types/admin";

/**
 * 权限点目录（authorization「资源:操作」），按子系统分组。对应 bkn-sdk
 * authorization 的 role permission 形态；角色抽屉据此渲染分组勾选。
 */
export const PERMISSION_GROUPS = [
  "知识网络",
  "数据平台 · Vega",
  "模型工厂",
  "执行工厂",
  "可观测性",
  "系统管理",
] as const;

export const PERMISSIONS: AdminPermission[] = [
  { key: "ontology-manager:*", label: "知识网络 · 全部", group: "知识网络" },
  { key: "ontology-manager:read", label: "知识网络 · 只读", group: "知识网络" },
  { key: "vega:catalog:*", label: "数据连接 / Catalog · 管理", group: "数据平台 · Vega" },
  { key: "vega:resource:*", label: "数据资源 · 管理", group: "数据平台 · Vega" },
  { key: "vega:build", label: "索引构建 · 执行", group: "数据平台 · Vega" },
  { key: "vega:read", label: "数据平台 · 只读", group: "数据平台 · Vega" },
  { key: "model:manage", label: "模型 · 管理", group: "模型工厂" },
  { key: "model:invoke", label: "模型 · 调用", group: "模型工厂" },
  { key: "agent:*", label: "智能体 · 管理", group: "执行工厂" },
  { key: "skill:*", label: "技能 / 工具箱 · 管理", group: "执行工厂" },
  { key: "trace:read", label: "Trace · 诊断", group: "可观测性" },
  { key: "admin:*", label: "系统管理 · 全部", group: "系统管理" },
];

const labelByKey = new Map(PERMISSIONS.map((item) => [item.key, item.label]));

export function permissionLabel(key: string): string {
  return labelByKey.get(key) ?? key;
}

export function permissionsByGroup(group: string): AdminPermission[] {
  return PERMISSIONS.filter((item) => item.group === group);
}
