/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

// 对象级授权（object-level authorization），对接 bkn-safe
// `/api/safe/v1/admin/object-grants`。在 RBAC（角色 → 权限）之上的补充层：
// 把某个具体对象（数据目录 / 模型 / 算子 …）的若干操作，直接授予**一个用户**。
//
// 后端契约要点（frontend-object-grants-integration.md）：
//   - 被授权方只支持「用户」（部门已从后端移除：casbin 无 user→部门成员规则）。
//   - 一条授权 = {accessor_id, resource:{type,id}, operations[]}，无 id / 无授权人时间。
//   - 唯一键 = accessor_id + resource.type + resource.id；POST 为「整套替换」语义。
//   - resource.id 必须是具体实例，不支持 `*` 通配（整类授权走角色页）。
//   - bkn-safe 不存资源名，对象名由前端从各领域服务解析（这里 objName 即解析结果）。

/** 一条对象级授权：把某对象的若干操作授予某个用户。 */
export type ObjectGrant = {
  /** 被授权用户 id（后端 accessor_id）。 */
  accessorId: string;
  objId: string;
  /** 前端解析的对象名（后端只返 type:id）；mock 直接带，真实模式从领域服务解析。 */
  objName: string;
  objSub?: string;
  objType: string;
  /** 取自 operationsForType(objType)（对象授权 UI 里隐藏类型级的 create）。 */
  operations: string[];
};

/** 可被授权的对象（总览页「新建授权」对象选择器）。真实模式从领域服务取。 */
export type AuthorizableObject = {
  id: string;
  name: string;
  sub?: string;
  type: string;
};

/** 新增/更新一条授权（按 用户 + 对象 唯一，整套替换）。operations 为空 = 撤销。 */
export type ObjectGrantInput = {
  accessorId: string;
  objId: string;
  objName: string;
  objSub?: string;
  objType: string;
  operations: string[];
};

export type AuthzSummary = {
  /** 去重后的被授权用户数。 */
  grantees: number;
  grants: number;
  objects: number;
};
