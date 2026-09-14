/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildReturnToState,
  readReturnTo,
} from "@/modules/execution-factory/utils/back-navigation";

describe("back-navigation return-to state", () => {
  it("round-trips the origin's path and query", () => {
    const state = buildReturnToState({
      pathname: "/knowledge-network/kn-1/capabilities",
      search: "?kind=skill",
    });

    expect(readReturnTo(state)).toBe("/knowledge-network/kn-1/capabilities?kind=skill");
  });

  it("ignores state that is missing, malformed, or not an in-app path", () => {
    expect(readReturnTo(null)).toBeUndefined();
    expect(readReturnTo(undefined)).toBeUndefined();
    expect(readReturnTo("/x")).toBeUndefined();
    expect(readReturnTo({})).toBeUndefined();
    expect(readReturnTo({ returnTo: 42 })).toBeUndefined();
    expect(readReturnTo({ returnTo: "https://example.com/" })).toBeUndefined();
    expect(readReturnTo({ returnTo: "relative" })).toBeUndefined();
  });
});
