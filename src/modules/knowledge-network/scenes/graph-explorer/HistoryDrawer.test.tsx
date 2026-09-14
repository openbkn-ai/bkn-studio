/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "@/modules/knowledge-network/utils/graph-explorer-history";

import { HistoryDrawer } from "./HistoryDrawer";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  id: "h1",
  at: 0,
  kind: "cypher",
  title: "(p:players)<-[:rel]-(pa)",
  input: {},
  output: {},
  ok: true,
  ms: 12,
  summary: "1 · 0",
  ...overrides,
});

const noop = () => undefined;

describe("HistoryDrawer send-to-canvas", () => {
  it("offers to send an entry that recorded a subgraph, and hands back that entry", () => {
    const onSendToCanvas = vi.fn();
    const withGraph = entry({ graph: { nodes: [{ id: "n1", otId: "ot", label: "n1", props: {} } as never], edges: [] } });
    render(<HistoryDrawer open entries={[withGraph]} onClose={noop} onCopy={noop} onRerun={noop} onSendToCanvas={onSendToCanvas} onClear={noop} />);

    // The actions sit inside the collapsed body; open it first.
    fireEvent.click(screen.getByText(withGraph.title));
    fireEvent.click(screen.getByTestId("graph-explorer-history-send"));
    expect(onSendToCanvas).toHaveBeenCalledWith(withGraph);
  });

  it("does not offer it for an entry with nothing to put on the canvas", () => {
    const empty = entry({ id: "h2", title: "empty result", graph: { nodes: [], edges: [] } });
    const none = entry({ id: "h3", title: "a path search", kind: "path", graph: undefined });
    render(<HistoryDrawer open entries={[empty, none]} onClose={noop} onCopy={noop} onRerun={noop} onSendToCanvas={noop} onClear={noop} />);
    fireEvent.click(screen.getByText(empty.title));
    expect(screen.queryByTestId("graph-explorer-history-send")).toBeNull();
  });
});
