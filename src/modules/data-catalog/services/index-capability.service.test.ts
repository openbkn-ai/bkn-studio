/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({ http: { get: getMock } }));

describe("getIndexCapabilities", () => {
  beforeEach(() => getMock.mockReset());

  it("maps the Vega capability response", async () => {
    getMock.mockResolvedValue({
      data: {
        checked_at: 1786357800000,
        fulltext_analyzers: [{ id: "standard" }, { id: "english" }, { id: "" }],
      },
    });
    const { getIndexCapabilities } = await import("./index-capability.service");

    await expect(getIndexCapabilities()).resolves.toEqual({
      checkedAt: 1786357800000,
      fulltextAnalyzers: ["standard", "english"],
    });
    expect(getMock).toHaveBeenCalledWith("/vega-backend/v1/index-capabilities");
  });
});
