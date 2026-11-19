/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Edition } from "@/framework/entitlement/edition";

/**
 * 能力登记表在产品内的快照。
 *
 * 单一真源是 license-server 的 `capabilities` 表(`store/capabilities.go` 的 seed,
 * 设计见 license-server `docs/design/capability-registry.md` §9)。这里是它的镜像,
 * **产品自带、不在运行时去拉**——决策 7:客户常常完全离线,而离线激活流程正是为拉不到
 * license-server 的客户存在的,那些客户同样拉不到名字。
 *
 * 只收对客户在售的行。`planned`(multi_tenant / offline_bundle /
 * bigdata_connect,以及上游 e8fdf2f 退回 planned 的 audit /
 * ops_dashboard / branding——EE 侧从未实现)一条都不进。`impact_graph` 与
 * `source_sync` 同样不进:登记表里是 active,但这一版产品里没有对应功能,列出来就是在卖
 * 交付不了的东西——登记表管的是「在售能力集」,产品页管的是「这一版真有什么」,两者不
 * 一致时以后者为准。
 * 登记表里它们存在是为了让路线图落在表里而不是散文里,对客户不可见——写进版本对比页
 * 就是在卖还没有的东西。
 *
 * 另一种例外是标了 `planned: true` 的行:产品决定把路线图上的企业运维能力摆出来,页面明确标
 * 「规划中」,不标「新增」——写清楚「还没有」,就不算在卖还没有的东西(2026-11-19)。
 *
 * 反方向的例外与 business_provenance 同一种:产品已经决定按某档在售、页面上已有入口,登记表
 * 还没跟上(2026-11-19 版本划分):knowledge_base / analysis_canvas / version_mgmt 上游仍是
 * planned,bkn_project / risk_control 上游还没有这一行。页面先按在售展示,登记表另行补登记、
 * 转 active。
 *
 * `key` 与 `minEdition` 在登记表里创建后不可改(改 key 会让存量证的那一项失去对应,
 * 改 minEdition 等于静默改动合同范围),所以这份快照对齐它们即可,名称与描述走 i18n。
 */
export type CapabilityCategory =
  "dataConnect" | "modeling" | "observability" | "operations" | "permission" | "semantic";

export type CapabilityCatalogEntry = {
  category: CapabilityCategory;
  /** 登记表主键,同时是证书 `features[]` 里的拼写,也是后端装配表 `MarkAssembled` 的名字。 */
  key: string;
  minEdition: Edition;
  /**
   * `/api/safe/v1/capabilities` 报不报得出这一项。
   *
   * 注意问的**不是**「谁实现的」:能力在别的服务里实现,只要那个服务的 ee 构建把它登记进
   * 装配表,这个端点就能一并报出来(`connector_certified` 由 vega 实现,2026-08-08 起已在
   * 两个列表里)。报得出就以 `capabilities[]` / `extensions[]` 为准——那是实况,能分清
   * 「换镜像」和「买证书」。
   *
   * 报不出的只能退到证书档位。ee-design.md §6「A 答不了 B」说的是这种:端点里的缺席说明
   * 不了任何事,当成「当前镜像不含」就会把买了的客户挡在门外。等每服务自述(§6.2)或各服务
   * 补登记之后,这个字段会归零,判定收敛成一条 `capabilityState()`。
   */
  reportedByEndpoint: boolean;
  /** 首次可签发的产品版本。有值时列表里标「新增」。 */
  sinceVersion?: string;
  /**
   * 上游登记表里仍是 planned、这一版还没有交付的能力。页面上标「规划中」;不带 sinceVersion,
   * 也不该被任何入口拿去门控。
   */
  planned?: true;
};

/** 分组展示顺序。与登记表的 `sort_order` 同序:先专业档,后企业档。 */
export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  "modeling",
  "dataConnect",
  "permission",
  "semantic",
  "observability",
  "operations",
];

export const CAPABILITY_CATALOG: CapabilityCatalogEntry[] = [
  {
    category: "permission",
    key: CAPABILITIES.SSO,
    minEdition: "professional",
    reportedByEndpoint: true,
  },
  {
    category: "permission",
    key: CAPABILITIES.RBAC_BASIC,
    reportedByEndpoint: true,
    minEdition: "professional",
  },
  {
    category: "permission",
    key: CAPABILITIES.PERM_FINE_GRAINED,
    reportedByEndpoint: true,
    minEdition: "professional",
  },
  {
    category: "dataConnect",
    key: "connector_certified",
    // vega 侧已登记(2026-08-08 实测两个列表里都有),判定回到端点实况。
    reportedByEndpoint: true,
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  {
    category: "dataConnect",
    key: CAPABILITIES.VEGA_LOGICAL_VIEW,
    // 由 EE Vega 登记，不经 bkn-safe 的能力端点报告。
    reportedByEndpoint: false,
    minEdition: "professional",
  },
  {
    // 实现在企业版前端镜像,bkn-safe-ee 登记进装配表,端点报得出。
    category: "semantic",
    key: CAPABILITIES.GRAPH_EXPLORER,
    reportedByEndpoint: true,
    minEdition: "professional",
    sinceVersion: "0.1.6",
  },
  {
    // 管理与查询分别由 bkn-backend-ee、ontology-query-ee 实现；bkn-safe-ee
    // 提供部署级 display-only 标记，供 Studio 统一门控。
    category: "semantic",
    key: CAPABILITIES.OBJECT_METRICS,
    reportedByEndpoint: true,
    minEdition: "professional",
    sinceVersion: "0.2.1",
  },
  {
    // BKN 项目管理整体归专业档(2026-11-19)。上游登记表还没有这一行,也没有服务登记装配表,
    // 端点报不出,只能按证书档位判。
    category: "modeling",
    key: "bkn_project",
    reportedByEndpoint: false,
    minEdition: "professional",
    sinceVersion: "0.2.2",
  },
  {
    // 知识库与 BKN 项目里的知识库扩展同一个 key(bkn-foundry#2522)。分在建模组:对客户来说
    // 它是「项目管理支持知识库」。
    //
    // bkn-safe-ee 的 knowledgebase.Setup 经 authzresource.RequireEdition 登记(socket 顺带
    // MarkAssembled),端点其实报得出;这里仍标 false,沿用进目录之前的判定(按证书档位):
    // 社区构建保留了知识库的 Beta / 专业版入口,专业证配社区镜像时不该被标成待购买。
    // 要改成按端点实况判,连同侧栏徽标(SideNav.test「knowledge base sidebar labels」)一起改。
    category: "modeling",
    key: CAPABILITIES.KNOWLEDGE_BASE,
    reportedByEndpoint: false,
    minEdition: "professional",
    sinceVersion: "0.2.2",
  },
  {
    // Studio provides the page; bkn-backend-ee enforces the Professional license.
    // bkn-safe does not report Eval, so endpoint absence is not an installation verdict.
    category: "semantic",
    key: CAPABILITIES.EVAL,
    reportedByEndpoint: false,
    minEdition: "professional",
    sinceVersion: "0.2.2",
  },
  {
    // 上游 e8fdf2f 把它降到社区档:技术 Trace 免费,对外能力对比里 CLI/SDK 的 trace
    // 查询本来就列在社区行。留在表里是为了让对比矩阵显示「三档都有」,不是付费项。
    category: "observability",
    key: "bkn_trace",
    reportedByEndpoint: false,
    minEdition: "community",
    sinceVersion: "0.1.3",
  },
  {
    // 2026-09-12 起按社区档在售:语义理解任务随社区版免费开放,数据目录侧不再挂徽标和蒙版。
    // 与 bkn_trace 同一种情况——留在表里只为让对比矩阵显示「三档都有」,不是付费项。
    //
    // 上游登记表(license-server `store/capabilities.go` seed)此刻仍是 professional,产品页
    // 先行。这里改的是展示与前端门控,不改证书:社区档能力的放行不看证(`capabilitySatisfied`
    // 对 community 恒真),已签发的专业证里多一个 semantic_task 也不会让谁被拦。上游应按
    // #21 处理 bkn_trace 的方式把这一行撤出登记表——社区能力不登记(`ee-features.md`)。
    category: "semantic",
    key: "semantic_task",
    reportedByEndpoint: false,
    minEdition: "community",
    sinceVersion: "0.1.3",
  },
  {
    category: "permission",
    key: CAPABILITIES.PERM_OBJECT_LEVEL,
    reportedByEndpoint: true,
    minEdition: "enterprise",
  },
  {
    // 风险管控:知识网络的权限矩阵与行动类的执行管控。上游登记表还没有这一行,也没有服务登记
    // 装配表,端点报不出,只能按证书档位判。
    category: "permission",
    key: "risk_control",
    reportedByEndpoint: false,
    minEdition: "enterprise",
    sinceVersion: "0.2.2",
  },
  {
    // 知识网络版本管理(草稿、发布、比较、回退)。上游登记表里是 planned 的 version_mgmt;
    // 没有服务登记装配表,端点报不出。
    category: "modeling",
    key: "version_mgmt",
    reportedByEndpoint: false,
    minEdition: "enterprise",
    sinceVersion: "0.2.2",
  },
  {
    // 应用工坊整体归企业档(2026-11-19),方案推演、模型试算与执行行动都在这一行里,不另列
    // scenario。页面在企业版前端镜像,服务是 openbkn-ee 的 workshop;bkn-safe-ee 登记进装配表,
    // 端点报得出。
    //
    // 上游登记表与 bkn-safe-ee 的 workshop.MinEdition 此刻仍是 professional;这里先改展示
    // (版本页、锁定徽标与升级页上写的档位),实际放行仍由服务端按专业档判。登记表那一行还是
    // planned、没签进过证书,可以按 reconcileTierCorrections 的做法改档。
    category: "semantic",
    key: CAPABILITIES.WORKSHOP,
    reportedByEndpoint: true,
    minEdition: "enterprise",
    sinceVersion: "0.2.2",
  },
  {
    // 分析画布:页面在企业版前端镜像,分析由 Workshop 服务保存;bkn-safe-ee 的
    // analysiscanvas.Setup 登记装配表,端点报得出。
    category: "semantic",
    key: "analysis_canvas",
    reportedByEndpoint: true,
    minEdition: "enterprise",
    sinceVersion: "0.2.2",
  },
  {
    category: "observability",
    key: CAPABILITIES.BUSINESS_PROVENANCE,
    // 上游状态仍是 planned,没有真实现,端点里自然没有它;今天由前端按档位判。
    reportedByEndpoint: false,
    minEdition: "enterprise",
    sinceVersion: "0.1.3",
  },
  // 规划中的放在最后(2026-11-19):卡片和对比表都按这份顺序排。企业档运维看板,上游登记表里
  // 是 planned 的 ops_dashboard,这一版还没有,页面标「规划中」。
  {
    category: "operations",
    key: "ops_dashboard",
    planned: true,
    reportedByEndpoint: false,
    minEdition: "enterprise",
  },
];

/** 某一档**新增**的能力(不含从低档继承的)。用于版本卡片列出「这一档多了什么」。 */
export function capabilitiesIntroducedBy(edition: Edition): CapabilityCatalogEntry[] {
  return CAPABILITY_CATALOG.filter((entry) => entry.minEdition === edition);
}

export function capabilitiesByCategory(category: CapabilityCategory): CapabilityCatalogEntry[] {
  return CAPABILITY_CATALOG.filter((entry) => entry.category === category);
}

/**
 * 某个能力的最低档位,用于给锁定入口标徽标(「专业版」/「企业版」)。
 *
 * **只用于展示。** 能不能用由服务端算好的 `capabilities[]` 决定,前端不比档位
 * (ee-design.md §3.2)。这里回答的是另一个问题:客户要买哪一档才能解锁它。
 */
export function capabilityMinEdition(key: string): Edition | null {
  return CAPABILITY_CATALOG.find((entry) => entry.key === key)?.minEdition ?? null;
}

/**
 * `/api/safe/v1/capabilities` 报不报得出这一项。
 *
 * 只有它成立时,`capabilities[]` / `extensions[]` 的缺席才说明得了问题;报不出的能力缺席
 * 是常态而不是结论(ee-design.md §6「A 答不了 B」),那时只能退到证书档位。
 */
export function capabilityReportedByEndpoint(key: string): boolean {
  return CAPABILITY_CATALOG.find((entry) => entry.key === key)?.reportedByEndpoint === true;
}
