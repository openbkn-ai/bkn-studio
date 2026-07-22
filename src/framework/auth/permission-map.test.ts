/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  deriveStudioPermissions,
  flattenSafeGrants,
  isStudioPermissionGranted,
} from "@/framework/auth/permission-map";
import { executionFactoryLabPermissions } from "@/modules/execution-factory-lab/permissions";
import { executionFactoryLabModuleManifest } from "@/modules/execution-factory-lab/module.manifest";
import { executionFactoryModuleManifest } from "@/modules/execution-factory/module.manifest";
import { defaultDevPermissions } from "@/framework/runtime/module-manifests";

/**
 * 取自测试环境 10.211.55.4 上普通用户 test 的 /api/safe/v1/me/permissions 实际响应，
 * 用真实授权形态而非臆造的数据做基准。
 */
const REAL_NON_ADMIN_GRANTS = [
  {
    operations: ["view_detail", "create", "modify", "delete", "authorize", "task_manage"],
    resource: { id: "*", type: "catalog" },
  },
  {
    operations: [
      "create",
      "modify",
      "delete",
      "view",
      "publish",
      "unpublish",
      "authorize",
      "public_access",
      "execute",
    ],
    resource: { id: "*", type: "operator" },
  },
  {
    operations: ["create", "modify", "delete", "view", "publish", "unpublish", "execute"],
    resource: { id: "*", type: "tool_box" },
  },
  {
    operations: ["create", "modify", "delete", "view", "publish"],
    resource: { id: "*", type: "skill" },
  },
  {
    operations: ["create", "modify", "delete", "view", "publish"],
    resource: { id: "*", type: "mcp" },
  },
];

describe("flattenSafeGrants", () => {
  it("展平成 type:op，缺资源类型的条目丢弃", () => {
    const flat = flattenSafeGrants([
      { operations: ["create", "view"], resource: { id: "*", type: "operator" } },
      { operations: ["create"], resource: { id: "*" } },
      { operations: undefined, resource: { type: "skill" } },
    ]);

    expect(flat).toEqual(new Set(["operator:create", "operator:view"]));
  });

  it("空输入不炸", () => {
    expect(flattenSafeGrants(undefined)).toEqual(new Set());
  });
});

describe("isStudioPermissionGranted", () => {
  const grants = flattenSafeGrants(REAL_NON_ADMIN_GRANTS);

  it("直接同名的权限点保持既有行为", () => {
    // data-catalog 声明的就是 bkn-safe 的原生串，不经翻译即成立。
    expect(isStudioPermissionGranted("catalog:view_detail", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("catalog:task_manage", grants, false)).toBe(true);
  });

  it("能力的增删改查按 operator 判定，且 edit 落到 modify、debug 落到 execute", () => {
    expect(isStudioPermissionGranted("execution-factory-lab:capability:create", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory-lab:capability:view", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:operator:edit", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:operator:debug", grants, false)).toBe(true);
  });

  it("函数归算子，与后端 #345 的门禁同口径", () => {
    expect(isStudioPermissionGranted("execution-factory-lab:function:create", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory-lab:function:debug", grants, false)).toBe(true);
  });

  it("工具没有独立资源类型，写操作落到父工具箱的 modify", () => {
    const withoutToolboxModify = flattenSafeGrants([
      { operations: ["view", "create"], resource: { id: "*", type: "tool_box" } },
    ]);

    expect(isStudioPermissionGranted("execution-factory:tool:view", withoutToolboxModify, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:tool:create", withoutToolboxModify, false)).toBe(false);
    expect(isStudioPermissionGranted("execution-factory:tool:edit", withoutToolboxModify, false)).toBe(false);
  });

  it("市场浏览按 public_access 判定，不误用 bkn-safe 的同名 catalog 数据目录", () => {
    // 只有 catalog 数据目录授权、没有任何 public_access 时，市场入口不应成立。
    const onlyDataCatalog = flattenSafeGrants([
      { operations: ["view_detail", "create"], resource: { id: "*", type: "catalog" } },
    ]);
    expect(isStudioPermissionGranted("execution-factory-lab:catalog:view", onlyDataCatalog, false)).toBe(false);

    expect(isStudioPermissionGranted("execution-factory-lab:catalog:view", grants, false)).toBe(true);
  });

  it("市场安装暂时屏蔽，超管也不放行", () => {
    expect(isStudioPermissionGranted("execution-factory-lab:catalog:install", grants, false)).toBe(false);
    expect(isStudioPermissionGranted("execution-factory-lab:catalog:install", grants, true)).toBe(false);
  });

  it("沙箱运行时只认超管，与后端 CheckAdminPermission 同口径", () => {
    expect(
      isStudioPermissionGranted(executionFactoryLabPermissions.sandboxRuntimeView, grants, false),
    ).toBe(false);
    expect(
      isStudioPermissionGranted(executionFactoryLabPermissions.sandboxRuntimeView, grants, true),
    ).toBe(true);
  });

  it("零权限账号一条都拿不到", () => {
    const empty = flattenSafeGrants([]);
    for (const permission of defaultDevPermissions) {
      expect(isStudioPermissionGranted(permission, empty, false)).toBe(false);
    }
  });

  it("无法解析的权限点 fail-closed", () => {
    expect(isStudioPermissionGranted("execution-factory:unknown:view", grants, false)).toBe(false);
    expect(isStudioPermissionGranted("execution-factory:operator:teleport", grants, false)).toBe(false);
    expect(isStudioPermissionGranted("garbage", grants, false)).toBe(false);
  });

  it("未纳入映射的模块保持原样，不因翻译而误得权限", () => {
    // bkn-safe 发的是 knowledge_network（下划线），Studio 声明的是 knowledge-network，
    // 两者本就不匹配；本映射不涉及该模块，行为维持不变。
    const knowledgeGrants = flattenSafeGrants([
      { operations: ["create"], resource: { id: "*", type: "knowledge_network" } },
    ]);
    expect(isStudioPermissionGranted("knowledge-network:create", knowledgeGrants, false)).toBe(false);
  });
});

describe("执行工厂权限点覆盖", () => {
  it("除去有意不映的三条，其余全部可由 bkn-safe 授权解析", () => {
    // 四类资源全量授权的用户，理应命中执行工厂的每一个权限点。
    const fullGrants = flattenSafeGrants(
      ["operator", "tool_box", "mcp", "skill"].map((type) => ({
        operations: [
          "create",
          "modify",
          "delete",
          "view",
          "publish",
          "unpublish",
          "authorize",
          "public_access",
          "execute",
        ],
        resource: { id: "*", type },
      })),
    );
    const all = [
      ...executionFactoryModuleManifest.permissions,
      ...executionFactoryLabModuleManifest.permissions,
    ];

    const unresolved = all.filter(
      (permission) => !isStudioPermissionGranted(permission, fullGrants, false),
    );

    // catalog:install 暂时屏蔽（后端无对应端点）；sandbox-runtime:view 锚在 is_admin。
    expect(unresolved.sort()).toEqual([
      "execution-factory-lab:catalog:install",
      "execution-factory-lab:sandbox-runtime:view",
      "execution-factory:catalog:install",
    ]);
  });
});

describe("折叠通配契约", () => {
  it("类型级 operator:* 放行该类型全部动作,含实例映射", () => {
    const typeWildcard = flattenSafeGrants([
      { operations: ["*"], resource: { id: "*", type: "operator" } },
    ]);

    expect(isStudioPermissionGranted("execution-factory:operator:create", typeWildcard, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:operator:edit", typeWildcard, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:operator:debug", typeWildcard, false)).toBe(true);
    // 另一类型不受影响。
    expect(isStudioPermissionGranted("execution-factory:toolbox:create", typeWildcard, false)).toBe(false);
  });

  it("全局通配 *:* 放行所有可映射权限点(非 is_admin 也算)", () => {
    const globalWildcard = flattenSafeGrants([
      { operations: ["*"], resource: { id: "*", type: "*" } },
    ]);

    expect(isStudioPermissionGranted("execution-factory:operator:create", globalWildcard, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory:tool:edit", globalWildcard, false)).toBe(true);
    expect(isStudioPermissionGranted("execution-factory-lab:catalog:view", globalWildcard, false)).toBe(true);
  });

  it("通配不绕过有意屏蔽:catalog:install 与 sandbox-runtime:view 仍锁死", () => {
    const globalWildcard = flattenSafeGrants([
      { operations: ["*"], resource: { id: "*", type: "*" } },
    ]);

    // 后端无安装端点,永久屏蔽——通配也不放。
    expect(isStudioPermissionGranted("execution-factory:catalog:install", globalWildcard, false)).toBe(false);
    // 沙箱运行时锚在 is_admin,通配的非超管拿不到。
    expect(isStudioPermissionGranted("execution-factory-lab:sandbox-runtime:view", globalWildcard, false)).toBe(false);
  });
});

describe("deriveStudioPermissions", () => {
  it("只在已声明的权限点内推导，不凭空造串", () => {
    const grants = flattenSafeGrants(REAL_NON_ADMIN_GRANTS);
    const derived = deriveStudioPermissions(defaultDevPermissions, grants, false);

    expect(derived.length).toBeGreaterThan(0);
    for (const permission of derived) {
      expect(defaultDevPermissions).toContain(permission);
    }
  });

  it("普通用户拿得到能力相关权限——修复前这里恒为空", () => {
    const grants = flattenSafeGrants(REAL_NON_ADMIN_GRANTS);
    const derived = deriveStudioPermissions(defaultDevPermissions, grants, false);

    expect(derived).toContain(executionFactoryLabPermissions.capabilityView);
    expect(derived).toContain(executionFactoryLabPermissions.capabilityCreate);
    expect(derived).not.toContain(executionFactoryLabPermissions.sandboxRuntimeView);
  });
});
