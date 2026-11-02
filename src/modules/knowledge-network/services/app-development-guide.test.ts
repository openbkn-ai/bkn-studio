/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  guideFileName,
  toHtml,
  toMarkdown,
} from "@/modules/knowledge-network/services/app-development-guide";
import {
  cypherTable,
  registerOAuthClient,
} from "@/modules/knowledge-network/services/app-development.service";

describe("toMarkdown", () => {
  it("writes headings, lists, links and fenced code", () => {
    const text = toMarkdown([
      { kind: "heading", level: 2, text: "Get started" },
      { kind: "list", items: ["a", "b"] },
      { kind: "link", text: "API reference", href: "https://example.com/x" },
      { kind: "code", language: "bash", code: "echo hi" },
    ]);
    expect(text).toBe(
      "## Get started\n\n- a\n- b\n\n[API reference](https://example.com/x)\n\n```bash\necho hi\n```\n",
    );
  });

  it("uses a fence longer than any backquote run in the code", () => {
    const text = toMarkdown([{ kind: "code", language: "text", code: "MATCH (n:`a`) ```" }]);
    expect(text.startsWith("````\n")).toBe(true);
    expect(text.trimEnd().endsWith("\n````")).toBe(true);
  });
});

describe("toHtml", () => {
  it("escapes every text and drops links that are not http", () => {
    const html = toHtml(
      "<b>Guide</b>",
      [
        { kind: "paragraph", text: '<script>alert("x")</script>' },
        { kind: "code", language: "bash", code: "a < b && c" },
        { kind: "link", text: "bad", href: "javascript:alert(1)" },
      ],
      "zh-CN",
    );
    expect(html).toContain("<title>&lt;b&gt;Guide&lt;/b&gt;</title>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("<pre><code>a &lt; b &amp;&amp; c</code></pre>");
    expect(html).toContain('<a href="#"');
    expect(html).not.toMatch(/<script/i);
  });
});

describe("guideFileName", () => {
  it("keeps the network id safe for a file name", () => {
    expect(guideFileName("supply_ontology_hand", "md")).toBe(
      "supply_ontology_hand-app-development.md",
    );
    expect(guideFileName("a/b c", "html")).toBe("a_b_c-app-development.html");
    expect(guideFileName("世界杯", "md")).toBe("knowledge-network-app-development.md");
  });
});

describe("cypherTable", () => {
  it("shows a returned node by its key and caps the rows", () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({
      t: { kind: "object", key: { code: { type: "string", value: `m-${String(index)}` } } },
      n: index,
    }));
    const table = cypherTable({ columns: [{ name: "t" }, { name: "n" }], entries });
    expect(table.columns).toEqual(["t", "n"]);
    expect(table.rows[0]).toEqual(["code=m-0", "0"]);
    expect(table.rows).toHaveLength(20);
    expect(table.truncated).toBe(true);
  });
});

describe("registerOAuthClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the name and callback and returns the client id", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            client_id: "c-1",
            client_name: "my-app",
            redirect_uris: ["http://127.0.0.1:8765/callback"],
          }),
          { status: 201 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = await registerOAuthClient(
      "https://bkn.example.com/api/safe/v1/oauth/register",
      "my-app",
      "http://127.0.0.1:8765/callback",
    );
    expect(client).toEqual({
      clientId: "c-1",
      clientName: "my-app",
      redirectUris: ["http://127.0.0.1:8765/callback"],
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      client_name: "my-app",
      redirect_uris: ["http://127.0.0.1:8765/callback"],
    });
  });

  it("surfaces the platform's reason when a callback is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "invalid_redirect_uri",
              error_description: "use a loopback address",
            }),
            { status: 400 },
          ),
        ),
      ),
    );
    await expect(
      registerOAuthClient("https://x/register", "app", "https://app.example.com/cb"),
    ).rejects.toThrow("use a loopback address");
  });
});
