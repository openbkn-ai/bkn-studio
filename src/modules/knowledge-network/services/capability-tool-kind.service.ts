/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { CapabilityBindingRecord } from "@/modules/knowledge-network/types/knowledge-network";

/**
 * A tool binding is stored under one `capability_type` whatever the tool actually is, so the split
 * between an HTTP interface and a code function has to come from the execution factory. It is
 * resolved per tool box rather than per tool: a box is created as either `openapi` or `function` and
 * every tool inside it follows, which turns a per-binding lookup into one catalogue read.
 */
export type CapabilityToolKind = "api" | "function";

/** The execution factory rejects a page_size above 100. */
const TOOLBOX_PAGE_SIZE = 100;

const TOOLBOX_MAX_PAGES = 5;

export async function loadToolBoxKinds(): Promise<Map<string, CapabilityToolKind>> {
  const kinds = new Map<string, CapabilityToolKind>();
  const first = await listToolboxes({ page: 1, pageSize: TOOLBOX_PAGE_SIZE });
  const pages = Math.min(Math.ceil(first.total / TOOLBOX_PAGE_SIZE), TOOLBOX_MAX_PAGES);
  const boxes = [...first.items];

  for (let page = 2; page <= pages; page += 1) {
    const next = await listToolboxes({ page, pageSize: TOOLBOX_PAGE_SIZE });
    boxes.push(...next.items);
  }

  boxes.forEach((box) => {
    kinds.set(box.boxId, box.metadataType === "openapi" ? "api" : "function");
  });

  return kinds;
}

/**
 * A binding whose box is gone from the catalogue counts as a function: that is how the backend
 * counts it in `functions_total`, and dropping it from both lists would make a dangling binding
 * invisible instead of merely misfiled.
 */
export function resolveBindingKind(
  binding: CapabilityBindingRecord,
  kinds: Map<string, CapabilityToolKind>,
): CapabilityToolKind {
  return kinds.get(binding.boxId) ?? "function";
}
