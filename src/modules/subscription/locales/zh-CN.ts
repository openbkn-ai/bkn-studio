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
 * `bullets` 用于升级弹窗与版本卡片。`cardBullets` 可为卡片提供较短的文案。权限相关能力描述
 * 来自对外版本说明的「权限能力矩阵」(资源粒度 / 操作粒度 / 行过滤与列权限 / 审计),
 * 矩阵改了这里要跟着改。
 */
export const subscriptionZhCN = {
  subscription: {
    capabilities: {
      kn_action_modeling: {
        name: "行动建模",
        description: "在知识网络中定义行动类、配置执行参数并执行行动。",
        bullets: {
          b1: "支持对象操作和工具调用",
          b2: "配置行动参数，查看执行记录",
        },
      },
      kn_events: {
        bullets: {
          b1: "配置事件类和识别规则",
          b2: "查看事件记录与识别结果",
        },
        name: "事件类",
        description: "在知识网络中定义事件类、配置识别规则并查看事件记录。",
      },
      kn_tool_mounts: {
        name: "知识网络资源挂载",
        description: "将函数、API、MCP 与 Skill 挂载到知识网络，供网络直接调用。",
        bullets: {
          b1: "函数、API、MCP 与 Skill 挂载",
        },
      },
      execution_factory: {
        name: "执行工厂",
        description: "管理、发布与调试执行单元，浏览全部执行单元并管理沙箱运行时。",
        bullets: {
          b1: "接入 OpenAPI、函数、MCP 与 Skill",
          b2: "创建、发布、调试和浏览执行单元",
          b3: "沙箱运行时管理",
        },
      },
      sso: {
        name: "单点登录",
        description: "管理第三方身份源、浏览器登录和接口令牌换发。",
        bullets: { b1: "OIDC / Casdoor" },
      },
      eval: {
        description: "基于评测模板管理 Case、执行评测并查看诊断与回归结果。",
        name: "Eval 质量评测",
      },
      business_provenance: {
        bullets: {
          b1: "时间链",
          b2: "证据链",
        },
        description: "业务问题与结果的时间链、证据链、数据溯源、业务语义图与交互式追溯",
        name: "业务溯源",
      },
      bkn_trace: {
        description: "技术 Trace 与运行诊断：调用链、耗时与错误定位（不含业务正文与证据链）",
        name: "运行诊断 Trace",
      },
      connector_certified: {
        bullets: {
          b1: "SQL Server、Oracle、Doris 直连，并支持以 API 方式连接数据；SAP HANA 需企业版及以上",
          b2: "连接参数、驱动与方言由官方维护并随版本验证",
          b3: "与社区连接器同一套建模、索引与查询链路，切换不改模型",
          b4: "使用连接器需要有效的对应版本授权，以及包含对应连接器实现的 Vega 部署镜像",
        },
        cardBullets: {
          b1: "SQL Server",
          b2: "Oracle",
          b3: "Doris",
          b4: "以 API 方式连接数据",
        },
        description:
          "认证/高级数据源连接器：专业版支持 SQL Server、Oracle、Doris 与 API 方式连接，企业版增加 SAP HANA；社区版仅开放基础连接器",
        name: "高级数据连接",
      },
      vega_logic_view: {
        description: "支持衍生视图和复合视图",
        name: "逻辑视图：支持衍生视图和复合视图",
      },
      graph_explorer: {
        bullets: {
          b1: "语义检索或 Cypher 找实例，逐跳展开",
          b2: "实例间路径查找，多种布局",
          b3: "探索历史、画布导出与分享链接",
        },
        description: "从具体实例出发，在画布上展开邻居、追踪路径；也能打开 Agent 给出的图谱链接",
        name: "图探索",
      },
      bkn_project: {
        bullets: {
          b1: "需求输入、本体建模与知识网络发布一站式管理",
          b2: "从数据表抽取概念",
          b3: "动力建模与业务场景",
        },
        description: "以项目组织知识网络的需求、本体建模与发布",
        name: "项目管理",
      },
      // 上游登记表仍是 planned,产品先按专业档在售;遮罩与升级弹窗(含 BKN 项目里的知识库扩展)同用这份。
      knowledge_base: {
        bullets: {
          b1: "从文档抽取概念、属性、关系与事件",
          b2: "实体识别、链接与知识融合",
          b3: "文件接入、解析切片与原文定位",
        },
        description: "接入对象存储、文件服务等来源的文件，管理内容版本，完成解析、切片与原文定位",
        name: "本体知识库",
      },
      action_governance: {
        bullets: {
          b1: "按规则要求确认、禁止执行或发起业务审批",
        },
        name: "行动管控",
        description: "配置行动执行的确认、禁止与业务审批规则。",
      },
      permission_matrix: {
        bullets: {
          b1: "查看生效权限与授权来源",
        },
        name: "权限矩阵",
        description: "查看知识网络中用户和角色对各类资源的权限。",
      },
      object_metrics: {
        bullets: {
          b1: "原子、衍生、复合指标统一管理",
          b2: "校验、预览、发布与血缘查看",
          b3: "按实例或对象集合查询、试算",
        },
        description: "按对象类定义、验证、发布并查询原子、衍生和复合对象指标",
        name: "对象指标",
      },
      workshop: {
        bullets: {
          b1: "组件搭建页面，AI 辅助配置",
          b2: "事件按任务分析与处理",
          b3: "方案推演、模型试算与执行行动",
        },
        description: "在知识网络上搭建业务应用：页面与组件、事件与任务、方案推演",
        name: "应用工坊",
      },
      analysis_canvas: {
        description: "用 AI 把分析拆成可复核的卡片，结果存在服务端，可带结果分享给他人",
        name: "分析画布",
      },
      kn_draft_versions: {
        name: "知识网络草稿与运行版本",
        description: "管理知识网络草稿并发布运行版本。",
        bullets: {
          b1: "编辑草稿、发布与查看运行版本",
        },
      },
      version_mgmt: {
        bullets: {
          b1: "多版本管理",
          b2: "版本历史，按历史版本查询与执行",
          b3: "版本比较与回退",
        },
        description: "知识网络的版本历史、比较与回退",
        name: "知识网络版本管理",
      },
      risk_control: {
        bullets: {
          b1: "权限矩阵：生效权限与来源",
          b2: "行动类的执行管控",
        },
        description: "知识网络的权限矩阵与行动类执行管控",
        name: "风险管控",
      },
      perm_fine_grained: {
        bullets: {
          b1: "查看、查询、修改、删除、执行分别授权",
          b2: "显式允许、拒绝与授权审计",
        },
        description: "按对象和操作配置允许、拒绝与来源级撤销",
        name: "对象授权",
      },
      perm_object_level: {
        bullets: {
          b1: "对象类行过滤",
          b2: "对象类列过滤：隐藏、仅列名、脱敏",
          b3: "行列权限变更审计",
        },
        description: "企业对象规则兼容层与属性级权限",
        name: "行列级权限管控",
      },
      rbac_basic: { description: "自定义部门、角色和权限控制", name: "自定义角色与权限" },
      // 登记表里这一行叫「运营看板」;产品页按运维的口径命名。
      ops_dashboard: { description: "模型使用策略、使用统计与运维看板", name: "运维看板" },
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
      basicAudit: "基础操作审计",
      cliTrace: "通过 CLI / SDK 查询运行链路、性能、证据与推理过程",
      commonSources: "MySQL、PostgreSQL、MariaDB、OpenSearch",
      indexing: "数据发现、批量索引与向量化",
      localAuth: "本地登录，用户、部门与内置角色管理",
      modelingSurfaces: "Studio、CLI、SDK 与 Skill 建模",
      modelingTypes: "对象与关系建模",
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
      importHint: "已有授权文件？前往授权管理导入，补证下一个请求即生效，无需重启。",
      needAdmin: "导入授权文件需要授权管理权限，请联系管理员。",
      apply: "申请授权",
      details: "查看详情",
    },
    current: {
      badge: "当前",
      edition: "当前工作区运行在{{edition}}。",
      unlicensed: "当前没有生效授权，按社区能力运行。",
    },
    matrix: {
      capability: "能力",
      new: "新增",
      planned: "规划中",
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
          "面向开发者、技术团队和生态伙伴，免费构建和验证业务知识网络，适合 Demo 验证和 POC。",
        price: "免费",
        unit: "自部署 · 无限期",
      },
      enterprise: {
        hanaConnector: "SAP HANA",
        audience: "面向需要将知识网络用于业务应用、生产管理和审计的组织。",
        price: "洽谈",
        unit: "按合同授权",
      },
      inheritsFrom: "{{edition}}全部能力",
      professional: {
        audience: "面向需要协作建模、接入更多数据和工具，并细化授权的团队。",
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
    contact: "完整能力对比、服务条款与优惠计划见版本说明；商务咨询 business@openbkn.ai。",
    title: "版本与订阅",
    subtitle: "所有版本均支持对象与关系建模、常用数据接入与查询。",
  },
} as const;
