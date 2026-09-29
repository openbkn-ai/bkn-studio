/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parseMcpSse } from "@/modules/execution-factory/services/mcp.service";
import type {
  McpMode,
  McpParseSseInput,
  McpParseSseTool,
} from "@/modules/execution-factory/types/mcp";

export type McpToolDiscovery = {
  tools: McpParseSseTool[];
  /** The transport that actually connected. */
  mode: McpMode;
  /** The transport that was asked for, when it had to be swapped. */
  fallbackFrom?: McpMode;
};

/**
 * Streamable HTTP and SSE endpoints reject each other's handshake, and the URL alone rarely says
 * which one it is. Retry with the other mode so the registered MCP can actually connect; when
 * neither works, surface the error of the mode that was asked for.
 */
export async function discoverMcpTools(input: McpParseSseInput): Promise<McpToolDiscovery> {
  const mode: McpMode = input.mode ?? "stream";

  try {
    const result = await parseMcpSse({ ...input, mode });
    return { tools: result.tools, mode };
  } catch (error) {
    const fallbackMode: McpMode = mode === "sse" ? "stream" : "sse";
    const result = await parseMcpSse({ ...input, mode: fallbackMode }).catch(() => {
      throw error;
    });
    return { tools: result.tools, mode: fallbackMode, fallbackFrom: mode };
  }
}
