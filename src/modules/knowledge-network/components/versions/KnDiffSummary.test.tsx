/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { KnDiffResult } from "@/modules/knowledge-network/types/kn-version";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { n?: number; version?: string }) =>
      values?.n !== undefined
        ? `${key}:${values.n}`
        : values?.version !== undefined
          ? `${key}:${values.version}`
          : key,
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
    render(<KnDiffSummary baseLabel="v2" result={result} targetLabel="draft" />);
    expect(screen.getByText("knowledgeNetwork.versions.diff.updated:1")).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.diff.created:1")).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.diff.unchanged:60")).toBeTruthy();
  });

  it("does not list the network as changed when only the branch read differs", () => {
    const result: KnDiffResult = {
      entries: [{ action: "create", id: "ot1", name: { new: "test type" }, type: "object_type" }],
      network: {
        action: "update",
        changes: [{ kind: "update", new: "draft", old: "v2", path: "branch" }],
        id: "kn-1",
        type: "network",
      },
      summary: { created: 1, deleted: 0, unchanged: 61, updated: 0 },
    };
    render(<KnDiffSummary baseLabel="v2" result={result} targetLabel="draft" />);
    expect(screen.getByText("knowledgeNetwork.versions.diff.updated:0")).toBeTruthy();
    expect(screen.queryByText("knowledgeNetwork.versions.diff.kind.network · 1")).toBeNull();
  });

  it("shows a changed definition field by field, grouped by the property it belongs to", () => {
    const result: KnDiffResult = {
      entries: [
        {
          action: "update",
          changes: [
            {
              kind: "update",
              new: "Team name",
              old: "Name",
              path: "data_properties[name].display_name",
            },
            { kind: "update", new: "teams", old: "team", path: "display_key" },
          ],
          id: "ot1",
          name: { new: "Team", old: "Team" },
          type: "object_type",
        },
      ],
      summary: { created: 0, deleted: 0, unchanged: 3, updated: 1 },
    };
    render(<KnDiffSummary baseLabel="v2" result={result} targetLabel="draft" />);
    expect(
      screen.getByText("knowledgeNetwork.versions.diff.section.data_properties · name"),
    ).toBeTruthy();
    expect(screen.getByText("knowledgeNetwork.versions.diff.field.display_name")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Team name")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.getByText("draft")).toBeTruthy();
  });

  it("shows an added definition as its content, with one table row per property", () => {
    const result: KnDiffResult = {
      entries: [
        {
          action: "update",
          changes: [{ kind: "update", new: "b", old: "a", path: "name" }],
          id: "g1",
          type: "concept_group",
        },
        {
          action: "create",
          changes: [
            { kind: "create", new: "test", path: "data_properties[test].name" },
            { kind: "create", new: "string", path: "data_properties[test].type" },
            { kind: "create", new: "test type", path: "name" },
          ],
          id: "ot1",
          name: { new: "test type" },
          type: "object_type",
        },
      ],
      summary: { created: 1, deleted: 0, unchanged: 0, updated: 1 },
    };
    render(<KnDiffSummary baseLabel="v2" result={result} targetLabel="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /test type/ }));
    expect(screen.getByText("knowledgeNetwork.versions.diff.onlyIn:draft")).toBeTruthy();
    expect(
      screen.getByText("knowledgeNetwork.versions.diff.section.data_properties · 1"),
    ).toBeTruthy();
    expect(screen.getByRole("cell", { name: "string" })).toBeTruthy();
  });
});
