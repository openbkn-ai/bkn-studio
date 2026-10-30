/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import type { AgentTokenProvider } from "@/modules/knowledge-network/services/agent-chat.service";

export function agentConfigPath(agentId: string) {
  return `/system/agent-config/${encodeURIComponent(agentId)}`;
}

/** Shared by the list and the detail page so both build the same request. */
export function useAgentAdminParams() {
  const {
    auth: { tokenManager },
  } = useRuntimeConfig();
  const tokenProvider = useMemo<AgentTokenProvider>(
    () => ({
      getToken: () => tokenManager.getAccessToken() ?? "",
      refresh: () => tokenManager.refreshAccessToken(),
    }),
    [tokenManager],
  );
  return useMemo(() => ({ base: window.location.origin, tokenProvider }), [tokenProvider]);
}
