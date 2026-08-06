/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const homeEnUS = {
  home: {
    description: "OpenBKN home",
    engineering: {
      install: {
        copied: "Install command copied",
        copyCommand: "Copy command",
        copyFailed: "Copy failed. Please copy the command manually.",
        description: "Install the Skills needed for your project. Restart the Agent session after installation.",
        title: "Get OpenBKN Skills",
        trigger: "Get Skills",
      },
      labels: {
        output: "Primary output",
        scenario: "Use when",
      },
      skillNameSeparator: ":",
      skills: {
        creator: {
          output: "A runnable knowledge network, data bindings and validation results, and a delivery report.",
          scenario: "Requirements or the modeling scheme are ready and you need to create, update, bind data, validate, test, publish, or improve from feedback.",
          title: "Business knowledge network construction and validation Skill",
        },
        ontologyBuilder: {
          output: "A business-reviewable ontology design that defines objects, relations, metrics, and actions.",
          scenario: "You have a PRD, process description, or business materials and need to agree how the knowledge network represents business semantics before creation.",
          title: "Business knowledge network design Skill",
        },
        requirement: {
          output: "A scenario-centered PRD, acceptance cases, and a BKN Creator handoff summary.",
          scenario: "Interview notes, a PRD, process documents, or early ideas need to be organized into business goals, scope, rules, and acceptance criteria.",
          title: "Requirement clarification Skill",
        },
      },
    },
    greeting: {
      afternoon: "Good afternoon, {{name}}",
      afternoonAnonymous: "Good afternoon",
      evening: "Good evening, {{name}}",
      eveningAnonymous: "Good evening",
      morning: "Good morning, {{name}}",
      morningAnonymous: "Good morning",
    },
    introduction:
      "Welcome to OpenBKN. For all types of enterprise agents, OpenBKN builds business knowledge networks driven by ontology, uniformly organizing the enterprise's data, logic, actions and risks, combining the creativity of agents with the certainty of enterprise business, and supporting accurate, secure and reliable analysis, execution and decision-making.",
    pathLabel: "Build path",
    paths: {
      engineering: {
        description:
          "Start from business materials and use AI Skills for requirement clarification, design, construction, and validation to build an iteratively improvable business knowledge network.",
        heading: "Build a business knowledge network with AI Skills",
        title: "AI Skills build",
      },
      platform: {
        description: "Start with the platform environment and business data. Prepare the environment and data, then model the knowledge network; validate business outcomes and expose capabilities for invocation to create a usable, continuously evolving business knowledge network.",
        heading: "Build a knowledge network manually",
        title: "Manual build",
      },
    },
    platform: {
      configuration: "Configuration",
      configurationLabel: "Configuration:",
      details: "View configuration details",
      impact: "If not configured",
      impactLabel: "If not configured:",
      noPermission: "Your account does not have permission for this action. Contact an administrator.",
      optional: "Optional",
      required: "Stage actions",
      role: "Purpose",
      roleLabel: "Purpose:",
      stages: {
        data: {
          detail: "Connect business data and synchronize it to the data directory. Then enrich business semantics and build retrieval indexes where needed, turning it into data assets that can be modeled and queried.",
          required: {
            connection: {
              description: "Configure the data source type, address, credentials, and database scope, then test the connection to confirm that the platform can access the target business data.",
              impact: "The platform cannot read target business data, so discovery, semantic understanding, index building, and resource-based knowledge network modeling cannot proceed.",
              outcome: "The platform has a reliable data access path and can continue discovering and preparing business resources.",
              summary: "Create a platform-to-data connection and verify connectivity.",
              title: "Configure a data connection",
            },
            discovery: {
              description: "Run discovery immediately or create a schedule for a data connection to synchronize databases, tables, views, and fields to the data directory, while continuing to discover added or stale resources.",
              impact: "The data directory has no available resources or field structures, so semantic understanding, index building, and object type modeling cannot select a resource.",
              outcome: "The platform has available business data resources and current structures to use in subsequent modeling.",
              summary: "Synchronize business resources and field structures to the data directory.",
              title: "Run data discovery",
            },
            indexBuild: {
              description: "For resources that need full-text retrieval, vector retrieval, or knowledge Q&A, configure and run an index build task in the data directory.",
              impact: "Resource browsing and basic modeling still work, but the resource cannot provide index-dependent full-text retrieval, vector retrieval, or knowledge Q&A.",
              outcome: "The data resource has indexes for retrieval and Q&A and can be used by the relevant retrieval paths.",
              summary: "Build indexes for retrieval and Q&A resources when needed.",
              title: "Build index tasks",
            },
            semanticUnderstanding: {
              description: "Select a resource in the data directory, run semantic understanding, and review the suggested business names, descriptions, and semantics for resources and fields.",
              impact: "Direct modeling still works, but resources remain raw databases, tables, and fields, requiring more manual effort to understand their business meaning and build the model.",
              outcome: "Resources and fields gain readable, reviewable business semantics that lower the cost of subsequent modeling and use.",
              summary: "Generate and review business semantics for resources and fields when needed.",
              title: "Run semantic understanding",
            },
          },
          summary: "Prepare business data resources",
          title: "Data preparation",
        },
        environment: {
          detail: "First establish the modules and operations that each participant can access, then set the default large and retrieval models needed for Q&A, semantic understanding, and retrieval.",
          required: {
            largeModel: {
              description: "Connect an available large language model (LLM) in model management, test it, and set it as the system default.",
              impact: "ContextLoader has no default model for understanding questions, organizing context, and generating answers, so intelligent Q&A and related model capabilities are unavailable.",
              outcome: "ContextLoader can automatically use the default LLM to understand business questions, organize context, and generate answers.",
              summary: "Set the system default LLM for question understanding and answer generation.",
              title: "Configure a large model",
            },
            permission: {
              description: "Use system management to configure users, roles, and resource operation permissions, defining who can manage data, models, knowledge networks, and execution tools.",
              impact: "Members cannot access the modules or operations needed for their role. Teams must share highly privileged accounts, increasing collaboration and audit risk.",
              outcome: "Members can collaboratively govern data, model, validate, and operate within clear, auditable permission boundaries.",
              summary: "Configure users, roles, and operation permissions for auditable collaboration.",
              title: "Configure users and permissions",
            },
            smallModel: {
              description: "Connect and set the system defaults for embedding and reranker models separately in model management, testing connectivity when needed.",
              impact: "Without embedding, resources cannot be vectorized and semantic recall is unavailable. Without reranker, recalled results cannot be reordered by relevance.",
              outcome: "Embedding turns content and queries into vectors for semantic recall; reranker reorders recalled results by relevance.",
              summary: "Set default retrieval models for semantic recall and result ranking.",
              title: "Configure small models",
            },
          },
          summary: "Prepare user access and model capabilities",
          title: "Prepare the environment",
        },
        model: {
          detail: "First create a knowledge network for the business scope. Object types turn resource fields into business objects, relation types describe the connections between objects, action types define triggerable business operations, and metrics establish consistent measurement definitions. Concept groups organize object types by theme and can limit the retrieval scope, while execution tools provide the actual invocation capability for tool-based logical attributes and action types.",
          required: {
            actionType: {
              description: "Select a bound object type, define trigger conditions and impact declarations, bind an execution tool, and map tool parameters from object properties, fixed values, or runtime input.",
              impact: "The knowledge network can query and analyze information only; it cannot turn business intent into actual business operations.",
              outcome: "Business intent becomes a validated, executable action with object context.",
              summary: "Define business operations with object context and execution mappings.",
              title: "Configure action types",
            },
            conceptGroup: {
              description: "Group object types by business theme. Intelligent Q&A and knowledge retrieval can select a concept group to limit concept recall to the corresponding business scope.",
              impact: "Object, relation, action, and metric capabilities still work, but retrieval searches the whole knowledge network with weaker topical focus, increasing the chance of irrelevant concepts in large networks.",
              outcome: "Object types can be organized by business theme, while retrieval narrows object, relation, and action recall to improve relevance.",
              summary: "Group object types by theme and limit knowledge recall scope.",
              title: "Configure concept groups",
            },
            metric: {
              description: "Based on a configured object type, select the measured property and aggregation, then configure units, filters, grouping, and time dimensions. Add analysis dimensions as needed for trend, period-over-period, proportion, and drill-down analysis.",
              impact: "Metric queries and analysis cannot use a consistent business definition. Q&A and analysis can only rely on raw properties, making business measurements difficult to reuse reliably.",
              outcome: "Analyze metrics by time, dimension, and condition in metric data queries, and reuse the same definition for consistent results.",
              summary: "Establish consistent, explainable, reusable business measurements.",
              title: "Configure metrics",
            },
            metricExecutionTool: {
              description: "Create or connect callable tools in Execution Units and define their inputs and outputs. Then bind them to tool-based logical attributes and action types, and configure parameter mappings.",
              impact: "Tool-based logical attributes cannot calculate or retrieve results, and action types cannot execute the underlying operation. Data attributes and metrics are unaffected.",
              outcome: "Logical attributes and action types can reuse configured tools to calculate derived values or perform business operations.",
              summary: "Provide reusable execution capabilities for tool-based logical attributes and action types.",
              title: "Configure execution tools",
            },
            network: {
              description: "Create or select a knowledge network for the business scope.",
              impact: "Business objects, Q&A configuration, and invocation have no common business boundary and cannot become a manageable delivery unit.",
              outcome: "Models, Q&A, and external calls can be managed within one knowledge network.",
              summary: "Create a knowledge network that carries business models and capabilities.",
              title: "Configure a knowledge network",
            },
            objectType: {
              description: "Select an onboarded data resource, define the business object's data attributes, primary key, and display key, map them to resource fields, and optionally add metric- or tool-based logical attributes.",
              impact: "Raw data cannot be organized into stable business objects, leaving relations, metrics, actions, and object-based queries without a reliable attribute foundation.",
              outcome: "Creates understandable, queryable, reusable business object semantics that provide the object and attribute foundation for relations, metrics, and actions.",
              summary: "Define business objects, attributes, and data mappings.",
              title: "Configure object types",
            },
            relationType: {
              description: "Select source and target object types, define their business relationship, and establish association rules through direct object-property links or data-resource field mappings.",
              impact: "Connections between objects cannot be expressed consistently, limiting cross-object queries, relation subgraphs, and relationship-based understanding.",
              outcome: "Object data can be connected through defined relations, supporting cross-object queries, relation analysis, and graph browsing.",
              summary: "Define association semantics and mapping rules between business objects.",
              title: "Configure relation types",
            },
          },
          summary: "Organize business semantics and configure invocable capabilities",
          title: "Model the knowledge network",
        },
        validate: {
          detail: "After building the knowledge network, choose the checks needed for business answers, MCP tool calls, and invocation evidence. Configure platform-level access when an external agent needs to use OpenBKN.",
          required: {
            chat: {
              description: "Ask real business questions in the target knowledge network and check whether answers match the intended semantics, use the correct knowledge and data, and meet expectations.",
              impact: "Answer quality cannot be validated from a business-user perspective, so knowledge coverage gaps and answer deviations may be found too late.",
              outcome: "Confirm that the knowledge network answers the target business questions, then refine its configuration as needed.",
              title: "Intelligent Q&A",
            },
            integration: {
              description: "Copy MCP, CLI, or SDK configuration for the target agent platform so it can invoke OpenBKN search, query, and action capabilities.",
              impact: "External agent platforms cannot connect to OpenBKN, leaving the built knowledge and action capabilities unavailable in the target agent.",
              outcome: "External agents can discover and invoke OpenBKN platform capabilities through the configured method.",
              title: "Connect an agent platform",
            },
            mcpDebug: {
              description: "Select an MCP tool, provide request parameters, and run it to verify that the platform MCP service is discoverable and returns the expected result for the current knowledge network.",
              impact: "MCP protocol, tool parameters, and results cannot be checked before external agent integration, so problems are discovered later.",
              outcome: "Confirm that the MCP service and tool invocation path work, with request examples ready for external integration.",
              title: "MCP service debugging",
            },
            traceAnalysis: {
              description: "For an executed business Q&A or tool call, inspect the request, knowledge and data evidence, execution trace, and result to explain the outcome or locate an issue.",
              impact: "When results are unexpected, answers are off target, or calls fail, it is difficult to identify whether the issue is in the request, knowledge, data, or execution.",
              outcome: "Trace the complete evidence and execution path behind a business result for troubleshooting and delivery acceptance.",
              title: "Business provenance analysis",
            },
          },
          summary: "Validate and expose capabilities",
          title: "Validate and deliver",
        },
      },
    },
    tagline: "Home",
    title: "Home",
  },
} as const;
