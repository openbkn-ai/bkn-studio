/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { UnderstandingTable } from "@/modules/bkn-project/types/publish";

/**
 * A table no understanding ran on that has a business name all the same: the network's object
 * types name it, or the catalog describes it. It needs no understanding before drafting.
 */
export const namedWithoutUnderstanding = (table: UnderstandingTable) =>
  table.status === "not_started" && (table.networkObjectTypes.length > 0 || table.described);
