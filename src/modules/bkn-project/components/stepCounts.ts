/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { draftGraph } from "@/modules/bkn-project/components/draft/graph";
import { kineticItemCount } from "@/modules/bkn-project/components/kinetic/needs";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { UnderstandingCatalog } from "@/modules/bkn-project/types/publish";
import type { Requirements } from "@/modules/bkn-project/types/requirements";

/*
 * What each step of a project holds, counted one way for every place that shows it: the side
 * navigation's badge, the overview's step card and the step's own page. A count is undefined
 * while it is not known, so nothing is shown rather than a guess.
 */

/** The tables of the project's catalogs, as the catalog tab and the concept sources count them. */
export const tableCount = (understanding: UnderstandingCatalog[]) =>
  understanding.reduce((sum, catalog) => sum + catalog.tables.length, 0);

/**
 * The object types of the concept model: what the network already has, with the object types the
 * project adds and adopted; on a network without any, the draft's adopted ones. Before a draft an
 * existing network's model is the network's own.
 */
export function modelObjectCount(
  draft: Draft | null | undefined,
  existingObjectTypeIds: ReadonlySet<string> | null | undefined,
): number | undefined {
  const nodes = draft?.status === "ready" ? draftGraph(draft).nodes : null;
  if (existingObjectTypeIds?.size) {
    const added = nodes?.filter((node) => !existingObjectTypeIds.has(node.id)).length ?? 0;
    return existingObjectTypeIds.size + added;
  }
  return nodes ? nodes.length : undefined;
}

/** The kinetic items: what the network already has and the project's needs nothing implements. */
export const kineticCount = kineticItemCount;

/** The scenario questions of the ready requirement specification. */
export const questionCount = (requirements: Requirements | null | undefined) =>
  requirements?.status === "ready" && requirements.spec
    ? requirements.spec.questions.length
    : undefined;
