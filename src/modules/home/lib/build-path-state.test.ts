/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { readHomeBuildState, writeHomeBuildState } from "./build-path-state";

describe("home build path state", () => {
  it("restores the selected platform stage from the URL", () => {
    expect(readHomeBuildState(new URLSearchParams("path=platform&stage=data"))).toEqual({
      path: "platform",
      stage: "data",
    });
  });

  it("uses the engineering path and environment stage when no valid state exists", () => {
    expect(readHomeBuildState(new URLSearchParams("path=unknown&stage=unknown"))).toEqual({
      path: "engineering",
      stage: "environment",
    });
  });

  it("keeps unrelated query parameters while writing the selected platform stage", () => {
    expect(
      writeHomeBuildState(new URLSearchParams("source=sidebar"), {
        path: "platform",
        stage: "validate",
      }).toString(),
    ).toBe("source=sidebar&path=platform&stage=validate");
  });

  it("clears build state when switching back to engineering", () => {
    expect(
      writeHomeBuildState(new URLSearchParams("source=sidebar&path=platform&stage=data"), {
        path: "engineering",
        stage: "environment",
      }).toString(),
    ).toBe("source=sidebar");
  });
});
