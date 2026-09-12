/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * `capabilities.*` 的中文名与描述逐字取自 license-server 的登记表 seed
 * (`server/internal/store/capabilities.go`)——那是签进客户证书、也是客户在门户上
 * 看到的同一份文案。两边不一致会让客户拿着证书对不上产品页。
 *
 * `bullets` 不在登记表里,是产品侧补的卖点:版本卡片与升级弹窗共用。权限三项的条目
 * 来自对外版本说明的「权限能力矩阵」(资源粒度 / 操作粒度 / 行列权限 / 脱敏 / 审计),
 * 矩阵改了这里要跟着改。
 */
export const subscriptionZhCN = {
  subscription: {
    capabilities: {
      business_provenance: {
        description: "业务问题与结果的证据链、数据溯源、业务语义图与交互式追溯",
        name: "业务溯源",
      },
      bkn_trace: {
        description: "技术 Trace 与运行诊断:调用链、耗时与错误定位(不含业务正文与证据链)",
        name: "运行诊断 Trace",
      },
      connector_certified: {
        bullets: {
          b1: "SQL Server 等商业数据库直连,不必再导出中间文件",
          b2: "连接参数、驱动与方言由官方维护并随版本验证",
          b3: "与社区连接器同一套建模、索引与查询链路,切换不改模型",
        },
        description: "认证/高级数据源连接器(如 SQL Server 等商业数据库);社区版仅开放基础连接器",
        name: "高级数据连接",
      },
      perm_fine_grained: {
        bullets: {
          b1: "授权到子资源:知识网络内部资源与 Catalog 下的 Resource",
          b2: "查看、查询、修改、删除、执行按操作分别配置",
          b3: "显式子资源例外:直接授权或直接拒绝",
          b4: "完整的资源授权审计",
        },
        description: "按对象和操作配置允许、拒绝与来源级撤销",
        name: "细粒度对象授权",
      },
      perm_object_level: {
        bullets: {
          b1: "对象类行权限",
          b2: "对象类列权限,属性分四档",
          b3: "数据脱敏",
          b4: "行列权限变更审计",
        },
        description: "企业对象规则兼容层与属性级权限",
        name: "企业对象规则",
      },
      rbac_basic: {
        bullets: { b1: "自定义角色与部门,不再限于系统内置角色" },
        description: "自定义部门、角色和权限控制",
        name: "自定义角色与权限",
      },
      semantic_task: {
        description: "面向业务语义的理解任务编排与执行",
        name: "语义理解任务",
      },
    },
    /**
     * 社区版能力(展示用)。登记表不登记社区能力(`ee-features.md`:社区证的 features 为空),
     * 所以这些条目没有 key、不参与门控,来源是对外版本说明里三档都打 ✓ 的那些行。
     */
    community: {
      actionSandbox: "行动运行与安全沙箱环境",
      basicAudit: "基础操作审计",
      cliTrace: "通过 CLI / SDK 查询运行链路、性能、证据与推理过程",
      commonSources: "常用数据库、OpenSearch 与 CSV 接入",
      indexing: "数据发现、批量索引与向量化",
      localAuth: "本地登录,用户、部门与内置角色管理",
      mcpTooling: "MCP、工具与 Skill 的接入、调试和调用",
      modelingSurfaces: "通过 BKN Studio、CLI、SDK 与 Skill 建模并管理知识网络",
      modelingTypes: "对象、关系、行动与指标建模",
      queryAndSearch: "关系查询、路径查询与语义检索",
      selfHosted: "源码构建、基础部署、状态检查与升级文档",
      topLevelGrants: "按知识网络、Catalog 等顶层资源整体授权,固定权限包",
    },
    categories: {
      modeling: "知识网络建模",
      dataConnect: "数据连接",
      observability: "可观测",
      operations: "运营",
      permission: "权限",
      semantic: "语义",
    },
    cta: {
      import: "导入授权文件",
      importHint: "已有授权文件?前往授权管理导入,补证下一个请求即生效,无需重启。",
      needAdmin: "导入授权文件需要授权管理权限,请联系管理员。",
      apply: "申请授权",
      details: "查看详情",
    },
    current: {
      badge: "当前",
      edition: "当前工作区运行在 {{edition}}。",
      unlicensed: "当前没有生效授权,按社区能力运行。",
    },
    matrix: {
      capability: "能力",
      new: "新增",
      sinceVersion: "{{version}} 起可用",
      title: "能力对比",
    },
    plans: {
      // 价格暂不在页面展示(见 SubscriptionScene 的注释)。留着的这份是对外版本说明的镜像
      // ——单一源是飞书《OpenBKN 版本、服务与销售》,不是 license-server 的设计文档:那边
      // §1.5 记的 ¥49,800/项目/年 是限时五折价且单位不同,已经漂了。标准价 ¥99,600/年,
      // 2026-12-31 前五折 ¥49,800/年(3 年起订),之后还有六折、八折两档,都带截止日期
      // ——正因为这套东西会随时间变,才不印在产品页上。
      community: {
        audience: "开发者、技术团队和生态伙伴。免费构建和验证完整的业务知识网络底座,适合跑通 Demo、样板项目和基础场景。",
        price: "免费",
        unit: "自部署 · 无限期",
      },
      enterprise: {
        audience: "将 OpenBKN 作为企业级 AI 平台底座的组织。支持企业级管理、知识探索、版本治理和更完整的生产运维能力。",
        price: "洽谈",
        unit: "按合同授权",
      },
      inheritsFrom: "{{edition}}全部能力",
      professional: {
        audience: "准备做生产试点的客户团队。在社区版基础上获得更高效的数据更新、企业权限、标准支持和更多连接能力。",
        price: "¥99,600",
        unit: "/ 年 · 标准价",
      },
      quota: {
        fromLicence: "当前档位的配额取自授权文件",
        maxNodes: "节点数 {{value}}",
        maxUsers: "用户数 {{value}}",
        unlimited: "不限",
      },
    },
    contact: "完整能力对比、服务条款与优惠计划见版本说明;商务咨询 business@openbkn.ai。",
    title: "版本与订阅",
    subtitle:
      "BKN 的知识网络与数据能力在所有版本中完整开放;权限边界、审计与合规能力随版本递进。",
  },
} as const;
