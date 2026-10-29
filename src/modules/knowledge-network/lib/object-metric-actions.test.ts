/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricActions } from "./object-metric-actions";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";

function metric(status: ObjectMetricRecordV1["definition"]["lifecycle"]["status"]) {
  return {
    definition: {
      id: "paid_amount",
      lifecycle: { status },
      version: 2,
    },
  } as ObjectMetricRecordV1;
}

describe("objectMetricActions", () => {
  it("never exposes mutations without modify permission", () => {
    expect(objectMetricActions(metric("draft"), false, false)).toMatchObject({
      canDeleteVersion: false,
      canDeprecate: false,
      canEdit: false,
    });
  });

  it("uses delete permission independently from modify permission", () => {
    expect(objectMetricActions(metric("draft"), false, true)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: false,
    });
  });

  it("allows working-draft edit and deletion, but not deprecation", () => {
    expect(objectMetricActions(metric("validated"), true, true)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: true,
    });
  });

  it("allows a published version to be deprecated", () => {
    const published = metric("published");
    expect(objectMetricActions(published, true, true)).toMatchObject({
      canDeprecate: true,
      deprecateReason: undefined,
    });
  });

  it("offers deletion but no editing for deprecated versions", () => {
    expect(objectMetricActions(metric("deprecated"), true, true)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: false,
    });
  });
});
