/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { subscriptionEnUS } from "./en-US";
import { subscriptionZhCN } from "./zh-CN";

describe("subscription permission terminology", () => {
  it("uses Column Masking in the object-rule capability matrix", () => {
    expect(subscriptionZhCN.subscription.capabilities.perm_object_level.bullets.b3).toBe("列掩码");
    expect(subscriptionEnUS.subscription.capabilities.perm_object_level.bullets.b3).toBe(
      "Column Masking",
    );
  });
});

describe("subscription capability copy", () => {
  it("lists timeline and evidence chain without execution chain", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.business_provenance.bullets),
    ).toEqual(["时间链", "证据链"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.business_provenance.bullets),
    ).toEqual(["Timeline", "Evidence chain"]);
  });

  it("lists the 0.2.0 Oracle and SAP HANA connectors on the Professional card", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle（0.2.0 起）", "SAP HANA（0.2.0 起）"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle (from 0.2.0)", "SAP HANA (from 0.2.0)"]);
  });
});
