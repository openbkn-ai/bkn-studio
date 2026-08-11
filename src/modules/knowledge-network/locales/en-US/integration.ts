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
    modeLabel: "Integration Method",
    tabsAriaLabel: "Knowledge network integration methods",
    tabs: {
      mcp: "MCP Integration",
      cli: "CLI Integration",
      sdk: "SDK Integration",
    },
    issueApiKey: "Issue API Key",
    packageLabel: "View npm package",
    copy: "Copy",
    copyFailed: "Copy failed. Please copy the code manually.",
    cli: {
      guideTitle: "Use OpenBKN from the CLI",
      guideDescription:
        "Use this for local terminals, CI/CD, and agents with shell access. The CLI uses the same platform capabilities without requiring custom API protocol handling.",
      steps: {
        install: "Install @openbkn/bkn-sdk globally to get the openbkn command.",
        token: "Issue an API Key in Account Center and use BKN_TOKEN to sign in to the target OpenBKN environment.",
        context: "Use context commands to search knowledge models, query instances, or discover MCP tools.",
        skill: "After installing the OpenBKN Skill for an agent, use natural language to choose the corresponding command.",
      },
      note: "API Keys currently power Context Loader commands. Issue one in Account Center and inject it into the terminal through BKN_TOKEN.",
      title: "CLI Examples",
      ariaLabel: "CLI examples",
      successMessage: "CLI example copied",
      examples: {
        setup: {
          label: "Install and Authenticate",
          title: "Install OpenBKN CLI and configure access credentials",
          code: `npm install -g @openbkn/bkn-sdk

export BKN_BASE_URL="{{platformOrigin}}"
export BKN_TOKEN="bak_<issued_from_account_center>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn --version`,
        },
        context: {
          label: "Knowledge Network Query",
          title: "Search knowledge models, query instances, and discover tools from the terminal",
          code: `openbkn context search-schema <kn-id> "Find order-related objects and relations"

openbkn context query-object-instance <kn-id> --args '{
  "ot_id": "order",
  "limit": 20
}'

openbkn context tools <kn-id>`,
        },
        "agent-skill": {
          label: "Agent Skill",
          title: "Install OpenBKN Skill for agents with terminal access",
          code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="{{platformOrigin}}"
export BKN_TOKEN="bak_<issued_from_account_center>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn help all`,
        },
      },
    },
    sdk: {
      guideTitle: "Integrate OpenBKN with the SDK",
      guideDescription:
        "Use this for Node.js server-side projects. The SDK wraps authentication, MCP sessions, JSON-RPC calls, and response parsing so services do not need to maintain raw HTTP protocol details.",
      steps: {
        install: "Install @openbkn/bkn-sdk.",
        token: "Issue an API Key in Account Center and configure BKN_BASE_URL and BKN_TOKEN on the server.",
        client: "Create a client and call knowledge network capabilities through bkn.context.",
        tools: "Query object instances as needed, or discover and call dynamic MCP tools.",
      },
      installSuccessMessage: "SDK install command copied",
      installTitle: "Install SDK",
      note: "API Keys currently power bkn.context and are managed only in Account Center. Server-side code reads them from BKN_TOKEN.",
      title: "SDK Examples",
      ariaLabel: "SDK examples",
      successMessage: "SDK example copied",
      examples: {
        "quick-start": {
          label: "Quick Start",
          title: "Create an SDK client and search knowledge models",
          code: `import { createClient } from "@openbkn/bkn-sdk";

const bkn = createClient({
  baseUrl: process.env.BKN_BASE_URL!,
  token: process.env.BKN_TOKEN!,
});

const result = await bkn.context.searchSchema(
  "your_kn_id",
  "Find order-related objects and relations",
  { searchScope: ["object", "relation"], maxConcepts: 10 },
);`,
        },
        "instance-query": {
          label: "Query Instances",
          title: "Query object instances by object type and conditions",
          code: `const result = await bkn.context.queryObjectInstance("your_kn_id", {
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
          code: `const tools = await bkn.context.tools("your_kn_id");

const result = await bkn.context.toolCall("your_kn_id", "search_schema", {
  query: "Find order-related objects and relations",
  response_format: "json",
});`,
        },
      },
    },
  },
} as const;
