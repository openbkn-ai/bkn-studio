/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, test } from "@playwright/test";

import { assertBackendReady } from "../../helpers/common";
import { cleanupAllE2eAssets } from "../../helpers/cleanup-all";

test.describe("Execution Factory — P0 cleanup", () => {
  test("P0-CLEAN: remove stale E2E test assets", async ({ request }) => {
    await assertBackendReady(request);
    const summary = await cleanupAllE2eAssets(request);
    expect(summary.dryRun).toBe(false);
    console.info(
      `P0-CLEAN removed operators=${summary.operators} toolboxes=${summary.toolboxes} mcps=${summary.mcps} skills=${summary.skills}`,
    );
  });
});
