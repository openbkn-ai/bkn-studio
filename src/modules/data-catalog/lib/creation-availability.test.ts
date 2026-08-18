/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { dataCatalogCreationAvailable } from "./creation-availability";

describe("dataCatalogCreationAvailable", () => {
  it("keeps unavailable creation flows disabled pending #452, #453, and #454", () => {
    expect(dataCatalogCreationAvailable).toBe(false);
  });
});
