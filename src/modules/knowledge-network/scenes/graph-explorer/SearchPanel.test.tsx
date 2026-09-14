/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

import { SearchPanel, type SearchPanelProps } from "./SearchPanel";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

const node = (otId: string, index: number): GNode => ({
  id: `${otId}-${index}`,
  otId,
  otName: otId,
  identity: { id: index },
  display: `${otId} #${index}`,
  props: {},
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

function renderPanel(overrides: Partial<SearchPanelProps>) {
  const props: SearchPanelProps = {
    objectTypes: [
      { id: "ot_a", name: "Type A" },
      { id: "ot_b", name: "Type B" },
    ],
    conceptGroups: [],
    metaByOt: {},
    ensureMeta: () => Promise.resolve(null),
    onSearch: () => Promise.resolve([]),
    onLocate: () => Promise.resolve([]),
    onQuery: () => Promise.resolve([]),
    onBrowse: () => Promise.resolve([]),
    onSubgraphByIds: () => Promise.resolve(),
    onCypher: () => Promise.resolve({ nodes: [], edges: [], rows: 0 }),
    onAddGraph: () => undefined,
    cypherRowLimit: 100,
    onGenerateCypher: null,
    onAiExplore: null,
    cypherModels: [],
    onAdd: () => undefined,
    canvasIds: new Set(),
    disabled: false,
    colorOf: () => "#000",
    ...overrides,
  };
  render(<SearchPanel {...props} />);
  fireEvent.click(screen.getByText("knowledgeNetwork.graphExplorer.tabs.browse"));
}

function pickObjectType(name: string) {
  const selector = document.querySelector('[data-testid="graph-explorer-browse-ot"] .ant-select-selector');
  expect(selector).toBeTruthy();
  fireEvent.mouseDown(selector!);
  const options = screen.getAllByText(name);
  fireEvent.click(options[options.length - 1]);
}

describe("SearchPanel browse", () => {
  it("drops a page that arrives after the object type was switched", async () => {
    const pageOfA = deferred<GNode[]>();
    const onBrowse = vi.fn((otId: string) =>
      otId === "ot_a" ? pageOfA.promise : Promise.resolve([node("ot_b", 1)]),
    );
    renderPanel({ onBrowse });

    pickObjectType("Type A");
    fireEvent.click(screen.getByTestId("graph-explorer-browse"));
    expect(onBrowse).toHaveBeenCalledWith("ot_a", 0);

    pickObjectType("Type B");
    await act(async () => {
      pageOfA.resolve(Array.from({ length: 50 }, (_, index) => node("ot_a", index)));
      await pageOfA.promise;
    });

    expect(screen.queryAllByTestId("graph-explorer-result")).toHaveLength(0);
    expect(screen.queryByText("knowledgeNetwork.graphExplorer.browse.more")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId("graph-explorer-browse"));
      await Promise.resolve();
    });
    expect(onBrowse).toHaveBeenLastCalledWith("ot_b", 0);
    expect(screen.getAllByTestId("graph-explorer-result")).toHaveLength(1);
    expect(screen.getByText("ot_b #1")).toBeTruthy();
  });
});
