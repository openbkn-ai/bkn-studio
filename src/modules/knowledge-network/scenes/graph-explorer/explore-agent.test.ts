/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import type { GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

import { buildExplorePrompt, conditionFrom, createExploreTools, summarizeNodes, type ExploreDeps, type ExploreStep } from "./explore-agent";

const node = (id: string, otId: string, props: Record<string, unknown> = {}): GNode => ({ id, otId, otName: otId, identity: {}, display: typeof props.name === "string" ? props.name : id, props });

const texts = {
  found: (count: number) => `found ${count}`,
  drawn: (nodes: number, edges: number) => `drawn ${nodes}/${edges}`,
  rows: (rows: number, nodes: number, edges: number) => `rows ${rows} ${nodes}/${edges}`,
  failed: (message: string) => `failed: ${message}`,
};

type Callable = { execute: (input: unknown, options: unknown) => Promise<unknown> };
const call = (tools: ReturnType<typeof createExploreTools>, name: string, input: unknown) => (tools[name] as unknown as Callable).execute(input, { toolCallId: "t", messages: [] });

describe("buildExplorePrompt", () => {
  it("lists object types with properties and relation types with their direction", () => {
    const system = buildExplorePrompt(
      {
        object_types: [{ id: "squads", name: "阵容", data_properties: [{ name: "key_id", type: "integer" }, { name: "team_name" }] }],
        relation_types: [{ id: "rel_squads_tournament", name: "届次", sourceId: "squads", targetId: "tournaments" }],
      },
      { intro: "INTRO", rulesHeader: "RULES", rules: ["one", "two"], propertiesLabel: "props", objectTypesHeader: "OBJECTS", relationTypesHeader: "RELATIONS" },
    );
    expect(system).toContain("INTRO\n\nRULES\n1. one\n2. two");
    expect(system).toContain("- squads (阵容)\n  props: key_id:integer, team_name");
    expect(system).toContain("- rel_squads_tournament (届次): squads -> tournaments");
  });
});

describe("summarizeNodes", () => {
  it("caps the list, keeps the total count and drops system properties", () => {
    const nodes = [node("a-1", "a", { name: "one", _display: "x", extra: null, size: 3 }), node("a-2", "a"), node("a-3", "a")];
    const summary = summarizeNodes(nodes, 2);
    expect(summary.count).toBe(3);
    expect(summary.items).toEqual([
      { id: "a-1", type: "a", label: "one", props: { name: "one", size: "3" } },
      { id: "a-2", type: "a", label: "a-2", props: {} },
    ]);
    expect(summarizeNodes(nodes, 1, false).items[0]).toEqual({ id: "a-1", type: "a", label: "one" });
  });
});

describe("conditionFrom", () => {
  it("returns null, a leaf, or an AND of leaves", () => {
    expect(conditionFrom([])).toBeNull();
    expect(conditionFrom([{ field: "name", operation: "==", value: "x" }])).toEqual({ field: "name", operation: "==", value: "x" });
    expect(conditionFrom([{ field: "a", operation: ">", value: 1 }, { field: "b", operation: "like", value: "%q%" }])).toMatchObject({ operation: "and", sub_conditions: [{ field: "a" }, { field: "b" }] });
  });
});

describe("createExploreTools", () => {
  const deps = (): ExploreDeps => ({
    search: vi.fn(() => Promise.resolve([node("a-1", "a", { name: "one" })])),
    query: vi.fn(() => Promise.resolve([])),
    show: vi.fn((ids: string[]) => Promise.resolve({ nodes: ids.map((id) => node(id, "a")), edges: [], added: { nodes: ids.length, edges: 0 } })),
    expand: vi.fn(() => Promise.reject(new Error("boom"))),
    cypher: vi.fn(() => Promise.resolve({ nodes: [], edges: [], rows: 0, added: { nodes: 0, edges: 0 } })),
    canvas: () => ({ nodes: [], edges: [] }),
  });

  it("returns candidates from search and reports the step", async () => {
    const steps: ExploreStep[] = [];
    const d = deps();
    const tools = createExploreTools(d, (step) => steps.push(step), texts);
    const out = await call(tools, "search_instances", { query: "one", limit: 5 });
    expect(d.search).toHaveBeenCalledWith("one", undefined, 5);
    expect(out).toMatchObject({ count: 1, items: [{ id: "a-1", label: "one" }] });
    expect(steps).toMatchObject([{ tool: "search_instances", ok: true, summary: "found 1" }]);
  });

  it("draws through show_instances and maps the expansion direction", async () => {
    const steps: ExploreStep[] = [];
    const d = deps();
    const tools = createExploreTools(d, (step) => steps.push(step), texts);
    const out = await call(tools, "show_instances", { ids: ["a-1", "a-2"] });
    expect(out).toMatchObject({ count: 2, added: { nodes: 2, edges: 0 } });
    expect(steps[0]).toMatchObject({ tool: "show_instances", ok: true, summary: "drawn 2/0" });
    await call(tools, "expand_neighbours", { ids: ["a-1"], direction: "in" });
    expect(d.expand).toHaveBeenCalledWith(["a-1"], "backward");
  });

  it("hands a failure back to the model as a result instead of throwing", async () => {
    const steps: ExploreStep[] = [];
    const tools = createExploreTools(deps(), (step) => steps.push(step), texts);
    const out = await call(tools, "expand_neighbours", { ids: ["a-1"] });
    expect(out).toEqual({ error: "boom" });
    expect(steps[0]).toMatchObject({ tool: "expand_neighbours", ok: false, summary: "failed: boom" });
  });
});
