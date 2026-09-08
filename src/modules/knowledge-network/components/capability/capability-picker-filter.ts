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
