/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const shellZhCN = {
  shell: {
    workspace: "工作区",
    modeStandalone: "独立运行",
    modeHosted: "宿主接入",
    productTagline: "控制台",
    userMenuProductTitle: "{{product}} {{tagline}}",
    userMenuTagline: "控制台",
    versionLine: "版本 {{version}}",
    headerAside: "统一应用壳层",
    collapseSidenav: "收起导航",
    expandSidenav: "展开导航",
    theme: {
      switchToDark: "切换到深色模式",
      switchToLight: "切换到浅色模式",
    },
    language: {
      label: "语言",
      zhCN: "中文",
      enUS: "English",
    },
    items: {
      home: "首页",
      globalBusinessKnowledgeNetwork: "全局业务知识网络",
      domainKnowledgeNetwork: "领域知识网络",
      knowledgeNetworkManagement: "知识网络管理",
      knowledgeNetworkIntegration: "知识网络对接",
      generalBusinessKnowledgeNetwork: "数据资源知识网络",
      dataConnection: "数据连接",
      dataCatalog: "数据目录",
      indexBuild: "任务管理",
      dataResource: "数据目录",
      dataQuality: "数据质量",
      executionFactory: "执行工厂",
      executionFactoryLab: "执行工厂（实验版）",
      executionFactoryLabCapabilities: "能力库",
      executionFactoryLabCatalog: "能力市场（实验版）",
      executionFactoryLabSandboxRuntime: "沙箱运行时管理",
      executionUnitManagement: "执行单元",
      allExecutionUnits: "全部执行单元",
      executionFactorySandboxRuntime: "沙箱运行时管理",
      executionUnitManagementTooltip: "管理当前平台内的算子、工具箱、MCP 与 Skill",
      allExecutionUnitsTooltip: "浏览市场目录并将资源引入当前平台",
      modelResources: "模型管理",
      quotaManagement: "配额管理",
      modelStatistics: "模型统计",
      systemManagement: "系统管理",
      userManagement: "用户管理",
      roleManagement: "角色管理",
      authorizationManagement: "权限管理",
      licenseManagement: "授权管理",
      accessAddressManagement: "访问地址",
      modelManagement: "模型配置",
      bknTrace: "BKN Trace",
      observability: "可观测性",
      // 侧栏 229px 里要与「企业版」徽标同排,六字放不下;页面标题仍是「业务溯源分析」。
      businessProvenance: "业务溯源",
      traceAnalysis: "Trace 分析",
      observabilityLogs: "日志检索",
      observabilitySettings: "可观测性设置",
      logManagement: "审计日志",
      apiKeys: "API Key",
      account: "个人中心",
      aboutOpenBkn: "关于 OpenBKN",
      permissionReviews: "权限工单",
      pendingPermissionRequests_one: "有 {{count}} 项待处理权限工单",
      pendingPermissionRequests_other: "有 {{count}} 项待处理权限工单",
      installStatus: "后端服务状态",
    },
    aboutOpenBkn: {
      title: "关于 OpenBKN",
      subtitle: "Open Business Knowledge Network. 开源本体平台。",
      summaryZh:
        "OpenBKN 是一个面向企业 AI、自动化与决策智能的本体驱动业务知识网络平台，也是一个开源本体平台。",
      summaryEn:
        "OpenBKN is an ontology-driven business knowledge network platform for enterprise AI, automation and decision intelligence. It's an Open Source Ontology Platform.",
      points: {
        ontology: {
          title: "本体驱动 · Ontology-Driven",
          description: "用本体描述企业对象、关系、规则、风险与行动，为智能体提供业务语义。",
        },
        openSource: {
          title: "开放平台 · Open Source",
          description: "开放、透明、可扩展，支持企业私有化部署与社区协作。",
        },
        action: {
          title: "从理解到行动 · From Understanding to Action",
          description: "连接知识、工具与业务行动，让智能体参与真实工作流。",
        },
        governance: {
          title: "安全可治理 · Secure & Traceable",
          description: "围绕业务对象与行动提供权限、风险控制和全链路追溯。",
        },
      },
      footer: "喜欢 OpenBKN？欢迎在 GitHub 为我们点个 Star。",
      website: "了解更多 ↗",
      github: "GitHub 点 Star",
    },
  },
} as const;
