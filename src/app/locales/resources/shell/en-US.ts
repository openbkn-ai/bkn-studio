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
      domainKnowledgeNetwork: "Domain Knowledge Network",
      knowledgeNetworkManagement: "Knowledge Network Management",
      knowledgeNetworkIntegration: "Knowledge Network Integration",
      generalBusinessKnowledgeNetwork: "Data Resource Knowledge Network",
      dataConnection: "Data Connection",
      dataCatalog: "Data Catalog",
      indexBuild: "Task Management",
      dataResource: "Data Catalog",
      dataQuality: "Data Quality",
      executionFactory: "Capability Factory",
      executionFactoryLab: "Execution Factory (Lab)",
      executionFactoryLabCapabilities: "Capability Library (Lab)",
      executionFactoryLabCatalog: "Capability Catalog (Lab)",
      executionFactoryLabSandboxRuntime: "Sandbox Runtime Management",
      executionUnitManagement: "Execution Units",
      allExecutionUnits: "All Execution Units",
      executionFactorySandboxRuntime: "Sandbox Runtime",
      executionUnitManagementTooltip:
        "Manage operators, toolboxes, MCP servers, and skills on this platform",
      allExecutionUnitsTooltip:
        "Browse the market catalog and introduce resources to this platform",
      modelResources: "Model Management",
      quotaManagement: "Quota Management",
      modelStatistics: "Model Statistics",
      systemManagement: "System Management",
      userManagement: "User Management",
      roleManagement: "Role Management",
      authorizationManagement: "Permission Management",
      licenseManagement: "License Management",
      accessAddressManagement: "Access Addresses",
      modelManagement: "Model Configuration",
      bknTrace: "BKN Trace",
      observability: "Observability",
      businessProvenance: "Business Provenance",
      traceAnalysis: "Trace Analysis",
      observabilityLogs: "Log Search",
      observabilitySettings: "Observability Settings",
      logManagement: "Audit Logs",
      apiKeys: "API Key",
      account: "Account",
      aboutOpenBkn: "About OpenBKN",
      permissionReviews: "Permission tickets",
      pendingPermissionRequests_one: "{{count}} permission ticket awaiting review",
      pendingPermissionRequests_other: "{{count}} permission tickets awaiting review",
      installStatus: "Backend Service Status",
    },
    aboutOpenBkn: {
      title: "About OpenBKN",
      subtitle: "Open Business Knowledge Network. Open Source Ontology Platform.",
      summary:
        "OpenBKN is an ontology-driven business knowledge network platform for enterprise AI, automation and decision intelligence. It's an Open Source Ontology Platform.",
      points: {
        ontology: {
          title: "Ontology-Driven",
          description:
            "Use ontologies to describe enterprise objects, relationships, rules, risks, and actions.",
        },
        openSource: {
          title: "Open Source Ontology Platform",
          description:
            "Open, transparent, and extensible, with support for private deployment and collaboration.",
        },
        action: {
          title: "From Understanding to Action",
          description:
            "Connect knowledge, tools, and business actions so agents can participate in real workflows.",
        },
        governance: {
          title: "Secure & Traceable",
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
