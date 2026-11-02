/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  apiKeyAppParts,
  joinSampleApp,
  renderApiKeyApp,
  renderSampleApp,
  SAMPLE_APP_URL,
  sampleAppExcerpts,
  sampleAppParts,
  sampleAppRunCommand,
  type SampleAppText,
} from "@/modules/knowledge-network/services/app-development-sample-app";

const text = new Proxy({} as SampleAppText, {
  get: (_target, key) => (key === "placeholder" ? '<"产品">' : String(key)),
});

const setup = {
  install: "uv add x",
  generate: "uv run bkn-osdk generate k --out ./bkn",
  run: "uv run uvicorn app:app",
};

describe("renderSampleApp", () => {
  const code = renderSampleApp("https://bkn.example.com", "supply", setup, text, true);

  it("serves where the registered callback points and says how to run it", () => {
    expect(SAMPLE_APP_URL).toBe("http://127.0.0.1:8765");
    expect(sampleAppRunCommand()).toBe("uvicorn app:app --host 127.0.0.1 --port 8765");
    expect(code).toContain('REDIRECT_URI = "http://127.0.0.1:8765/callback"');
    expect(code).toContain(
      "    uv add x\n    uv run bkn-osdk generate k --out ./bkn\n    uv run uvicorn app:app\n",
    );
  });

  it("signs in through its own callback handler and keeps tokens per browser", () => {
    expect(code).toContain("auth = oauth.authorization_request(PLATFORM, CLIENT_ID, REDIRECT_URI)");
    expect(code).toContain("sessions[sid] = oauth.exchange_code(PLATFORM, auth, code, state)");
    expect(code).toContain('response.set_cookie("sid", sid, httponly=True, samesite="lax")');
    expect(code).toContain("with refresh_lock:");
    expect(code).toContain("tokens = oauth.refresh(PLATFORM, tokens, client_id=CLIENT_ID)");
    // Signed out, every route answers 401 and the page shows the sign-in card.
    expect(code).toContain("            raise HTTPException(status_code=401)\n");
    expect(code).toContain("if (response.status === 401) return signedOut();");
  });

  it("shows neither the object types nor the chat until signed in", () => {
    // The app starts hidden, but Tailwind's `grid` would show it anyway; the rule keeps it hidden.
    expect(code).toMatch(/<div id="app" hidden class="grid /);
    expect(code).toContain("<style>[hidden] { display: none !important; }</style>");
  });

  it("still shows the page when the object types cannot be read, with the reason", () => {
    // Otherwise a failed read (a bad API key, the platform down) leaves a blank page, no error.
    expect(code).toContain(
      '  const types = await load("/api/object-types").catch((failure) => {\n' +
        '    add($("objects"), "p", "text-red-600", failure.message);\n' +
        "    return [];\n  });\n",
    );
  });

  it("serves a static page and answers with data, building no HTML in Python", () => {
    expect(code).toContain('@app.get("/")\ndef home():\n    return HTMLResponse(PAGE)');
    for (const gone of ["def card(", "def objects_html(", "def workspace(", "def relay("]) {
      expect(code).not.toContain(gone);
    }
  });

  it("lists and reads objects as the signed-in user, through the generated classes", () => {
    expect(code).toContain("\nimport bkn\n");
    expect(code).toContain("from bkn_osdk import AuthError, kn, oauth\n");
    expect(code).toContain("CLASSES = {cls.__bkn_id__: cls for cls in bkn.OBJECT_TYPES}");
    expect(code).toContain(
      "    with as_user(request):\n        listing = kn.get_object_types(KN_ID, limit=200)\n",
    );
    expect(code).toContain('if item["id"] in CLASSES and item.get("data_source")');
    expect(code).toContain(
      "    with as_user(request):\n        found, total = cls.take(10), cls.count()\n",
    );
    expect(code).toContain('    return {"rows": rows, "total": total}');
    expect(code).toContain(
      "return bkn_osdk.session(base_url=PLATFORM, token=signed_in(request).access_token)",
    );
    expect(code).not.toContain("NAMES");
  });

  it("forwards the Agent's events untouched and reads them in the page", () => {
    expect(code).toContain('        body["thread_id"] = q.thread_id');
    expect(code).toContain("upstream = open_agent(signed_in(request).access_token, q)");
    expect(code).toContain(
      "        yield from upstream.iter_raw()\n    finally:\n        upstream.close()",
    );
    expect(code).toContain(
      'return StreamingResponse(forward(upstream), media_type="text/event-stream")',
    );
    expect(code).toContain('const events = buffer.split("\\n\\n");');
    expect(code).toContain('if (name === "meta") thread = data.thread_id;');
    expect(code).toContain('if (name === "result") show(answer, data.content.answer);');
  });

  it("styles the page with Tailwind and renders answers safely", () => {
    expect(code).toContain('<script src="https://cdn.tailwindcss.com/3.4.16?plugins=typography">');
    expect(code).toContain("DOMPurify.sanitize(marked.parse(markdown))");
    expect(code).toContain('PAGE = r"""');
    expect(code).toContain('placeholder="&#60;&#34;产品&#34;&#62;"');
    expect(code).toContain("aria-[current=page]:bg-blue-50");
    // Columns in a steady order whatever order the platform sends; cells are text, never markup.
    expect(code).toContain('.filter((key) => !key.startsWith("_")).sort();');
    expect(code).toContain("element.textContent = text;");
  });

  it("reads with no generated code when asked to", () => {
    const runtime = renderSampleApp(
      "https://bkn.example.com",
      "supply",
      { install: "pip install x", run: "uvicorn app:app" },
      text,
      true,
      "runtime",
    );
    expect(runtime).toContain("    pip install x\n    uvicorn app:app\n");
    expect(runtime).toContain(
      "    with as_user(request):\n        result = kn.query_object_instance(KN_ID, type_id, limit=10)\n",
    );
    expect(runtime).toContain('return {"rows": result["datas"], "total": result["total_count"]}');
    expect(runtime).not.toContain("CLASSES");
    expect(runtime).not.toContain("import bkn\n");
  });

  it("is the chat alone when there is no object type to read", () => {
    const bare = renderSampleApp("https://bkn.example.com", "supply", setup, text);
    expect(bare).not.toContain("/api/object-types");
    expect(bare).not.toContain("as_user");
    expect(bare).not.toContain('id="types"');
    expect(bare).toContain("from bkn_osdk import AuthError, oauth\n");
    expect(bare).toContain('$("app").hidden = false;');
  });
});

describe("renderApiKeyApp", () => {
  const code = renderApiKeyApp("https://bkn.example.com", "supply", setup, text, true);

  it("reads and asks with the app's key from the server's environment, with no sign-in", () => {
    expect(code).toContain('API_KEY = os.environ["BKN_TOKEN"]');
    expect(code).toContain("bkn_osdk.configure(base_url=PLATFORM, token=API_KEY)");
    expect(code).toContain("    upstream = open_agent(API_KEY, q)");
    expect(code).toContain(
      'def object_types():\n    """generatedTypes"""\n    listing = kn.get_object_types(KN_ID, limit=200)\n',
    );
    expect(code).toContain("from bkn_osdk import kn\n");
    for (const gone of ["oauth", "/logout", "signedOut", "as_user", "HTTPException"]) {
      expect(code).not.toContain(gone);
    }
  });
});

describe("sampleAppExcerpts", () => {
  it("shows the code that deals with the platform, part for part as the file has it", () => {
    const parts = sampleAppParts("https://bkn.example.com", "supply", setup, text, true);
    const code = joinSampleApp(parts);
    const excerpts = sampleAppExcerpts(parts);
    expect(excerpts.map((excerpt) => excerpt.key)).toEqual(["objects", "agent", "signIn"]);
    for (const excerpt of excerpts) {
      for (const part of excerpt.code.split("\n\n\n")) expect(code).toContain(part);
    }
    const [reading, agent, signIn] = excerpts.map((excerpt) => excerpt.code);
    expect(reading).toMatch(/^CLASSES = /);
    expect(reading).toContain('@app.get("/api/objects/{type_id}")');
    expect(agent).toMatch(/^class Question\(BaseModel\):/);
    expect(agent).toContain('@app.post("/ask")');
    // Sign-in, reading as the user, and the callback; not the page or the chat route.
    expect(signIn).toContain("def signed_in(request: Request)");
    expect(signIn).toContain("def as_user(request: Request):");
    expect(signIn).toContain('@app.get("/callback")');
    expect(signIn).not.toContain('@app.get("/")');
    expect(signIn).not.toContain('@app.post("/ask")');
  });

  it("has no sign-in to show without OAuth, and no reading without object types", () => {
    const apiKey = sampleAppExcerpts(apiKeyAppParts("https://x", "supply", setup, text, true));
    expect(apiKey.map((excerpt) => excerpt.key)).toEqual(["objects", "agent"]);
    const bare = sampleAppExcerpts(sampleAppParts("https://x", "supply", setup, text));
    expect(bare.map((excerpt) => excerpt.key)).toEqual(["agent", "signIn"]);
  });
});
