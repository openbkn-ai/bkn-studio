/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { SHARE_ID_LIMIT, buildShareUrl, parseDeepLink } from "./deep-link";

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

describe("buildShareUrl", () => {
  it("round-trips through parseDeepLink, encoding ids and keeping the layout", () => {
    const { url, dropped } = buildShareUrl("https://h/studio/kn/x/graph-explorer", ["product-a b", "fact-1", "fact-1"], { layout: "dagre" });
    expect(dropped).toBe(0);
    const query = url.slice(url.indexOf("?"));
    expect(parseDeepLink(query)).toEqual({ ids: ["product-a b", "fact-1"], cypher: null, expand: null, layout: "dagre" });
  });

  it("cuts the id list at the share limit and reports the remainder", () => {
    const ids = Array.from({ length: SHARE_ID_LIMIT + 5 }, (_, index) => `n-${index}`);
    const { url, dropped } = buildShareUrl("https://h/p", ids);
    expect(dropped).toBe(5);
    expect(parseDeepLink(url.slice(url.indexOf("?")))?.ids).toHaveLength(SHARE_ID_LIMIT);
  });
});
