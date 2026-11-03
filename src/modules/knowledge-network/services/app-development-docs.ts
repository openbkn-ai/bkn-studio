/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Links into the published API reference, one version per platform release. */

import { sdkVersionOf } from "@/modules/knowledge-network/services/app-development-examples";

const DOCS_BASE = "https://openbkn-ai.github.io/bkn-foundry/versions";

/** Pages and Redoc anchors, as the reference names them. */
const PAGES = {
  query_object_instance:
    "context-loader/object-instance.html#tag/ObjectInstance/operation/queryObjectInstance",
  search_instance:
    "context-loader/object-instance.html#tag/ObjectInstance/operation/searchInstance",
  run_cypher: "context-loader/cypher.html#tag/Cypher/operation/runCypher",
  execute_action: "context-loader/action.html#tag/Action/operation/executeAction",
  execute_tool: "context-loader/tool.html#tag/Tool/operation/executeTool",
  agent:
    "bkn-agent/bkn-agent.html#tag/BknAgentExecution/operation/execute_api_bkn_agent_v1_executions_post",
  auth: "auth.html",
} as const;

export type DocsPage = keyof typeof PAGES;

/** A release reads its own version; a development build or an unknown one reads main. */
export function docsVersion(serverVersion: string | null) {
  const sdk = sdkVersionOf(serverVersion);
  return sdk && !sdk.prerelease ? `v${sdk.version}` : "main";
}

export function docsUrl(serverVersion: string | null, page: DocsPage) {
  return `${DOCS_BASE}/${docsVersion(serverVersion)}/${PAGES[page]}`;
}

export function docsPageForTool(tool: string): DocsPage | null {
  return tool in PAGES && tool !== "agent" && tool !== "auth" ? (tool as DocsPage) : null;
}
