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
 * `bullets` 不在登记表里,是产品侧补的卖点:版本卡片与升级弹窗共用;`cardBullets` 有值时
 * 卡片改用它(见 `capabilityCardBullets`)。权限三项的条目
 * 来自对外版本说明的「权限能力矩阵」(资源粒度 / 操作粒度 / 行过滤与列权限 / 审计),
 * 矩阵改了这里要跟着改。
 */
export const subscriptionZhCN = {
  subscription: {
    capabilities: {
      business_provenance: {
        bullets: {
          b1: "时间链",
          b2: "证据链",
        },
        description: "业务问题与结果的时间链、证据链、数据溯源、业务语义图与交互式追溯",
        name: "业务溯源",
      },
      bkn_trace: {
        description: "技术 Trace 与运行诊断:调用链、耗时与错误定位(不含业务正文与证据链)",
        name: "运行诊断 Trace",
      },
      connector_certified: {
        bullets: {
          b1: "SQL Server、Oracle 直连，无需导出中间文件",
          b2: "连接参数、驱动与方言由官方维护并随版本验证",
          b3: "与社区连接器同一套建模、索引与查询链路,切换不改模型",
        },
        // 卡片只列连得上哪些库;上面的整句卖点留给升级弹窗。
        cardBullets: {
          b1: "SQL Server",
          b2: "Oracle",
        },
        description:
          "认证/高级数据源连接器：专业版支持 SQL Server、Oracle，企业版增加 SAP HANA；社区版仅开放基础连接器",
        name: "高级数据连接",
      },
      vega_logic_view: {
        description: "支持衍生视图和复合视图",
        name: "逻辑视图：支持衍生视图和复合视图",
      },
      graph_explorer: {
        bullets: {
          b1: "语义检索、条件、浏览或 Cypher 找到实例,沿关系逐跳展开",
          b2: "两个实例之间的路径查找,多种布局",
          b3: "探索历史、画布导出与可分享的链接",
        },
        description: "从具体实例出发,在画布上展开邻居、追踪路径;也能打开 Agent 给出的图谱链接",
        name: "图探索",
      },
      perm_fine_grained: {
        bullets: {
          b1: "查看、查询、修改、删除、执行分别授权",
          b2: "显式例外(直接授权或拒绝)与完整授权审计",
        },
        description: "按对象和操作配置允许、拒绝与来源级撤销",
        name: "细粒度对象授权",
      },
      perm_object_level: {
        bullets: {
          b1: "对象类支持行过滤",
          b2: "对象类支持列过滤（支持配置属性列不可见、仅属性名称、列掩码-内容脱敏）",
          b3: "行列权限变更审计",
        },
        description: "企业对象规则兼容层与属性级权限",
        name: "企业对象规则",
      },
      rbac_basic: { description: "自定义部门、角色和权限控制", name: "自定义角色与权限" },
      semantic_task: {
        description: "面向业务语义的理解任务编排与执行",
        name: "数据资源支持语义理解",
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
      commonSources: "MySQL、PostgreSQL、MariaDB、Opensearch 作为数据源接入",
      executionFactory: "执行工厂可接入 OpenAPI、MCP、 SKILL 与函数",
      indexing: "数据发现、批量索引与向量化",
      localAuth: "本地登录,用户、部门与内置角色管理",
      mcpTooling: "MCP、工具与 Skill 的接入、调试和调用",
      modelingSurfaces: "通过 BKN Studio、CLI、SDK 与 Skill 建模并管理知识网络",
      modelingTypes: "对象、关系、行动与指标建模",
      oneClickExperience: "支持一键体验，动态加载官方样例",
      queryAndSearch: "关系查询、路径查询与语义检索",
      selfHosted: "源码构建、基础部署、状态检查与升级文档",
      topLevelGrants: "知识网络、Catalog 等顶层资源的整体授权",
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
        audience:
          "面向开发者、技术团队和生态伙伴,免费构建和验证业务知识网络,适合 Demo 验证和 POC。",
        price: "免费",
        unit: "自部署 · 无限期",
      },
      enterprise: {
        audience:
          "面向以 OpenBKN 为企业 AI Agent 运行底座的组织,在专业版基础上增加 SAP HANA 数据连接、企业对象细粒度权限和业务溯源。",
        hanaConnector: "SAP HANA",
        price: "洽谈",
        unit: "按合同授权",
      },
      inheritsFrom: "{{edition}}全部能力",
      professional: {
        audience:
          "面向快速成长的 AI 原生团队,在社区版基础上增加自定义角色与权限、细粒度对象授权和高级数据连接。",
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
    subtitle: "BKN 的知识网络与数据能力在所有版本中完整开放;权限边界、审计与合规能力随版本递进。",
  },
} as const;
