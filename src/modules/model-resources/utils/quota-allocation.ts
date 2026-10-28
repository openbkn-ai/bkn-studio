/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import BigNumber from "bignumber.js";

import type { UserQuotaRecord } from "../types/quota";
import { TOKEN_UNIT_VALUE } from "./quota-units";

/** Compare the net allocation change with the API's unallocated raw tokens. */
export function isQuotaAllocationExceeded(
  items: UserQuotaRecord[],
  originalItems: UserQuotaRecord[],
  remainingTokens: number,
  type: "inputTokens" | "outputTokens",
) {
  if (remainingTokens === -1) {
    return false;
  }
  const index = type === "inputTokens" ? 0 : 1;
  const total = (rows: UserQuotaRecord[]) =>
    rows.reduce(
      (sum, item) =>
        sum.plus(
          new BigNumber(item[type] ?? 0).times(TOKEN_UNIT_VALUE[item.numType[index] ?? 0] ?? 1),
        ),
      new BigNumber(0),
    );
  return total(items).minus(total(originalItems)).isGreaterThan(remainingTokens);
}
