/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiKeysEnUS = {
  apiKeys: {
    title: "API Key",
    description:
      "Issue long-lived API keys (bak_ prefix) and put them in the Authorization header of MCP clients / SDKs to replace short-lived login tokens. Valid only for the Context Loader (MCP / REST); identity and permissions match yours.",
    issue: "Issue key",
    refresh: "Refresh",
    calloutInfo:
      "A key is a personal Bearer token: paste it into the 立即体验 API Key field, or configure it in a CLI / MCP client. Identity and permissions match yours; the secret is shown only once at issue time.",
    columns: {
      name: "Name",
      key: "Key",
      created: "Created",
      expires: "Expires",
      lastUsed: "Last used",
      status: "Status",
      actions: "Actions",
    },
    neverExpire: "Never expires",
    never: "Never",
    statusEnabled: "Enabled",
    statusDisabled: "Disabled",
    actionUsage: "Usage",
    actionRegenerate: "Regenerate",
    actionRevoke: "Revoke",
    usage: {
      lead: "Use the key as the Authorization: Bearer header to call the ContextLoader REST API or configure an MCP client.",
      rest: "REST · ContextLoader",
      mcp: "mcpServers config",
      tabClaude: "Claude Code",
      tabCodex: "Codex",
      tabCursor: "Cursor",
      tabGeneric: "Generic mcp.json",
      tabRest: "REST",
      claudeCli: "① One-line CLI setup",
      claudeJson: "② Or write to the project .mcp.json",
      codexToml: "~/.codex/config.toml (streamable HTTP)",
      cursorHint: "Write to ~/.cursor/mcp.json (global) or the project's .cursor/mcp.json, then restart Cursor.",
      cursorFile: "~/.cursor/mcp.json",
    },
    usageModal: {
      title: "Use key",
      lead: "This key's secret was shown only once at issue time. Replace <YOUR_API_KEY> in the examples below with the full key you saved then.",
      close: "Close",
    },
    emptyTitle: "No API keys",
    emptyDescription: "Issue a long-lived key for MCP clients like Cursor / Claude Code.",
    loadFailed: "Failed to load API keys.",
    issueSuccess: "Issued.",
    issueFailed: "Failed to issue.",
    revokeSuccess: "Revoked.",
    revokeFailed: "Failed to revoke.",
    regenerateSuccess: "Regenerated.",
    regenerateFailed: "Failed to regenerate.",
    issueModal: {
      title: "Issue API key",
      name: "Name",
      namePlaceholder: "To tell uses apart, e.g. \"My Cursor\"",
      nameRequired: "Please enter a name",
      expiry: "Expiry",
      expiryDefault: "1 year (default)",
      expiryCustom: "Custom date",
      expiryNever: "Never expires",
      expiryDate: "Expiry date",
      expiryDateRequired: "Please pick an expiry date",
      expiryFuture: "Expiry must be in the future",
      neverWarn: "A key that never expires is riskier if leaked. Use with care and keep it safe.",
      submit: "Issue",
      dupName: "A key with this name already exists. Pick another name.",
    },
    secretModal: {
      title: "Copy and save your API key now",
      warning:
        "This is the full secret, shown only once. You cannot view it again after closing — copy and save it now.",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Copy failed",
      done: "I have saved it",
    },
    revokeConfirm: {
      title: "Revoke API key (high-risk)",
      content:
        "Revoking \"{{name}}\" takes effect immediately and cannot be undone; clients using it will get 401. Revoke?",
      ok: "Confirm revoke",
    },
    regenerateConfirm: {
      title: "Regenerate API key (high-risk)",
      content:
        "Regenerating immediately invalidates the old secret of \"{{name}}\" and produces a new one. Continue?",
      ok: "Confirm regenerate",
    },
  },
} as const;
