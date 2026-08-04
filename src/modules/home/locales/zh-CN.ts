/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeZhCN = {
  home: {
    description: "OpenBKN 首页",
    engineering: {
      install: {
        copied: "安装命令已复制",
        copyCommand: "复制命令",
        copyFailed: "复制失败，请手动复制命令",
        description: "按项目需要安装对应 Skill。安装完成后，重启 Agent 会话即可使用。",
        title: "获取 OpenBKN Skills",
        trigger: "获取 Skills",
      },
      labels: {
        output: "主要产物",
        scenario: "适用场景",
      },
      skillNameSeparator: "：",
      skills: {
        creator: {
          output: "可运行的知识网络、数据绑定与校验结果、交付报告。",
          scenario: "已确认需求或建模方案，需要创建、更新、绑定数据、校验、测试、发布或根据反馈持续改进。",
          title: "业务知识网络构建&验证 Skill",
        },
        ontologyBuilder: {
          output: "业务可评审的本体建模方案，明确对象、关系、指标和行动设计。",
          scenario: "已有 PRD、流程说明或业务材料，需要在正式创建前确认知识网络如何表达业务语义。",
          title: "业务知识网络设计 Skill",
        },
        methodology: {
          output: "建模分类建议、判断依据、边界风险和待业务确认的问题。",
          scenario: "已形成需求或建模方案，但对象边界、关系语义、指标口径、行动或治理边界仍存在争议。",
          title: "知识网络建模评审 Skill",
        },
        requirement: {
          output: "场景中心 PRD、验收用例和 BKN Creator 交接摘要。",
          scenario: "访谈纪要、PRD、流程说明或初步想法尚未整理，需要先明确业务目标、范围、规则和验收标准。",
          title: "需求澄清 Skill",
        },
      },
    },
    greeting: {
      afternoon: "下午好，{{name}}",
      afternoonAnonymous: "下午好",
      evening: "晚上好，{{name}}",
      eveningAnonymous: "晚上好",
      morning: "早上好，{{name}}",
      morningAnonymous: "早上好",
    },
    introduction:
      "欢迎使用 OpenBKN 构建业务知识网络，将企业数据组织为可理解、可查询、可调用的业务知识与能力，支撑业务分析、决策和自动化协作。",
    pathLabel: "构建路径",
    paths: {
      engineering: {
        description:
          "从业务材料出发，使用 AI Skills 完成需求澄清、设计、评审和构建验证，形成可持续迭代的业务知识网络。",
        heading: "AI Skills 辅助构建业务知识网络",
        title: "AI Skills 构建",
      },
      platform: {
        description: "从平台环境与业务数据出发，依次完成环境准备、数据治理和知识网络建模；再验证业务效果并开放调用，形成可用、可持续演进的业务知识网络。",
        heading: "手动构建知识网络",
        title: "手动构建",
      },
    },
    platform: {
      configuration: "配置内容",
      configurationLabel: "配置内容：",
      details: "查看配置说明",
      impact: "未配置影响",
      impactLabel: "未配置影响：",
      noPermission: "需要用户管理权限，请联系管理员。",
      optional: "可选",
      required: "本阶段操作",
      role: "作用",
      roleLabel: "作用：",
      stages: {
        data: {
          detail: "将业务数据接入平台并同步到数据目录；再按资源用途补全业务语义、构建检索索引，沉淀为可建模、可查询的数据资产。",
          required: {
            connection: {
              description: "配置数据源类型、地址、认证信息和库范围，并通过连接测试确认平台可访问目标业务数据。",
              impact: "平台无法读取目标业务数据，后续探查、语义理解、索引构建和基于资源的知识网络建模均无法开展。",
              outcome: "平台获得稳定的数据访问通道，可继续发现和治理业务资源。",
              summary: "建立平台访问业务数据的连接并完成连通性验证。",
              title: "配置数据连接",
            },
            discovery: {
              description: "为数据连接立即执行或创建定时探查计划，将库、表、视图及字段结构同步到数据目录，并持续发现新增或失效资源。",
              impact: "数据目录中没有可治理的资源和字段结构，后续无法选择资源进行语义理解、索引构建或对象类建模。",
              outcome: "平台获得可治理的数据资源及其最新结构，为后续建模提供可选资源。",
              summary: "将业务数据的资源和字段结构同步到数据目录。",
              title: "执行数据探查",
            },
            indexBuild: {
              description: "针对需要全文检索、向量检索或知识问答的资源，在数据目录中配置并执行索引构建任务。",
              impact: "不影响资源浏览和基础建模；但该资源不能提供依赖索引的全文检索、向量检索和知识问答能力。",
              outcome: "数据资源具备面向检索和问答的索引能力，可被相关检索链路使用。",
              summary: "按需为检索和问答资源构建索引。",
              title: "构建索引任务",
            },
            semanticUnderstanding: {
              description: "在数据目录中选择资源执行语义理解，并审核系统为资源和字段生成的业务名称、说明及语义建议。",
              impact: "不影响直接使用资源建模；但资源仍以原始库表和字段呈现，理解数据含义与建立业务模型需要更多人工判断。",
              outcome: "资源和字段获得可读、可审核的业务语义，降低后续建模和使用成本。",
              summary: "按需生成并审核资源与字段的业务语义。",
              title: "执行数据语义理解",
            },
          },
          summary: "治理业务数据资产",
          title: "数据治理",
        },
        environment: {
          detail: "先确定参与人员可访问的模块和操作范围，再设置系统默认的大模型与检索模型，为问答、语义理解和检索能力提供基础。",
          required: {
            largeModel: {
              description: "在模型管理中接入可用的大语言模型（LLM），测试可用性后设置为系统默认模型。",
              impact: "ContextLoader 无法自动获得用于理解问题、组织上下文和生成回答的默认模型，智能问答及相关模型能力不可用。",
              outcome: "ContextLoader 可自动使用默认 LLM 理解业务问题、组织上下文并生成回答。",
              summary: "设置系统默认 LLM，支撑问题理解和回答生成。",
              title: "配置大模型",
            },
            permission: {
              description: "在系统管理中为参与成员配置用户、角色及资源操作权限，明确谁可以管理数据、模型、知识网络和执行工具。",
              impact: "成员无法按职责进入所需模块或执行必要操作，团队只能共享高权限账号，协作和审计风险增加。",
              outcome: "成员可按职责协作完成数据治理、建模、验证和运维，权限边界清晰可审计。",
              summary: "配置用户、角色和操作权限，建立可审计的协作边界。",
              title: "配置用户与权限",
            },
            smallModel: {
              description: "在模型管理中分别接入并设置 embedding 与 reranker 的系统默认模型，必要时先完成连通性测试。",
              impact: "未配置 embedding 时，资源无法向量化，语义召回不可用；未配置 reranker 时，召回结果无法按相关性重排序。",
              outcome: "embedding 将内容和查询转为向量以支持语义召回；reranker 对召回结果进行相关性重排序。",
              summary: "设置默认检索模型，支撑语义召回和结果排序。",
              title: "配置小模型",
            },
          },
          summary: "准备用户权限与模型能力",
          title: "环境准备",
        },
        model: {
          detail: "先创建承载业务范围的知识网络。对象类将数据资源字段组织为业务对象，关系类描述对象之间的关联，行动类定义可触发的业务操作，指标固化统一的业务度量口径；概念分组按主题归类对象类，并可在检索时限定召回范围，执行工具为工具型逻辑属性和行动类提供实际调用能力。",
          required: {
            actionType: {
              description: "选择绑定对象类，定义触发条件和影响声明，绑定执行工具，并将工具参数映射为对象属性、固定值或运行时输入。",
              impact: "知识网络只能查询和分析信息，无法把业务意图落实为实际业务操作。",
              outcome: "可将业务意图转化为带对象上下文、可校验并可执行的行动能力。",
              summary: "定义业务操作及其对象上下文和执行映射。",
              title: "配置行动类",
            },
            conceptGroup: {
              description: "按业务主题归类对象类；在智能问答和知识检索时可选择概念分组，将概念召回限定在对应的业务范围内。",
              impact: "不影响对象、关系、行动和指标的基础能力；但检索会在完整知识网络中召回，主题聚焦较弱，大型网络中更容易引入无关概念。",
              outcome: "可按业务主题组织对象类，并在检索时缩小对象、关系和行动的召回范围，提高结果的相关性。",
              summary: "按业务主题组织对象类，并限定知识召回范围。",
              title: "配置概念分组",
            },
            metric: {
              description: "基于已配置的对象类，选择统计属性和聚合方式，并配置单位、过滤条件、分组与时间维度；按需设置分析维度，支持趋势、同比、占比和下钻分析。",
              impact: "无法以统一口径进行指标查询和分析，智能问答或业务分析只能基于原始属性理解数据，难以稳定复用业务度量结果。",
              outcome: "可在指标数据查询中按时间、维度和条件进行分析，并复用同一指标定义获得一致结果。",
              summary: "固化统一、可解释、可复用的业务度量口径。",
              title: "配置指标",
            },
            metricExecutionTool: {
              description: "在执行单元中创建或接入可调用的工具，并定义输入输出；随后在对象类的工具型逻辑属性和行动类中绑定工具、配置参数映射。",
              impact: "工具型逻辑属性无法计算或获取结果，行动类无法完成实际执行；基础数据属性和指标不受影响。",
              outcome: "对象类逻辑属性和行动类可复用已配置的工具，完成派生属性计算或业务操作。",
              summary: "为工具型逻辑属性和行动类提供可复用的执行能力。",
              title: "配置执行工具",
            },
            network: {
              description: "创建或选择一个承载业务范围的知识网络。",
              impact: "业务对象、问答配置和调用能力没有统一的业务边界，无法形成可管理的交付单元。",
              outcome: "业务模型、问答与对外调用可在同一知识网络内管理。",
              summary: "创建承载业务模型与能力的知识网络。",
              title: "配置知识网络",
            },
            objectType: {
              description: "选择已接入的数据资源，定义业务对象的数据属性、主键和标题键，并映射到资源字段；按需添加指标型或工具型逻辑属性。",
              impact: "原始数据无法组织为稳定的业务对象，关系、指标、行动以及面向对象的查询都缺少可靠的属性基础。",
              outcome: "形成可理解、可查询、可复用的业务对象语义，为关系、指标和行动提供对象与属性基础。",
              summary: "定义业务对象、属性及其数据映射。",
              title: "配置对象类",
            },
            relationType: {
              description: "选择起点和终点对象类，定义二者的业务关系，并通过对象属性直连或数据资源字段映射建立关联规则。",
              impact: "对象之间的关联无法被统一表达，跨对象查询、关系子图和基于关系的业务理解会受到限制。",
              outcome: "可沿已定义的关系关联对象数据，支持跨对象查询、关系分析和图谱浏览。",
              summary: "定义业务对象之间的关联语义与映射规则。",
              title: "配置关系类",
            },
          },
          summary: "组织业务语义并配置可调用能力",
          title: "知识网络建模",
        },
        validate: {
          detail: "知识网络构建后，按交付场景选择验证业务回答、MCP 工具调用和调用依据；需要接入外部智能体时，再配置平台级调用方式。",
          required: {
            chat: {
              description: "在目标知识网络中提出真实业务问题，检查回答是否命中业务语义、使用了正确的知识和数据，并满足预期。",
              impact: "无法从业务使用者视角验证答案质量，交付前难以及时发现知识覆盖或回答偏差。",
              outcome: "确认知识网络可回答目标业务问题，并据此补充或调整知识网络配置。",
              title: "智能问答",
            },
            integration: {
              description: "按外部智能体平台的接入方式复制 MCP、CLI 或 SDK 配置，使其可以调用 OpenBKN 提供的检索、查询和行动能力。",
              impact: "外部智能体平台无法接入 OpenBKN，已构建的知识和行动能力不能在目标智能体中使用。",
              outcome: "外部智能体可按配置方式发现并调用 OpenBKN 平台能力。",
              title: "对接智能体平台",
            },
            mcpDebug: {
              description: "在 MCP 调试中选择工具、填写请求参数并运行，验证平台 MCP 服务是否可发现，以及工具调用是否返回当前知识网络的预期结果。",
              impact: "无法在接入外部智能体前确认 MCP 协议、工具参数和返回结果是否正确，问题会延后暴露。",
              outcome: "确认 MCP 服务和工具调用链路可用，并获得可用于外部接入的请求示例。",
              title: "MCP 服务调试",
            },
            traceAnalysis: {
              description: "对已发生的业务问答或工具调用，查看请求、知识与数据证据、执行轨迹和结果，定位异常或解释结果来源。",
              impact: "结果异常、回答偏差或调用失败时，难以定位是请求、知识、数据还是执行环节的问题。",
              outcome: "可追溯业务结果的完整依据和执行路径，为问题排查与交付验收提供证据。",
              title: "业务溯源分析",
            },
          },
          summary: "验证效果并开放调用",
          title: "验证与交付",
        },
      },
    },
    tagline: "首页",
    title: "首页",
  },
} as const;
