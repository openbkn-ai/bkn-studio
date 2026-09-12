/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Capability names mirror the licence registry seed in license-server
 * (`server/internal/store/capabilities.go`), which is authored in Chinese —
 * these are translations of that source, not a second source of truth. When a
 * registry row changes, change it there first.
 */
export const subscriptionEnUS = {
  subscription: {
    capabilities: {
      business_provenance: {
        description:
          "Evidence chains, data provenance, the business semantic graph and interactive tracing for business questions and results.",
        name: "Business provenance",
      },
      bkn_trace: {
        description:
          "Technical traces and runtime diagnostics: call chains, latency and error localisation (no business content or evidence chain).",
        name: "Runtime diagnostic traces",
      },
      connector_certified: {
        bullets: {
          b1: "Connect straight to SQL Server and other commercial databases — no export step in between",
          b2: "Connection parameters, drivers and dialects are vendor-maintained and validated each release",
          b3: "Same modelling, indexing and query path as the community connectors — switching changes no model",
        },
        description:
          "Certified and advanced source connectors (SQL Server and other commercial databases). Community ships the basic connectors only.",
        name: "Advanced data connectivity",
      },
      perm_fine_grained: {
        bullets: {
          b1: "Grants down to sub-resources: inside a knowledge network and per Resource under a catalog",
          b2: "View, query, modify, delete and execute configured per operation",
          b3: "Explicit sub-resource exceptions: direct allow or direct deny",
          b4: "Full resource-authorization audit",
        },
        description: "Per-object allow and deny decisions with source-level revocation",
        name: "Fine-grained object authorization",
      },
      perm_object_level: {
        bullets: {
          b1: "Row-level permissions on object types",
          b2: "Column-level permissions on object types, four property tiers",
          b3: "Data masking",
          b4: "Audit of row and column permission changes",
        },
        description: "Enterprise object-rule compatibility and property-level controls",
        name: "Enterprise object rules",
      },
      rbac_basic: {
        bullets: { b1: "Custom roles and departments instead of the built-in roles only" },
        description: "Custom departments, roles and permission control",
        name: "Custom roles and permissions",
      },
      semantic_task: {
        description: "Authoring and execution of business-semantic understanding tasks",
        name: "Semantic understanding tasks",
      },
    },
    /**
     * Community capabilities (display only). The registry does not record community
     * capabilities (`ee-features.md`: a community certificate carries an empty
     * features list), so these have no key and gate nothing — they mirror the rows
     * ticked for every edition on the public pricing page.
     */
    community: {
      actionSandbox: "Action execution in a secure sandbox",
      basicAudit: "Basic activity audit",
      cliTrace: "Query run traces, latency, evidence and reasoning via CLI / SDK",
      commonSources: "Common databases, OpenSearch and CSV ingestion",
      indexing: "Data discovery, batch indexing and vectorisation",
      localAuth: "Local sign-in with user, department and built-in role management",
      mcpTooling: "Connect, debug and invoke MCP servers, tools and Skills",
      modelingSurfaces:
        "Model and manage knowledge networks from BKN Studio, CLI, SDK and Skills",
      modelingTypes: "Object, relation, action and metric modelling",
      queryAndSearch: "Relation queries, path queries and semantic search",
      selfHosted: "Source builds, basic deployment, health checks and upgrade docs",
      topLevelGrants:
        "Grants on top-level resources only (knowledge networks, catalogs) as a fixed permission bundle",
    },
    categories: {
      modeling: "Knowledge modelling",
      dataConnect: "Data connectivity",
      observability: "Observability",
      operations: "Operations",
      permission: "Permissions",
      semantic: "Semantics",
    },
    cta: {
      import: "Import licence",
      importHint:
        "Already have a licence file? Import it under licence management — it takes effect on the next request, no restart required.",
      needAdmin: "Importing a licence requires licence management permission. Ask an administrator.",
      apply: "Request a licence",
      details: "View details",
    },
    current: {
      badge: "Current",
      edition: "This workspace runs on {{edition}}.",
      unlicensed: "No licence is in force. Running the community capability set.",
    },
    matrix: {
      capability: "Capability",
      new: "New",
      sinceVersion: "Available from {{version}}",
      title: "Capability comparison",
    },
    plans: {
      // Pricing is not rendered today (see SubscriptionScene). What is kept here mirrors the
      // public pricing page, NOT license-server's design doc — §1.5 there records
      // ¥49,800/project/year, which is the limited-time half-price figure under a different
      // unit, and has drifted. List price is ¥99,600/year; discounts run to 2028 in three
      // steps, each with an expiry — exactly why the number does not belong on this page.
      community: {
        audience:
          "Developers, technical teams and ecosystem partners. Build and validate a complete business knowledge network for free.",
        price: "Free",
        unit: "Self-hosted · perpetual",
      },
      enterprise: {
        audience:
          "Organisations running OpenBKN as an enterprise AI platform. Adds enterprise administration, knowledge exploration, version governance and fuller production operations.",
        price: "Contact us",
        unit: "Per contract",
      },
      inheritsFrom: "Everything in {{edition}}",
      professional: {
        audience:
          "Customer teams moving to a production pilot. Adds faster source refresh, enterprise permissions, vendor support and more connectors.",
        price: "¥99,600",
        unit: "/ year · list price",
      },
      quota: {
        fromLicence: "Quotas for the current edition come from the licence file",
        maxNodes: "{{value}} nodes",
        maxUsers: "{{value}} users",
        unlimited: "Unlimited",
      },
    },
    contact:
      "Full capability comparison, service terms and current discounts are in the pricing page; for sales, business@openbkn.ai.",
    title: "Editions & subscription",
    subtitle:
      "Knowledge network and data capabilities are complete in every edition. Permission boundaries, audit and compliance scale with the edition.",
  },
} as const;
