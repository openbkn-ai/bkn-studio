/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import {
  countReasonPhrase,
  excludedReasonText,
  formatRate,
  propertyTypeKey,
  joinCountPhrase,
  keyCountPhrase,
  keySourcePhrase,
  keyWarnings,
  missingCatalogs,
  originPhrase,
  relationsWithUnadoptedEnds,
  verificationPhrase,
} from "./evidence";

const P = "bknProject.model.evidence";
const key = (counts: { distinct: number; nulls: number; rows: number }, computed = true) => ({
  computed,
  source: "chosen",
  ...counts,
});

describe("draft evidence", () => {
  it("names each known source and verification, and any other as other basis", () => {
    for (const source of ["primary_key", "unique_index", "inferred", "chosen", "none"]) {
      expect(keySourcePhrase(source)).toEqual({ key: `${P}.keySource.${source}` });
    }
    for (const origin of ["foreign_key", "name_match", "link_table"]) {
      expect(originPhrase(origin)).toEqual({ key: `${P}.origin.${origin}` });
    }
    expect(verificationPhrase("confirmed")).toEqual({ key: `${P}.verification.confirmed` });
    expect(keySourcePhrase("semantic")).toEqual({
      key: `${P}.other`,
      params: { value: "semantic" },
    });
    expect(originPhrase("comment")).toEqual({ key: `${P}.other`, params: { value: "comment" } });
    expect(verificationPhrase("sampled")).toEqual({
      key: `${P}.other`,
      params: { value: "sampled" },
    });
  });

  it("says why nothing was counted by the reason's code only", () => {
    const failed = "query_failed: vega-backend returned HTTP 403: Public.Forbidden";
    expect(countReasonPhrase(failed)).toEqual({ key: `${P}.countReason.query_failed` });
    expect(countReasonPhrase("composite_key")).toEqual({ key: `${P}.countReason.composite_key` });
    expect(countReasonPhrase(undefined)).toEqual({ key: `${P}.countReason.none` });
    // In the count slot an unknown reason still reads as "not counted", not as another basis.
    expect(countReasonPhrase("sampled_only")).toEqual({
      key: `${P}.countReason.other`,
      params: { value: "sampled_only" },
    });
  });

  it("counts a key, and warns when it is not unique or has empty rows", () => {
    expect(keyCountPhrase(key({ distinct: 911, nulls: 0, rows: 1972 }))).toEqual({
      key: `${P}.keyCount`,
      params: { distinct: 911, nulls: 0, rows: 1972 },
    });
    expect(keyWarnings(key({ distinct: 911, nulls: 0, rows: 1972 }))).toEqual([
      { key: `${P}.warning.notUnique`, params: { distinct: 911, rows: 1972 } },
    ]);
    // Empty rows are not counted as distinct values, so a key unique where it is set warns
    // only about them.
    expect(keyWarnings(key({ distinct: 58, nulls: 2, rows: 60 }))).toEqual([
      { key: `${P}.warning.nulls`, params: { nulls: 2 } },
    ]);
    expect(keyWarnings(key({ distinct: 60, nulls: 0, rows: 60 }))).toEqual([]);
    expect(keyWarnings(key({ distinct: 0, nulls: 0, rows: 0 }, false))).toEqual([]);
  });

  it("counts a join with its hit rate", () => {
    expect(formatRate(0.995)).toBe("99.5%");
    expect(formatRate(1)).toBe("100%");
    expect(
      joinCountPhrase({
        computed: true,
        hitRate: 0.995,
        hits: 796,
        nulls: 0,
        orphans: 4,
        rows: 800,
        sourceDistinct: 60,
      }),
    ).toEqual({
      key: `${P}.joinCount`,
      params: { hits: 796, orphans: 4, rate: "99.5%", rows: 800 },
    });
    expect(
      joinCountPhrase({
        computed: false,
        hitRate: 0,
        hits: 0,
        nulls: 0,
        orphans: 0,
        reason: "cross_catalog",
        rows: 0,
        sourceDistinct: 0,
      }),
    ).toEqual({ key: `${P}.countReason.cross_catalog` });
  });

  it("finds relations adopted while an end is not", () => {
    const draft = mapDraft(mockDraft("p1"));
    expect(relationsWithUnadoptedEnds(draft).map((item) => item.id)).toEqual([
      "material_bom_to_sales_orders",
    ]);
  });

  it("reports the catalogs of the project and its draft that the caller cannot see", () => {
    const draft = mapDraft(mockDraft("p1", "old"));
    expect(missingCatalogs(["new"], draft, new Set(["new"]))).toEqual(["old"]);
    expect(missingCatalogs(["gone"], null, new Set(["new"]))).toEqual(["gone"]);
    expect(missingCatalogs(["old"], draft, new Set(["old"]))).toEqual([]);
  });
});

describe("left-out reasons", () => {
  const t = ((key: string, options?: Record<string, unknown>) =>
    options?.defaultValue ?? key) as unknown as Parameters<typeof excludedReasonText>[0];

  it("names a missing reason rather than showing empty brackets", () => {
    expect(excludedReasonText(t, undefined)).toBe("bknProject.model.excluded.reason.none");
    expect(excludedReasonText(t, "")).toBe("bknProject.model.excluded.reason.none");
  });

  it("names property types as kinds of values, and unknown ones as other", () => {
    expect(propertyTypeKey("unsigned integer")).toBe("bknProject.model.propertyType.integer");
    expect(propertyTypeKey("string")).toBe("bknProject.model.propertyType.text");
    expect(propertyTypeKey("timestamp")).toBe("bknProject.model.propertyType.datetime");
    expect(propertyTypeKey("geo_hash")).toBe("bknProject.model.propertyType.other");
  });
});
