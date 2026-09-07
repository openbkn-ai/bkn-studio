/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const listToolboxesMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  listToolboxes: listToolboxesMock,
}));

import {
  loadToolBoxKinds,
  resolveBindingKind,
} from "@/modules/knowledge-network/services/capability-tool-kind.service";
import type { CapabilityBindingRecord } from "@/modules/knowledge-network/types/knowledge-network";

function binding(boxId: string): CapabilityBindingRecord {
  return {
    boundAsBox: false,
    boxId,
    boxName: "",
    branch: "main",
    capabilityId: "tool-1",
    capabilityType: "function",
    comment: "",
    createTime: "-",
    creatorName: "-",
    description: "",
    id: "binding-1",
    name: "",
    sources: [],
    status: "",
    updateTime: "-",
    updaterName: "-",
  };
}

describe("capability-tool-kind.service", () => {
  beforeEach(() => {
    listToolboxesMock.mockReset();
  });

  it("walks every page so a box beyond the first is still classified", async () => {
    listToolboxesMock.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        items:
          page === 1
            ? [{ boxId: "box-openapi", metadataType: "openapi" }]
            : [{ boxId: "box-function", metadataType: "function" }],
        total: 101,
        page,
        pageSize: 100,
      }),
    );

    const kinds = await loadToolBoxKinds();

    expect(kinds.get("box-openapi")).toBe("api");
    expect(kinds.get("box-function")).toBe("function");
  });

  it("files a binding whose box is gone under functions, matching functions_total", () => {
    const kinds = new Map<string, "api" | "function">([["box-openapi", "api"]]);

    expect(resolveBindingKind(binding("box-openapi"), kinds)).toBe("api");
    expect(resolveBindingKind(binding("box-deleted"), kinds)).toBe("function");
  });
});
