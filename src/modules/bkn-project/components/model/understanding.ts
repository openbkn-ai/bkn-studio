/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { UnderstandingCatalog, UnderstandingTable } from "@/modules/bkn-project/types/publish";

/**
 * A table no understanding ran on that has a business name all the same: the network's object
 * types name it, or the catalog describes it. It needs no understanding before drafting.
 */
export const namedWithoutUnderstanding = (table: UnderstandingTable) =>
  table.status === "not_started" && (table.networkObjectTypes.length > 0 || table.described);

/**
 * How far the tables of the catalogs whose progress the caller can see are understood, as the
 * modeling page and the concept sources both say it.
 */
export function tally(catalogs: UnderstandingCatalog[]) {
  const tables = catalogs.filter((catalog) => catalog.visible).flatMap((catalog) => catalog.tables);
  const count = (...statuses: string[]) =>
    tables.filter((table) => statuses.includes(table.status)).length;
  // Named by the network or described by the catalog: nothing to understand, as the hint counts.
  const named = tables.filter(namedWithoutUnderstanding).length;
  const understood = count("completed");
  const remaining = count("pending", "running");
  return {
    done: understood + named,
    /** Every table has a business name, and none was understood here. */
    named: named > 0 && named + understood === tables.length && !understood,
    /** No table was ever understood, nor tried, nor has a business name. */
    neverRun: count("not_started") === tables.length && !named,
    remaining,
    total: tables.length,
    understood,
    // Failed, cancelled, and never understood, such as the tables of a catalog added since.
    unfinished: tables.length - understood - named - remaining,
  };
}
