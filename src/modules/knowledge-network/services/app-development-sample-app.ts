/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * A whole sample app, as one `app.py`: a FastAPI app serving one static page, whose script lists
 * the network's object types in a side list, shows the first rows of the one picked, and chats with
 * the platform's Q&A Agent (several turns, answers shown as they are written, Markdown rendered,
 * styled with Tailwind from a CDN).
 *
 * The Python only answers with data, so what it shows is how to use the platform: two JSON routes
 * for objects, and one that forwards the Agent's event stream untouched. Two choices, made
 * independently. Whose token: the signed-in user's (OAuth, taking the callback in its own handler
 * with `authorization_request` + `exchange_code`) or the app's API Key. How objects are read:
 * through the package `bkn-osdk generate` made (typed classes, named from the platform's listing,
 * which the classes do not carry), or with no generated code at all.
 */

import {
  EXAMPLE_REDIRECT_URI,
  SMART_QA_AGENT,
} from "@/modules/knowledge-network/services/app-development-render";

export type SampleAppText = {
  /** Docstrings: what the file is, how to run it, where to open it (`{{url}}` filled in). */
  title: string;
  run: string;
  open: string;
  apiKeyTitle: string;
  apiKeyOpen: string;
  apiKeyComment: string;
  /** Comments shared by both versions. */
  agent: string;
  thread: string;
  forward: string;
  page: string;
  /** Comments of the generated-package reading. */
  generatedTypes: string;
  generatedTable: string;
  /** Comments of the reading with no generated code. */
  listTypes: string;
  runtimeTable: string;
  /** Comments of the OAuth version. */
  clientId: string;
  redirectUri: string;
  memory: string;
  pending: string;
  sessions: string;
  lock: string;
  refresh: string;
  login: string;
  callback: string;
  asUser: string;
  signedIn: string;
  /** Text on the page. */
  pageTitle: string;
  chatTitle: string;
  objectTypes: string;
  readFailed: string;
  signInHint: string;
  signIn: string;
  signOut: string;
  newChat: string;
  submit: string;
  placeholder: string;
  thinking: string;
  using: string;
  failed: string;
  notSignedIn: string;
  retry: string;
  noAnswer: string;
};

/**
 * What the docstring tells someone to run: install, generate the Ontology SDK (not when reading
 * with no generated code), start.
 */
export type SampleAppSetup = { install: string; generate?: string; run: string };

/** Read through the generated package, or with no generated code at all. */
export type SampleAppMode = "generated" | "runtime";

/** The page is served where the registered callback points, so the cookie survives the trip. */
export const SAMPLE_APP_URL = new URL(EXAMPLE_REDIRECT_URI).origin;

export function sampleAppRunCommand() {
  const { hostname, port } = new URL(EXAMPLE_REDIRECT_URI);
  return `uvicorn app:app --host ${hostname} --port ${port}`;
}

/**
 * The file is built from parts, joined by the two blank lines between top-level definitions. A part
 * marked with an excerpt key is also shown on its own: the code that deals with the platform, as
 * opposed to the page and the routes around it.
 */
export type SampleAppExcerptKey = "objects" | "agent" | "signIn";
export type SampleAppPart = { code: string; excerpt?: SampleAppExcerptKey };
export type SampleAppExcerpt = { key: SampleAppExcerptKey; code: string };

const EXCERPT_ORDER: SampleAppExcerptKey[] = ["objects", "agent", "signIn"];

export function joinSampleApp(parts: SampleAppPart[]) {
  return `${parts.map((part) => part.code).join("\n\n\n")}\n`;
}

/** Each excerpt is its parts in file order, so it is exactly what the file holds. */
export function sampleAppExcerpts(parts: SampleAppPart[]): SampleAppExcerpt[] {
  return EXCERPT_ORDER.flatMap((key) => {
    const mine = parts.filter((part) => part.excerpt === key);
    if (mine.length === 0) return [];
    return [{ key, code: mine.map((part) => part.code).join("\n\n\n") }];
  });
}

const TAILWIND = "https://cdn.tailwindcss.com/3.4.16?plugins=typography";
const MARKED = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";
const DOMPURIFY = "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js";

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
/** The side list stays in view while the page scrolls. */
const SIDE =
  "self-start rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:sticky md:top-6";
/** A side-list entry; `aria-current` marks the object type shown. */
const LINK =
  "block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 aria-[current=page]:bg-blue-50 aria-[current=page]:font-medium aria-[current=page]:text-blue-700";
const BUTTON = "rounded-xl bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700";
const INPUT =
  "flex-1 rounded-xl border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const CELL = "whitespace-nowrap border-b border-slate-100 px-3 py-2";

/** Text for HTML, and for a Python string literal that holds HTML. */
function h(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const s = (value: string) => JSON.stringify(value);

/**
 * The page: static HTML, and a script that draws it from the app's JSON routes. Signed out (OAuth,
 * any route answering 401), it shows the sign-in card instead. The chat reads the Agent's own
 * events: `meta` keeps the conversation going, `tool_started` is what the Agent looked up, `token`
 * is the answer as it is written (text before a tool call is progress and gets replaced),
 * `result` is final.
 */
function pyPage(text: SampleAppText, oauth: boolean, objects: boolean) {
  const lines = (on: boolean, value: string) => (on ? value : "");
  return `# ${text.page}
PAGE = r"""<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(text.pageTitle)}</title>
<script src="${TAILWIND}"></script>
<style>[hidden] { display: none !important; }</style>
<body class="min-h-screen bg-slate-50 text-slate-800">
<main class="mx-auto max-w-6xl space-y-6 px-4 py-10">
<h1 class="text-2xl font-semibold tracking-tight">${h(text.pageTitle)}</h1>${lines(
    oauth,
    `
<section id="signin" hidden class="${CARD}">
  <p class="mb-4 text-slate-500">${h(text.signInHint)}</p>
  <a href="/login" class="${BUTTON}">${h(text.signIn)}</a>
</section>`,
  )}
<div id="app" hidden class="grid gap-6${objects ? " md:grid-cols-[13rem_minmax(0,1fr)]" : ""}">${lines(
    objects,
    `
  <aside class="${SIDE}">
    <h2 class="mb-2 px-3 text-xs font-medium text-slate-400">${h(text.objectTypes)}</h2>
    <nav id="types" class="space-y-0.5"></nav>
  </aside>`,
  )}
  <div class="min-w-0 space-y-6">${lines(
    objects,
    `
    <section id="objects" class="${CARD}"></section>`,
  )}
    <section class="${CARD}">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-medium">${h(text.chatTitle)}</h2>
        <nav class="flex gap-4 text-sm text-slate-500">
          <a href="#" id="reset" class="hover:text-blue-600">${h(text.newChat)}</a>${lines(
            oauth,
            `
          <a href="/logout" class="hover:text-blue-600">${h(text.signOut)}</a>`,
          )}
        </nav>
      </div>
      <div id="log" class="space-y-4"></div>
      <form id="ask" class="mt-5 flex gap-2">
        <input id="question" placeholder="${h(text.placeholder)}" autocomplete="off" required class="${INPUT}">
        <button class="${BUTTON}">${h(text.submit)}</button>
      </form>
    </section>
  </div>
</div>
</main>
<script src="${MARKED}"></script>
<script src="${DOMPURIFY}"></script>
<script>
const $ = (id) => document.getElementById(id);
const add = (parent, tag, className, text = "") => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
};${lines(
    oauth,
    `
const signedOut = () => {
  $("app").hidden = true;
  $("signin").hidden = false;
};`,
  )}
async function load(url) {
  const response = await fetch(url);${lines(
    oauth,
    `
  if (response.status === 401) return signedOut();`,
  )}
  if (!response.ok) throw new Error(${s(text.readFailed)} + response.status);
  return response.json();
}${lines(
    objects,
    `
async function showObjects(type, link) {
  for (const other of $("types").children) other.removeAttribute("aria-current");
  link.setAttribute("aria-current", "page");
  const box = $("objects");
  try {
    const data = await load("/api/objects/" + encodeURIComponent(type.id));
    if (!data) return;
    const columns = Object.keys(data.rows[0] ?? {}).filter((key) => !key.startsWith("_")).sort();
    box.replaceChildren();
    const title = add(box, "h2", "mb-3 font-medium", type.name + " ");
    add(title, "span", "text-sm font-normal text-slate-400", data.rows.length + " / " + data.total);
    const table = add(add(box, "div", "overflow-x-auto"), "table", "min-w-full text-sm");
    const head = add(add(table, "thead", ""), "tr", "");
    for (const column of columns) add(head, "th", "${CELL} text-left font-medium text-slate-500", column);
    const body = add(table, "tbody", "");
    for (const row of data.rows) {
      const line = add(body, "tr", "");
      for (const column of columns) add(line, "td", "${CELL}", row[column] ?? "");
    }
  } catch (failure) {
    box.replaceChildren();
    add(box, "p", "text-red-600", failure.message);
  }
}`,
  )}
async function start() {${lines(
    objects,
    `
  const types = await load("/api/object-types").catch((failure) => {
    add($("objects"), "p", "text-red-600", failure.message);
    return [];
  });
  if (!types) return;
  for (const type of types) {
    const link = add($("types"), "button", "${LINK}", type.name);
    link.onclick = () => showObjects(type, link);
  }
  $("types").firstChild?.click();`,
  )}
  $("app").hidden = false;
}
let thread = null;
const show = (element, markdown) => {
  element.innerHTML = DOMPurify.sanitize(marked.parse(markdown));
};
$("reset").onclick = (event) => {
  event.preventDefault();
  thread = null;
  $("log").replaceChildren();
};
$("ask").onsubmit = async (event) => {
  event.preventDefault();
  const question = $("question").value.trim();
  if (!question) return;
  $("question").value = "";
  add($("log"), "div", "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white", question);
  const turn = add($("log"), "div", "max-w-[85%] space-y-1");
  const steps = add(turn, "div", "text-xs text-slate-400");
  const answer = add(turn, "div", "prose prose-sm prose-slate max-w-none rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2", ${s(text.thinking)});
  answer.scrollIntoView({ block: "end", behavior: "smooth" });
  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, thread_id: thread }),
  });${lines(
    oauth,
    `
  if (response.status === 401) return signedOut();`,
  )}
  if (!response.ok) {
    answer.textContent = ${s(text.failed)} + response.status;
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let written = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split("\\n\\n");
    buffer = events.pop();
    for (const event of events) {
      const name = event.match(/^event: (.*)$/m)?.[1];
      const data = JSON.parse(event.match(/^data: (.*)$/m)?.[1] ?? "{}");
      if (name === "meta") thread = data.thread_id;
      if (name === "tool_started") {
        steps.textContent += (steps.textContent ? " → " : ${s(text.using)}) + data.name;
        written = "";
        answer.textContent = ${s(text.thinking)};
      }
      if (name === "token") show(answer, (written += data.content));
      if (name === "result") show(answer, data.content.answer);
      if (name === "terminal" && data.status !== "succeeded") {
        answer.textContent = ${s(text.noAnswer)} + (data.error?.detail ?? "");
      }
    }
  }
};
start();
</script>
"""`;
}

/** Four more spaces in front of each non-empty line. */
function indent(code: string) {
  return code.replace(/^(?=.)/gm, "    ");
}

/**
 * One route body with its platform calls inside `with as_user(request):` in the OAuth version, so
 * each person reads with their own permissions; the API Key version makes the same calls plainly.
 */
function route(oauth: boolean, before: string, calls: string, after: string) {
  return [before, oauth ? `with as_user(request):\n${indent(calls)}` : calls, after]
    .filter(Boolean)
    .map(indent)
    .join("\n");
}

/** The two routes the side list and the table read, as the version's identity. */
function pyObjects(text: SampleAppText, oauth: boolean, mode: SampleAppMode): SampleAppPart {
  const typesParams = oauth ? "request: Request" : "";
  const rowsParams = oauth ? "request: Request, type_id: str" : "type_id: str";
  const keep =
    mode === "generated"
      ? `item["id"] in CLASSES and item.get("data_source")`
      : `item.get("data_source")`;
  const types = `@app.get("/api/object-types")
def object_types(${typesParams}):
    """${mode === "generated" ? text.generatedTypes : text.listTypes}"""
${route(
  oauth,
  "",
  "listing = kn.get_object_types(KN_ID, limit=200)",
  `return [
    {"id": item["id"], "name": item.get("name") or item["id"]}
    for item in listing["object_types"]
    if ${keep}
]`,
)}`;
  const rows =
    mode === "generated"
      ? `@app.get("/api/objects/{type_id}")
def objects(${rowsParams}):
    """${text.generatedTable}"""
${route(
  oauth,
  `cls = CLASSES[type_id]
props = cls.__properties__()`,
  "found, total = cls.take(10), cls.count()",
  `rows = [{prop.bkn_id: getattr(row, prop.attribute) for prop in props} for row in found]
return {"rows": rows, "total": total}`,
)}`
      : `@app.get("/api/objects/{type_id}")
def objects(${rowsParams}):
    """${text.runtimeTable}"""
${route(
  oauth,
  "",
  "result = kn.query_object_instance(KN_ID, type_id, limit=10)",
  `return {"rows": result["datas"], "total": result["total_count"]}`,
)}`;
  const classes =
    mode === "generated" ? "CLASSES = {cls.__bkn_id__: cls for cls in bkn.OBJECT_TYPES}\n\n\n" : "";
  return { code: `${classes}${types}\n\n\n${rows}`, excerpt: "objects" };
}

/** Asking the Agent and handing its event stream to the page untouched. */
function pyAgent(text: SampleAppText, oauth: boolean): SampleAppPart {
  return {
    code: `class Question(BaseModel):
    question: str
    thread_id: str | None = None


def open_agent(token: str, q: Question) -> httpx.Response:
    body = {
        "agent_id": AGENT_ID,
        "message": q.question,
        "client_request_id": str(uuid.uuid4()),
        "context": {"kn_id": KN_ID},
    }
    if q.thread_id:
        body["thread_id"] = q.thread_id  # ${text.thread}
    request = client.build_request(
        "POST",
        f"{PLATFORM}/api/bkn-agent/v1/executions",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    )
    return client.send(request, stream=True)


def forward(upstream: httpx.Response):
    """${text.forward}"""
    try:
        yield from upstream.iter_raw()
    finally:
        upstream.close()


@app.post("/ask")
def ask(${oauth ? "request: Request, " : ""}q: Question):
    upstream = open_agent(${oauth ? "signed_in(request).access_token" : "API_KEY"}, q)
    if upstream.is_error:
        upstream.close()
        return Response(status_code=upstream.status_code)
    return StreamingResponse(forward(upstream), media_type="text/event-stream")`,
    excerpt: "agent",
  };
}

function docstring(title: string, run: string, open: string, setup: SampleAppSetup) {
  const lines = [
    setup.install,
    ...(setup.generate ? [setup.generate] : []),
    ...setup.run.split("\n"),
  ];
  return `"""${title}

${run}
${lines.map((line) => `    ${line}`).join("\n")}
${open}
"""`;
}

/** The generated package sits next to `app.py`, so it imports as a local package, after the rest. */
function generatedImport(objects: boolean, mode: SampleAppMode) {
  return objects && mode === "generated" ? "\nimport bkn\n" : "";
}

/** What the version takes from `bkn_osdk` besides the module itself. */
function osdkNames(objects: boolean, own: string[]) {
  const names = [...own, ...(objects ? ["kn"] : [])];
  return names.length > 0 ? `from bkn_osdk import ${names.sort().join(", ")}\n` : "";
}

const HOME = `@app.get("/")
def home():
    return HTMLResponse(PAGE)`;

/**
 * The same page without sign-in: the app reads and asks with its own API Key, so everyone who can
 * open the page uses the key owner's permissions. The key stays on the server.
 */
export function apiKeyAppParts(
  origin: string,
  knId: string,
  setup: SampleAppSetup,
  text: SampleAppText,
  objects = false,
  mode: SampleAppMode = "generated",
): SampleAppPart[] {
  return [
    {
      code: `${docstring(text.apiKeyTitle, text.run, text.apiKeyOpen, setup)}

import os
import uuid

import bkn_osdk
import httpx
${osdkNames(objects, [])}from fastapi import FastAPI
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel
${generatedImport(objects, mode)}
PLATFORM = ${s(origin)}
API_KEY = os.environ["BKN_TOKEN"]  # ${text.apiKeyComment}
KN_ID = ${s(knId)}
AGENT_ID = ${s(SMART_QA_AGENT)}  # ${text.agent}

bkn_osdk.configure(base_url=PLATFORM, token=API_KEY)
app = FastAPI()
client = httpx.Client(timeout=300)`,
    },
    { code: pyPage(text, false, objects) },
    { code: HOME },
    ...(objects ? [pyObjects(text, false, mode)] : []),
    pyAgent(text, false),
  ];
}

export function renderApiKeyApp(...args: Parameters<typeof apiKeyAppParts>) {
  return joinSampleApp(apiKeyAppParts(...args));
}

export function sampleAppParts(
  origin: string,
  knId: string,
  setup: SampleAppSetup,
  text: SampleAppText,
  objects = false,
  mode: SampleAppMode = "generated",
): SampleAppPart[] {
  return [
    {
      code: `${docstring(text.title, text.run, text.open, setup)}

import html
import secrets
import threading
import uuid

import bkn_osdk
import httpx
${osdkNames(objects, ["AuthError", "oauth"])}from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel
${generatedImport(objects, mode)}
PLATFORM = ${s(origin)}
CLIENT_ID = "<client_id>"  # ${text.clientId}
REDIRECT_URI = ${s(EXAMPLE_REDIRECT_URI)}  # ${text.redirectUri}
KN_ID = ${s(knId)}
AGENT_ID = ${s(SMART_QA_AGENT)}  # ${text.agent}

app = FastAPI()
client = httpx.Client(timeout=300)

# ${text.memory}
pending: dict[str, oauth.AuthorizationRequest] = {}  # ${text.pending}
sessions: dict[str, oauth.Tokens] = {}  # ${text.sessions}
# ${text.lock}
refresh_lock = threading.Lock()`,
    },
    { code: pyPage(text, true, objects) },
    { code: HOME },
    {
      code: `def signed_in(request: Request) -> oauth.Tokens:
    """${text.signedIn}"""
    sid = request.cookies.get("sid", "")
    with refresh_lock:
        tokens = sessions.get(sid)
        if tokens is None:
            raise HTTPException(status_code=401)
        if tokens.expires_within(60):
            # ${text.refresh}
            try:
                tokens = oauth.refresh(PLATFORM, tokens, client_id=CLIENT_ID)
            except AuthError:
                sessions.pop(sid, None)
                raise HTTPException(status_code=401) from None
            sessions[sid] = tokens
        return tokens${
          objects
            ? `


def as_user(request: Request):
    """${text.asUser}"""
    return bkn_osdk.session(base_url=PLATFORM, token=signed_in(request).access_token)`
            : ""
        }`,
      excerpt: "signIn",
    },
    ...(objects ? [pyObjects(text, true, mode)] : []),
    pyAgent(text, true),
    {
      code: `@app.get("/login")
def login():
    # ${text.login}
    auth = oauth.authorization_request(PLATFORM, CLIENT_ID, REDIRECT_URI)
    sid = secrets.token_urlsafe(32)
    pending[sid] = auth
    response = RedirectResponse(auth.url)
    response.set_cookie("sid", sid, httponly=True, samesite="lax")
    return response


@app.get("/callback")
def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    sid = request.cookies.get("sid", "")
    auth = pending.pop(sid, None)
    try:
        if error or auth is None:
            raise AuthError(error or "no sign-in in progress")
        # ${text.callback}
        sessions[sid] = oauth.exchange_code(PLATFORM, auth, code, state)
    except AuthError as failure:
        reason = html.escape(str(failure))
        return HTMLResponse(f'${h(text.notSignedIn)}{reason} <a href="/login">${h(text.retry)}</a>')
    return RedirectResponse("/")`,
      excerpt: "signIn",
    },
    {
      code: `@app.get("/logout")
def logout(request: Request):
    sessions.pop(request.cookies.get("sid", ""), None)
    response = RedirectResponse("/")
    response.delete_cookie("sid")
    return response`,
    },
  ];
}

export function renderSampleApp(...args: Parameters<typeof sampleAppParts>) {
  return joinSampleApp(sampleAppParts(...args));
}
