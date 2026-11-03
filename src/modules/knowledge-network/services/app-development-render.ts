/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Renders the App development page's examples as code a person would write: short values on one
 * line, longer ones broken, keys unquoted where the language allows, Cypher split into clauses.
 */

import {
  REST_KN_PREFIX,
  toolInput,
  type ToolCall,
} from "@/modules/knowledge-network/services/app-development-examples";

/** Lines are kept within this width where a value can be broken. */
const WIDTH = 80;

type Style = "json" | "js" | "py";

/** Code emitted as is, such as a variable name. */
export class Raw {
  constructor(readonly code: string) {}
}

const JS_IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function scalar(value: unknown, style: Style): string {
  if (value === null || value === undefined) return style === "py" ? "None" : "null";
  if (typeof value === "boolean") {
    if (style === "py") return value ? "True" : "False";
    return value ? "true" : "false";
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  // A JSON string literal is valid in all three languages; anything else is shown as JSON.
  return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(JSON.stringify(value));
}

function key(name: string, style: Style) {
  return style === "js" && JS_IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

function isContainer(value: unknown): value is unknown[] | Record<string, unknown> {
  return typeof value === "object" && value !== null && !(value instanceof Raw);
}

function entry(name: string, value: unknown, style: Style, render: (v: unknown) => string) {
  if (style === "js" && value instanceof Raw && value.code === name) return name;
  return `${key(name, style)}: ${render(value)}`;
}

function inline(value: unknown, style: Style): string {
  if (value instanceof Raw) return value.code;
  if (!isContainer(value)) return scalar(value, style);
  if (Array.isArray(value)) return `[${value.map((item) => inline(item, style)).join(", ")}]`;
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const body = entries
    .map(([name, item]) => entry(name, item, style, (v) => inline(v, style)))
    .join(", ");
  return style === "py" ? `{${body}}` : `{ ${body} }`;
}

/**
 * One value at `indent`, with `used` characters already on its first line. It stays on one line
 * when that line fits; otherwise each element gets a line of its own.
 */
export function literal(value: unknown, style: Style, indent: string, used: number): string {
  const one = inline(value, style);
  if (!isContainer(value) || used + one.length <= WIDTH) return one;
  const unit = style === "py" ? "    " : "  ";
  const inner = indent + unit;
  const comma = style === "json" ? "" : ",";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const lines = value.map(
      (item, index) =>
        `${inner}${literal(item, style, inner, inner.length)}${index < value.length - 1 ? "," : comma}`,
    );
    return `[\n${lines.join("\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  const lines = entries.map(([name, item], index) => {
    const head = `${key(name, style)}: `;
    const text = entry(name, item, style, (v) =>
      literal(v, style, inner, inner.length + head.length),
    );
    return `${inner}${text}${index < entries.length - 1 ? "," : comma}`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}

/* ============================ Cypher ============================ */

/** Splits a one-line statement before RETURN and LIMIT, outside quotes and backquotes. */
export function cypherClauses(statement: string): string[] {
  const clauses: string[] = [];
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "`" || char === '"' || char === "'") {
      quote = char;
      continue;
    }
    const rest = statement.slice(index);
    if (char === " " && /^ (RETURN|LIMIT) /.test(rest)) {
      clauses.push(statement.slice(start, index));
      start = index + 1;
    }
  }
  clauses.push(statement.slice(start));
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

/* ============================ Shell ============================ */

/** Single-quotes a shell word; a quote inside it is closed, escaped and reopened. */
export function shellQuote(text: string) {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

function restUrl(origin: string, call: ToolCall) {
  const params = new URLSearchParams({ ...call.query, response_format: "json" });
  // URLSearchParams escapes everything; ids are readable without it, so keep ":" and "," as is.
  const search = params.toString().replace(/%3A/gi, ":").replace(/%2C/gi, ",");
  return `${origin}${REST_KN_PREFIX}/${call.tool}?${search}`;
}

/** The URL is double-quoted: zsh, the macOS default, treats an unquoted `?` as a glob. */
export function renderRest(origin: string, call: ToolCall) {
  const data = "  -d ";
  return [
    `curl -X POST "${restUrl(origin, call)}" \\`,
    `  -H "Authorization: Bearer $BKN_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `${data}${shellQuote(literal(call.body, "json", "  ", data.length + 1))}`,
  ].join("\n");
}

/** For calls REST cannot make in one step: the endpoint and the body, nothing to run. */
export function renderRestRequest(origin: string, call: ToolCall) {
  return [
    `POST ${restUrl(origin, call)}`,
    "Content-Type: application/json",
    "",
    literal(call.body, "json", "", 0),
  ].join("\n");
}

/* ============================ Python ============================ */

/** How each tool's input maps onto the `bkn_osdk.kn` function of the same name. */
const PYTHON_SIGNATURES: Record<string, { positional: string[]; rename?: Record<string, string> }> =
  {
    query_object_instance: { positional: ["kn_id", "ot_id"] },
    run_cypher: { positional: ["kn_id", "query"] },
    search_instance: { positional: ["kn_id", "query"] },
    query_metric: { positional: ["kn_id", "metric_id", "version"] },
    execute_action: {
      positional: ["kn_id", "at_id"],
      rename: { _instance_identities: "instance_identities" },
    },
    execute_tool: { positional: ["kn_id", "toolbox_id", "tool_id", "arguments"] },
  };

function pythonCall(head: string, args: Array<[string | null, unknown]>) {
  const one = `${head}(${args
    .map(([name, value]) => (name ? `${name}=${inline(value, "py")}` : inline(value, "py")))
    .join(", ")})`;
  if (one.length <= WIDTH) return one;
  const lines = args.map(([name, value]) => {
    const prefix = name ? `${name}=` : "";
    return `    ${prefix}${literal(value, "py", "    ", 4 + prefix.length + 1)},`;
  });
  return `${head}(\n${lines.join("\n")}\n)`;
}

/** A statement as a triple-quoted constant, unless its text would need escaping there. */
export function pythonQuery(statement: string) {
  if (statement.includes('"""') || statement.includes("\\")) return null;
  return `QUERY = """\n${cypherClauses(statement).join("\n")}\n"""`;
}

/** The lines that make the call, ending in `result = …`; shared with the login program. */
function pythonToolLines(call: ToolCall) {
  const signature = PYTHON_SIGNATURES[call.tool] ?? { positional: [] };
  const input = toolInput(call);
  const prelude: string[] = [];
  if (call.tool === "run_cypher" && typeof input.query === "string") {
    const constant = pythonQuery(input.query);
    if (constant) {
      prelude.push(constant, "");
      input.query = new Raw("QUERY");
    }
  }
  const args: Array<[string | null, unknown]> = signature.positional.map((name) => [
    null,
    input[name],
  ]);
  for (const [name, value] of Object.entries(input)) {
    if (signature.positional.includes(name)) continue;
    args.push([signature.rename?.[name] ?? name, value]);
  }
  return [...prelude, `result = ${pythonCall(`kn.${call.tool}`, args)}`];
}

/**
 * Platform and token, passed explicitly as the TypeScript and REST examples do: the SDK would
 * otherwise find them itself, which reads as if the example forgot the token.
 */
export function pythonConfigure(origin: string) {
  return pythonCall("bkn_osdk.configure", [
    ["base_url", origin],
    ["token", new Raw('os.environ["BKN_TOKEN"]')],
  ]);
}

export function renderPython(origin: string, call: ToolCall) {
  return [
    "import os",
    "",
    "import bkn_osdk",
    "from bkn_osdk import kn",
    "",
    pythonConfigure(origin),
    "",
    ...pythonToolLines(call),
    "print(result)",
  ].join("\n");
}

/* ============================ TypeScript ============================ */

/** `toolCall` binds the network, so `kn_id` leaves the arguments. */
function typeScriptToolLines(call: ToolCall) {
  const args: Record<string, unknown> = Object.fromEntries(
    Object.entries(toolInput(call)).filter(([name]) => name !== "kn_id"),
  );
  const prelude: string[] = [];
  if (call.tool === "run_cypher" && typeof args.query === "string") {
    const clauses = cypherClauses(args.query);
    prelude.push(
      "const query = [",
      ...clauses.map((clause) => `  ${JSON.stringify(clause)},`),
      '].join("\\n");',
      "",
    );
    args.query = new Raw("query");
  }
  const head = `const result = await bkn.context.toolCall(${JSON.stringify(call.knId)}, ${JSON.stringify(call.tool)}, `;
  return [...prelude, `${head}${literal(args, "js", "", head.length)});`];
}

export function renderTypeScript(origin: string, call: ToolCall) {
  return [
    'import { createClient } from "@openbkn/bkn-sdk";',
    "",
    "const bkn = createClient({",
    `  baseUrl: ${JSON.stringify(origin)},`,
    "  token: process.env.BKN_TOKEN,",
    "});",
    "",
    ...typeScriptToolLines(call),
    "console.log(JSON.stringify(result, null, 2));",
  ].join("\n");
}

/* ============================ BKN Agent ============================ */

/** The preset Agent behind the workspace's smart Q&A. */
export const SMART_QA_AGENT = "studio_smart_qa";

const REQUEST_ID_MARK = "__client_request_id__";

/**
 * A heredoc keeps the body readable and still lets the shell mint a request id. The heredoc is
 * unquoted, so every `\`, `$` and backquote in the JSON is escaped except the one substitution.
 */
export function renderAgentExecution(origin: string, knId: string, question: string) {
  const body = literal(
    {
      agent_id: SMART_QA_AGENT,
      message: question,
      client_request_id: REQUEST_ID_MARK,
      context: { kn_id: knId },
    },
    "json",
    "",
    0,
  )
    .replace(/[\\$`]/g, (char) => `\\${char}`)
    .replace(`"${REQUEST_ID_MARK}"`, '"$(uuidgen)"');
  return [
    `curl -N -X POST "${origin}/api/bkn-agent/v1/executions" \\`,
    `  -H "Authorization: Bearer $BKN_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    "  --data @- <<EOF",
    body,
    "EOF",
  ].join("\n");
}

/* ============================ OAuth ============================ */

export type OAuthEndpoints = {
  authorization: string;
  token: string;
  /** Absent when the deployment does not publish a device authorization endpoint. */
  device?: string;
  /** Absent when the deployment does not let clients register themselves. */
  registration?: string;
};

/** The public client every deployment ships for the device flow; it needs no registration. */
export const PUBLIC_CLIENT_ID = "openbkn-sdk";

function form(url: string, fields: Array<[string, string]>) {
  return [
    `curl -X POST "${url}" \\`,
    ...fields.map(
      ([name, value], index) =>
        `  -d ${shellQuote(`${name}=${value}`)}${index < fields.length - 1 ? " \\" : ""}`,
    ),
  ].join("\n");
}

export function renderDeviceLogin(
  endpoints: OAuthEndpoints & { device: string },
  comments: { start: string; poll: string; refresh: string },
) {
  return [
    `# ${comments.start}`,
    form(endpoints.device, [
      ["client_id", PUBLIC_CLIENT_ID],
      ["scope", "openid offline"],
    ]),
    "",
    `# ${comments.poll}`,
    form(endpoints.token, [
      ["grant_type", "urn:ietf:params:oauth:grant-type:device_code"],
      ["client_id", PUBLIC_CLIENT_ID],
      ["device_code", "<device_code>"],
    ]),
    "",
    `# ${comments.refresh}`,
    form(endpoints.token, [
      ["grant_type", "refresh_token"],
      ["client_id", PUBLIC_CLIENT_ID],
      ["refresh_token", "<refresh_token>"],
    ]),
  ].join("\n");
}

/** Loopback callbacks are what self-registration admits without an operator's say-so. */
export const EXAMPLE_REDIRECT_URI = "http://127.0.0.1:8765/callback";

export function renderClientRegistration(
  endpoints: OAuthEndpoints & { registration: string },
  comments: { register: string; authorize: string; exchange: string },
) {
  // Readable rather than percent-encoded: ":" and "/" are valid in a query, and the <...> parts are
  // placeholders to replace anyway.
  const authorize =
    `${endpoints.authorization}?response_type=code&client_id=<client_id>` +
    `&redirect_uri=${EXAMPLE_REDIRECT_URI}&scope=openid%20offline&state=<state>` +
    "&code_challenge=<code_challenge>&code_challenge_method=S256";
  const register = "  -d ";
  return [
    `# ${comments.register}`,
    `curl -X POST "${endpoints.registration}" \\`,
    '  -H "Content-Type: application/json" \\',
    `${register}${shellQuote(
      literal(
        { client_name: "my-app", redirect_uris: [EXAMPLE_REDIRECT_URI] },
        "json",
        "  ",
        register.length + 1,
      ),
    )}`,
    "",
    `# ${comments.authorize}`,
    authorize,
    "",
    `# ${comments.exchange}`,
    form(endpoints.token, [
      ["grant_type", "authorization_code"],
      ["client_id", "<client_id>"],
      ["code", "<code>"],
      ["redirect_uri", EXAMPLE_REDIRECT_URI],
      ["code_verifier", "<code_verifier>"],
    ]),
  ].join("\n");
}

export type LoginFlow = "device" | "code";

export type AppLoginComments = {
  clientId: string;
  redirectUri: string;
  /** Why every new set is saved, and where this example keeps it. */
  save: string;
  saveWhere: string;
  /** Reuse saved tokens before asking the user to sign in again. */
  reuse: string;
  /** What the sign-in line does, per flow. */
  login: Record<LoginFlow, string>;
  call: string;
  /** Device tokens belong to the built-in client, so no client id is passed. */
  deviceClient: string;
  /** TypeScript prints the device prompt itself: the label before the URL and before the code. */
  promptOpen: string;
  promptCode: string;
};

/** Where the examples keep tokens between runs: a file only its owner can read. */
export const TOKEN_FILE = "bkn-tokens.json";

function indent(lines: string[], by: string) {
  return lines.map((line) => (line ? `${by}${line}` : line));
}

/**
 * Signing a user in with the SDK (bkn-sdk `oauth`), then calling as them. Tokens are kept in a
 * file and reused on the next run; the client renews them itself and hands every new set to
 * `save`, which is the one thing an app has to get right.
 */
export function renderLoginPython(
  origin: string,
  flow: LoginFlow,
  call: ToolCall | null,
  comments: AppLoginComments,
) {
  const text = (value: string) => JSON.stringify(value);
  const code = flow === "code";
  return [
    "import json",
    "from pathlib import Path",
    "",
    "import bkn_osdk",
    "from bkn_osdk import kn, oauth",
    "",
    `PLATFORM = ${text(origin)}`,
    ...(code
      ? [
          `CLIENT_ID = "<client_id>"  # ${comments.clientId}`,
          `REDIRECT_URI = ${text(EXAMPLE_REDIRECT_URI)}  # ${comments.redirectUri}`,
        ]
      : []),
    `TOKEN_FILE = Path(${text(TOKEN_FILE)})`,
    "",
    "",
    "def save(tokens):",
    `    """${comments.save}`,
    "",
    `    ${comments.saveWhere}`,
    '    """',
    "    TOKEN_FILE.touch(mode=0o600)",
    "    TOKEN_FILE.write_text(json.dumps(tokens.to_dict()))",
    "",
    "",
    `# ${comments.reuse}`,
    "if TOKEN_FILE.exists():",
    "    tokens = oauth.Tokens.from_dict(json.loads(TOKEN_FILE.read_text()))",
    "else:",
    `    # ${comments.login[flow]}`,
    code
      ? "    tokens = oauth.login(PLATFORM, client_id=CLIENT_ID, redirect_uri=REDIRECT_URI)"
      : "    tokens = oauth.device_login(PLATFORM)",
    "    save(tokens)",
    "",
    `# ${comments.call}`,
    ...(code
      ? [
          "bkn_osdk.configure(",
          "    base_url=PLATFORM,",
          "    tokens=tokens,",
          "    client_id=CLIENT_ID,",
          "    on_refresh=save,",
          ")",
        ]
      : [
          `# ${comments.deviceClient}`,
          "bkn_osdk.configure(base_url=PLATFORM, tokens=tokens, on_refresh=save)",
        ]),
    ...(call ? [...pythonToolLines(call), "print(result)"] : []),
  ].join("\n");
}

export function renderLoginTypeScript(
  origin: string,
  flow: LoginFlow,
  call: ToolCall | null,
  comments: AppLoginComments,
) {
  const text = (value: string) => JSON.stringify(value);
  const code = flow === "code";
  const signIn = code
    ? [
        `tokens = await oauth.login(PLATFORM, ${literal(
          { clientId: new Raw("CLIENT_ID"), redirectUri: new Raw("REDIRECT_URI") },
          "js",
          "",
          "  tokens = await oauth.login(PLATFORM, ".length,
        )});`,
      ]
    : [
        "tokens = await oauth.deviceLogin(PLATFORM, {",
        "  onPrompt: (prompt) => {",
        `    console.log(${text(comments.promptOpen)}, prompt.verificationUriComplete ?? prompt.verificationUri);`,
        `    console.log(${text(comments.promptCode)}, prompt.userCode);`,
        "  },",
        "});",
      ];
  const client = {
    baseUrl: new Raw("PLATFORM"),
    tokens: new Raw("tokens"),
    ...(code ? { clientId: new Raw("CLIENT_ID") } : {}),
    onTokenRefresh: new Raw("save"),
  };
  const head = "const bkn = createClient(";
  return [
    'import { existsSync, readFileSync, writeFileSync } from "node:fs";',
    'import { createClient, oauth } from "@openbkn/bkn-sdk";',
    "",
    `const PLATFORM = ${text(origin)};`,
    ...(code
      ? [
          `const CLIENT_ID = "<client_id>"; // ${comments.clientId}`,
          `const REDIRECT_URI = ${text(EXAMPLE_REDIRECT_URI)}; // ${comments.redirectUri}`,
        ]
      : []),
    `const TOKEN_FILE = ${text(TOKEN_FILE)};`,
    "",
    `// ${comments.save}`,
    `// ${comments.saveWhere}`,
    "function save(tokens) {",
    "  writeFileSync(TOKEN_FILE, JSON.stringify(tokens), { mode: 0o600 });",
    "}",
    "",
    `// ${comments.reuse}`,
    "let tokens;",
    "if (existsSync(TOKEN_FILE)) {",
    '  tokens = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));',
    "} else {",
    `  // ${comments.login[flow]}`,
    ...indent(signIn.join("\n").split("\n"), "  "),
    "  save(tokens);",
    "}",
    "",
    `// ${comments.call}`,
    ...(code ? [] : [`// ${comments.deviceClient}`]),
    `${head}${literal(client, "js", "", head.length)});`,
    ...(call
      ? [...typeScriptToolLines(call), "console.log(JSON.stringify(result, null, 2));"]
      : []),
  ].join("\n");
}
