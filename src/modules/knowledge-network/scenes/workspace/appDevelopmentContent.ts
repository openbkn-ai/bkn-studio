/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * What the App development page says, independent of how it is shown: the page renders it, and
 * the Markdown and HTML exports are built from the same pieces.
 */

import {
  docsPageForTool,
  docsUrl,
} from "@/modules/knowledge-network/services/app-development-docs";
import {
  bknOsdkRequirement,
  generateCommand,
  osdkExamplesUrl,
  pythonAddCommand,
  pythonProjectCommands,
  pythonRun,
  type PythonSetupComments,
  type PythonTool,
  scalarFields,
  sdkVersionOf,
  typeScriptInstallCommand,
  type ToolCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import type {
  GuideCodeLanguage,
  GuideNode,
} from "@/modules/knowledge-network/services/app-development-guide";
import {
  osdkClassName,
  renderOsdkExamples,
  type OsdkExample,
} from "@/modules/knowledge-network/services/app-development-osdk";
import {
  defaultOAuthEndpoints,
  EXAMPLE_REDIRECT_URI,
  renderAgentExecution,
  renderLoginPython,
  renderLoginTypeScript,
  renderClientRegistration,
  renderDeviceLogin,
  renderPython,
  renderRest,
  renderRestRequest,
  renderTypeScript,
  type AppLoginComments,
  type LoginFlow,
  type OAuthEndpoints,
} from "@/modules/knowledge-network/services/app-development-render";
import {
  apiKeyAppParts,
  joinSampleApp,
  sampleAppExcerpts,
  sampleAppParts,
  SAMPLE_APP_URL,
  sampleAppRunCommand,
  type SampleAppMode,
  type SampleAppText,
} from "@/modules/knowledge-network/services/app-development-sample-app";
import type { AppDevelopmentData } from "@/modules/knowledge-network/scenes/workspace/useAppDevelopmentData";

/** `t` scoped to `knowledgeNetwork.appDevelopment`. */
export type Copy = (key: string, values?: Record<string, unknown>) => string;

export type CapabilityKey = "queryObjects" | "cypher" | "search" | "metric" | "action" | "function";

export type CapabilityEntry = {
  key: CapabilityKey;
  title: string;
  description: string;
  call: ToolCall | null;
  notes: string[];
  /** REST cannot make this call in one command; show the request, not a curl. */
  restRequestOnly?: string;
  tryLink?: string;
  empty: { link: string; linkLabel: string; text: string };
};

export function capabilityEntries(
  data: AppDevelopmentData,
  workspace: string,
  k: Copy,
): CapabilityEntry[] {
  const entries: CapabilityEntry[] = [
    {
      key: "queryObjects",
      title: k("queryObjects.title"),
      description: k("queryObjects.description"),
      call: data.queryObjects?.call ?? null,
      notes: data.queryObjects
        ? [
            k(data.queryObjects.filtered ? "queryObjects.sampled" : "queryObjects.unsampled", {
              name: data.queryObjects.name,
            }),
          ]
        : [],
      tryLink: data.queryObjects
        ? `${workspace}/object-types/${encodeURIComponent(data.queryObjects.objectTypeId)}/detail`
        : undefined,
      empty: {
        link: `${workspace}/object-types`,
        linkLabel: k("queryObjects.emptyLink"),
        text: k("queryObjects.empty"),
      },
    },
    {
      key: "cypher",
      title: k("cypher.title"),
      description: k("cypher.description"),
      call: data.cypher?.call ?? null,
      notes: data.cypher
        ? [
            k(data.cypher.anchored ? "cypher.relation" : "cypher.unanchored", {
              name: data.cypher.name,
            }),
          ]
        : [],
      tryLink: `${workspace}/experience/cypher`,
      empty: {
        link: `${workspace}/relation-types`,
        linkLabel: k("cypher.emptyLink"),
        text: k("cypher.empty"),
      },
    },
    {
      key: "search",
      title: k("search.title"),
      description: k("search.description"),
      call: data.search?.call ?? null,
      notes: data.search ? [k("search.objectType", { name: data.search.name })] : [],
      empty: {
        link: `${workspace}/object-types`,
        linkLabel: k("search.emptyLink"),
        text: k("search.empty"),
      },
    },
  ];
  if (data.metric !== undefined) {
    entries.push({
      key: "metric",
      title: k("metric.title"),
      description: k("metric.description"),
      call: data.metric?.call ?? null,
      notes: data.metric
        ? [k("metric.name", { name: data.metric.name, version: data.metric.version })]
        : [],
      tryLink: data.metric
        ? `${workspace}/metrics/${encodeURIComponent(data.metric.metricId)}/detail`
        : undefined,
      empty: {
        link: `${workspace}/metrics`,
        linkLabel: k("metric.emptyLink"),
        text: k("metric.empty"),
      },
    });
  }
  entries.push(
    {
      key: "action",
      title: k("action.title"),
      description: k("action.description"),
      call: data.action?.call ?? null,
      notes: data.action
        ? [
            k("action.name", { name: data.action.name }),
            k(data.action.createsObjects ? "action.placeholdersCreate" : "action.placeholders"),
          ]
        : [],
      restRequestOnly: k("action.restNote"),
      tryLink: data.action
        ? `${workspace}/action-types/${encodeURIComponent(data.action.actionTypeId)}/execution`
        : undefined,
      empty: {
        link: `${workspace}/action-types`,
        linkLabel: k("action.emptyLink"),
        text: k("action.empty"),
      },
    },
    {
      key: "function",
      title: k("function.title"),
      description: k("function.description"),
      call: data.fn?.call ?? null,
      notes: data.fn ? [k("function.name", { name: data.fn.name }), k("function.result")] : [],
      tryLink: `${workspace}/functions`,
      empty: {
        link: `${workspace}/functions`,
        linkLabel: k("function.emptyLink"),
        text: k("function.empty"),
      },
    },
  );
  return entries;
}

function sampleDisplay(data: AppDevelopmentData) {
  const display = data.queryObjects?.row?._display;
  return typeof display === "string" || typeof display === "number" ? String(display) : "";
}

/** A name reads as a question; a code like the display key often does not. */
function sampleQuestion(data: AppDevelopmentData) {
  const row = data.queryObjects?.row ?? null;
  const named = scalarFields(row).find(
    ([field, value]) => /name/i.test(field) && typeof value === "string",
  );
  return named ? String(named[1]) : sampleDisplay(data) || (data.queryObjects?.name ?? "");
}

export type OsdkExampleEntry = OsdkExample & { title: string; note: string };

export function osdkExamples(
  data: AppDevelopmentData,
  knId: string,
  origin: string,
  k: Copy,
): OsdkExampleEntry[] {
  const source = data.queryObjects;
  if (!source) return [];
  const relation = source.relation;
  const examples = renderOsdkExamples({
    origin,
    knId,
    objectTypeId: source.objectTypeId,
    properties: source.properties,
    row: source.row,
    relation,
    question: sampleQuestion(data),
    cypher: data.cypher?.call ?? null,
    comments: {
      get: k("osdk.comments.get"),
      where: k("osdk.comments.where"),
      combine: k("osdk.comments.combine"),
      page: k("osdk.comments.page"),
      iterate: k("osdk.comments.iterate"),
      count: k("osdk.comments.count"),
      hop: k("osdk.comments.hop", {
        relation: relation?.name ?? "",
        target: relation?.targetName ?? "",
      }),
      multiHop: k("osdk.comments.multiHop", {
        relation: relation?.next?.name ?? "",
        target: relation?.next?.targetName ?? "",
      }),
      searchTypes: k("osdk.comments.searchTypes"),
      searchInstances: k("osdk.comments.searchInstances"),
    },
  });
  return examples.map((example) => ({
    ...example,
    title: k(`osdk.examples.${example.key}.title`),
    note: k(`osdk.examples.${example.key}.note`),
  }));
}

/** Python reads the address from `~/.bkn` after a CLI login; an API Key alone needs it set. */
export function apiKeyCode(origin: string) {
  return `export BKN_BASE_URL=${origin}\nexport BKN_TOKEN=<API Key>`;
}

export function oauthLoginCode(origin: string) {
  return `openbkn auth login ${origin}\nexport BKN_TOKEN=$(openbkn auth token)`;
}

export function agentScenarios(data: AppDevelopmentData, knId: string, k: Copy) {
  const name = data.queryObjects?.name ?? knId;
  const value = sampleDisplay(data);
  return [
    { key: "ask", example: k("agent.scenarios.ask.example", { name }) },
    {
      key: "explain",
      example: value ? k("agent.scenarios.explain.example", { name, value }) : null,
    },
    { key: "digest", example: k("agent.scenarios.digest.example", { name }) },
    { key: "bot", example: null },
  ].map((scenario) => ({
    ...scenario,
    title: k(`agent.scenarios.${scenario.key}.title`),
    description: k(`agent.scenarios.${scenario.key}.description`),
  }));
}

export function typeScriptVersionNote(platformVersion: string | null, k: Copy) {
  const sdk = sdkVersionOf(platformVersion);
  if (!sdk) return k("start.typescriptUnknown");
  return sdk.prerelease
    ? k("start.typescriptDevBuild", { version: platformVersion })
    : k("start.typescriptVersion", { version: sdk.version });
}

export function oauthEndpoints(data: AppDevelopmentData, origin: string): OAuthEndpoints {
  return data.oauth ?? defaultOAuthEndpoints(origin);
}

export function deviceLoginCode(endpoints: OAuthEndpoints, k: Copy) {
  return renderDeviceLogin(endpoints, {
    start: k("login.deviceComments.start"),
    poll: k("login.deviceComments.poll"),
    refresh: k("login.deviceComments.refresh"),
  });
}

export function clientRegistrationCode(
  endpoints: OAuthEndpoints & { registration: string },
  k: Copy,
) {
  return renderClientRegistration(endpoints, {
    register: k("login.codeComments.register"),
    authorize: k("login.codeComments.authorize"),
    exchange: k("login.codeComments.exchange"),
  });
}

export type LoginLanguage = "rest" | "python" | "typescript";

/** The TypeScript SDK signs users in from 0.2.1; it must match the platform's version. */
export function typeScriptCanSignIn(platformVersion: string | null) {
  const sdk = sdkVersionOf(platformVersion);
  if (!sdk) return true;
  const [major, minor, patch] = sdk.version.split(".").map(Number);
  return major > 0 || minor > 2 || (minor === 2 && patch >= 1);
}

export function loginLanguages(data: AppDevelopmentData): LoginLanguage[] {
  return typeScriptCanSignIn(data.platformVersion)
    ? ["rest", "python", "typescript"]
    : ["rest", "python"];
}

function loginComments(k: Copy): AppLoginComments {
  const c = (key: string) => k(`login.sdkComments.${key}`);
  return {
    clientId: c("clientId"),
    redirectUri: c("redirectUri"),
    save: c("save"),
    saveWhere: c("saveWhere"),
    reuse: c("reuse"),
    login: { device: c("deviceLogin"), code: c("codeLogin") },
    call: c("call"),
    deviceClient: c("deviceClient"),
    promptOpen: c("promptOpen"),
    promptCode: c("promptCode"),
  };
}

/**
 * One sign-in method in one language: curl steps for REST, the SDK for Python and TypeScript.
 * Null when the method is unavailable (no self-registration) or the language cannot do it.
 */
export function loginCode(
  data: AppDevelopmentData,
  origin: string,
  flow: LoginFlow,
  language: LoginLanguage,
  k: Copy,
): string | null {
  const endpoints = oauthEndpoints(data, origin);
  const registration = endpoints.registration;
  if (flow === "code" && !registration) return null;
  if (!loginLanguages(data).includes(language)) return null;
  if (language === "rest") {
    return flow === "device"
      ? deviceLoginCode(endpoints, k)
      : clientRegistrationCode({ ...endpoints, registration: registration ?? "" }, k);
  }
  const call = data.queryObjects?.call ?? null;
  return language === "python"
    ? renderLoginPython(origin, flow, call, loginComments(k))
    : renderLoginTypeScript(origin, flow, call, loginComments(k));
}

export const PYTHON_TOOLS: PythonTool[] = ["venv", "uv"];

/** The project the Get started step makes, which the Ontology SDK step generates into. */
const SDK_PROJECT = "my-app";
/** The sample app gets a project of its own. */
const SAMPLE_PROJECT = "qa-app";

function setupComments(k: Copy): PythonSetupComments {
  return {
    python: k("start.pythonSetup.python"),
    activate: k("start.pythonSetup.activate"),
    uv: k("start.pythonSetup.uv"),
  };
}

/** Get started: a project with its own environment and the SDK in it. */
export function sdkProjectCommands(tool: PythonTool, k: Copy) {
  return pythonProjectCommands(tool, SDK_PROJECT, [bknOsdkRequirement()], setupComments(k));
}

/** Both versions read objects through the Ontology SDK and call the Agent with httpx. */
function samplePackages() {
  return ["fastapi", "uvicorn", "httpx", bknOsdkRequirement()];
}

/** Both versions install the same packages into a project of their own. */
export function sampleAppSetupCommands(tool: PythonTool, k: Copy) {
  return pythonProjectCommands(tool, SAMPLE_PROJECT, samplePackages(), setupComments(k));
}

/** The API Key version reads its key from the environment the server starts in. */
export function sampleAppStartCommand(version: SampleAppVersion, tool: PythonTool) {
  const serve = pythonRun(tool, sampleAppRunCommand());
  return version === "apiKey" ? `export BKN_TOKEN=<API Key>\n${serve}` : serve;
}

const SAMPLE_APP_TEXT = [
  "title",
  "run",
  "open",
  "apiKeyTitle",
  "apiKeyOpen",
  "apiKeyComment",
  "agent",
  "thread",
  "forward",
  "page",
  "generatedTypes",
  "generatedTable",
  "listTypes",
  "runtimeTable",
  "clientId",
  "redirectUri",
  "memory",
  "pending",
  "sessions",
  "lock",
  "refresh",
  "login",
  "callback",
  "asUser",
  "signedIn",
  "pageTitle",
  "chatTitle",
  "objectTypes",
  "readFailed",
  "signInHint",
  "signIn",
  "signOut",
  "newChat",
  "submit",
  "thinking",
  "using",
  "failed",
  "notSignedIn",
  "retry",
  "noAnswer",
] as const;

export type SampleAppVersion = "oauth" | "apiKey";

/** Run inside the Get started project: `generate` makes `bkn/` next to the user's code. */
export function osdkGenerateCommand(knId: string, tool: PythonTool) {
  return pythonRun(tool, generateCommand(knId));
}

/**
 * Where the generated package sits next to the code that imports it, which is what decides
 * whether `import bkn` works at all. uv also keeps the project's dependencies beside it.
 */
export function osdkLayout(k: Copy, tool: PythonTool) {
  const l = (key: string) => k(`osdk.layout.${key}`);
  const rows: Array<[string, string]> = [
    [`${SDK_PROJECT}/`, l("project")],
    ["├── .venv/", l(tool === "uv" ? "uvEnv" : "venvEnv")],
    ...(tool === "uv"
      ? ([
          ["├── pyproject.toml", l("pyproject")],
          ["├── uv.lock", l("lock")],
        ] satisfies Array<[string, string]>)
      : []),
    ["├── bkn/", l("package")],
    ["│   ├── __init__.py", l("init")],
    ["│   ├── object_types.py", l("objectTypes")],
    ["│   ├── relation_types.py", l("relationTypes")],
    ["│   └── metrics.py", l("metrics")],
    ["└── main.py", l(tool === "uv" ? "mainUv" : "main")],
  ];
  const width = Math.max(...rows.map(([path]) => path.length)) + 2;
  return rows.map(([path, note]) => (note ? `${path.padEnd(width)}# ${note}` : path)).join("\n");
}

function sampleAppText(data: AppDevelopmentData, knId: string, k: Copy): SampleAppText {
  const text = Object.fromEntries(
    SAMPLE_APP_TEXT.map((key) => [key, k(`sampleApp.code.${key}`, { url: SAMPLE_APP_URL })]),
  ) as Omit<SampleAppText, "placeholder">;
  return { ...text, placeholder: agentScenarios(data, knId, k)[0]?.example ?? "" };
}

/**
 * Whether the page has objects to show: an object type with data (and, read through the generated
 * package, a class for it). Without one the page is the chat alone.
 */
function sampleAppHasObjects(data: AppDevelopmentData, mode: SampleAppMode) {
  return data.objectTypes.some(
    (objectType) => mode === "runtime" || osdkClassName(objectType.id) !== null,
  );
}

/**
 * What qa-app holds before it starts: `app.py` beside the generated `bkn/`, so `import bkn`
 * finds it, and the commands run from here.
 */
export function sampleAppLayout(k: Copy, tool: PythonTool, mode: SampleAppMode) {
  const l = (key: string) => k(`osdk.layout.${key}`);
  const rows: Array<[string, string]> = [
    [`${SAMPLE_PROJECT}/`, k("sampleApp.layout.project")],
    ["├── .venv/", l(tool === "uv" ? "uvEnv" : "venvEnv")],
    ...(tool === "uv"
      ? ([
          ["├── pyproject.toml", l("pyproject")],
          ["├── uv.lock", l("lock")],
          ["├── main.py", k("sampleApp.layout.uvMain")],
        ] satisfies Array<[string, string]>)
      : []),
    ...(mode === "generated"
      ? ([["├── bkn/", l("package")]] satisfies Array<[string, string]>)
      : []),
    ["└── app.py", k("sampleApp.layout.app")],
  ];
  const width = Math.max(...rows.map(([path]) => path.length)) + 2;
  return rows.map(([path, note]) => `${path.padEnd(width)}# ${note}`).join("\n");
}

/** Generating the Ontology SDK into the sample's project; the API Key version uses its key. */
export function sampleAppGenerateCommand(
  knId: string,
  version: SampleAppVersion,
  tool: PythonTool,
) {
  const generate = pythonRun(tool, generateCommand(knId));
  return version === "apiKey" ? `export BKN_TOKEN=<API Key>\n${generate}` : generate;
}

/**
 * The OAuth version is null where clients cannot register themselves: a web app then has no way
 * to sign users in. The API Key version needs nothing from the platform but a key.
 */
function sampleAppBuild(
  data: AppDevelopmentData,
  knId: string,
  origin: string,
  k: Copy,
  version: SampleAppVersion,
  tool: PythonTool,
  mode: SampleAppMode,
) {
  const text = sampleAppText(data, knId, k);
  const objects = sampleAppHasObjects(data, mode);
  const setup = {
    install: pythonAddCommand(tool, samplePackages()),
    generate: mode === "generated" ? pythonRun(tool, generateCommand(knId)) : undefined,
    run: sampleAppStartCommand(version, tool),
  };
  if (version === "apiKey") return apiKeyAppParts(origin, knId, setup, text, objects, mode);
  if (!oauthEndpoints(data, origin).registration) return null;
  return sampleAppParts(origin, knId, setup, text, objects, mode);
}

export function sampleAppCode(
  data: AppDevelopmentData,
  knId: string,
  origin: string,
  k: Copy,
  version: SampleAppVersion = "oauth",
  tool: PythonTool = "venv",
  mode: SampleAppMode = "generated",
): string | null {
  const parts = sampleAppBuild(data, knId, origin, k, version, tool, mode);
  return parts ? joinSampleApp(parts) : null;
}

/** The parts of `app.py` that deal with the platform, cut from the same file the page offers. */
export function sampleAppKeyCode(
  data: AppDevelopmentData,
  knId: string,
  origin: string,
  k: Copy,
  version: SampleAppVersion = "oauth",
  tool: PythonTool = "venv",
  mode: SampleAppMode = "generated",
) {
  const parts = sampleAppBuild(data, knId, origin, k, version, tool, mode);
  return (parts ? sampleAppExcerpts(parts) : []).map(({ key, code }) => {
    const id = key === "objects" ? `objects.${mode}` : key;
    return {
      key,
      code,
      title: k(`sampleApp.excerpts.${id}.title`),
      description: k(`sampleApp.excerpts.${id}.description`),
    };
  });
}

/** Clients only need the address: they discover sign-in from it and open a browser. */
export function mcpUrl(origin: string) {
  return `${origin}/api/agent-retrieval/v1/mcp/`;
}

/* ============================ Export ============================ */

type GuideContext = { data: AppDevelopmentData; knId: string; networkName: string; origin: string };

function capabilityNodes(entry: CapabilityEntry, origin: string, version: string | null, k: Copy) {
  const nodes: GuideNode[] = [
    { kind: "heading", level: 3, text: entry.title },
    { kind: "paragraph", text: entry.description },
  ];
  if (!entry.call) {
    nodes.push({ kind: "paragraph", text: entry.empty.text });
    return nodes;
  }
  const call = entry.call;
  nodes.push(...entry.notes.map((text): GuideNode => ({ kind: "paragraph", text })));
  nodes.push({ kind: "heading", level: 4, text: k("tabs.rest") });
  if (entry.restRequestOnly) {
    nodes.push(
      { kind: "paragraph", text: entry.restRequestOnly },
      { kind: "code", language: "text", code: renderRestRequest(origin, call) },
    );
  } else {
    nodes.push({ kind: "code", language: "bash", code: renderRest(origin, call) });
  }
  nodes.push(
    { kind: "heading", level: 4, text: k("tabs.python") },
    {
      kind: "code",
      language: "python",
      code: renderPython(origin, call),
    },
    { kind: "heading", level: 4, text: k("tabs.typescript") },
    { kind: "code", language: "typescript", code: renderTypeScript(origin, call) },
  );
  const page = docsPageForTool(call.tool);
  if (page) nodes.push({ kind: "link", text: k("apiDocs"), href: docsUrl(version, page) });
  return nodes;
}

export const LANGUAGE_TAB: Record<LoginLanguage, string> = {
  rest: "tabs.rest",
  python: "tabs.python",
  typescript: "tabs.typescript",
};

const GUIDE_LANGUAGE: Record<LoginLanguage, GuideCodeLanguage> = {
  rest: "bash",
  python: "python",
  typescript: "typescript",
};

function loginNodes(
  data: AppDevelopmentData,
  origin: string,
  flow: LoginFlow,
  k: Copy,
): GuideNode[] {
  return loginLanguages(data).flatMap((language): GuideNode[] => {
    const code = loginCode(data, origin, flow, language, k);
    if (!code) return [];
    return [
      { kind: "heading", level: 4, text: k(LANGUAGE_TAB[language]) },
      ...(language === "rest"
        ? []
        : ([{ kind: "paragraph", text: k(`login.sdk.${language}`) }] satisfies GuideNode[])),
      { kind: "code", language: GUIDE_LANGUAGE[language], code },
    ];
  });
}

/** Setup and start commands for both tools, labelled, for the exported guide. */
function toolNodes(k: Copy, commands: (tool: PythonTool) => string): GuideNode[] {
  return PYTHON_TOOLS.flatMap((tool): GuideNode[] => [
    { kind: "paragraph", text: k(`start.pythonTools.${tool}`) },
    { kind: "code", language: "bash", code: commands(tool) },
  ]);
}

function sampleAppNodes(
  data: AppDevelopmentData,
  knId: string,
  origin: string,
  k: Copy,
): GuideNode[] {
  const versions: SampleAppVersion[] = ["oauth", "apiKey"];
  const modes: SampleAppMode[] = ["generated", "runtime"];
  const tab = (version: SampleAppVersion) =>
    k(version === "oauth" ? "sampleApp.oauthTab" : "sampleApp.apiKeyTab");
  /** A document cannot offer a download, so the whole files go to an appendix, named like this. */
  const appendix = (version: SampleAppVersion, mode: SampleAppMode) =>
    `${tab(version)} · ${k(`sampleApp.modes.${mode}`)}`;
  const excerpts = (version: SampleAppVersion, mode: SampleAppMode, only?: string): GuideNode[] =>
    sampleAppKeyCode(data, knId, origin, k, version, "venv", mode)
      .filter((excerpt) => !only || excerpt.key === only)
      .flatMap(({ title, description, code }): GuideNode[] => [
        { kind: "paragraph", text: k("sampleApp.excerptLine", { title, description }) },
        { kind: "code", language: "python", code },
      ]);
  /** Only the reading changes with nothing generated, and only where there is something to read. */
  const runtime = (version: SampleAppVersion): GuideNode[] => {
    const reading = excerpts(version, "runtime", "objects");
    return reading.length > 0
      ? [
          {
            kind: "paragraph",
            text: k("sampleApp.runtimeGuide", { appendix: appendix(version, "runtime") }),
          },
          ...reading,
        ]
      : [];
  };
  /** The key code of one version, then what changes with nothing generated. */
  const keyCode = (version: SampleAppVersion): GuideNode[] => [
    { kind: "heading", level: 4, text: k("sampleApp.keyCode") },
    { kind: "paragraph", text: k("sampleApp.keyCodeNote") },
    ...excerpts(version, "generated"),
    ...runtime(version),
  ];
  const oauthAvailable = sampleAppCode(data, knId, origin, k, "oauth") !== null;
  /** The tree to check before starting, per tool, for the guide's main (generated) reading. */
  const layoutNodes = (): GuideNode[] => [
    { kind: "paragraph", text: k("sampleApp.layout.check") },
    ...PYTHON_TOOLS.flatMap((tool): GuideNode[] => [
      { kind: "paragraph", text: k(`start.pythonTools.${tool}`) },
      { kind: "code", language: "text", code: sampleAppLayout(k, tool, "generated") },
    ]),
  ];
  return [
    { kind: "heading", level: 2, text: k("sampleApp.title") },
    { kind: "paragraph", text: k("sampleApp.description") },
    { kind: "heading", level: 3, text: tab("oauth") },
    ...(oauthAvailable
      ? ([
          {
            kind: "paragraph",
            text: k("sampleApp.register", { redirectUri: EXAMPLE_REDIRECT_URI }),
          },
          { kind: "paragraph", text: k("sampleApp.install") },
          ...toolNodes(k, (tool) => sampleAppSetupCommands(tool, k)),
          { kind: "paragraph", text: k("sampleApp.generate") },
          ...toolNodes(k, (tool) => sampleAppGenerateCommand(knId, "oauth", tool)),
          {
            kind: "paragraph",
            text: k("sampleApp.saveGuide", { appendix: appendix("oauth", "generated") }),
          },
          ...layoutNodes(),
          { kind: "paragraph", text: k("sampleApp.start", { url: SAMPLE_APP_URL }) },
          ...toolNodes(k, (tool) => sampleAppStartCommand("oauth", tool)),
          { kind: "paragraph", text: k("sampleApp.limits") },
          ...keyCode("oauth"),
        ] satisfies GuideNode[])
      : ([{ kind: "paragraph", text: k("sampleApp.unavailable") }] satisfies GuideNode[])),
    { kind: "heading", level: 3, text: tab("apiKey") },
    { kind: "paragraph", text: k("sampleApp.apiKey.create") },
    { kind: "paragraph", text: k("sampleApp.apiKey.install") },
    ...toolNodes(k, (tool) => sampleAppSetupCommands(tool, k)),
    { kind: "paragraph", text: k("sampleApp.apiKey.generate") },
    ...toolNodes(k, (tool) => sampleAppGenerateCommand(knId, "apiKey", tool)),
    {
      kind: "paragraph",
      text: k("sampleApp.apiKey.saveGuide", { appendix: appendix("apiKey", "generated") }),
    },
    ...layoutNodes(),
    { kind: "paragraph", text: k("sampleApp.apiKey.start", { url: SAMPLE_APP_URL }) },
    ...toolNodes(k, (tool) => sampleAppStartCommand("apiKey", tool)),
    { kind: "paragraph", text: k("sampleApp.apiKey.limits") },
    ...keyCode("apiKey"),
    { kind: "heading", level: 3, text: k("sampleApp.appendix") },
    ...versions.flatMap((version) =>
      modes.flatMap((mode): GuideNode[] => {
        const code = sampleAppCode(data, knId, origin, k, version, "venv", mode);
        return code
          ? [
              { kind: "heading", level: 4, text: appendix(version, mode) },
              { kind: "code", language: "python", code },
            ]
          : [];
      }),
    ),
  ];
}

export function buildGuide(
  { data, knId, networkName, origin }: GuideContext,
  k: Copy,
): GuideNode[] {
  const version = data.platformVersion;
  const sdk = sdkVersionOf(version);
  const osdk = osdkExamples(data, knId, origin, k);
  const endpoints = oauthEndpoints(data, origin);
  const scenarios = agentScenarios(data, knId, k);
  const question = scenarios[0]?.example ?? "";

  return [
    { kind: "heading", level: 1, text: k("guide.title", { name: networkName }) },
    { kind: "paragraph", text: k("description") },
    { kind: "paragraph", text: k("guide.meta", { knId, origin }) },

    { kind: "heading", level: 2, text: k("start.title") },
    { kind: "paragraph", text: k("start.token") },
    { kind: "heading", level: 4, text: k("start.oauthTab") },
    { kind: "paragraph", text: k("start.oauth") },
    { kind: "code", language: "bash", code: oauthLoginCode(origin) },
    { kind: "heading", level: 4, text: k("start.apiKeyTab") },
    { kind: "paragraph", text: k("start.apiKey") },
    { kind: "code", language: "bash", code: apiKeyCode(origin) },
    { kind: "paragraph", text: k("start.install") },
    { kind: "heading", level: 4, text: k("tabs.python") },
    { kind: "paragraph", text: k("start.python") },
    ...toolNodes(k, (tool) => sdkProjectCommands(tool, k)),
    { kind: "heading", level: 4, text: k("tabs.typescript") },
    {
      kind: "paragraph",
      text: `${k("start.typescript")} ${typeScriptVersionNote(version, k)} ${k("start.cli")}`,
    },
    { kind: "code", language: "bash", code: typeScriptInstallCommand(sdk) },
    { kind: "link", text: k("start.authDocs"), href: docsUrl(version, "auth") },

    { kind: "heading", level: 2, text: k("login.title") },
    { kind: "paragraph", text: k("login.description") },
    { kind: "heading", level: 3, text: k("login.deviceTitle") },
    { kind: "paragraph", text: k("login.device") },
    ...loginNodes(data, origin, "device", k),
    { kind: "heading", level: 3, text: k("login.codeTitle") },
    ...(endpoints.registration
      ? ([
          { kind: "paragraph", text: k("login.code") },
          ...loginNodes(data, origin, "code", k),
          { kind: "paragraph", text: k("login.codeRules") },
        ] satisfies GuideNode[])
      : ([{ kind: "paragraph", text: k("login.codeUnavailable") }] satisfies GuideNode[])),

    { kind: "heading", level: 2, text: k("osdk.title") },
    { kind: "paragraph", text: k("osdk.description") },
    { kind: "paragraph", text: k("osdk.generate") },
    ...PYTHON_TOOLS.flatMap((tool): GuideNode[] => [
      { kind: "paragraph", text: k(`start.pythonTools.${tool}`) },
      { kind: "code", language: "bash", code: osdkGenerateCommand(knId, tool) },
      { kind: "code", language: "text", code: osdkLayout(k, tool) },
      { kind: "paragraph", text: k(`osdk.layoutNote.${tool}`) },
    ]),
    { kind: "paragraph", text: k("osdk.use") },
    ...(osdk.length > 0
      ? osdk.flatMap((example): GuideNode[] => [
          { kind: "heading", level: 4, text: example.title },
          { kind: "paragraph", text: example.note },
          { kind: "code", language: "python", code: example.code },
        ])
      : ([
          {
            kind: "paragraph",
            text: data.queryObjects
              ? k("osdk.unavailable", { name: data.queryObjects.name })
              : k("osdk.empty"),
          },
        ] satisfies GuideNode[])),
    { kind: "paragraph", text: k("osdk.check") },
    { kind: "paragraph", text: k("osdk.scope") },
    { kind: "link", text: k("osdk.moreExamples"), href: osdkExamplesUrl() },

    { kind: "heading", level: 2, text: k("capabilitiesTitle") },
    ...capabilityEntries(data, "", k).flatMap((entry) =>
      capabilityNodes(entry, origin, version, k),
    ),

    { kind: "heading", level: 2, text: k("agent.title") },
    { kind: "paragraph", text: k("agent.description") },
    { kind: "heading", level: 3, text: k("agent.scenariosTitle") },
    {
      kind: "list",
      items: scenarios.map((scenario) =>
        [
          k("guide.scenarioItem", { title: scenario.title, description: scenario.description }),
          scenario.example ? k("agent.exampleQuestion", { question: scenario.example }) : "",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    },
    { kind: "paragraph", text: k("agent.request") },
    { kind: "code", language: "bash", code: renderAgentExecution(origin, knId, question) },
    { kind: "paragraph", text: k("agent.response") },
    { kind: "paragraph", text: k("agent.ownAgent") },
    { kind: "link", text: k("apiDocs"), href: docsUrl(version, "agent") },

    ...sampleAppNodes(data, knId, origin, k),

    { kind: "heading", level: 2, text: k("mcp.title") },
    { kind: "paragraph", text: k("mcp.description") },
    { kind: "code", language: "text", code: mcpUrl(origin) },
    { kind: "paragraph", text: k("mcp.network", { knId }) },
  ];
}
