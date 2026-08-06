/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 付费能力名。**必须走常量,不许写字面量。**
 *
 * 打错一个字的后果是静默的:`useCapability("rbac_bassic")` 不会报错,只会永远返回
 * not-installed,于是那个入口在所有部署上都不显示,而且没有任何地方会红。常量至少
 * 让它变成一个编译错误。
 *
 * 名字与后端各插座的 Capability 常量一一对应(`adminwrite.Capability` 等)。权威
 * 字典在 license-server `docs/design/license-service.md` §1.5;这里只是镜像,新增
 * 能力先改那边。
 *
 * 注意它们**不是**证书里的 feature key——虽然拼写相同。授权按档位判,这些字符串
 * 只是"哪个能力"的标识,不参与任何授权判定。
 */
export const CAPABILITIES = {
  /** 自定义角色/部门/权限的写入面。专业档起。 */
  RBAC_BASIC: "rbac_basic",
  /** 对象级授权与高级角色控制(显式 deny、有效期)。企业档起。 */
  PERM_OBJECT_LEVEL: "perm_object_level",
  /** 操作审计与合规报表。企业档起。 */
  AUDIT: "audit",
} as const;

export type CapabilityKey = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
