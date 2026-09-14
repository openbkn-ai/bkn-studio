/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { SHARE_URL_LIMIT, buildShareUrl, combineLinkSource, packIds, parseDeepLink, unpackIds } from "./deep-link";

describe("parseDeepLink", () => {
  it("reads ids, cypher, expand aliases and layout", () => {
    expect(parseDeepLink("?ids=product-a,fact-1,fact-1,%20&expand=in&layout=radial")).toEqual({
      ids: ["product-a", "fact-1"],
      cypher: null,
      expand: "backward",
      layout: "radial",
    });
    expect(parseDeepLink("?cypher=MATCH%20(k%3Aknowledge)&expand=both")).toEqual({ ids: [], cypher: "MATCH (k:knowledge)", expand: "bidirectional", layout: null });
  });

  it("returns null without ids or cypher and ignores unknown values", () => {
    expect(parseDeepLink("")).toBeNull();
    expect(parseDeepLink("?layout=radial&expand=out")).toBeNull();
    expect(parseDeepLink("?ids=x&expand=sideways&layout=spiral")).toEqual({ ids: ["x"], cypher: null, expand: null, layout: null });
  });
});

describe("combineLinkSource", () => {
  it("reads the query string and the fragment as one source", () => {
    expect(parseDeepLink(combineLinkSource("?layout=grid", "#ids=a-1"))).toEqual({ ids: ["a-1"], cypher: null, expand: null, layout: "grid" });
    expect(combineLinkSource("", "")).toBe("");
  });
});

describe("packIds / unpackIds", () => {
  it("writes each object-type prefix once and expands it back", () => {
    const { packed, plain } = packIds(["squads-1", "squads-2", "groups-7"], ["squads", "groups"]);
    expect(packed).toBe("squads:1,2;groups:7");
    expect(plain).toEqual([]);
    expect(unpackIds(packed)).toEqual(["squads-1", "squads-2", "groups-7"]);
  });

  it("leaves an unknown object type or a key holding a separator in the plain list", () => {
    const { packed, plain } = packIds(["squads-1", "mystery-9", "squads-a,b"], ["squads"]);
    expect(packed).toBe("squads:1");
    expect(plain).toEqual(["mystery-9", "squads-a,b"]);
  });

  it("keeps a colon inside a key, splitting only at the first one", () => {
    expect(unpackIds("squads:12:30")).toEqual(["squads-12:30"]);
    expect(unpackIds("no-colon-here")).toEqual([]);
  });
});

describe("buildShareUrl", () => {
  it("puts ids in the fragment, packed by object type, and round-trips", () => {
    const { url, dropped } = buildShareUrl("https://h/studio/kn/x/graph-explorer", ["product-a b", "fact-1", "fact-1"], { layout: "dagre", objectTypeIds: ["product", "fact"] });
    expect(dropped).toBe(0);
    expect(url).toContain("#");
    expect(url.slice(0, url.indexOf("#"))).toBe("https://h/studio/kn/x/graph-explorer");
    expect(parseDeepLink(url.slice(url.indexOf("#")))).toEqual({ ids: ["product-a b", "fact-1"], cypher: null, expand: null, layout: "dagre" });
  });

  it("keeps a whole canvas of long ids well inside the limit", () => {
    const ids = Array.from({ length: 500 }, (_, index) => `player_appearances-${20000 + index}`);
    const { url, dropped } = buildShareUrl("https://h/p", ids, { objectTypeIds: ["player_appearances"] });
    expect(dropped).toBe(0);
    expect(url.length).toBeLessThan(SHARE_URL_LIMIT);
    expect(parseDeepLink(url.slice(url.indexOf("#")))?.ids).toHaveLength(500);
  });

  it("cuts the list only when the url would exceed the limit, and reports the remainder", () => {
    const ids = Array.from({ length: 400 }, (_, index) => `n-${String(index).padStart(120, "0")}`);
    const { url, dropped } = buildShareUrl("https://h/p", ids, { objectTypeIds: ["n"] });
    expect(dropped).toBeGreaterThan(0);
    expect(url.length).toBeLessThanOrEqual(SHARE_URL_LIMIT);
    expect(parseDeepLink(url.slice(url.indexOf("#")))?.ids).toHaveLength(400 - dropped);
  });
});
