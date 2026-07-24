/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { streamingNeedsBuildKey } from "./build-task-launch-guards";

describe("streamingNeedsBuildKey", () => {
  it("requires a configured build key only for streaming builds", () => {
    expect(streamingNeedsBuildKey("streaming", [])).toBe(true);
    expect(streamingNeedsBuildKey("streaming", ["id"])).toBe(false);
    expect(streamingNeedsBuildKey("batch", [])).toBe(false);
  });
});
