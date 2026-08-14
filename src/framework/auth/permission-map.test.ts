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
 * Actual /api/safe/v1/me/permissions response for a regular test user in the test environment.
 * Use a real grant shape as the baseline rather than invented data.
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

  // Under scope=type, the backend aggregates operations held only on some instances into
  // instance_operations. Omitting them would hide menu entries from users granted only a few objects.
  it("并入 instance_operations —— 只被授了对象的用户不丢入口", () => {
    const flat = flattenSafeGrants([
      {
        instance_operations: ["modify"],
        operations: ["view"],
        resource: { id: "*", type: "tool_box" },
      },
      // Pure object-level grant: this type has no type-level operations, only instance-level ones.
      { instance_operations: ["use"], operations: [], resource: { id: "*", type: "agent" } },
    ]);

    expect(flat).toEqual(new Set(["tool_box:view", "tool_box:modify", "agent:use"]));
  });
});

describe("isStudioPermissionGranted", () => {
  const grants = flattenSafeGrants(REAL_NON_ADMIN_GRANTS);

  it("直接同名的权限点保持既有行为", () => {
    // data-catalog declares bkn-safe's native strings, so no translation is required.
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
    // A catalog data-directory grant without any public_access must not enable the marketplace entry.
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

  it("沙箱运行时不由 is_admin 推导，避免三员角色取得业务入口", () => {
    expect(
      isStudioPermissionGranted(executionFactoryLabPermissions.sandboxRuntimeView, grants, false),
    ).toBe(false);
    expect(
      isStudioPermissionGranted(executionFactoryLabPermissions.sandboxRuntimeView, grants, true),
    ).toBe(false);
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
    // bkn-safe emits knowledge_network with an underscore while Studio declares knowledge-network.
    // They do not match by design; this mapping does not cover the module and behavior remains unchanged.
    const knowledgeGrants = flattenSafeGrants([
      { operations: ["create"], resource: { id: "*", type: "knowledge_network" } },
    ]);
    expect(isStudioPermissionGranted("knowledge-network:create", knowledgeGrants, false)).toBe(true);
    expect(isStudioPermissionGranted("knowledge-network:edit", knowledgeGrants, false)).toBe(false);
  });
});

describe("执行工厂权限点覆盖", () => {
  it("除去有意不映的三条，其余全部可由 bkn-safe 授权解析", () => {
    // A user granted every operation on all four resource types should match every execution-factory permission point.
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

    // catalog:install remains blocked because the backend has no endpoint. Sandbox runtime is
    // intentionally absent: its menu is reserved for resource-wildcard super administrators.
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
    // Other resource types remain unaffected.
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

    // The backend has no installation endpoint, so it remains permanently blocked even by a wildcard.
    expect(isStudioPermissionGranted("execution-factory:catalog:install", globalWildcard, false)).toBe(false);
    // Sandbox runtime does not use the grant mapper; fetchCurrentUser gives resource-wildcard
    // super administrators the complete registered permission set directly.
    expect(isStudioPermissionGranted("execution-factory-lab:sandbox-runtime:view", globalWildcard, false)).toBe(false);
  });

  it("模型资源权限映射到 bkn-safe 的 large_model/small_model 操作", () => {
    const grants = flattenSafeGrants([
      {
        operations: ["view_detail", "create", "modify"],
        resource: { id: "*", type: "large_model" },
      },
    ]);

    expect(isStudioPermissionGranted("model-resources:model:view", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("model-resources:large-model:view", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("model-resources:small-model:view", grants, false)).toBe(false);
    expect(isStudioPermissionGranted("model-resources:model:create", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("model-resources:model:edit", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("model-resources:model:delete", grants, false)).toBe(false);
    expect(isStudioPermissionGranted("model-resources:statistics:view", grants, false)).toBe(true);
    expect(isStudioPermissionGranted("model-resources:quota:edit", grants, false)).toBe(true);
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
