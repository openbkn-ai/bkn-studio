/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const integrationPart = {
  integration: {
    title: "Integrate OpenBKN capabilities",
    description:
      "Provide a unified integration entry for agent platforms and business systems. MCP is for agent tool calls, CLI is for terminals and agents, and SDK is for building apps on a knowledge network.",
    descriptionHelpLabel: "View integration method help",
    modeLabel: "Integration method",
    tabsAriaLabel: "Knowledge network integration methods",
    tabs: {
      mcp: "MCP integration",
      cli: "CLI integration",
      sdk: "SDK integration",
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
      title: "CLI examples",
      ariaLabel: "CLI examples",
      successMessage: "CLI example copied",
      examples: {
        setup: {
          label: "Install and authenticate",
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
          label: "Knowledge network query",
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
          label: "Agent skill",
          title: "Install OpenBKN skill for agents with terminal access",
          code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="{{platformOrigin}}"
# Sign in once, then reuse the stored OAuth session.
openbkn auth login "$BKN_BASE_URL"
openbkn help all`,
        },
      },
    },
    // The SDK tab only links on: SDK examples are generated per network, on its App development page.
    sdk: {
      guideTitle: "Build apps on a knowledge network",
      guideDescription:
        "SDK examples are generated from each knowledge network's actual structure, on its App development page: object types, relations, actions, functions and more, each in Python, TypeScript and REST.",
      steps: {
        pick: "Pick the knowledge network to build on, on the right.",
        start:
          "On its App development page, get a token, install the SDK and generate the network's ontology SDK.",
        examples:
          "Copy the example for each capability, or download the full Q&A web app example. The whole page also exports as Markdown for a developer or a coding agent.",
      },
      eyebrow: "Python / TypeScript / REST",
      title: "Choose a knowledge network",
      searchPlaceholder: "Search knowledge networks by name",
      loading: "Loading knowledge networks…",
      loadFailed: "Could not load knowledge networks.",
      retry: "Retry",
      noNetworks: "No knowledge networks yet.",
      noMatch: "No matching knowledge networks.",
      more: "{{count}} more knowledge networks. Type a name to search.",
      more_one: "{{count}} more knowledge network. Type a name to search.",
      more_other: "{{count}} more knowledge networks. Type a name to search.",
    },
  },
} as const;
