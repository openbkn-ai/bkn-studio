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
 */
export const subscriptionZhCN = {
  subscription: {
    capabilities: {
      audit: { description: "审计治理", name: "审计治理" },
      bkn_trace: {
        description: "技术 Trace 与运行诊断:调用链、耗时与错误定位(不含业务正文与证据链)",
        name: "运行诊断 Trace",
      },
      branding: { description: "产品名称/Logo/登录页定制", name: "品牌定制" },
      connector_certified: {
        description: "认证/高级数据源连接器(如 SQL Server 等商业数据库);社区版仅开放基础连接器",
        name: "高级数据连接",
      },
      impact_graph: { description: "OpenBKN Impact Graph 影响关系图", name: "影响关系图" },
      ops_dashboard: { description: "模型使用策略、使用统计、运营看板", name: "运营看板" },
      perm_object_level: { description: "对象级授权和高级角色控制", name: "对象级授权" },
      rbac_basic: { description: "自定义部门、角色和权限控制", name: "自定义角色与权限" },
      semantic_task: { description: "面向业务语义的理解任务编排与执行", name: "语义理解任务" },
      source_sync: { description: "跟踪数据源变化并自动更新", name: "数据源变化跟踪" },
    },
    categories: {
      dataConnect: "数据连接",
      observability: "可观测",
      operations: "运营",
      permission: "权限",
      semantic: "语义",
    },
    cluster: {
      otherService: "标「—」的能力由其他服务提供,集群授权端点只描述 bkn-safe 自身的镜像,答不了它们。",
      available: "可用",
      hint: "「你的集群」按当前授权与镜像实算:需升级 = 镜像里有、证书档位不够;不可用 = 当前镜像不含该实现。",
      notInstalled: "不可用",
      notLicensed: "需升级",
      title: "你的集群",
      unknown: "读取中",
    },
    contact: {
      body: "请联系你的客户经理，或通过官方商务渠道咨询报价、私有化交付与行业定制方案。",
      title: "联系销售",
    },
    cta: {
      current: "当前版本",
      import: "导入授权文件",
      importHint: "已有授权文件?前往授权管理导入,补证下一个请求即生效,无需重启。",
      needAdmin: "导入授权文件需要授权管理权限,请联系管理员。",
      sales: "联系销售",
    },
    current: {
      badge: "当前",
      edition: "当前工作区运行在 {{edition}}。",
      unlicensed: "当前没有生效授权,按社区能力运行。",
    },
    industry: {
      body: "在企业版基础上,按合同追加行业专有能力与配额。有序档位下行业版包含企业版全部能力,合同只做加法。",
      title: "行业解决方案",
    },
    matrix: {
      capability: "能力",
      new: "新增",
      sinceVersion: "{{version}} 起可用",
      title: "能力对比",
    },
    plans: {
      community: {
        audience: "评估、单团队试点,或已经有外部权限系统的场景。",
        highlights: {
          catalog: "知识网络与数据目录全量功能",
          index: "索引构建 · 批量与流式",
          model: "模型接入与调用",
        },
        price: "免费",
        unit: "自部署 · 无限期",
      },
      enterprise: {
        audience: "有合规、审计与私有化交付要求的金融、政企与大型集团。",
        price: "洽谈",
        unit: "按合同授权",
      },
      inheritsFrom: "{{edition}}全部能力",
      professional: {
        audience: "多团队协作、需要按组织结构划分权限边界的生产环境。",
        price: "¥49,800",
        unit: "/ 项目 · 年",
      },
      quota: { maxNodes: "节点数 {{value}}", maxUsers: "用户数 {{value}}", unlimited: "不限" },
    },
    priceNote: "价格为标准报价口径,实际以商务合同为准。授权粒度为项目,一个项目一张授权文件。",
    title: "版本与订阅",
    subtitle:
      "BKN 的知识网络与数据能力在所有版本中完整开放;权限边界、审计与合规能力随版本递进。",
  },
} as const;
