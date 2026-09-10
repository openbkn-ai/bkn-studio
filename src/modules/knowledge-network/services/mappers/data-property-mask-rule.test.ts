/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  mapDataProperty,
  toBackendDataProperty,
} from "@/modules/knowledge-network/services/mappers";
import type { BackendDataProperty } from "@/modules/knowledge-network/services/mappers/backend-types";

const meta = { displayKey: "", primaryKeys: [] };

describe("data property mask rule mapper", () => {
  it.each<BackendDataProperty["mask_rule"]>([
    { kind: "fixed", replacement: "***" },
    { kind: "partial", keep_start: 3, keep_end: 2, replacement: "*" },
    {
      kind: "email",
      local_keep_start: 2,
      preserve_domain: true,
      replacement: "*",
    },
    { kind: "round", step: 100 },
    { kind: "date_granularity", granularity: "month" },
  ])("round-trips $kind rules without losing fields", (maskRule) => {
    const backendProperty: BackendDataProperty = {
      display_name: "Sensitive field",
      mask_rule: maskRule,
      name: "sensitive_field",
      type: "string",
    };

    expect(toBackendDataProperty(mapDataProperty(backendProperty, meta)).mask_rule).toEqual(
      maskRule,
    );
  });

  it("maps snake-case partial fields to the editor model", () => {
    expect(
      mapDataProperty(
        {
          mask_rule: {
            keep_end: 4,
            keep_start: 3,
            kind: "partial",
            replacement: "•",
          },
          name: "mobile",
          type: "string",
        },
        meta,
      ).maskRule,
    ).toEqual({
      keepEnd: 4,
      keepStart: 3,
      kind: "partial",
      replacement: "•",
    });
  });
});
