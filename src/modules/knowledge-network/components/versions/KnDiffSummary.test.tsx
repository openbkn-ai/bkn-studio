/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { KnDiffResult } from "@/modules/knowledge-network/types/kn-version";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { n?: number }) =>
      values?.n === undefined ? key : `${key}:${values.n}`,
  }),
}));

import { KnDiffSummary } from "@/modules/knowledge-network/components/versions/KnDiffSummary";

describe("KnDiffSummary", () => {
  beforeAll(() => {
    // antd reads responsive breakpoints, which jsdom does not provide.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  afterEach(cleanup);

  it("counts a change to the network itself with the listed changes", () => {
    const result: KnDiffResult = {
      entries: [{ action: "create", id: "g1", type: "concept_group" }],
      network: { action: "update", id: "kn-1", type: "network" },
      summary: { created: 1, deleted: 0, unchanged: 60, updated: 0 },
    };
    render(<KnDiffSummary result={result} />);
    expect(screen.getByText("knowledgeNetwork.versions.diff.updated:1")).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.diff.created:1")).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.diff.unchanged:60")).toBeTruthy();
  });
});
