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
      sso: {
        name: "Single sign-on",
        description: "Manage identity providers, browser sign-in and API token exchange.",
        bullets: { b1: "OIDC / Casdoor" },
      },
      eval: {
        description:
          "Manage cases from templates, run evaluations, and review diagnostics and regression results.",
        name: "Eval quality evaluation",
      },
      business_provenance: {
        bullets: {
          b1: "Timeline",
          b2: "Evidence chain",
        },
        description:
          "Timelines, evidence chains, data provenance, the business semantic graph and interactive tracing for business questions and results.",
        name: "Business provenance",
      },
      bkn_trace: {
        description:
          "Technical traces and runtime diagnostics: call chains, latency and error localisation (no business content or evidence chain).",
        name: "Runtime diagnostic traces",
      },
      connector_certified: {
        bullets: {
          b1: "Connect directly to SQL Server, Oracle and Doris, and connect data through APIs; SAP HANA requires Enterprise or higher",
          b2: "Connection parameters, drivers and dialects are vendor-maintained and validated each release",
          b3: "Same modelling, indexing and query path as the community connectors — switching changes no model",
          b4: "Using a connector requires a valid licence for its edition and a Vega deployment image containing its implementation",
        },
        // The card lists only which databases connect; the full sentences above stay in the upgrade dialog.
        cardBullets: {
          b1: "SQL Server",
          b2: "Oracle",
          b3: "Doris",
          b4: "Data through APIs",
        },
        description:
          "Certified and advanced source connectors: Professional includes SQL Server, Oracle, Doris and API connections; Enterprise adds SAP HANA. Community ships the basic connectors only.",
        name: "Advanced data connectivity",
      },
      vega_logic_view: {
        description: "Supports derived and composite views.",
        name: "Logical views: derived and composite views",
      },
      graph_explorer: {
        bullets: {
          b1: "Find instances by search or Cypher, expand hop by hop",
          b2: "Paths between instances, several layouts",
          b3: "History, canvas export and share links",
        },
        description:
          "Start from a concrete instance, expand its neighbours and trace paths on a canvas; also opens graph links handed over by agents.",
        name: "Graph explorer",
      },
      bkn_project: {
        bullets: {
          b1: "Requirements, ontology modelling and network releases in one place",
          b2: "Extract concepts from data tables",
          b3: "Kinetic modelling and business scenarios",
        },
        description:
          "Organise a knowledge network's requirements, ontology modelling and releases as projects.",
        name: "Project management",
      },
      knowledge_base: {
        bullets: {
          b1: "Extract concepts, properties, relations and events from documents",
          b2: "Entity recognition, linking and fusion",
          b3: "File ingestion, chunking and source location",
        },
        description:
          "Connect files from object storage, file services and other sources, keep their content versions, and parse, chunk and locate them in the original text.",
        name: "Ontology knowledge base",
      },
      action_governance: {
        name: "Action control",
        description: "Configure confirmation, denial and business approval rules for actions.",
      },
      permission_matrix: {
        name: "Permission matrix",
        description: "Review user and role permissions across knowledge network resources.",
      },
      object_metrics: {
        bullets: {
          b1: "Atomic, derived and composite metrics",
          b2: "Validate, preview, publish and trace lineage",
          b3: "Query and trial by instance or object set",
        },
        description:
          "Define, validate, publish and query atomic, derived and composite metrics by object type.",
        name: "Object Metrics",
      },
      workshop: {
        bullets: {
          b1: "Build pages from components with AI help",
          b2: "Handle events as tasks",
          b3: "Scenarios, model trials and actions",
        },
        description:
          "Build business apps on knowledge networks: pages and components, events and tasks, scenarios.",
        name: "Workshop",
      },
      analysis_canvas: {
        description:
          "Break an analysis into reviewable cards with AI; results are kept on the server and can be shared with others.",
        name: "Analysis canvas",
      },
      version_mgmt: {
        bullets: {
          b1: "Multiple versions",
          b2: "Version history; query and run on a past version",
          b3: "Version comparison and rollback",
        },
        description: "Version history, comparison and rollback for knowledge networks.",
        name: "Knowledge network versions",
      },
      risk_control: {
        bullets: {
          b1: "Permission matrix: effective permissions and sources",
          b2: "Execution control for action types",
        },
        description: "Permission matrix and action execution control for knowledge networks.",
        name: "Risk control",
      },
      perm_fine_grained: {
        bullets: {
          b1: "View, query, modify, delete and execute granted separately",
          b2: "Explicit allow, deny and authorization audit",
        },
        description: "Per-object allow and deny decisions with source-level revocation",
        name: "Object authorization",
      },
      perm_object_level: {
        bullets: {
          b1: "Row filtering on object types",
          b2: "Column filtering: hide, names only, or mask",
          b3: "Audit of row and column permission changes",
        },
        description: "Enterprise object-rule compatibility and property-level controls",
        name: "Row- and column-level permission control",
      },
      rbac_basic: {
        description: "Custom departments, roles and permission control",
        name: "Custom roles and permissions",
      },
      ops_dashboard: {
        description: "Model usage policies, usage statistics and an O&M dashboard",
        name: "O&M dashboard",
      },
      semantic_task: {
        description: "Authoring and execution of business-semantic understanding tasks",
        name: "Semantic understanding for data resources",
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
      commonSources: "MySQL, PostgreSQL, MariaDB and OpenSearch",
      executionFactory: "Execution Factory connects OpenAPI, MCP, SKILL and functions",
      indexing: "Data discovery, batch indexing and vectorisation",
      localAuth: "Local sign-in with user, department and built-in role management",
      mcpTooling: "Connect, debug and invoke MCP servers, tools and Skills",
      modelingSurfaces: "Model from Studio, CLI, SDK and Skills",
      modelingTypes: "Object, relation and action modelling",
      draftAndRunning: "Knowledge network draft and running version",
      oneClickExperience: "Try it in one click with dynamically loaded official examples",
      queryAndSearch: "Relation queries, path queries and semantic search",
      selfHosted: "Source builds, basic deployment, health checks and upgrade docs",
      topLevelGrants: "Grants on whole top-level resources (knowledge networks, catalogs)",
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
      needAdmin:
        "Importing a licence requires licence management permission. Ask an administrator.",
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
      planned: "Planned",
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
          "For developers, technical teams and ecosystem partners. Build and validate business knowledge networks for free, ideal for demo validation and POCs.",
        price: "Free",
        unit: "Self-hosted · perpetual",
      },
      enterprise: {
        audience:
          "For organisations running their enterprise AI agents on OpenBKN. Adds Workshop, the analysis canvas, risk control, knowledge network versions, SAP HANA connectivity, row- and column-level permission control and business provenance on top of Professional.",
        hanaConnector: "SAP HANA",
        price: "Contact us",
        unit: "Per contract",
      },
      inheritsFrom: "Everything in {{edition}}",
      professional: {
        audience:
          "For fast-growing AI-native teams. Adds custom roles and permissions, object authorization, advanced data connectivity (including API connections), project management and the knowledge base on top of Community.",
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
      "Knowledge network modelling, common data connections and queries are open in every edition. Projects and the knowledge base, permission control, versions and business apps scale with the edition.",
  },
} as const;
