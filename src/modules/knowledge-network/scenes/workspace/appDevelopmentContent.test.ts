/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { toMarkdown } from "@/modules/knowledge-network/services/app-development-guide";
import {
  cypherCall,
  queryObjectsCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import {
  buildGuide,
  capabilityEntries,
  loginCode,
  loginLanguages,
  osdkExamples,
  sampleAppCode,
  sampleAppKeyCode,
  sampleAppLayout,
} from "@/modules/knowledge-network/scenes/workspace/appDevelopmentContent";
import type { AppDevelopmentData } from "@/modules/knowledge-network/scenes/workspace/useAppDevelopmentData";

const k = (key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;

const row = {
  _instance_identity: { material_number: "367-000061" },
  _display: "367-000061",
  material_number: "367-000061",
};

const data: AppDevelopmentData = {
  platformVersion: "0.2.0",
  tools: null,
  queryObjects: {
    ...queryObjectsCall("supply", "product", row),
    objectTypeId: "product",
    name: "产品",
    row,
    properties: ["material_number"],
  },
  objectTypes: [
    { id: "bom", name: "产品BOM" },
    { id: "product", name: "产品" },
    { id: "9lives", name: "不成类名" },
  ],
  cypher: {
    call: cypherCall("supply", { id: "r", sourceId: "product", targetId: "bom" }, row, null).call,
    name: "r",
    anchored: true,
  },
  search: null,
  action: null,
  fn: null,
  oauth: {
    authorization: "https://x/oauth2/auth",
    token: "https://x/oauth2/token",
    device: "https://x/oauth2/device/auth",
    registration: "https://x/api/safe/v1/oauth/register",
  },
};

describe("capabilityEntries", () => {
  it("leaves metrics out where the edition has none, and keeps empty ones with a way out", () => {
    const entries = capabilityEntries(data, "/ws", k);
    expect(entries.map((entry) => entry.key)).toEqual([
      "queryObjects",
      "cypher",
      "search",
      "action",
      "function",
    ]);
    const search = entries.find((entry) => entry.key === "search");
    expect(search?.call).toBeNull();
    expect(search?.empty.link).toBe("/ws/object-types");
  });
});

describe("buildGuide", () => {
  it("carries every block and the three renderings of each example", () => {
    const markdown = toMarkdown(
      buildGuide({ data, knId: "supply", networkName: "供应链", origin: "https://x" }, k),
    );
    const order = [
      "start.title",
      "login.title",
      "osdk.title",
      "capabilitiesTitle",
      "agent.title",
      "mcp.title",
    ].map((heading) => markdown.indexOf(`## ${heading}\n`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markdown).toContain("export BKN_BASE_URL=https://x\nexport BKN_TOKEN=<API Key>");
    expect(markdown).toContain("#### osdk.examples.cypher.title");
    expect(markdown).toContain("kn.run_cypher(bkn.KN_ID");
    expect(markdown).toContain(
      '```bash\ncurl -X POST "https://x/api/agent-retrieval/v1/kn/run_cypher',
    );
    expect(markdown).toContain("```python\nimport os\n\nimport bkn_osdk");
    expect(markdown).toContain('token=os.environ["BKN_TOKEN"]');
    expect(markdown).toContain("```typescript\nimport { createClient }");
    expect(markdown).toContain("bkn-osdk generate supply --out ./bkn");
    // Both tools, from creating the project to generating into it.
    expect(markdown).toContain("mkdir my-app && cd my-app\npython3 -m venv .venv");
    expect(markdown).toContain("uv init --app --no-package my-app && cd my-app");
    expect(markdown).toContain("```bash\nuv run bkn-osdk generate supply --out ./bkn\n```");
    expect(markdown).toMatch(/```\nmy-app\/ +# osdk\.layout\.project\n├── \.venv\//);
    expect(markdown).toContain("├── pyproject.toml");
    expect(markdown).toContain("uv run uvicorn app:app --host 127.0.0.1 --port 8765");
    expect(markdown).toContain("https://x/api/safe/v1/oauth/register");
    expect(markdown).toContain("tokens = oauth.device_login(PLATFORM)");
    expect(markdown).toContain("    tokens = oauth.login(PLATFORM, client_id=CLIENT_ID");
    expect(markdown).toContain("## sampleApp.title");
    expect(markdown).toContain("### sampleApp.oauthTab");
    expect(markdown).toContain("### sampleApp.apiKeyTab");
    expect(markdown).toContain('API_KEY = os.environ["BKN_TOKEN"]');
    expect(markdown).toContain("uvicorn app:app --host 127.0.0.1 --port 8765");
    // Key code inline for each version, the reading with nothing generated, whole files at the end.
    expect(markdown.split("#### sampleApp.keyCode")).toHaveLength(3);
    expect(markdown.split("sampleApp.runtimeGuide")).toHaveLength(3);
    expect(markdown).toContain('sampleApp.excerptLine {"title":"sampleApp.excerpts.signIn.title"');
    expect(markdown).toContain("### sampleApp.appendix");
    expect(markdown.split("\n#### sampleApp.oauthTab · sampleApp.modes.")).toHaveLength(3);
    expect(markdown.split("\n#### sampleApp.apiKeyTab · sampleApp.modes.")).toHaveLength(3);
    // Whole files only in the appendix: the routes appear after it and nowhere before.
    const appendixAt = markdown.indexOf("### sampleApp.appendix");
    expect(markdown.indexOf("return HTMLResponse(PAGE)")).toBeGreaterThan(appendixAt);
    // Each version shows the layout to check before starting, for both tools.
    expect(markdown.split("sampleApp.layout.check")).toHaveLength(3);
    expect(markdown).toMatch(/```\nqa-app\/ +# sampleApp\.layout\.project\n├── \.venv\//);
    // A 0.2.0 platform pairs with a TypeScript SDK that cannot sign users in.
    expect(markdown).not.toContain("oauth.deviceLogin");
    expect(markdown).not.toMatch(/ory_at_|bak_/);
  });
});

describe("osdkExamples", () => {
  it("asks the search example with a name rather than a code", () => {
    const named = { ...row, material_name: "农业无人飞机" };
    const search = osdkExamples(
      { ...data, queryObjects: { ...data.queryObjects!, row: named } },
      "supply",
      "https://x",
      k,
    ).find((example) => example.key === "search");
    expect(search?.code).toContain('bkn.search("农业无人飞机"');
    expect(search?.title).toBe("osdk.examples.search.title");
  });
});

describe("sampleAppCode", () => {
  it("reads through the generated package, with no name table", () => {
    const code = sampleAppCode(data, "supply", "https://x", k, "apiKey") ?? "";
    expect(code).not.toContain("NAMES");
    expect(code).toContain("    bkn-osdk generate supply --out ./bkn\n");
    expect(code).toContain("\nimport bkn\n");
    expect(code).toContain('@app.get("/api/objects/{type_id}")');
  });

  it("reads the object types from the platform when nothing is generated", () => {
    const code = sampleAppCode(data, "supply", "https://x", k, "apiKey", "uv", "runtime") ?? "";
    expect(code).toContain("from bkn_osdk import kn\n");
    expect(code).not.toContain("bkn-osdk generate");
    expect(code).not.toContain("\nimport bkn\n");
    expect(code).toContain("result = kn.query_object_instance(KN_ID, type_id, limit=10)");
    expect(sampleAppCode(data, "supply", "https://x", k, "oauth", "uv", "runtime")).toContain(
      "from bkn_osdk import AuthError, kn, oauth\n",
    );
  });

  it("cuts the key code from the same file the page offers for download", () => {
    const code = sampleAppCode(data, "supply", "https://x", k) ?? "";
    const keyCode = sampleAppKeyCode(data, "supply", "https://x", k);
    expect(keyCode.map((excerpt) => excerpt.key)).toEqual(["objects", "agent", "signIn"]);
    expect(keyCode[0].title).toBe("sampleApp.excerpts.objects.generated.title");
    for (const excerpt of keyCode) {
      for (const part of excerpt.code.split("\n\n\n")) expect(code).toContain(part);
    }
    const apiKey = sampleAppKeyCode(data, "supply", "https://x", k, "apiKey", "venv", "runtime");
    expect(apiKey.map((excerpt) => excerpt.key)).toEqual(["objects", "agent"]);
    expect(apiKey[0].title).toBe("sampleApp.excerpts.objects.runtime.title");
  });

  it("leaves the side list out when no object type has data", () => {
    const bare = sampleAppCode({ ...data, objectTypes: [] }, "supply", "https://x", k, "apiKey");
    expect(bare).not.toContain("/api/object-types");
    expect(bare).not.toContain('id="types"');
    expect(bare).toContain("    return HTMLResponse(PAGE)");
  });

  it("shows what qa-app holds before it starts", () => {
    expect(sampleAppLayout(k, "venv", "generated")).toBe(
      [
        "qa-app/     # sampleApp.layout.project",
        "├── .venv/  # osdk.layout.venvEnv",
        "├── bkn/    # osdk.layout.package",
        "└── app.py  # sampleApp.layout.app",
      ].join("\n"),
    );
    const uv = sampleAppLayout(k, "uv", "runtime");
    expect(uv).toContain("├── pyproject.toml");
    expect(uv).toContain("├── main.py");
    expect(uv).not.toContain("bkn/");
  });
});

describe("loginLanguages", () => {
  it("offers TypeScript sign-in only where the matching SDK has it", () => {
    expect(loginLanguages(data)).toEqual(["rest", "python"]);
    expect(loginLanguages({ ...data, platformVersion: "0.2.1" })).toContain("typescript");
    expect(loginLanguages({ ...data, platformVersion: "0.2.1-main.20261101" })).toContain(
      "typescript",
    );
    expect(loginLanguages({ ...data, platformVersion: null })).toContain("typescript");
    expect(loginCode(data, "https://x", "device", "typescript", k)).toBeNull();
  });

  it("has no authorization-code sign-in without self-registration", () => {
    const closed = { ...data, platformVersion: "0.2.1", oauth: null };
    expect(loginCode(closed, "https://x", "code", "python", k)).toBeNull();
    expect(loginCode(closed, "https://x", "device", "python", k)).toContain("device_login");
    expect(sampleAppCode(closed, "supply", "https://x", k)).toBeNull();
    // The API Key version needs no registration.
    expect(sampleAppCode(closed, "supply", "https://x", k, "apiKey")).toContain("API_KEY");
  });
});
