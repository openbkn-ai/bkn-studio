/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parseViewParams } from "./params";

describe("parseViewParams", () => {
  it("reads the network, ids, expansion and layout from the query", () => {
    const params = parseViewParams("?kn=worldcup&ids=squads-1,squads-10&expand=in&layout=radial&token=abc");
    expect(params).toEqual({ kn: "worldcup", ids: ["squads-1", "squads-10"], expand: "backward", layout: "radial", token: "abc" });
  });

  it("falls back to force layout and no expansion, and reports missing ids as empty", () => {
    const params = parseViewParams("?kn=worldcup");
    expect(params.ids).toEqual([]);
    expect(params.expand).toBeNull();
    expect(params.layout).toBe("force");
  });

  it("takes the token from the query, then the config, then the fallback", () => {
    expect(parseViewParams("?kn=a&ids=x-1&token=q", "c", "f").token).toBe("q");
    expect(parseViewParams("?kn=a&ids=x-1", "c", "f").token).toBe("c");
    expect(parseViewParams("?kn=a&ids=x-1", "", "f").token).toBe("f");
    expect(parseViewParams("?kn=a&ids=x-1").token).toBe("");
  });
});
