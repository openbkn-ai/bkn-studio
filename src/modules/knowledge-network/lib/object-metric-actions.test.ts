/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectMetricActions } from "./object-metric-actions";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

function metric(status: ObjectMetricRecordV1["definition"]["lifecycle"]["status"]) {
  return {
    definition: {
      calculation_scope: "object_instance",
      id: "paid_amount",
      lifecycle: { status },
      version: 2,
    },
  } as ObjectMetricRecordV1;
}

describe("objectMetricActions", () => {
  it("never exposes mutations without modify permission", () => {
    expect(objectMetricActions(metric("draft"), false, false, null)).toMatchObject({
      canDeleteVersion: false,
      canDeprecate: false,
      canEdit: false,
    });
  });

  it("uses delete permission independently from modify permission", () => {
    expect(objectMetricActions(metric("draft"), false, true, null)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: false,
    });
  });

  it("allows working-draft edit and deletion, but not deprecation", () => {
    expect(objectMetricActions(metric("validated"), true, true, null)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: true,
    });
  });

  it("requires a known unbound published version before deprecation", () => {
    const published = metric("published");
    expect(objectMetricActions(published, true, true, undefined).deprecateReason).toBeTruthy();
    const owner = {
      logicProperties: [
        {
          metricBinding: { metric_ref: { metric_id: "paid_amount", version: 2 } },
        },
      ],
    } as ObjectTypeDetail;
    expect(objectMetricActions(published, true, true, owner).deprecateReason).toBeTruthy();
    owner.logicProperties[0].metricBinding!.metric_ref.version = 1;
    expect(objectMetricActions(published, true, true, owner).deprecateReason).toBeUndefined();
  });

  it("offers deletion but no editing for deprecated versions", () => {
    expect(objectMetricActions(metric("deprecated"), true, true, null)).toMatchObject({
      canDeleteVersion: true,
      canDeprecate: false,
      canEdit: false,
    });
  });
});
