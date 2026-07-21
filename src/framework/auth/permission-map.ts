/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 把 bkn-safe 下发的资源授权翻译成 Studio 各模块声明的权限点。
 *
 * 两侧命名从来不是一套：bkn-safe 发的是 `<resource_type>:<operation>`（如 `operator:create`），
 * Studio 声明的是 `<module>:<entity>:<action>`（如 `execution-factory:operator:create`）。
 * 在此之前 current-user.ts 直接拿展平后的 `type:op` 去比对模块权限点，永远不可能命中，
 * 于是所有非超管用户在执行工厂相关页面的权限集恒为空——后端明明授了 operator:create，
 * 前端却连页面都进不去。
 *
 * 执行工厂后端只有四个资源类型：operator / tool_box / mcp / skill
 * （adp/execution-factory/operator-integration/server/interfaces/logics_auth.go:53-58）。
 * 下面的映射即以后端实际鉴权点为准，逐条对齐。
 */

/** bkn-safe 的资源类型。后端仅此四种。 */
type SafeResourceType = "operator" | "tool_box" | "mcp" | "skill";

const ALL_RESOURCE_TYPES: SafeResourceType[] = ["operator", "tool_box", "mcp", "skill"];

/** Studio 的动作 → bkn-safe 的操作。词表不同，需逐个对齐。 */
const ACTION_TO_OPERATION: Record<string, string> = {
  create: "create",
  delete: "delete",
  // Studio 说 debug，后端记的是 execute
  debug: "execute",
  // Studio 说 edit，后端记的是 modify
  edit: "modify",
  execute: "execute",
  publish: "publish",
  unpublish: "unpublish",
  view: "view",
};

/**
 * Studio 的实体 → bkn-safe 的资源类型。
 *
 * capability、function 都是算子的表现形式，归 operator。
 * tool 没有独立资源类型，一切工具级操作都授权到父工具箱（toolbox_handler 全线如此）。
 */
const ENTITY_TO_RESOURCE_TYPE: Record<string, SafeResourceType> = {
  capability: "operator",
  function: "operator",
  mcp: "mcp",
  operator: "operator",
  skill: "skill",
  tool: "tool_box",
  toolbox: "tool_box",
};

/**
 * 需要覆盖默认规则的条目。值为「命中即成立」的 `type:op` 列表，空数组表示恒不成立。
 *
 * 键是去掉模块前缀后的 `<entity>:<action>`，因此 execution-factory 与
 * execution-factory-lab 两个模块共用同一套规则。
 */
const OVERRIDES: Record<string, string[]> = {
  // 市场浏览：后端对四类资源统一按 public_access 判定，没有独立的 market 资源类型。
  // 注意 bkn-safe 也有个叫 catalog 的资源类型，那是 Vega 数据目录，与此处的能力市场
  // 同名不同物，绝不能映过去。
  "catalog:view": ALL_RESOURCE_TYPES.map((type) => `${type}:public_access`),
  // 市场安装：后端在执行工厂中没有对应端点，暂时屏蔽入口，待后端补齐再放开。
  "catalog:install": [],
  // 导入导出：导出读四类中任一，导入在目标类型上建。
  "impex:export": ALL_RESOURCE_TYPES.map((type) => `${type}:view`),
  "impex:import": ALL_RESOURCE_TYPES.map((type) => `${type}:create`),
  // 工具没有自己的资源类型，写操作一律落到父工具箱的 modify。
  "tool:create": ["tool_box:modify"],
  "tool:delete": ["tool_box:modify"],
  "tool:edit": ["tool_box:modify"],
};

/**
 * 只有超管可见的权限点。这些页面返回跨租户运维数据，不隶属于任何单一业务资源，
 * bkn-safe 侧也没有对应的资源类型可授，判定只能锚在 is_admin。
 *
 * 与执行工厂后端 CheckAdminPermission 同口径（复用 bkn-safe 的 safe_admin:console:manage）。
 */
const ADMIN_ONLY_SUFFIXES = new Set(["sandbox-runtime:view"]);

/** 把 bkn-safe 的授权条目展平成 `type:op` 集合。 */
export function flattenSafeGrants(
  grants: { operations?: string[]; resource?: { id?: string; type?: string } }[] | undefined,
): Set<string> {
  const flat = new Set<string>();
  for (const entry of grants ?? []) {
    const type = entry.resource?.type;
    if (!type) {
      continue;
    }
    for (const operation of entry.operations ?? []) {
      flat.add(`${type}:${operation}`);
    }
  }
  return flat;
}

/**
 * 适用本映射的模块前缀。
 *
 * 只翻译执行工厂两个模块。其余模块（knowledge-network、data-catalog、system-admin 等）
 * 的权限点各有各的命名，且部分本就与 bkn-safe 直接同名，不在本次收敛范围内——对它们
 * 保持原有的直接比对行为，避免顺手改动波及未经验证的模块。
 */
const MAPPED_MODULE_PREFIXES = ["execution-factory", "execution-factory-lab"];

/**
 * 判断某个 Studio 权限点在给定的 bkn-safe 授权集下是否成立。
 *
 * 判定顺序：
 *   1. 与 bkn-safe 下发的 `type:op` 直接同名 —— 保留既有行为，任何模块都不会因本映射掉权限；
 *   2. 超管专属权限点 —— 锚在 is_admin；
 *   3. 执行工厂的翻译规则 —— 覆盖表优先于通用的实体/动作映射。
 *
 * 无法解析的权限点判为不成立（fail-closed）：宁可少给，不可错给。
 */
export function isStudioPermissionGranted(
  studioPermission: string,
  safeGrants: Set<string>,
  isAdmin: boolean,
): boolean {
  // 1. 直接同名。data-catalog 的 `catalog:view_detail` 等即走这条。
  if (safeGrants.has(studioPermission)) {
    return true;
  }

  const segments = studioPermission.split(":");
  if (segments.length < 3 || !MAPPED_MODULE_PREFIXES.includes(segments[0])) {
    return false;
  }
  const suffix = segments.slice(1).join(":");

  // 2. 超管专属。
  if (ADMIN_ONLY_SUFFIXES.has(suffix)) {
    return isAdmin;
  }

  // 3. 覆盖表优先。
  const override = OVERRIDES[suffix];
  if (override) {
    return override.some((candidate) => safeGrants.has(candidate));
  }

  const [, entity, action] = segments;
  const resourceType = ENTITY_TO_RESOURCE_TYPE[entity];
  const operation = ACTION_TO_OPERATION[action];
  if (!resourceType || !operation) {
    return false;
  }
  return safeGrants.has(`${resourceType}:${operation}`);
}

/**
 * 从 bkn-safe 授权推导出当前用户实际持有的 Studio 权限点。
 *
 * knownPermissions 是各模块 manifest 声明的全部权限点；只在这个集合内推导，
 * 避免造出模块从未声明过的权限串。
 */
export function deriveStudioPermissions(
  knownPermissions: readonly string[],
  safeGrants: Set<string>,
  isAdmin: boolean,
): string[] {
  return knownPermissions.filter((permission) =>
    isStudioPermissionGranted(permission, safeGrants, isAdmin),
  );
}
