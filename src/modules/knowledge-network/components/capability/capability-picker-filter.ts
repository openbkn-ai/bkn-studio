/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Both mount sources are a container holding named tools: a toolset with its tools, or an MCP
 * Server with the tools it exposes. Only the address differs — tool_id inside a toolset, name
 * inside a Server — which is what `id` carries.
 */
export type PickerTool = { description?: string; id: string; name: string; status?: string };

/**
 * `status` is the toolset's lifecycle state and `toolCount` what the catalogue listing reported;
 * both are absent for an MCP Server, which the picker only lists once published and whose tools it
 * only learns by asking the Server.
 */
export type PickerContainer = { id: string; name: string; status?: string; toolCount?: number };

/**
 * Why something in the picker cannot be mounted. These mirror the checks the backend runs on write
 * (a published toolset, an enabled tool, a whole-toolset mount that expands to at least one tool),
 * so the picker refuses up front what the write would refuse afterwards.
 */
export type PickerBlockReason =
  | "boxUnpublished"
  | "mounted"
  | "noEnabledTools"
  | "noTools"
  | "notFound"
  | "toolDisabled";

function isUnpublished(container: Pick<PickerContainer, "status">) {
  return container.status !== undefined && container.status !== "published";
}

/** An MCP tool carries no status: whatever a published Server exposes can be mounted. */
export function toolBlockReason(
  container: Pick<PickerContainer, "status">,
  tool: PickerTool,
): PickerBlockReason | null {
  if (isUnpublished(container)) {
    return "boxUnpublished";
  }

  return tool.status !== undefined && tool.status !== "enabled" ? "toolDisabled" : null;
}

/**
 * Whether the container as a whole can be picked. Before its tools are loaded only the catalogue's
 * word is available, so a toolset that reported tools is given the benefit of the doubt until they
 * are read — the picker reads them the moment the toolset is ticked.
 */
export function containerBlockReason(
  container: PickerContainer,
  tools: PickerTool[] | undefined,
): PickerBlockReason | null {
  if (isUnpublished(container)) {
    return "boxUnpublished";
  }

  if (!tools) {
    return container.toolCount === 0 ? "noTools" : null;
  }

  if (tools.length === 0) {
    return "noTools";
  }

  return tools.some((tool) => toolBlockReason(container, tool) === null) ? null : "noEnabledTools";
}

/**
 * What the search box leaves on screen: a container whose own name matches, or one holding a tool
 * that matches. The tree and select-all both read this, so ticking "select all" can never reach a
 * container the search hid — mounting one the person never saw is how a whole catalogue ends up
 * bound by accident.
 */
export function filterVisibleContainers<T extends { id: string; name: string }>(
  containers: T[],
  toolsByContainer: Record<string, PickerTool[]>,
  keyword: string,
): T[] {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) {
    return containers;
  }

  return containers.filter(
    (container) =>
      container.name.toLowerCase().includes(trimmed) ||
      (toolsByContainer[container.id] ?? []).some(
        (tool) =>
          tool.name.toLowerCase().includes(trimmed) || tool.id.toLowerCase().includes(trimmed),
      ),
  );
}
