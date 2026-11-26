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
      kn_action_modeling: {
        name: "Action modelling",
        description:
          "Define action types, configure execution parameters, and run actions in a knowledge network.",
        bullets: {
          b1: "Object operations and tool calls",
          b2: "Configure action parameters and review execution history",
        },
      },
      kn_events: {
        bullets: {
          b1: "Configure event classes and detection rules",
          b2: "Review event records and detection results",
        },
        name: "Event classes",
        description:
          "Define event classes, configure detection rules, and view event records in a knowledge network.",
      },
      kn_tool_mounts: {
        name: "Knowledge network resource mounting",
        description:
          "Mount functions, APIs, MCP servers, and Skills for direct use by a knowledge network.",
        bullets: {
          b1: "Mount functions, APIs, MCP servers, and Skills",
        },
      },
      execution_factory: {
        name: "Execution Factory",
        description:
          "Manage, publish, and debug execution units, browse all units, and manage the sandbox runtime.",
        bullets: {
          b1: "Connect OpenAPI, functions, MCP servers, and Skills",
          b2: "Create, publish, debug, and browse execution units",
          b3: "Manage sandbox runtimes",
        },
      },
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
        bullets: {
          b1: "Require confirmation, block execution, or trigger business approval",
        },
        name: "Action control",
        description: "Configure confirmation, denial and business approval rules for actions.",
      },
      permission_matrix: {
        bullets: {
          b1: "Inspect effective permissions and their sources",
        },
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
      basicAudit: "Basic activity audit",
      cliTrace: "Query run traces, latency, evidence and reasoning via CLI / SDK",
      commonSources: "MySQL, PostgreSQL, MariaDB and OpenSearch",
      indexing: "Data discovery, batch indexing and vectorisation",
      localAuth: "Local sign-in with user, department and built-in role management",
      modelingSurfaces: "Model from Studio, CLI, SDK and Skills",
      modelingTypes: "Object and relation modelling",
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
        hanaConnector: "SAP HANA",
        audience:
          "For organizations running business applications and governing and auditing production use.",
        price: "Contact us",
        unit: "Per contract",
      },
      inheritsFrom: "Everything in {{edition}}",
      professional: {
        audience:
          "For teams that model together, connect more data and tools, and need finer access control.",
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
      "Every edition supports object and relation modelling, common data connections, and queries.",
  },
} as const;
