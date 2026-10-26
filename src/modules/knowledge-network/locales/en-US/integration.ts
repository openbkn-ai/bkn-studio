/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const integrationPart = {
  integration: {
    title: "Integrate OpenBKN Capabilities",
    description:
      "Provide a unified integration entry for agent platforms and business systems. MCP is for agent tool calls, CLI is for terminals and agents, and SDK is for Node.js services.",
    descriptionHelpLabel: "View integration method help",
    modeLabel: "Integration Method",
    tabsAriaLabel: "Knowledge network integration methods",
    tabs: {
      mcp: "MCP Integration",
      cli: "CLI Integration",
      sdk: "SDK Integration",
    },
    mcpWorkspace: {
      tabsAriaLabel: "MCP integration workspace",
      tabs: {
        connect: "Client setup",
        debug: "Tool debugging",
      },
      networkLabel: "Knowledge network",
      networkLoading: "Loading knowledge networks…",
      networkPlaceholder: "Select a knowledge network",
      networkNoMatch: "No matching knowledge networks",
      openNetwork: "View knowledge network",
      retry: "Retry",
      loadFailedTitle: "Failed to load knowledge networks",
      loadFailedDescription: "The available knowledge networks could not be loaded. Please retry.",
      selectNetworkTitle: "Select a knowledge network to debug",
      selectNetworkDescription:
        "MCP tool calls require an explicit knowledge-network context. Selecting one loads the tools available for that network.",
      noNetworksTitle: "No knowledge networks available for debugging",
      noNetworksDescription:
        "Create a knowledge network first, or ask an administrator for access to one.",
      networkUnavailableTitle: "The original knowledge network is unavailable",
      networkUnavailableDescription:
        "The knowledge network in this link does not exist or is not accessible to the current account. Select another network.",
    },
    packageLabel: "View npm package",
    copy: "Copy",
    copyFailed: "Copy failed. Please copy the code manually.",
    cli: {
      guideTitle: "Use OpenBKN from the CLI",
      guideDescription:
        "Use this for local terminals, CI/CD, and agents with shell access. OAuth account sessions are the default way to access platform capabilities without custom API protocol handling.",
      steps: {
        install: "Install @openbkn/bkn-sdk globally to get the openbkn command.",
        token: "Sign in with an OpenBKN account; the CLI stores and refreshes the OAuth session.",
        context:
          "Use bkn list to get a knowledge network ID, then call platform or context commands as needed.",
        skill:
          "After installing the OpenBKN Skill for an agent, use natural language to choose the corresponding command.",
      },
      title: "CLI Examples",
      ariaLabel: "CLI examples",
      successMessage: "CLI example copied",
      examples: {
        setup: {
          label: "Install and Authenticate",
          title: "Install OpenBKN CLI and sign in with an account",
          code: `npm install -g @openbkn/bkn-sdk

export BKN_BASE_URL="{{platformOrigin}}"
# Scenario 1: Local terminal sign-in in a browser
openbkn auth login "$BKN_BASE_URL"

# Scenario 2: Headless non-interactive account/password sign-in (choose one)
# openbkn auth login "$BKN_BASE_URL" -u "<account>" -p "<password>"

# Verify the session and list accessible knowledge networks
openbkn auth status
openbkn bkn list --limit 10`,
        },
        context: {
          label: "Knowledge Network Query",
          title: "Common scenarios: search models, query instances, and discover tools",
          code: `# Scenario 1: Search knowledge models
openbkn context search-schema <kn-id> "Find order-related objects and relations"

# Scenario 2: Query object instances
openbkn context query-object-instance <kn-id> --args '{
  "ot_id": "order",
  "limit": 20
}'

# Scenario 3: Discover available tools
openbkn context tools <kn-id>`,
        },
        "agent-skill": {
          label: "Agent Skill",
          title: "Install OpenBKN Skill for agents with terminal access",
          code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="{{platformOrigin}}"
# Sign in once, then reuse the stored OAuth session.
openbkn auth login "$BKN_BASE_URL"
openbkn help all`,
        },
      },
    },
    sdk: {
      guideTitle: "Integrate OpenBKN with the SDK",
      guideDescription:
        "Use this for Node.js server-side projects. The SDK establishes and refreshes OAuth sessions with account credentials, and wraps platform requests, MCP sessions, JSON-RPC calls, and response parsing.",
      steps: {
        install: "Install @openbkn/bkn-sdk.",
        token:
          "Configure an OpenBKN account and password; the SDK establishes a refreshable OAuth session.",
        client: "Create an authenticated client asynchronously with the platform URL.",
        tools:
          "Get a knowledge network ID first, then call bkn, resource, vega, or context capabilities as permitted by the account.",
      },
      installSuccessMessage: "SDK install command copied",
      installTitle: "Install SDK",
      title: "SDK Examples",
      ariaLabel: "SDK examples",
      successMessage: "SDK example copied",
      examples: {
        "quick-start": {
          label: "Quick Start",
          title:
            "Create an authenticated client with account credentials and search knowledge models",
          code: `import { createAuthenticatedClient } from "@openbkn/bkn-sdk";

const bkn = await createAuthenticatedClient({
  baseUrl: process.env.BKN_BASE_URL!,
  auth: {
    username: process.env.BKN_USERNAME!,
    password: process.env.BKN_PASSWORD!,
  },
});

// Configure the knowledge network ID for the service.
const knId = process.env.BKN_KN_ID!;

const result = await bkn.context.searchSchema(
  knId,
  "Find order-related objects and relations",
  { searchScope: ["object", "relation"], maxConcepts: 10 },
);`,
        },
        "instance-query": {
          label: "Query Instances",
          title: "Query object instances by object type and conditions",
          code: `const result = await bkn.context.queryObjectInstance(knId, {
  ot_id: "order",
  condition: {
    operation: "and",
    sub_conditions: [
      { field: "status", operation: "==", value_from: "const", value: "paid" },
    ],
  },
  limit: 20,
});`,
        },
        "dynamic-tool": {
          label: "Dynamic Tools",
          title: "Discover and call MCP tools exposed by the current knowledge network",
          code: `// Step 1: Discover tools exposed by the knowledge network
const tools = await bkn.context.tools(knId);

// Step 2: Call the selected tool
const result = await bkn.context.toolCall(knId, "search_schema", {
  query: "Find order-related objects and relations",
  response_format: "json",
});`,
        },
      },
    },
  },
} as const;
