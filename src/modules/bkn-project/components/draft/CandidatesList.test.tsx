/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Candidate, Candidates } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
}));

import { CandidatesList } from "./CandidatesList";

const candidate = (extra: Partial<Candidate>): Candidate => ({
  addedByCatalog: "",
  adopted: false,
  excludeReason: "",
  id: "customers",
  kind: "object_types",
  name: "Customers",
  neededBy: null,
  reviewed: null,
  state: "pending",
  table: null,
  ...extra,
});

const list: Candidates = {
  counts: { adopted: 0, excluded: 1, pending: 3 },
  items: [
    candidate({
      neededBy: { concepts: [{ id: "c1", term: "Client" }], questions: [] },
      table: { name: "customers", rows: 120 },
    }),
    candidate({
      addedByCatalog: "cat-2",
      id: "material_bom",
      name: "BOM",
      table: { name: "bom", rows: null },
    }),
    candidate({ id: "material_bom_to_sales_orders", kind: "relation_types", name: "BOM orders" }),
    candidate({ excludeReason: "A log", id: "sales_orders", name: "Orders", state: "excluded" }),
  ],
};

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
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

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

function renderList(extra: Partial<Parameters<typeof CandidatesList>[0]> = {}) {
  const props = {
    accepting: false,
    candidates: list,
    catalog: "",
    catalogIds: ["cat-001", "cat-2"],
    catalogNames: { "cat-2": "CRM" },
    draft: mapDraft(mockDraft("p1")),
    error: null,
    onAcceptSuggestions: vi.fn(),
    onCatalog: vi.fn(),
    onOpen: vi.fn(),
    ...extra,
  };
  renderWithoutAntdStyles(<CandidatesList {...props} />);
  return props;
}

const row = (name: string) => screen.getByRole("button", { name }).closest("tr") as HTMLElement;

describe("CandidatesList", () => {
  it("marks why a candidate is first, the catalog that added it, and what it waits for", () => {
    renderList();
    expect(
      within(row("Customers")).getByText("bknProject.model.candidates.mark.needed"),
    ).toBeInTheDocument();
    expect(
      within(row("Customers")).getByText(
        `bknProject.model.candidates.source:${JSON.stringify({ name: "customers", rows: 120 })}`,
      ),
    ).toBeInTheDocument();
    // Read off the draft: the BOM waits for its identity, its relation for an end.
    expect(
      within(row("BOM")).getByText("bknProject.model.candidates.mark.added"),
    ).toBeInTheDocument();
    expect(
      within(row("BOM")).getByText("bknProject.model.candidates.mark.identity"),
    ).toBeInTheDocument();
    expect(
      within(row("BOM orders")).getByText("bknProject.model.candidates.mark.ends"),
    ).toBeInTheDocument();
    // Without a row count, only the table's name: never a made-up zero.
    expect(within(row("BOM")).getByText("bom")).toBeInTheDocument();
    expect(
      within(row("Orders")).getByText("bknProject.model.candidates.state.excluded"),
    ).toBeInTheDocument();
  });

  it("opens a candidate with the list's order, filters by added catalog and accepts suggestions", () => {
    const props = renderList();
    fireEvent.click(screen.getByRole("button", { name: "BOM" }));
    expect(props.onOpen).toHaveBeenCalledWith(list.items[1], list.items);

    expect(
      screen.getByRole("combobox", { name: "bknProject.model.candidates.catalog" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "bknProject.model.candidates.acceptSuggestions" }),
    );
    expect(props.onAcceptSuggestions).toHaveBeenCalled();
  });

  it("offers nothing to change where nothing can, and no catalog filter with one catalog", () => {
    renderList({
      candidates: { ...list, items: [list.items[0]] },
      catalogIds: ["cat-001"],
      onAcceptSuggestions: undefined,
      onOpen: undefined,
    });
    expect(screen.queryByRole("button", { name: "Customers" })).toBeNull();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "bknProject.model.candidates.acceptSuggestions" }),
    ).toBeNull();
  });
});
