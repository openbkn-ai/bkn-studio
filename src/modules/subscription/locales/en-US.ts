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
      audit: { description: "Audit governance", name: "Audit governance" },
      bkn_trace: {
        description:
          "Technical traces and runtime diagnostics: call chains, latency and error localisation (no business content or evidence chain).",
        name: "Runtime diagnostic traces",
      },
      branding: {
        description: "Custom product name, logo and sign-in page",
        name: "Branding",
      },
      connector_certified: {
        description:
          "Certified and advanced source connectors (SQL Server and other commercial databases). Community ships the basic connectors only.",
        name: "Advanced data connectivity",
      },
      impact_graph: {
        description: "OpenBKN Impact Graph",
        name: "Impact graph",
      },
      ops_dashboard: {
        description: "Model usage policies, usage statistics and operations dashboards",
        name: "Operations dashboard",
      },
      perm_object_level: {
        description: "Object-level authorization and advanced role control",
        name: "Object-level authorization",
      },
      rbac_basic: {
        description: "Custom departments, roles and permission control",
        name: "Custom roles and permissions",
      },
      semantic_task: {
        description: "Authoring and execution of business-semantic understanding tasks",
        name: "Semantic understanding tasks",
      },
      source_sync: {
        description: "Track source changes and refresh automatically",
        name: "Source change tracking",
      },
    },
    categories: {
      dataConnect: "Data connectivity",
      observability: "Observability",
      operations: "Operations",
      permission: "Permissions",
      semantic: "Semantics",
    },
    cluster: {
      otherService: "Rows marked “—” are provided by other services. This endpoint only describes the bkn-safe image, so it cannot answer for them.",
      available: "Available",
      hint: "“Your cluster” is computed from the licence and the image in force: Upgrade = shipped in this image but the tier is too low; Unavailable = this image does not carry the implementation.",
      notInstalled: "Unavailable",
      notLicensed: "Upgrade",
      title: "Your cluster",
      unknown: "Loading",
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
    industry: {
      body: "Industry-specific capabilities and quotas added on top of Enterprise by contract. Under the ordered tier model an industry licence carries every enterprise capability — contracts only add.",
      title: "Industry solution",
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
        highlights: {
          catalog: "Full knowledge network and data catalog",
          index: "Index building — batch and streaming",
          model: "Model integration and invocation",
        },
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
