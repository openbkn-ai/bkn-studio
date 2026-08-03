/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetRecentVisit,
  listRecentVisits,
  recordRecentVisit,
} from "@/modules/home/services/recent-visits.service";

const network = {
  id: "kn-1",
  kind: "knowledge-network" as const,
  path: "/knowledge-network/workspace/kn-1/overview",
  title: "销售领域",
};

describe("recent visits storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the most recent entry first and de-duplicates by kind and id", () => {
    recordRecentVisit("user-1", network);
    recordRecentVisit("user-1", {
      id: "res-1",
      kind: "data-resource",
      path: "/data-directory/resource/res-1",
      title: "客户表",
    });
    recordRecentVisit("user-1", { ...network, title: "销售领域(改名)" });

    const visits = listRecentVisits("user-1");

    expect(visits.map((visit) => visit.id)).toEqual(["kn-1", "res-1"]);
    expect(visits[0]?.title).toBe("销售领域(改名)");
  });

  it("keeps each user in a separate bucket", () => {
    recordRecentVisit("user-1", network);

    expect(listRecentVisits("user-2")).toEqual([]);
    expect(listRecentVisits(null)).toEqual([]);
  });

  it("caps the history at eight entries", () => {
    for (let index = 0; index < 12; index += 1) {
      recordRecentVisit("user-1", {
        id: `res-${index}`,
        kind: "data-resource",
        path: `/data-directory/resource/res-${index}`,
        title: `资源 ${index}`,
      });
    }

    const visits = listRecentVisits("user-1");

    expect(visits).toHaveLength(8);
    expect(visits[0]?.id).toBe("res-11");
  });

  it("drops a single entry without touching the rest", () => {
    recordRecentVisit("user-1", network);
    recordRecentVisit("user-1", {
      id: "res-1",
      kind: "data-resource",
      path: "/data-directory/resource/res-1",
      title: "客户表",
    });

    forgetRecentVisit("user-1", "knowledge-network", "kn-1");

    expect(listRecentVisits("user-1").map((visit) => visit.id)).toEqual(["res-1"]);
  });

  it("ignores entries that are not usable links", () => {
    recordRecentVisit("user-1", { ...network, id: "" });
    recordRecentVisit("user-1", { ...network, path: "" });

    expect(listRecentVisits("user-1")).toEqual([]);
  });

  it("recovers from corrupted storage payloads", () => {
    window.localStorage.setItem("bkn-studio:recent-visits:user-1", "not-json");

    expect(listRecentVisits("user-1")).toEqual([]);
  });
});
