/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { RelationSuggestion, RelationSuggestions } from "@/modules/bkn-project/types/draft";

const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  get: vi.fn(),
  isolated: vi.fn(),
  t: (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("@/modules/bkn-project/services/relation-suggestions.service", () => ({
  askRelationSuggestions: mocks.ask,
  getRelationSuggestions: mocks.get,
  listIsolatedObjectTypes: mocks.isolated,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RelationSuggestionsEntry } from "./RelationSuggestionsDrawer";

const draft = mapDraft(mockDraft("p1"));

const drafted: RelationSuggestion = {
  ends: {
    mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
    source: "sales_orders",
    target: "customers",
  },
  evidence: {
    computed: true,
    hitRate: 0.96,
    hits: 1180,
    nulls: 0,
    orphans: 54,
    rows: 1234,
    sourceDistinct: 0,
  },
  name: "Orders of a customer",
  origin: "drafted",
  reason: "",
  relationTypeId: "rt_orders",
};
const fields: RelationSuggestion = {
  ...drafted,
  evidence: { ...drafted.evidence, computed: false, reason: "cross_catalog" },
  name: "Customer of a bill",
  origin: "stem_match",
  relationTypeId: "",
};
const suggestions = (...candidates: RelationSuggestion[]): RelationSuggestions => ({
  answer: "",
  candidates,
  objectType: { id: "customers", name: "Customer" },
});

function renderEntry(editable = true) {
  const handlers = { onAdopt: vi.fn().mockResolvedValue(undefined), onCreate: vi.fn() };
  renderWithoutAntdStyles(
    <RelationSuggestionsEntry draft={draft} editable={editable} projectId="p1" {...handlers} />,
  );
  return handlers;
}

async function openCustomers() {
  fireEvent.click(
    await screen.findByRole("button", { name: 'bknProject.relationSuggestions.entry:{"count":1}' }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Customer" }));
}

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

describe("RelationSuggestionsEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isolated.mockResolvedValue([{ id: "customers", name: "Customer" }]);
    mocks.get.mockResolvedValue(suggestions(drafted, fields));
  });

  it("says when every adopted object is connected", async () => {
    mocks.isolated.mockResolvedValue([]);
    renderEntry();
    expect(
      await screen.findByText("bknProject.relationSuggestions.allConnected"),
    ).toBeInTheDocument();
  });

  it("shows an object's suggestions by business names, source and count", async () => {
    renderEntry();
    await openCustomers();

    expect(await screen.findByText("Orders of a customer")).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith("p1", "customers");
    // Its ends by name, and its source in words.
    expect(
      screen.getAllByText(
        'bknProject.relationSuggestions.ends:{"source":"sales_orders","target":"customers"}',
      ),
    ).toHaveLength(2);
    expect(screen.getByText("bknProject.relationSuggestions.origin.drafted")).toBeInTheDocument();
    expect(
      screen.getByText("bknProject.relationSuggestions.origin.stem_match"),
    ).toBeInTheDocument();
    // Counted, or why not.
    expect(screen.getByText(/bknProject\.model\.evidence\.joinCount:/)).toBeInTheDocument();
    expect(screen.getByText(/countReason\.cross_catalog|countReason\.other/)).toBeInTheDocument();
  });

  it("adopts a drafted suggestion, and opens any other in the relation editor", async () => {
    const { onAdopt, onCreate } = renderEntry();
    await openCustomers();

    const [adopt, open] = await screen.findAllByRole("button", {
      name: /bknProject\.relationSuggestions\.(adopt|open)/,
    });
    fireEvent.click(adopt);
    await waitFor(() => expect(onAdopt).toHaveBeenCalledWith("rt_orders"));
    fireEvent.click(open);
    expect(onCreate).toHaveBeenCalledWith(fields);
  });

  it("adds what AI suggests, and keeps the fields' suggestions when it cannot", async () => {
    mocks.ask
      .mockResolvedValueOnce({
        ...suggestions(
          { ...drafted, reason: "Each order names its customer." },
          { ...fields, name: "AI link", origin: "ai", reason: "Bills go to customers." },
        ),
        answer: "Customers connect through the orders they place.",
      })
      .mockRejectedValueOnce(new Error("502"));
    renderEntry();
    await openCustomers();

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.relationSuggestions.ask" }),
    );
    expect(await screen.findByText("Each order names its customer.")).toBeInTheDocument();
    // AI's view of how it connects, above the suggestions.
    expect(
      screen.getByText("Customers connect through the orders they place."),
    ).toBeInTheDocument();
    expect(screen.getByText("bknProject.relationSuggestions.origin.ai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "bknProject.relationSuggestions.ask" }));
    expect(await screen.findByText("bknProject.relationSuggestions.askFailed")).toBeInTheDocument();
    expect(screen.getByText("AI link")).toBeInTheDocument();
  });

  it("lets AI be asked again once another read supersedes an answer still coming", async () => {
    mocks.isolated.mockResolvedValue([
      { id: "customers", name: "Customer" },
      { id: "sales_orders", name: "Order" },
    ]);
    mocks.ask.mockImplementationOnce(() => new Promise(() => undefined));
    renderEntry();
    fireEvent.click(
      await screen.findByRole("button", {
        name: 'bknProject.relationSuggestions.entry:{"count":2}',
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Customer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.relationSuggestions.ask" }),
    );
    expect(await screen.findByText("bknProject.relationSuggestions.asking")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Order" }));
    expect(
      await screen.findByRole("button", { name: "bknProject.relationSuggestions.ask" }),
    ).toBeEnabled();
  });

  it("shows AI's suggestions without an empty answer when AI wrote none", async () => {
    mocks.ask.mockResolvedValueOnce(
      suggestions(drafted, {
        ...fields,
        name: "AI link",
        origin: "ai",
        reason: "Bills go to customers.",
      }),
    );
    renderEntry();
    await openCustomers();

    fireEvent.click(
      await screen.findByRole("button", { name: "bknProject.relationSuggestions.ask" }),
    );
    expect(await screen.findByText("AI link")).toBeInTheDocument();
    expect(screen.getByText("Bills go to customers.")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.relationSuggestions.answerTitle")).toBeNull();
  });

  it("offers no adopting or asking to someone who cannot edit", async () => {
    renderEntry(false);
    await openCustomers();
    expect(await screen.findByText("Orders of a customer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adopt|open|ask/ })).toBeNull();
  });
});
