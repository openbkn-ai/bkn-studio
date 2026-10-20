/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { cypherErrorFrom, runCypherQuery } from "./cypher-query.service";

const env = { base: "https://platform.example.com/", token: "token-1", knId: "worldcup" };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("runCypherQuery", () => {
  it("posts the query as written and reads columns, value types and execution", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reply(200, {
        columns: [{ name: "n", type: "integer" }],
        entries: [{ n: 79 }],
        execution: { conclusions_limited: true, match_rows: 79 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const query = "MATCH (g:goals) WHERE g.team_id <> g.player_team_id RETURN count(*) AS n";

    const run = await runCypherQuery({ env, query });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://platform.example.com/api/agent-retrieval/v1/kn/run_cypher?response_format=json",
    );
    expect(JSON.parse(init.body as string)).toEqual({ kn_id: "worldcup", query });
    expect(run.ok && run.result).toEqual({
      columns: [{ name: "n", type: "integer" }],
      entries: [{ n: 79 }],
      execution: { conclusions_limited: true, match_rows: 79 },
    });
  });

  it("asks for display properties, and runs again without them when the backend refuses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply(400, {
          code: "BknBackend.Cypher.InvalidQuery",
          description: 'object_properties names "t", but the query does not return that node',
        }),
      )
      .mockResolvedValueOnce(reply(200, { columns: [], entries: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const run = await runCypherQuery({
      env,
      query: "MATCH (t:teams) RETURN t.team_name",
      objectProperties: { t: ["team_name"] },
    });

    expect(run.ok).toBe(true);
    const bodies = fetchMock.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
    );
    expect(bodies[0].object_properties).toEqual({ t: ["team_name"] });
    expect(bodies[1]).not.toHaveProperty("object_properties");
  });

  it("returns the backend's refusal with its code and fix, keeping the exchange", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply(400, {
          code: "BknBackend.Cypher.SyntaxError",
          description: "unexpected token !=",
          solution: "write not-equal as <>",
        }),
      ),
    );

    const run = await runCypherQuery({ env, query: "MATCH (g:goals) WHERE g.a != 1 RETURN g" });

    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error).toEqual({
      message: "unexpected token !=",
      code: "BknBackend.Cypher.SyntaxError",
      solution: "write not-equal as <>",
    });
    expect(run.exchange.status).toBe(400);
  });
});

describe("cypherErrorFrom", () => {
  it("joins bkn-backend's description with its details", () => {
    expect(
      cypherErrorFrom(
        {
          code: "BknBackend.Cypher.SyntaxError",
          description: "Cypher 查询语法解析失败",
          solution: "请按提示位置修正查询语句。",
          details: "line 1, column 32: != is not supported",
        },
        400,
        "",
      ),
    ).toEqual({
      message: "Cypher 查询语法解析失败: line 1, column 32: != is not supported",
      code: "BknBackend.Cypher.SyntaxError",
      solution: "请按提示位置修正查询语句。",
    });
  });

  it("falls back to the text when the body is not JSON", () => {
    expect(cypherErrorFrom("gateway timeout", 504, "gateway timeout")).toEqual({
      message: "gateway timeout",
    });
    expect(cypherErrorFrom(undefined, 502, "")).toEqual({ message: "HTTP 502" });
  });
});
