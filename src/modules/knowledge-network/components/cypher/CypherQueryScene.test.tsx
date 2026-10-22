/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CypherAgentError } from "@/modules/knowledge-network/cypher/cypher-ai";

import { CypherQueryScene } from "./CypherQueryScene";

const mocks = vi.hoisted(() => ({
  fetchKnDetailRest: vi.fn(),
  getObjectTypeDisplayKeys: vi.fn(),
  getObjectTypeProperties: vi.fn(),
  cancelExecution: vi.fn(),
  runCypherQuery: vi.fn(),
  generateCypher: vi.fn(),
  explainCypher: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-runtime-config", () => ({
  useRuntimeConfig: () => ({
    auth: {
      tokenManager: {
        getAccessToken: () => "token-1",
        refreshAccessToken: () => Promise.resolve("token-2"),
      },
    },
  }),
}));

vi.mock("@/modules/knowledge-network/services/context-loader.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/context-loader.service")
  >()),
  fetchKnDetailRest: mocks.fetchKnDetailRest,
}));

vi.mock("@/modules/knowledge-network/cypher/cypher-query.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/cypher/cypher-query.service")
  >()),
  getObjectTypeDisplayKeys: mocks.getObjectTypeDisplayKeys,
  getObjectTypeProperties: mocks.getObjectTypeProperties,
  runCypherQuery: mocks.runCypherQuery,
}));

vi.mock("@/modules/knowledge-network/cypher/cypher-ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/knowledge-network/cypher/cypher-ai")>()),
  generateCypher: mocks.generateCypher,
  explainCypher: mocks.explainCypher,
}));

vi.mock(
  "@/modules/knowledge-network/services/bkn-agent-execution.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/bkn-agent-execution.service")
    >()),
    cancelExecution: mocks.cancelExecution,
  }),
);

// Monaco does not run in jsdom: a textarea with the same run and history keys stands in.
vi.mock("@/modules/knowledge-network/components/cypher/CypherEditor", () => ({
  CypherEditor: ({
    value,
    onChange,
    onRun,
    onHistory,
  }: {
    value: string;
    onChange: (value: string) => void;
    onRun: () => void;
    onHistory: (older: boolean) => void;
  }) => (
    <textarea
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key === "Enter") onRun();
        if (event.key === "ArrowUp") onHistory(true);
        if (event.key === "ArrowDown") onHistory(false);
      }}
      value={value}
    />
  ),
}));

// echarts needs a real canvas; the chart itself is covered by the option builder's tests.
vi.mock("@/modules/knowledge-network/components/cypher/CypherChart", () => ({
  CypherChart: () => <div data-testid="chart" />,
}));

const exchange = { url: "/run_cypher", request: {}, status: 200, latencyMs: 12, response: {} };

function team(name: string) {
  return {
    kind: "object",
    object_type_id: "teams",
    key: { team_id: { type: "integer", value: "7" } },
    properties: { team_name: name },
  };
}

function editor(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>("textbox");
}

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  // antd's responsive table reads media queries, which jsdom lacks.
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

beforeEach(() => {
  localStorage.clear();
  mocks.fetchKnDetailRest.mockResolvedValue({
    id: "worldcup",
    object_types: [
      { id: "goals", name: "进球" },
      { id: "teams", name: "球队" },
    ],
    concept_groups: [],
    relation_types: [
      { id: "rel_goals_team", name: "进球所属球队", sourceId: "goals", targetId: "teams" },
    ],
  });
  mocks.getObjectTypeDisplayKeys.mockResolvedValue({ teams: "team_name" });
  mocks.getObjectTypeProperties.mockResolvedValue({
    teams: [{ name: "team_name", displayName: "球队名" }],
  });
  mocks.getObjectTypeDisplayKeys.mockClear();
  mocks.runCypherQuery.mockReset();
  mocks.generateCypher.mockReset();
  mocks.explainCypher.mockReset();
});

afterEach(cleanup);

describe("CypherQueryScene", () => {
  it("runs a sample query from the schema panel and shows a count as a table", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "n" }], entries: [{ n: 79 }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(await screen.findByTestId("cypher-schema-object-goals"));

    await screen.findByText("79");
    expect(mocks.runCypherQuery.mock.calls[0][0]).toMatchObject({
      query: "MATCH (n:goals) RETURN n LIMIT 25",
      objectProperties: {},
    });
    expect(editor().value).toBe("MATCH (n:goals) RETURN n LIMIT 25");
    // A count holds no node or relationship, so the graph view is off.
    const graphOption = screen
      .getByText("knowledgeNetwork.cypherQuery.views.graph")
      .closest("label");
    expect(graphOption?.className).toMatch(/disabled/);
  });

  it("reruns a schema sample with properties when its object type cannot return nodes", async () => {
    mocks.runCypherQuery
      .mockResolvedValueOnce({
        ok: false,
        error: { message: "dataset", code: "BknBackend.Cypher.Unsupported" },
        exchange,
      })
      .mockResolvedValueOnce({
        ok: true,
        result: { columns: [{ name: "n_team_name" }], entries: [{ n_team_name: "Brazil" }] },
        exchange,
      });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");
    await waitFor(() => expect(mocks.getObjectTypeProperties).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("cypher-schema-object-teams"));

    await screen.findByText("Brazil");
    const rewritten = "MATCH (n:teams) RETURN n.team_name AS n_team_name LIMIT 25";
    expect(mocks.runCypherQuery.mock.calls.map((call) => call[0].query)).toEqual([
      "MATCH (n:teams) RETURN n LIMIT 25",
      rewritten,
    ]);
    expect(screen.getByTestId("cypher-frame-notice")).toBeTruthy();
    expect(screen.getAllByTestId("cypher-frame")).toHaveLength(1);
    expect(editor().value).toBe(rewritten);
  });

  it("does not rewrite a sample refused for another reason", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: false,
      error: { message: "forbidden", code: "BknBackend.Cypher.PropertyForbidden" },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    fireEvent.click(await screen.findByTestId("cypher-schema-object-teams"));
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("cypher-frame-notice")).toBeNull();
  });

  it("runs the editor's query on Ctrl+Enter, asking returned nodes for their display property", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "t" }], entries: [{ t: team("Brazil") }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");

    const query = "MATCH (t:teams) WHERE t.team_name = 'Brazil' RETURN t LIMIT 5";
    fireEvent.change(editor(), { target: { value: query } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });

    await screen.findByTestId("chart");
    expect(mocks.runCypherQuery.mock.calls[0][0]).toMatchObject({
      query,
      objectProperties: { t: ["team_name"] },
    });
    expect(mocks.getObjectTypeDisplayKeys).toHaveBeenCalledWith("kn-1", ["teams"]);
    expect(localStorage.getItem("bkn-studio.cypher-frames.worldcup")).toContain("Brazil");
  });

  it("asks for display keys again after a failed read instead of dropping them", async () => {
    mocks.getObjectTypeDisplayKeys.mockRejectedValueOnce(new Error("401"));
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "t" }], entries: [{ t: team("Brazil") }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");

    const query = "MATCH (t:teams) RETURN t LIMIT 5";
    fireEvent.change(editor(), { target: { value: query } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(1));
    expect(mocks.runCypherQuery.mock.calls[0][0]).not.toHaveProperty("objectProperties.t");

    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(2));
    expect(mocks.runCypherQuery.mock.calls[1][0]).toMatchObject({
      objectProperties: { t: ["team_name"] },
    });
  });

  it("generates a query with the Agent, puts it in the editor and runs it", async () => {
    const query = "MATCH (t:teams) RETURN count(t) AS n";
    mocks.generateCypher.mockResolvedValue({
      query,
      answer: `\`\`\`cypher\n${query}\n\`\`\``,
      threadId: "thread-1",
    });
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "n" }], entries: [{ n: 32 }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "一共有多少支球队" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));

    await screen.findByText("32");
    expect(mocks.generateCypher.mock.calls[0][0]).toMatchObject({
      knId: "worldcup",
      message: "一共有多少支球队",
    });
    expect(mocks.runCypherQuery.mock.calls[0][0]).toMatchObject({ query });
    expect(editor().value).toBe(query);
    expect(screen.getByText("knowledgeNetwork.cypherQuery.frames.aiBadge")).toBeTruthy();
    expect(screen.getByText("一共有多少支球队")).toBeTruthy();
  });

  it("shows the backend's error and asks the same Agent thread to fix the query", async () => {
    const query = "MATCH (g:goals) WHERE g.a != 1 RETURN g";
    mocks.generateCypher.mockResolvedValueOnce({ query, answer: query, threadId: "thread-1" });
    mocks.runCypherQuery.mockResolvedValueOnce({
      ok: false,
      error: { message: "unexpected token !=", code: "Cypher.SyntaxError", solution: "use <>" },
      exchange: { ...exchange, status: 400 },
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "非巴西的进球" } });
    fireEvent.keyDown(editor(), { key: "Enter", metaKey: true });

    await screen.findByText("unexpected token !=");
    expect(screen.getByText("knowledgeNetwork.cypherQuery.status.code")).toBeTruthy();

    mocks.generateCypher.mockResolvedValueOnce({
      query: "MATCH (g:goals) WHERE g.a <> 1 RETURN g",
      answer: "",
      threadId: "thread-1",
    });
    mocks.runCypherQuery.mockResolvedValueOnce({
      ok: true,
      result: { columns: [{ name: "g" }], entries: [] },
      exchange,
    });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.frames.fixWithAi"));

    await waitFor(() => expect(mocks.generateCypher).toHaveBeenCalledTimes(2));
    expect(mocks.generateCypher.mock.calls[1][0]).toMatchObject({ threadId: "thread-1" });
  });

  it("keeps an unpublished Agent out of the stream and lets the notice be closed", async () => {
    mocks.generateCypher.mockRejectedValue(new CypherAgentError("NOT_READY", true));
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "巴西队的进球" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));

    await screen.findByText("knowledgeNetwork.cypherQuery.agent.notReady");
    expect(screen.queryByTestId("cypher-frame")).toBeNull();
    expect(editor().value).toBe("巴西队的进球");
    expect(mocks.runCypherQuery).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByText("knowledgeNetwork.cypherQuery.agent.notReady")).toBeNull();
    expect(screen.getByText("knowledgeNetwork.cypherQuery.agent.notReadyShort")).toBeTruthy();
    expect(localStorage.getItem("bkn-studio.cypher-agent-notice-dismissed")).toBe("1");
  });

  it("puts each new run on top and refreshes a frame in place when it runs again", async () => {
    mocks.runCypherQuery.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve({
        ok: true,
        result: { columns: [{ name: "q" }], entries: [{ q: query }] },
        exchange,
      }),
    );
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    for (const query of ["RETURN 'first' AS q", "RETURN 'second' AS q"]) {
      fireEvent.change(editor(), { target: { value: query } });
      fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
      await screen.findByText(
        query.includes("first") ? "RETURN 'first' AS q" : "RETURN 'second' AS q",
        {
          selector: "code",
        },
      );
    }
    await waitFor(() => expect(screen.getAllByTestId("cypher-frame")).toHaveLength(2));
    const order = () =>
      screen
        .getAllByTestId("cypher-frame")
        .map((frame) => frame.querySelector("code")?.textContent);
    expect(order()).toEqual(["RETURN 'second' AS q", "RETURN 'first' AS q"]);

    fireEvent.click(screen.getAllByTestId("cypher-frame-rerun")[1]);
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(3));
    expect(screen.getAllByTestId("cypher-frame")).toHaveLength(2);
    expect(order()).toEqual(["RETURN 'second' AS q", "RETURN 'first' AS q"]);
  });

  it("steps through earlier queries with Ctrl+Up and Ctrl+Down", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [], entries: [] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    for (const query of ["RETURN 1 AS a", "RETURN 2 AS b"]) {
      fireEvent.change(editor(), { target: { value: query } });
      fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    }
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(2));
    fireEvent.change(editor(), { target: { value: "draft" } });

    fireEvent.keyDown(editor(), { key: "ArrowUp", ctrlKey: true });
    expect(editor().value).toBe("RETURN 2 AS b");
    fireEvent.keyDown(editor(), { key: "ArrowUp", ctrlKey: true });
    expect(editor().value).toBe("RETURN 1 AS a");
    fireEvent.keyDown(editor(), { key: "ArrowDown", ctrlKey: true });
    fireEvent.keyDown(editor(), { key: "ArrowDown", ctrlKey: true });
    expect(editor().value).toBe("draft");
  });

  it("fills a syntax reference example into the editor", async () => {
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByTestId("cypher-reference-open"));
    fireEvent.click((await screen.findAllByTestId("cypher-reference-use"))[0]);

    expect(editor().value).toBe("MATCH (a:ObjectType) RETURN a LIMIT 25");
  });

  it("stops a generation and cancels its run on the server", async () => {
    mocks.generateCypher.mockImplementation(
      (params: { signal: AbortSignal; onRun: (id: string) => void }) => {
        params.onRun("run-9");
        return new Promise((_, reject) =>
          params.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        );
      },
    );
    mocks.cancelExecution.mockResolvedValue({});
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "慢问题" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));
    expect(await screen.findByTestId("cypher-frame-stop")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cypher-frame-stop-inline"));

    await screen.findByText("knowledgeNetwork.cypherQuery.frames.stopped");
    expect(mocks.cancelExecution).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-9" }));
  });

  it("continues an AI frame's thread when following up", async () => {
    mocks.generateCypher.mockResolvedValue({
      query: "MATCH (t:teams) RETURN t LIMIT 5",
      answer: "",
      threadId: "thread-7",
    });
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "t" }], entries: [{ t: team("Brazil") }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "球队" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));
    await screen.findByTestId("chart");

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.cypherQuery.frames.followUp" }),
    );
    expect(screen.getByText("knowledgeNetwork.cypherQuery.editor.followingUp")).toBeTruthy();
    fireEvent.change(editor(), { target: { value: "只要巴西" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));

    await waitFor(() => expect(mocks.generateCypher).toHaveBeenCalledTimes(2));
    expect(mocks.generateCypher.mock.calls[1][0]).toMatchObject({
      message: "只要巴西",
      threadId: "thread-7",
    });
  });

  it("loads an AI frame's query and its question, so both modes keep their text", async () => {
    mocks.generateCypher.mockResolvedValue({
      query: "MATCH (t:teams) RETURN t LIMIT 5",
      answer: "",
      threadId: "thread-8",
    });
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "t" }], entries: [{ t: team("Brazil") }] },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    fireEvent.change(editor(), { target: { value: "球队" } });
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.generate"));
    await screen.findByTestId("chart");
    fireEvent.change(editor(), { target: { value: "别的问题" } });

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.cypherQuery.frames.loadQuery" }),
    );
    expect(editor().value).toBe("MATCH (t:teams) RETURN t LIMIT 5");
    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.editor.modeAsk"));
    expect(editor().value).toBe("球队");
  });

  it("folds the schema panel and its groups", async () => {
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-goals");

    fireEvent.click(screen.getByText("knowledgeNetwork.cypherQuery.schema.relationTypes"));
    expect(screen.queryByTestId("cypher-schema-relation-rel_goals_team")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.cypherQuery.schema.collapsePanel" }),
    );
    expect(screen.queryByTestId("cypher-schema-object-goals")).toBeNull();
    expect(localStorage.getItem("bkn-studio.cypher-schema-collapsed")).toBe("1");
    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.cypherQuery.schema.expandPanel" }),
    );
    expect(screen.getByTestId("cypher-schema-object-goals")).toBeTruthy();
  });

  it("plans the editor's query with the Plan button or an EXPLAIN prefix, reading nothing", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: {
        columns: [],
        entries: [],
        plan: {
          shape: "match",
          objects: [{ alias: "t", object_type_id: "teams" }],
          columns: [{ name: "t", kind: "node" }],
          limit: 1000,
          limit_source: "default",
          reads: ["teams.team_name"],
          warnings: ["no LIMIT: at most 1000 rows come back"],
        },
      },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");

    fireEvent.change(editor(), { target: { value: "MATCH (t:teams) RETURN t" } });
    fireEvent.click(screen.getByTestId("cypher-editor-plan"));

    await screen.findByTestId("cypher-plan");
    expect(screen.getByText("no LIMIT: at most 1000 rows come back")).toBeTruthy();
    expect(screen.getByText("t: 球队")).toBeTruthy();
    expect(mocks.runCypherQuery.mock.calls[0][0]).toMatchObject({
      query: "MATCH (t:teams) RETURN t",
      explain: true,
      objectProperties: undefined,
    });

    fireEvent.change(editor(), { target: { value: "explain MATCH (t:teams) RETURN t" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(mocks.runCypherQuery).toHaveBeenCalledTimes(2));
    expect(mocks.runCypherQuery.mock.calls[1][0]).toMatchObject({
      query: "MATCH (t:teams) RETURN t",
      explain: true,
    });
  });

  it("keeps rows in view when a plain run's response also carries a plan", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: true,
      result: {
        columns: [{ name: "n" }],
        entries: [{ n: 79 }],
        plan: {
          shape: "aggregate",
          objects: [],
          columns: [{ name: "n", kind: "count" }],
          limit: 1,
          limit_source: "default",
          reads: [],
        },
      },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");

    fireEvent.change(editor(), { target: { value: "MATCH (g:goals) RETURN count(*) AS n" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });

    await screen.findByText("79");
    expect(screen.queryByTestId("cypher-plan")).toBeNull();
  });

  it("says when a run stopped at the default limit, and words plan warnings by their code", async () => {
    mocks.runCypherQuery.mockResolvedValueOnce({
      ok: true,
      result: { columns: [{ name: "n" }], entries: [{ n: 1 }], limited: true },
      exchange,
    });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);
    await screen.findByTestId("cypher-schema-object-teams");

    fireEvent.change(editor(), { target: { value: "MATCH (t:teams) RETURN t.team_name AS n" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await screen.findByTestId("cypher-limited");

    mocks.runCypherQuery.mockResolvedValueOnce({
      ok: true,
      result: {
        columns: [],
        entries: [],
        plan: {
          shape: "match",
          objects: [{ alias: "t", object_type_id: "teams" }],
          columns: [{ name: "n", kind: "property" }],
          limit: 1000,
          limit_source: "default",
          reads: [],
          warnings: ["no LIMIT: at most 1000 rows come back", "something new"],
          warning_codes: ["default_limit", ""],
        },
      },
      exchange,
    });
    fireEvent.click(screen.getByTestId("cypher-editor-plan"));
    await screen.findByTestId("cypher-plan");
    expect(
      screen.getByText("knowledgeNetwork.cypherQuery.plan.warningCodes.default_limit"),
    ).toBeTruthy();
    // A warning without a code keeps the backend's words.
    expect(screen.getByText("something new")).toBeTruthy();
  });

  it("explains the editor's query in a new frame without running it", async () => {
    mocks.explainCypher.mockResolvedValue({ answer: "查找**巴西队**的进球", threadId: "t-1" });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.change(editor(), { target: { value: "MATCH (t:teams) RETURN t LIMIT 5" } });
    fireEvent.click(screen.getByTestId("cypher-editor-explain"));

    await screen.findByText("巴西队");
    expect(mocks.runCypherQuery).not.toHaveBeenCalled();
    const request = mocks.explainCypher.mock.calls[0][0] as { message: string; threadId?: string };
    expect(request.message).toContain("knowledgeNetwork.cypherQuery.frames.explainRequest");
    expect(request.message).toContain("```cypher\nMATCH (t:teams) RETURN t LIMIT 5\n```");
    expect(request.threadId).toBeUndefined();
  });

  it("stops an explanation with the same button a generation uses", async () => {
    mocks.explainCypher.mockImplementation(
      (params: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          params.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.change(editor(), { target: { value: "MATCH (t:teams) RETURN t LIMIT 5" } });
    fireEvent.click(screen.getByTestId("cypher-editor-explain"));
    const stop = await screen.findByTestId("cypher-frame-stop-explain");
    expect(stop.classList.contains("ant-btn-link")).toBe(false);
    fireEvent.click(stop);

    await waitFor(() => expect(screen.queryByTestId("cypher-frame-stop-explain")).toBeNull());
  });

  it("explains a failed frame with its error", async () => {
    mocks.runCypherQuery.mockResolvedValue({
      ok: false,
      error: { message: "unexpected token !=", code: "Cypher.SyntaxError" },
      exchange,
    });
    mocks.explainCypher.mockResolvedValue({ answer: "不等于要写成 <>", threadId: "t-2" });
    render(<CypherQueryScene knId="worldcup" networkId="kn-1" />);

    fireEvent.change(editor(), { target: { value: "MATCH (g:goals) WHERE g.a != 1 RETURN g" } });
    fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    await screen.findByText("unexpected token !=");
    fireEvent.click(screen.getByTestId("cypher-frame-explain"));

    await screen.findByText("不等于要写成 <>");
    const request = mocks.explainCypher.mock.calls[0][0] as { message: string };
    expect(request.message).toContain("knowledgeNetwork.cypherQuery.frames.explainError");
    expect(request.message).toContain("Cypher.SyntaxError | unexpected token !=");
  });
});
