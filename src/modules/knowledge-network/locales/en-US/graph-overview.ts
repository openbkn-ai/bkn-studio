/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const graphOverviewPart = {
  graphOverview: {
    title: "Graph overview",
    description: "Draw the network's instances and relations at once to see its overall shape",
    openAction: "Show graph",
    summary: {
      complete: "{{nodes}} instances · {{edges}} relations",
      sampled: "{{nodes}}/{{totalNodes}} instances · {{edges}}/{{totalEdges}} relations",
      limitedByNodes:
        "More than {{limit}} instances: relations are sampled in turn so every relation type is represented",
      limitedByEdges:
        "More than {{limit}} relations: relations are sampled in turn so every relation type is represented",
      cached: "Loaded {{time}}",
    },
    types: {
      toggle: "Object types {{count}}",
      toggleHidden: "Object types {{count}} · {{hidden}} hidden",
      hide: "Hide this type",
      show: "Show this type",
      only: "Show only this type",
      all: "Show all",
      pick: "Select instances of this type",
    },
    search: "Find an instance by name",
    handOver: {
      tip: "Open the selected instances in another page to look further",
      empty: "Click an instance (its neighbours come along) or Shift + drag to select",
      tooMany: "At most {{limit}} instances can be taken at once; narrow the selection",
    },
    drawer: {
      title: "Instance properties",
      close: "Close",
      instanceId: "Instance ID",
      empty: "No properties",
    },
    layout: {
      run: "Run layout",
      stop: "Stop layout",
    },
    neighbours: {
      title: "{{name}} · {{count}} neighbours",
      more: "{{count}} more relation types",
    },
    limit: {
      option: "Up to {{value}}",
      tip: "How many instances to draw at most; changing it reloads",
    },
    fit: "Fit view",
    reload: "Reload",
    stop: "Stop",
    progress: "{{nodes}} instances · {{edges}} relations so far · reading {{current}}",
    counting: "totals",
    failed: "Could not load the overview",
    partialFailureLine: "{{count}} not read: {{names}}",
    saturatedLine: "{{count}} read one page only: {{names}}",
    noWebgl:
      "WebGL is not available in this browser right now, so the overview cannot be drawn. Restart the browser, or check chrome://gpu to see whether WebGL is disabled",
    empty: "This network has no instances to show yet",
    hint: "Scroll to zoom · Click for neighbours · Shift + drag to select · Esc to clear",
    back: "Back",
    hint3d:
      "Drag to rotate · right-drag to pan · scroll to zoom · click for neighbours · Esc to clear; 3D draws the first 20000 points at most",
  },
};
