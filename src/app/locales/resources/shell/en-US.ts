/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const shellEnUS = {
  shell: {
    workspace: "Workspace",
    modeStandalone: "Standalone",
    modeHosted: "Hosted",
    productTagline: "Studio Console",
    userMenuProductTitle: "{{product}} {{tagline}}",
    userMenuTagline: "Console",
    versionLine: "Version {{version}}",
    headerAside: "Application shell baseline",
    stage: {
      beta: "Beta",
    },
    collapseSidenav: "Collapse navigation",
    expandSidenav: "Expand navigation",
    theme: {
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
    },
    language: {
      label: "Language",
      zhCN: "中文",
      enUS: "English",
    },
    items: {
      home: "Home",
      globalBusinessKnowledgeNetwork: "Global Business Knowledge Network",
      bknProject: "Project management",
      domainKnowledgeNetwork: "Domain Knowledge Network",
      knowledgeNetworkManagement: "Knowledge networks",
      knowledgeNetworkIntegration: "Knowledge network integration",
      generalBusinessKnowledgeNetwork: "Data Resource Knowledge Network",
      dataConnection: "Data connections",
      dataCatalog: "Data catalog",
      indexBuild: "Tasks",
      dataResource: "Data catalog",
      knowledgeBase: "Knowledge base",
      dataQuality: "Data quality",
      executionFactory: "Execution Factory",
      executionFactoryLab: "Execution Factory (Lab)",
      executionFactoryLabCapabilities: "Capability library (Lab)",
      executionFactoryLabCatalog: "Capability catalog (Lab)",
      executionFactoryLabSandboxRuntime: "Sandbox runtime",
      executionUnitManagement: "Execution units",
      allExecutionUnits: "All execution units",
      executionFactorySandboxRuntime: "Sandbox runtime",
      executionUnitManagementTooltip: "Manage toolboxes, MCP servers, and skills on this platform",
      allExecutionUnitsTooltip:
        "Browse the market catalog and introduce resources to this platform",
      modelResources: "Models",
      quotaManagement: "Quotas",
      modelStatistics: "Model statistics",
      systemManagement: "System",
      userManagement: "Users",
      roleManagement: "Roles",
      authorizationManagement: "Permissions",
      licenseManagement: "License",
      accessAddressManagement: "Access",
      agentConfig: "Built-in agents",
      modelManagement: "Model configuration",
      bknTrace: "BKN Trace",
      observability: "Observability",
      businessProvenance: "Business provenance",
      traceAnalysis: "Trace analysis",
      observabilityLogs: "Log search",
      observabilitySettings: "Observability settings",
      logManagement: "Audit logs",
      apiKeys: "API keys",
      account: "Account",
      aboutOpenBkn: "About OpenBKN",
      permissionReviews: "Permission tickets",
      pendingPermissionRequests_one: "{{count}} permission ticket awaiting review",
      pendingPermissionRequests_other: "{{count}} permission tickets awaiting review",
      installStatus: "Backend service status",
    },
    aboutOpenBkn: {
      title: "About OpenBKN",
      summary:
        "OpenBKN is an open-source ontology platform providing an ontology-driven business knowledge network to empower enterprise AI, automation, and decision intelligence.",
      points: {
        ontology: {
          title: "Ontology-Driven",
          description:
            "Use ontologies to describe enterprise objects, relationships, rules, risks, and actions.",
        },
        openSource: {
          title: "Open source ontology platform",
          description:
            "Open, transparent, and extensible, with support for private deployment and collaboration.",
        },
        action: {
          title: "From understanding to action",
          description:
            "Connect knowledge, tools, and business actions so agents can participate in real workflows.",
        },
        governance: {
          title: "Secure & traceable",
          description:
            "Apply permissions, risk controls, and end-to-end traceability to business actions.",
        },
      },
      footer: "Like OpenBKN? Give us a star on GitHub.",
      website: "Learn more ↗",
      github: "Star on GitHub",
    },
  },
} as const;
