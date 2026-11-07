/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ValueType } from "@/modules/knowledge-network/types/knowledge-network";

import { MOCK_DECLARED_NETWORK_ID } from "./declaration-refusals";

/** The value types of the clinic-lab sample, on the mock network that holds 3.0 declarations. */
export const mockValueTypes: Record<string, ValueType[]> = {
  [MOCK_DECLARED_NETWORK_ID]: [
    {
      baseType: "keyword",
      description: "LIS status codes of a lab order. X is the cancel code of the old system.",
      enum: [
        { display: "Ordered", value: "N" },
        { display: "Sampled", value: "S" },
        { display: "Reported", value: "P" },
        { display: "Cancelled", value: "C" },
        { deprecated: true, display: "Cancelled", value: "X" },
      ],
      id: "lis_apply_status",
      name: "LIS order status",
      tags: ["lab"],
      updateTime: "2026-11-06 10:00:00",
      updaterName: "Knowledge Team",
    },
    {
      baseType: "string",
      description: "",
      id: "cn_id_card",
      length: { max: 18, min: 18 },
      name: "Resident ID card number",
      pattern: "^\\d{17}[\\dX]$",
      tags: [],
      updateTime: "2026-11-06 10:00:00",
      updaterName: "Knowledge Team",
    },
    {
      baseType: "decimal",
      description: "",
      id: "amount_cny",
      name: "Amount in CNY",
      range: { min: 0 },
      tags: [],
      unit: "CNY",
      updateTime: "2026-11-06 10:00:00",
      updaterName: "Knowledge Team",
    },
  ],
};
