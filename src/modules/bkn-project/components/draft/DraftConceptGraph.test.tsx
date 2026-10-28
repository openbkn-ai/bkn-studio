/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { DraftConceptGraph } from "./DraftConceptGraph";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Stands in for the graph with its click rule: clicking the selected node unselects it.
vi.mock("@/modules/knowledge-network/components/preview/OntologyGraphView", () => ({
  OntologyGraphView: ({
    onSelect,
    selectedId,
  }: {
    onSelect: (id: string | null) => void;
    selectedId: string | null;
  }) => (
    <button onClick={() => onSelect(selectedId === "customers" ? null : "customers")} type="button">
      {selectedId ?? "none"}
    </button>
  ),
}));

describe("DraftConceptGraph", () => {
  it("opens the same object type on every click, not every other one", () => {
    const onOpen = vi.fn();
    render(<DraftConceptGraph draft={mapDraft(mockDraft("p1"))} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith("customers");
  });

  it("highlights the clicked object type where clicking opens nothing", () => {
    render(<DraftConceptGraph draft={mapDraft(mockDraft("p1"))} />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("customers");
  });
});
