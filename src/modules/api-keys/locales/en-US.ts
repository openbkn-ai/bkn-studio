/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const apiKeysEnUS = {
  apiKeys: {
    title: "API Keys",
    description:
      "Issue long-lived API keys (bak_ prefix) for Context Loader calls through MCP, CLI, or SDK, replacing short-lived login tokens. Identity and permissions match yours.",
    issue: "Issue key",
    refresh: "Refresh",
    calloutInfo:
      "An API key is your personal Bearer token. Under Domain Knowledge Network → Knowledge network integration → MCP integration, select Configure API key and paste the key. You can also provide it to the CLI / SDK through BKN_TOKEN or configure it in an MCP client. Calls use your account identity and permissions; the full secret is shown only once when issued, so save it immediately.",
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
    actionRegenerate: "Regenerate",
    actionRevoke: "Revoke",
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
      namePlaceholder: 'To tell uses apart, e.g. "My Cursor"',
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
        'Revoking "{{name}}" takes effect immediately and cannot be undone; clients using it will get 401. Revoke?',
      ok: "Confirm revoke",
    },
    regenerateConfirm: {
      title: "Regenerate API key (high-risk)",
      content:
        'Regenerating immediately invalidates the old secret of "{{name}}" and produces a new one. Continue?',
      ok: "Confirm regenerate",
    },
    tabs: {
      keys: "API keys",
      clients: "Connected clients",
    },
    connectedClients: {
      title: "Connected clients",
      description:
        "Clients you connected by signing in from an agent such as WorkBuddy, Claude Code or Cursor. They act as you and renew their access on their own. Disconnecting one revokes its access at once; it has to connect and sign in again.",
      columns: {
        client: "Client",
        callback: "Callback",
        grantedAt: "Authorized",
        actions: "Actions",
      },
      actionDisconnect: "Disconnect",
      disconnectConfirm: {
        title: "Disconnect this client?",
        content:
          "“{{name}}” will lose access to the platform and has to connect and sign in again from the client.",
        ok: "Disconnect",
      },
      disconnectSuccess: "Disconnected",
      disconnectFailed: "Failed to disconnect",
      loadFailed: "Failed to load connected clients",
      emptyTitle: "No connected clients yet",
      emptyDescription:
        "Put only the MCP URL into an agent and click Connect; after you sign in it appears here. See Domain Knowledge Network → Knowledge network integration → MCP integration for the setup.",
    },
  },
} as const;
