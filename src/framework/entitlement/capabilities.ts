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
  /** 对象细粒度授权、显式 allow / deny 与来源级撤销。专业档起。 */
  PERM_FINE_GRAINED: "perm_fine_grained",
  /** 企业对象规则兼容层与属性级权限。企业档起。 */
  PERM_OBJECT_LEVEL: "perm_object_level",
  /**
   * 业务溯源:证据链、数据溯源、业务语义图、Resolver、交互式追溯与导出。企业档起。
   *
   * 由 bkn-trace 实现(走临时分叉 `bkn-foundry-ee`),**不在 bkn-safe 的装配表里**——
   * 所以 `/api/safe/v1/capabilities` 永远不会报它。别拿它去门控导航:那会把这个页面
   * 永久隐藏(ee-design.md §6「A 答不了 B」)。它今天只用于版本页的在售清单。
   */
  BUSINESS_PROVENANCE: "business_provenance",
  /** 认证/高级数据源连接器(SQL Server 等商业库)。专业档起,由 Vega 实现。 */
  CONNECTOR_CERTIFIED: "connector_certified",
  /**
   * 图探索:实例级图探索页与独立看图页。专业档起。
   *
   * 代码不在本仓——它在企业版前端镜像里,经 `@/app/extensions/installed` 注册进来;社区
   * 构建没有这个页面。bkn-safe-ee 把它登记进装配表,所以 `/api/safe/v1/capabilities`
   * 报得出它,入口照常按 `capabilityState()` 判。
   */
  GRAPH_EXPLORER: "graph_explorer",
} as const;

export type CapabilityKey = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
