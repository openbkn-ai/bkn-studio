/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { readGraphTokens } from "@/modules/knowledge-network/lib/graph-style";

import { OntologyG6Canvas } from "./OntologyG6Canvas";

type Behavior = { type: string; enable?: (event: unknown) => boolean; preventDefault?: boolean };
type Plugin = {
  type: string;
  enable?: (event: unknown) => boolean;
  getContent?: (event: unknown, items: { data?: Record<string, unknown> }[]) => Promise<string>;
};
type Listener = (event: { target: { id: string } }) => void;

// jsdom has no ResizeObserver; the stand-in lets a test report a new size.
const resizeListeners: ((size: { width: number; height: number }) => void)[] = [];
globalThis.ResizeObserver = class {
  constructor(private readonly callback: ResizeObserverCallback) {
    resizeListeners.push((size) =>
      this.callback([{ contentRect: size } as unknown as ResizeObserverEntry], this),
    );
  }
  observe() {}
  disconnect() {}
  unobserve() {}
};
const reportSize = (width: number, height: number) => resizeListeners.at(-1)?.({ width, height });

// G6 cannot draw in jsdom; the stand-in keeps the options and lets a test fire its events.
const created: {
  options: { behaviors: Behavior[]; plugins: Plugin[] };
  listeners: Map<string, Listener>;
  layerRender: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  fitView: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock("@antv/g6", () => {
  class Graph {
    destroyed = false;
    listeners = new Map<string, Listener>();
    layerRender = vi.fn();
    resize = vi.fn();
    fitView = vi.fn(() => Promise.resolve());
    constructor(options: { behaviors: Behavior[]; plugins: Plugin[] }) {
      created.push({
        options,
        listeners: this.listeners,
        layerRender: this.layerRender,
        resize: this.resize,
        fitView: this.fitView,
      });
    }
    getCanvas() {
      return { getLayers: () => ({ main: { render: this.layerRender } }) };
    }
    on(event: string, listener: Listener) {
      this.listeners.set(event, listener);
    }
    setNode() {}
    setEdge() {}
    setData() {}
    updateNodeData() {}
    updateEdgeData() {}
    render = () => Promise.resolve();
    draw = () => Promise.resolve();
    setElementState = () => Promise.resolve();
    fitCenter = () => Promise.resolve();
    zoomBy = () => Promise.resolve();
    getZoom = () => 1;
    destroy() {
      this.destroyed = true;
    }
  }
  return {
    Graph,
    NodeEvent: { CLICK: "node:click" },
    CanvasEvent: { CLICK: "canvas:click" },
    GraphEvent: { AFTER_TRANSFORM: "aftertransform" },
  };
});

const STRUCTURE = { nodes: [], edges: [], combos: [] };
const DECORATIONS = { nodes: [], edges: [], states: {} };
const TOKENS = readGraphTokens();

function canvasElement(onNodeClick = vi.fn(), maximized = false) {
  return (
    <OntologyG6Canvas
      ariaLabel="graph"
      maximized={maximized}
      decorations={DECORATIONS}
      onBlankClick={vi.fn()}
      onNodeClick={onNodeClick}
      onZoom={vi.fn()}
      structure={STRUCTURE}
      tokens={TOKENS}
      totalNodes={0}
    />
  );
}

function renderCanvas(onNodeClick = vi.fn()) {
  render(canvasElement(onNodeClick));
  return created[created.length - 1];
}

describe("OntologyG6Canvas", () => {
  it("zooms only with Ctrl/⌘ held and leaves a plain wheel to the page", () => {
    const graph = renderCanvas();
    const zoom = graph.options.behaviors.find((behavior) => behavior.type === "zoom-canvas");

    expect(zoom?.preventDefault).toBe(false);
    expect(zoom?.enable?.({ ctrlKey: false, metaKey: false })).toBe(false);
    expect(zoom?.enable?.({ ctrlKey: true })).toBe(true);
    expect(zoom?.enable?.({ metaKey: true })).toBe(true);

    const area = screen.getByRole("img", { name: "graph" });
    const plain = new WheelEvent("wheel", { cancelable: true, deltaY: 10 });
    area.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    const pinch = new WheelEvent("wheel", { cancelable: true, ctrlKey: true, deltaY: 10 });
    area.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
  });

  it("drags types and group boxes, pans on blank canvas, and reports a clicked node", async () => {
    const onNodeClick = vi.fn();
    const graph = renderCanvas(onNodeClick);
    const drag = graph.options.behaviors.find((behavior) => behavior.type === "drag-element");
    const pan = graph.options.behaviors.find((behavior) => behavior.type === "drag-canvas");

    expect(drag?.enable?.({ targetType: "node" })).toBe(true);
    expect(drag?.enable?.({ targetType: "combo" })).toBe(true);
    expect(drag?.enable?.({ targetType: "edge" })).toBe(false);
    expect(pan?.enable?.({ targetType: "canvas" })).toBe(true);
    expect(pan?.enable?.({ targetType: "node" })).toBe(false);

    graph.listeners.get("node:click")?.({ target: { id: "order" } });
    await waitFor(() => expect(onNodeClick).toHaveBeenCalledWith("order"));
  });

  it("draws a frame after names change, so they do not wait for the next pan", async () => {
    const graph = renderCanvas();
    await waitFor(() => expect(graph.layerRender).toHaveBeenCalled());
  });

  it("keeps the user's view when the space changes, and refits it when maximized", async () => {
    const onNodeClick = vi.fn();
    const { rerender } = render(canvasElement(onNodeClick));
    const graph = created[created.length - 1];
    await waitFor(() => expect(graph.fitView).toHaveBeenCalledTimes(1));
    reportSize(800, 400);

    // The window or the sidebar changes the size: the canvas follows, the view stays.
    reportSize(700, 400);
    await waitFor(() => expect(graph.resize).toHaveBeenCalledWith(700, 400));
    expect(graph.fitView).toHaveBeenCalledTimes(1);

    rerender(canvasElement(onNodeClick, true));
    reportSize(1400, 900);
    await waitFor(() => expect(graph.fitView).toHaveBeenCalledTimes(2));
  });

  it("names the hovered type in full, escaped, with its concept group", async () => {
    const graph = renderCanvas();
    const tooltip = graph.options.plugins.find((plugin) => plugin.type === "tooltip");

    expect(tooltip?.enable?.({ targetType: "node" })).toBe(true);
    expect(tooltip?.enable?.({ targetType: "edge" })).toBe(false);
    const html = await tooltip?.getContent?.({}, [
      { data: { name: "<采购>订单", group: "采购域" } },
    ]);
    expect(html).toContain("&#60;采购&#62;订单");
    expect(html).toContain("采购域");
  });
});
