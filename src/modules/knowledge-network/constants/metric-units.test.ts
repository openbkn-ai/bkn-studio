/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  ALL_METRIC_UNITS,
  METRIC_UNIT_TYPE_OPTIONS,
  METRIC_UNITS_BY_TYPE,
} from "./metric-units";

describe("metric-units", () => {
  it("covers every backend unit exactly once across unit types", () => {
    const grouped = METRIC_UNIT_TYPE_OPTIONS.flatMap((unitType) => METRIC_UNITS_BY_TYPE[unitType]);

    expect(grouped).toHaveLength(ALL_METRIC_UNITS.length);
    expect(new Set(grouped)).toEqual(new Set(ALL_METRIC_UNITS));
  });

  it("maps storage and transmission units to the correct types", () => {
    expect(METRIC_UNITS_BY_TYPE.storeUnit).toEqual(["bit", "Byte", "KB", "MB", "GB", "TB", "PB"]);
    expect(METRIC_UNITS_BY_TYPE.transmissionRate).toEqual(["bps", "Kbps", "Mbps"]);
    expect(METRIC_UNITS_BY_TYPE.numUnit).toEqual(["none", "K", "Mil", "Bil", "Tri"]);
  });
});
