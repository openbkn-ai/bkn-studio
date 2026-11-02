/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { docsUrl } from "@/modules/knowledge-network/services/app-development-docs";
import {
  actionCall,
  cypherCall,
  queryObjectsCall,
  searchCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import {
  cypherClauses,
  defaultOAuthEndpoints,
  literal,
  renderAgentExecution,
  renderLoginPython,
  renderLoginTypeScript,
  renderClientRegistration,
  renderDeviceLogin,
  renderPython,
  renderRest,
  renderRestRequest,
  renderTypeScript,
  shellQuote,
} from "@/modules/knowledge-network/services/app-development-render";

const ORIGIN = "https://bkn.example.com";
const KN = "supply";

const productRow = {
  _instance_identity: { material_number: "367-000061" },
  material_number: "367-000061",
  material_name: "农业无人飞机",
};

const materialRow = {
  _instance_identity: { material_code: "526-000006" },
  material_code: "526-000006",
  material_name: "北斗导航农机驾驶仪",
};

const cypher = cypherCall(
  KN,
  { id: "prod2bom", sourceId: "product", targetId: "material" },
  productRow,
  materialRow,
).call;

describe("literal", () => {
  it("keeps short values on one line and breaks long ones", () => {
    expect(literal({ id: "367-000061" }, "js", "", 0)).toBe('{ id: "367-000061" }');
    expect(literal({ id: "367-000061" }, "py", "", 0)).toBe('{"id": "367-000061"}');
    expect(literal({ "kn-id": 1 }, "js", "", 0)).toBe('{ "kn-id": 1 }');
    expect(literal({ ok: true, none: null }, "py", "", 0)).toBe('{"ok": True, "none": None}');
    const long = literal({ a: "x".repeat(40), b: "y".repeat(40) }, "json", "", 0);
    expect(long).toBe(`{\n  "a": "${"x".repeat(40)}",\n  "b": "${"y".repeat(40)}"\n}`);
  });
});

describe("cypherClauses", () => {
  it("splits before RETURN and LIMIT, not inside backquotes", () => {
    expect(cypherClauses("MATCH (n:`a RETURN b`) RETURN n.`x` LIMIT 10")).toEqual([
      "MATCH (n:`a RETURN b`)",
      "RETURN n.`x`",
      "LIMIT 10",
    ]);
  });
});

describe("REST", () => {
  it("quotes the URL so zsh does not glob the query string", () => {
    const text = renderRest(ORIGIN, queryObjectsCall(KN, "product", productRow).call);
    expect(text).toContain(
      `curl -X POST "${ORIGIN}/api/agent-retrieval/v1/kn/query_object_instance?kn_id=supply&ot_id=product&response_format=json"`,
    );
    expect(text).toContain('-H "Authorization: Bearer $BKN_TOKEN"');
  });

  it("indents the JSON body under -d and breaks what does not fit", () => {
    const text = renderRest(ORIGIN, queryObjectsCall(KN, "product", productRow).call);
    expect(text).toContain(
      `  -d '{\n    "filters": [\n      { "field": "material_number", "op": "==", "value": "367-000061" }\n    ],\n    "limit": 10\n  }'`,
    );
    expect(renderRest(ORIGIN, searchCall(KN, "x"))).toContain(
      `  -d '{ "kn_id": "supply", "query": "x" }'`,
    );
  });

  it("keeps a single quote inside the body valid shell", () => {
    expect(shellQuote(`{"name":"O'Brien"}`)).toBe(`'{"name":"O'\\''Brien"}'`);
    expect(renderRest(ORIGIN, searchCall(KN, "O'Brien"))).toContain(`O'\\''Brien`);
  });

  it("shows a request without a command when REST cannot run it in one step", () => {
    const text = renderRestRequest(ORIGIN, actionCall(KN, "close", [], null));
    expect(text.startsWith(`POST ${ORIGIN}/api/agent-retrieval/v1/kn/execute_action?`)).toBe(true);
    expect(text).not.toContain("curl");
  });
});

describe("Python", () => {
  it("puts a Cypher statement in a triple-quoted constant, one clause per line", () => {
    const text = renderPython(ORIGIN, cypher);
    expect(text).toContain(`    base_url="${ORIGIN}",\n    token=os.environ["BKN_TOKEN"],`);
    expect(text).toContain(
      'QUERY = """\nMATCH (s:`product` {`material_number`: $id})-[:`prod2bom`]->(t:`material`)\nRETURN t.`material_code`, t.`material_name`\nLIMIT 10\n"""',
    );
    expect(text).toContain(
      'result = kn.run_cypher("supply", QUERY, parameters={"id": "367-000061"})',
    );
  });

  it("maps tool inputs onto bkn_osdk.kn arguments", () => {
    const action = renderPython(
      ORIGIN,
      actionCall(KN, "close", [{ name: "ok", type: "boolean" }], productRow),
    );
    expect(action).toContain("instance_identities=");
    expect(action).not.toContain("_instance_identities");
    expect(action).toContain('"ok": False');
  });
});

describe("TypeScript", () => {
  it("joins the Cypher clauses and passes the statement by shorthand", () => {
    const text = renderTypeScript(ORIGIN, cypher);
    expect(text).toContain("const bkn = createClient({\n");
    expect(text).toContain('  baseUrl: "https://bkn.example.com",\n');
    expect(text).toContain('const query = [\n  "MATCH');
    expect(text).toContain('].join("\\n");');
    expect(text).toContain(
      'bkn.context.toolCall("supply", "run_cypher", {\n  query,\n  parameters: { id: "367-000061" },\n});',
    );
  });

  it("writes keys without quotes and leaves kn_id to toolCall", () => {
    const text = renderTypeScript(ORIGIN, queryObjectsCall(KN, "product", productRow).call);
    expect(text).toContain('ot_id: "product"');
    expect(text).toContain('filters: [{ field: "material_number"');
    expect(text).not.toContain("kn_id");
  });

  it("never prints a token", () => {
    for (const text of [
      renderRest(ORIGIN, cypher),
      renderPython(ORIGIN, cypher),
      renderTypeScript(ORIGIN, cypher),
    ]) {
      expect(text).not.toMatch(/ory_at_|bak_/);
    }
  });
});

describe("BKN Agent", () => {
  it("sends the body as a heredoc that mints a request id and escapes the rest", () => {
    const text = renderAgentExecution(ORIGIN, KN, "cost $5 `now`");
    expect(text).toContain("  --data @- <<EOF\n{");
    expect(text).toContain('"agent_id": "studio_smart_qa"');
    expect(text).toContain('"client_request_id": "$(uuidgen)"');
    expect(text).toContain('"message": "cost \\$5 \\`now\\`"');
    expect(text.endsWith("\nEOF")).toBe(true);
  });
});

describe("OAuth", () => {
  const endpoints = {
    ...defaultOAuthEndpoints(ORIGIN),
    registration: `${ORIGIN}/api/safe/v1/oauth/register`,
  };

  it("walks the device flow with the public client", () => {
    const text = renderDeviceLogin(endpoints, { start: "start", poll: "poll", refresh: "refresh" });
    expect(text).toContain(`curl -X POST "${ORIGIN}/oauth2/device/auth"`);
    expect(text).toContain("-d 'client_id=openbkn-sdk'");
    expect(text).toContain("-d 'grant_type=urn:ietf:params:oauth:grant-type:device_code'");
    expect(text).toContain("-d 'grant_type=refresh_token'");
  });

  it("registers a loopback client and exchanges the code with PKCE", () => {
    const text = renderClientRegistration(endpoints, {
      register: "register",
      authorize: "authorize",
      exchange: "exchange",
    });
    expect(text).toContain(`curl -X POST "${ORIGIN}/api/safe/v1/oauth/register"`);
    expect(text).toContain('"redirect_uris": ["http://127.0.0.1:8765/callback"]');
    expect(text).toContain(
      `${ORIGIN}/oauth2/auth?response_type=code&client_id=<client_id>&redirect_uri=http://127.0.0.1:8765/callback`,
    );
    expect(text).toContain("code_challenge_method=S256");
    expect(text).toContain("-d 'code_verifier=<code_verifier>'");
  });

  const loginComments = {
    clientId: "client id",
    redirectUri: "callback",
    save: "save",
    saveWhere: "where",
    reuse: "reuse",
    login: { device: "device login", code: "code login" },
    call: "call",
    deviceClient: "device client",
    promptOpen: "open",
    promptCode: "code",
  };
  const query = queryObjectsCall("supply", "product", null).call;

  it("signs a user in with the Python SDK, which renews the tokens and hands them to save", () => {
    const text = renderLoginPython(ORIGIN, "code", query, loginComments);
    expect(text).toContain("from bkn_osdk import kn, oauth");
    expect(text).toContain('REDIRECT_URI = "http://127.0.0.1:8765/callback"  # callback');
    expect(text).toContain(
      "    tokens = oauth.login(PLATFORM, client_id=CLIENT_ID, redirect_uri=REDIRECT_URI)",
    );
    // Saved tokens are reused; a first run signs in and saves them, readable by the owner only.
    expect(text).toContain("    TOKEN_FILE.touch(mode=0o600)");
    expect(text).toContain(
      "    tokens = oauth.Tokens.from_dict(json.loads(TOKEN_FILE.read_text()))",
    );
    expect(text).toContain("    client_id=CLIENT_ID,\n    on_refresh=save,\n)");
    expect(text).toContain('result = kn.query_object_instance("supply", "product", limit=10)');
    expect(text).not.toMatch(/ory_at_|bak_/);
  });

  it("signs a device in from Python with the built-in client", () => {
    const text = renderLoginPython(ORIGIN, "device", null, loginComments);
    expect(text).toContain("    tokens = oauth.device_login(PLATFORM)");
    expect(text).toContain("bkn_osdk.configure(base_url=PLATFORM, tokens=tokens, on_refresh=save)");
    expect(text).not.toContain("CLIENT_ID");
    expect(text.trimEnd().endsWith("on_refresh=save)")).toBe(true);
  });

  it("signs a user in with the TypeScript SDK", () => {
    const code = renderLoginTypeScript(ORIGIN, "code", query, loginComments);
    expect(code).toContain('import { createClient, oauth } from "@openbkn/bkn-sdk";');
    // Saved tokens are reused; only a first run signs the user in, then saves.
    expect(code).toContain("writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });");
    expect(code).toContain('  tokens = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));');
    expect(code).toContain("  tokens = await oauth.login(PLATFORM, {");
    expect(code).toContain("  save(tokens);\n}");
    expect(code).toContain("    redirectUri: REDIRECT_URI,");
    expect(code).toContain("  tokens,\n  clientId: CLIENT_ID,\n  onTokenRefresh: save,");
    expect(code).toContain(
      'const result = await bkn.context.toolCall("supply", "query_object_instance"',
    );

    const device = renderLoginTypeScript(ORIGIN, "device", null, loginComments);
    expect(device).toContain("  tokens = await oauth.deviceLogin(PLATFORM, {");
    expect(device).toContain('console.log("code", prompt.userCode);');
    expect(device).not.toContain("CLIENT_ID");
  });

  it("passes the token explicitly in Python, as the other two do", () => {
    const text = renderPython(ORIGIN, query);
    expect(text.startsWith("import os\n\nimport bkn_osdk\nfrom bkn_osdk import kn\n")).toBe(true);
    expect(text).toContain(`base_url="${ORIGIN}"`);
    expect(text).toContain('token=os.environ["BKN_TOKEN"]');
  });
});

describe("API reference links", () => {
  it("links a release to its own version and anything else to main", () => {
    expect(docsUrl("0.2.0", "run_cypher")).toBe(
      "https://openbkn-ai.github.io/bkn-foundry/versions/v0.2.0/context-loader/cypher.html#tag/Cypher/operation/runCypher",
    );
    expect(docsUrl("0.2.1-main.20261029", "auth")).toBe(
      "https://openbkn-ai.github.io/bkn-foundry/versions/main/auth.html",
    );
    expect(docsUrl(null, "auth")).toContain("/versions/main/");
  });
});
