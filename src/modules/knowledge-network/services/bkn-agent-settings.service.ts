/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Network and personal settings for the smart Q&A Agent. Both layers live in BKN Agent
 * and only add instructions or narrow tools and limits on top of the shared definition;
 * the server clamps anything beyond the layer above.
 */

import {
  makeAuthedFetch,
  type AgentTokenProvider,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  BknAgentExecutionError,
  SMART_QA_AGENT_ID,
} from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import { isPlatformManagedTool } from "@/modules/knowledge-network/services/bkn-lifecycle.service";

const API = "/api/bkn-agent/v1";

export type AgentLimits = {
  max_turns?: number | null;
  max_tool_calls?: number | null;
  timeout_s?: number | null;
  max_output_tokens?: number | null;
  keep_tool_results?: number | null;
  data_result_chars?: number | null;
  schema_result_chars?: number | null;
  summarize_after_tokens?: number | null;
};

export type AgentSetting = {
  instruction?: string | null;
  /** null or absent follows the layer above. */
  allowed_tools?: string[] | null;
  limits?: AgentLimits | null;
};

export type AgentSettingLayer = {
  agent_id: string;
  setting: AgentSetting;
  /** 0 means nothing has been saved for this layer. */
  version: number;
  update_time?: number | null;
};

export type AgentEffective = {
  limits: AgentLimits;
  /** null means every tool the shared definition loads. */
  allowed_tools: string[] | null;
};

export type AgentConfig = {
  agent_id: string;
  name?: string | null;
  model?: string | null;
  status: string;
  shared: AgentEffective;
  network: AgentSettingLayer;
  user: AgentSettingLayer;
  effective: AgentEffective;
  /** Context Loader MCP surface; null is the service default. */
  mcp_profile?: McpProfileChoice | null;
  can_edit_network: boolean;
  /** Until an Agent management operation is registered, only the Agent's creator. */
  can_edit_shared: boolean;
};

export type McpProfileChoice = "full" | "compact";

export type SharedAgent = {
  agent_id: string;
  model?: string | null;
  status: string;
  limits: AgentLimits;
  mcp_profile?: McpProfileChoice | null;
};

export type SharedUpdate = {
  /** null restores the service default surface. */
  mcp_profile?: McpProfileChoice | null;
  /** Empty string selects the platform default model. */
  model?: string;
  limits?: AgentLimits | null;
  status?: "draft" | "published";
};

export type SharedPrompt = {
  prompt: { prompt_id: string; current_version: number; content: string };
  versions: { version: number; content: string; create_user: string; create_time: number }[];
};

type Params = { base: string; tokenProvider: AgentTokenProvider };

async function request<T>(
  { base, tokenProvider }: Params,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await makeAuthedFetch(tokenProvider)(`${base}${API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = response.statusText || `HTTP ${response.status}`;
    let code: string | undefined;
    try {
      const body = JSON.parse(text) as { code?: string; description?: string };
      code = body.code;
      message = body.description ?? message;
    } catch {
      /* Non-JSON gateway pages keep the status text. */
    }
    throw new BknAgentExecutionError(message, response.status, code, text || undefined);
  }
  return (await response.json()) as T;
}

const agentPath = (agentId: string) => encodeURIComponent(agentId);

export function getAgentConfig(params: Params & { knId: string }): Promise<AgentConfig> {
  return request(
    params,
    `/me/agents/${agentPath(SMART_QA_AGENT_ID)}/config?kn_id=${encodeURIComponent(params.knId)}`,
  );
}

export function saveUserSetting(
  params: Params & { setting: AgentSetting },
): Promise<AgentSettingLayer> {
  return request(params, `/me/agents/${agentPath(SMART_QA_AGENT_ID)}/setting`, {
    method: "PUT",
    body: JSON.stringify(params.setting),
  });
}

export function resetUserSetting(params: Params): Promise<AgentSettingLayer> {
  return request(params, `/me/agents/${agentPath(SMART_QA_AGENT_ID)}/setting`, {
    method: "DELETE",
  });
}

export function saveNetworkSetting(
  params: Params & { knId: string; setting: AgentSetting },
): Promise<AgentSettingLayer> {
  return request(
    params,
    `/networks/${encodeURIComponent(params.knId)}/agents/${agentPath(SMART_QA_AGENT_ID)}/setting`,
    { method: "PUT", body: JSON.stringify(params.setting) },
  );
}

export function resetNetworkSetting(params: Params & { knId: string }): Promise<AgentSettingLayer> {
  return request(
    params,
    `/networks/${encodeURIComponent(params.knId)}/agents/${agentPath(SMART_QA_AGENT_ID)}/setting`,
    { method: "DELETE" },
  );
}

export function getShared(params: Params): Promise<SharedAgent> {
  return request(params, `/admin/agents/${agentPath(SMART_QA_AGENT_ID)}`);
}

export function updateShared(params: Params & { update: SharedUpdate }): Promise<SharedAgent> {
  return request(params, `/admin/agents/${agentPath(SMART_QA_AGENT_ID)}`, {
    method: "PUT",
    body: JSON.stringify(params.update),
  });
}

export function getSharedPrompt(params: Params): Promise<SharedPrompt> {
  return request(params, `/admin/agents/${agentPath(SMART_QA_AGENT_ID)}/prompt`);
}

export function publishSharedPrompt(params: Params & { content: string }): Promise<SharedPrompt> {
  return request(params, `/admin/agents/${agentPath(SMART_QA_AGENT_ID)}/prompt`, {
    method: "PUT",
    body: JSON.stringify({ content: params.content }),
  });
}

export function rollbackSharedPrompt(params: Params & { version: number }): Promise<SharedPrompt> {
  return request(params, `/admin/agents/${agentPath(SMART_QA_AGENT_ID)}/prompt/rollback`, {
    method: "POST",
    body: JSON.stringify({ version: params.version }),
  });
}

/** Context Loader tools never offered on the public surface, mirroring bkn-agent. */
const UNAVAILABLE_TOOLS = new Set([
  "run_code",
  "run_shell",
  "execute_tool",
  "execute_skill",
  "execute_native_tool",
]);

/** Tool names a user can choose from: lifecycle and unscoped tools are excluded. */
export function selectableTools(names: readonly string[]): string[] {
  return names.filter((name) => !isPlatformManagedTool(name) && !UNAVAILABLE_TOOLS.has(name));
}

const LIMIT_KEYS = [
  "max_turns",
  "max_tool_calls",
  "timeout_s",
  "max_output_tokens",
  "keep_tool_results",
  "data_result_chars",
  "schema_result_chars",
  "summarize_after_tokens",
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export const AGENT_LIMIT_KEYS: readonly LimitKey[] = LIMIT_KEYS;

/** What a layer below may use, mirroring the server's merge: tools intersect, limits take the minimum. */
export function narrow(
  upper: AgentEffective,
  layer: AgentSetting | null | undefined,
): AgentEffective {
  if (!layer) return upper;
  const limits: AgentLimits = { ...upper.limits };
  for (const key of LIMIT_KEYS) {
    const wanted = layer.limits?.[key];
    const cap = upper.limits[key];
    if (wanted == null) continue;
    limits[key] = cap == null ? wanted : Math.min(cap, wanted);
  }
  const chosen = layer.allowed_tools;
  const allowed =
    chosen == null
      ? upper.allowed_tools
      : upper.allowed_tools == null
        ? [...chosen]
        : upper.allowed_tools.filter((name) => chosen.includes(name));
  return { limits, allowed_tools: allowed };
}
