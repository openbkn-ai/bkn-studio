/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined, DownloadOutlined, ExportOutlined, GlobalOutlined } from "@ant-design/icons";
import { Alert, App, Button, Input, Spin } from "antd";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import {
  docsPageForTool,
  docsUrl,
  type DocsPage,
} from "@/modules/knowledge-network/services/app-development-docs";
import {
  checkExample,
  osdkExamplesUrl,
  sdkVersionOf,
  type PythonTool,
  typeScriptInstallCommand,
  type ToolCall,
} from "@/modules/knowledge-network/services/app-development-examples";
import {
  guideFileName,
  toHtml,
  toMarkdown,
} from "@/modules/knowledge-network/services/app-development-guide";
import type { OsdkExampleKey } from "@/modules/knowledge-network/services/app-development-osdk";
import type { LoginFlow } from "@/modules/knowledge-network/services/app-development-render";
import {
  SAMPLE_APP_URL,
  type SampleAppMode,
} from "@/modules/knowledge-network/services/app-development-sample-app";
import {
  EXAMPLE_REDIRECT_URI,
  renderAgentExecution,
  renderPython,
  renderRest,
  renderRestRequest,
  renderTypeScript,
} from "@/modules/knowledge-network/services/app-development-render";
import {
  registerOAuthClient,
  tryRunCypher,
  trySearchInstances,
  type CypherResult,
  type RegisteredClient,
  type SearchHit,
} from "@/modules/knowledge-network/services/app-development.service";
import type {
  ContextLoaderEnv,
  McpAuth,
  McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import {
  agentScenarios,
  apiKeyCode,
  buildGuide,
  capabilityEntries,
  LANGUAGE_TAB,
  loginCode,
  loginLanguages,
  sampleAppCode,
  sampleAppGenerateCommand,
  sampleAppKeyCode,
  sampleAppLayout,
  sampleAppSetupCommands,
  sampleAppStartCommand,
  sdkProjectCommands,
  type SampleAppVersion,
  mcpUrl,
  oauthLoginCode,
  osdkExamples,
  osdkGenerateCommand,
  osdkLayout,
  PYTHON_TOOLS,
  typeScriptVersionNote,
  type CapabilityEntry,
  type Copy,
  type LoginLanguage,
} from "@/modules/knowledge-network/scenes/workspace/appDevelopmentContent";
import {
  useAppDevelopmentData,
  type AppDevelopmentData,
} from "@/modules/knowledge-network/scenes/workspace/useAppDevelopmentData";
import {
  useHighlightedCode,
  type CodeLanguage,
  type TokenKind,
} from "@/modules/knowledge-network/scenes/workspace/useHighlightedCode";

import styles from "./WorkspaceDevelopSection.module.css";

type Language = "rest" | "python" | "typescript";

const LANGUAGES: Language[] = ["rest", "python", "typescript"];

const TOKEN_CLASS: Record<TokenKind, string | undefined> = {
  comment: styles.tkComment,
  key: styles.tkKey,
  string: styles.tkString,
  number: styles.tkNumber,
  keyword: styles.tkKeyword,
  variable: styles.tkVariable,
  type: styles.tkType,
};

const CONNECTED_CLIENTS_PATH = "/account/api-keys?tab=clients";

/** The examples name the gateway a developer calls, not the dev server that proxies it. */
function platformOrigin() {
  return gatewayOrigin() || window.location.origin;
}

function useCopy(): Copy {
  const { t } = useTranslation();
  return (key, values) => t(`knowledgeNetwork.appDevelopment.${key}`, values);
}

function CodeBlock({ code, language }: { code: string; language: CodeLanguage }) {
  const k = useCopy();
  const { message } = App.useApp();
  const lines = useHighlightedCode(code, language);
  const copy = async () => {
    try {
      await writeTextToClipboard(code);
      void message.success(k("copied"));
    } catch {
      void message.error(k("copyFailed"));
    }
  };
  return (
    <div className={styles.codeBlock}>
      <button className={styles.copyButton} onClick={() => void copy()} type="button">
        <CopyOutlined /> {k("copy")}
      </button>
      <pre className={styles.code}>
        {lines
          ? lines.map((tokens, row) => (
              <span key={row}>
                {tokens.map((token, column) => (
                  <span className={token.kind ? TOKEN_CLASS[token.kind] : undefined} key={column}>
                    {token.text}
                  </span>
                ))}
                {row < lines.length - 1 ? "\n" : null}
              </span>
            ))
          : code}
      </pre>
    </div>
  );
}

function Tabs<T extends string>({
  items,
  onChange,
  value,
}: {
  items: Array<{ key: T; label: string }>;
  onChange: (key: T) => void;
  value: T;
}) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={value === item.key}
          className={value === item.key ? styles.tabActive : styles.tab}
          key={item.key}
          onClick={() => onChange(item.key)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DocsLink({ page, version }: { page: DocsPage; version: string | null }) {
  const k = useCopy();
  return (
    <a className={styles.docsLink} href={docsUrl(version, page)} rel="noreferrer" target="_blank">
      {k("apiDocs")} <ExportOutlined />
    </a>
  );
}

function CheckNotice({ call, tools }: { call: ToolCall; tools: McpToolDef[] | null }) {
  const k = useCopy();
  const check = checkExample(call, tools);
  if (check.status === "ok") return null;
  if (check.status === "unchecked") {
    return (
      <Alert className={styles.notice} message={k("check.unchecked")} showIcon type="warning" />
    );
  }
  const parts = [
    check.unknownTool ? k("check.unknownTool", { tool: call.tool }) : null,
    check.missing.length ? k("check.missing", { fields: check.missing.join(", ") }) : null,
    check.undeclared.length ? k("check.undeclared", { fields: check.undeclared.join(", ") }) : null,
  ].filter(Boolean);
  // Keep the console trail the design asks for: which tool, which fields.
  console.warn("[app-development] example does not match tools/list", call.tool, check);
  return (
    <Alert
      className={styles.notice}
      message={k("check.mismatch", { detail: parts.join("; ") })}
      showIcon
      type="warning"
    />
  );
}

function Block({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className={styles.block}>
      <header className={styles.blockHeader}>
        <h2 className={styles.blockTitle}>{title}</h2>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </header>
      {description ? <p className={styles.blockDescription}>{description}</p> : null}
      {children}
    </section>
  );
}

function Capability({
  children,
  entry,
  tools,
  version,
}: {
  children?: ReactNode;
  entry: CapabilityEntry;
  tools: McpToolDef[] | null;
  version: string | null;
}) {
  const k = useCopy();
  const [language, setLanguage] = useState<Language>("rest");
  const origin = platformOrigin();
  const { call, restRequestOnly } = entry;
  const mismatched = call ? checkExample(call, tools).status === "mismatch" : false;
  const docsPage = call ? docsPageForTool(call.tool) : null;

  const code = (() => {
    if (!call) return "";
    if (language === "python") return renderPython(origin, call);
    if (language === "typescript") return renderTypeScript(origin, call);
    return restRequestOnly ? renderRestRequest(origin, call) : renderRest(origin, call);
  })();
  const codeLanguage: CodeLanguage =
    language === "rest" ? (restRequestOnly ? "json" : "shell") : language;

  return (
    <section className={styles.capability}>
      <header className={styles.capabilityHeader}>
        <div>
          <h3 className={styles.capabilityTitle}>{entry.title}</h3>
          <p className={styles.capabilityDescription}>{entry.description}</p>
        </div>
        {call ? (
          <div className={styles.headerActions}>
            {docsPage ? <DocsLink page={docsPage} version={version} /> : null}
            {entry.tryLink ? (
              <Link className={styles.tryLink} to={entry.tryLink}>
                {k("tryIt")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>
      {call ? (
        <>
          {entry.notes.map((note) => (
            <p className={styles.note} key={note}>
              {note}
            </p>
          ))}
          <CheckNotice call={call} tools={tools} />
          {mismatched ? null : (
            <>
              <Tabs
                items={LANGUAGES.map((key) => ({ key, label: k(`tabs.${key}`) }))}
                onChange={setLanguage}
                value={language}
              />
              {language === "rest" && restRequestOnly ? (
                <Alert className={styles.notice} message={restRequestOnly} showIcon type="info" />
              ) : null}
              <CodeBlock code={code} language={codeLanguage} />
            </>
          )}
          {children}
        </>
      ) : (
        <p className={styles.empty}>
          {entry.empty.text} <Link to={entry.empty.link}>{entry.empty.linkLabel}</Link>
        </p>
      )}
    </section>
  );
}

function SearchTry({ env, auth }: { env: ContextLoaderEnv; auth: McpAuth }) {
  const k = useCopy();
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ hits: SearchHit[]; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const query = text.trim();
    if (!query) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await trySearchInstances(env, query, auth));
    } catch (failure) {
      setResult(null);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.tryBox}>
      <Input.Search
        enterButton={k("search.run")}
        loading={running}
        onChange={(event) => setText(event.target.value)}
        onSearch={() => void run()}
        placeholder={k("search.placeholder")}
        value={text}
      />
      {error ? <p className={styles.tryError}>{k("search.failed", { message: error })}</p> : null}
      {result ? (
        <div className={styles.tryResult}>
          <p className={styles.note}>
            {result.hits.length
              ? k("search.hits", { count: result.hits.length })
              : (result.message ?? k("search.noHits"))}
          </p>
          <ul className={styles.hitList}>
            {result.hits.slice(0, 8).map((hit, index) => (
              <li key={`${hit.objectTypeName}-${hit.display}-${String(index)}`}>
                <span className={styles.hitType}>{hit.objectTypeName}</span>
                {hit.display}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CypherTry({ call, env, auth }: { call: ToolCall; env: ContextLoaderEnv; auth: McpAuth }) {
  const k = useCopy();
  const [query, setQuery] = useState(() =>
    typeof call.body.query === "string" ? call.body.query : "",
  );
  const [parameters, setParameters] = useState(() =>
    call.body.parameters ? JSON.stringify(call.body.parameters, null, 2) : "",
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CypherResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    let parsed: Record<string, unknown> | undefined;
    if (parameters.trim()) {
      try {
        const value: unknown = JSON.parse(parameters);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        parsed = value as Record<string, unknown>;
      } catch {
        setResult(null);
        setError(k("cypher.parametersInvalid"));
        return;
      }
    }
    setRunning(true);
    setError(null);
    try {
      setResult(await tryRunCypher(env, query, parsed, auth));
    } catch (failure) {
      setResult(null);
      setError(k("cypher.failed", { message: failure instanceof Error ? failure.message : "" }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.tryBox}>
      <h4 className={styles.tryTitle}>{k("cypher.try")}</h4>
      <label className={styles.fieldLabel}>
        {k("cypher.query")}
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 8 }}
          className={styles.monoInput}
          onChange={(event) => setQuery(event.target.value)}
          value={query}
        />
      </label>
      <label className={styles.fieldLabel}>
        {k("cypher.parameters")}
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 6 }}
          className={styles.monoInput}
          onChange={(event) => setParameters(event.target.value)}
          value={parameters}
        />
      </label>
      <Button loading={running} onClick={() => void run()} type="primary">
        {k("cypher.run")}
      </Button>
      {error ? <p className={styles.tryError}>{error}</p> : null}
      {result ? (
        <div className={styles.tryResult}>
          <p className={styles.note}>
            {result.rows.length === 0
              ? k("cypher.noRows")
              : result.truncated
                ? k("cypher.truncated", { count: result.rows.length })
                : k("cypher.rows", { count: result.rows.length })}
          </p>
          {result.rows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.resultTable}>
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, column) => (
                        <td key={column}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RegisterClient({ endpoint }: { endpoint: string }) {
  const k = useCopy();
  const [name, setName] = useState("my-app");
  const [redirectUri, setRedirectUri] = useState(EXAMPLE_REDIRECT_URI);
  const [running, setRunning] = useState(false);
  const [client, setClient] = useState<RegisteredClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setRunning(true);
    setError(null);
    try {
      setClient(await registerOAuthClient(endpoint, name.trim(), redirectUri.trim()));
    } catch (failure) {
      setClient(null);
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.tryBox}>
      <h4 className={styles.tryTitle}>{k("login.registerTitle")}</h4>
      <p className={styles.note}>{k("login.registerNote")}</p>
      <div className={styles.formRow}>
        <label className={styles.fieldLabel}>
          {k("login.clientName")}
          <Input onChange={(event) => setName(event.target.value)} value={name} />
        </label>
        <label className={styles.fieldLabel}>
          {k("login.redirectUri")}
          <Input onChange={(event) => setRedirectUri(event.target.value)} value={redirectUri} />
        </label>
        <Button
          disabled={!name.trim() || !redirectUri.trim()}
          loading={running}
          onClick={() => void register()}
          type="primary"
        >
          {k("login.register")}
        </Button>
      </div>
      {error ? (
        <p className={styles.tryError}>{k("login.registerFailed", { message: error })}</p>
      ) : null}
      {client ? (
        <>
          <p className={styles.note}>{k("login.registered")}</p>
          <CodeBlock
            code={`client_id=${client.clientId}\nredirect_uri=${client.redirectUris.join(" ")}`}
            language="shell"
          />
        </>
      ) : null}
    </div>
  );
}

type PythonToolProps = { tool: PythonTool; onToolChange: (tool: PythonTool) => void };

/** venv or uv: one choice for the whole page, so every command reads the same way. */
function PythonToolTabs({ tool, onToolChange }: PythonToolProps) {
  const k = useCopy();
  return (
    <Tabs
      items={PYTHON_TOOLS.map((key) => ({ key, label: k(`start.pythonTools.${key}`) }))}
      onChange={onToolChange}
      value={tool}
    />
  );
}

function GetStarted({
  platformVersion,
  tool,
  onToolChange,
}: { platformVersion: string | null } & PythonToolProps) {
  const k = useCopy();
  const [credential, setCredential] = useState<"oauth" | "apiKey">("oauth");
  const [sdkLanguage, setSdkLanguage] = useState<"python" | "typescript">("python");
  const origin = platformOrigin();
  const sdk = sdkVersionOf(platformVersion);

  return (
    <Block actions={<DocsLink page="auth" version={platformVersion} />} title={k("start.title")}>
      <ol className={styles.steps}>
        <li>
          <p>{k("start.token")}</p>
          <Tabs
            items={[
              { key: "oauth", label: k("start.oauthTab") },
              { key: "apiKey", label: k("start.apiKeyTab") },
            ]}
            onChange={setCredential}
            value={credential}
          />
          {credential === "oauth" ? (
            <>
              <p className={styles.note}>{k("start.oauth")}</p>
              <CodeBlock code={oauthLoginCode(origin)} language="shell" />
            </>
          ) : (
            <>
              <p className={styles.note}>
                {k("start.apiKey")} <Link to="/account/api-keys">{k("start.apiKeyLink")}</Link>
              </p>
              <CodeBlock code={apiKeyCode(origin)} language="shell" />
            </>
          )}
        </li>
        <li>
          <p>{k("start.install")}</p>
          <Tabs
            items={[
              { key: "python", label: k("tabs.python") },
              { key: "typescript", label: k("tabs.typescript") },
            ]}
            onChange={setSdkLanguage}
            value={sdkLanguage}
          />
          {sdkLanguage === "python" ? (
            <>
              <PythonToolTabs onToolChange={onToolChange} tool={tool} />
              <p className={styles.note}>{k("start.python")}</p>
              <CodeBlock code={sdkProjectCommands(tool, k)} language="shell" />
            </>
          ) : (
            <>
              <p className={styles.note}>
                {k("start.typescript")} {typeScriptVersionNote(platformVersion, k)} {k("start.cli")}
              </p>
              <CodeBlock code={typeScriptInstallCommand(sdk)} language="shell" />
            </>
          )}
        </li>
      </ol>
    </Block>
  );
}

function OsdkBlock({
  data,
  knId,
  tool,
  onToolChange,
}: { data: AppDevelopmentData; knId: string } & PythonToolProps) {
  const k = useCopy();
  const examples = osdkExamples(data, knId, platformOrigin(), k);
  const [selected, setSelected] = useState<OsdkExampleKey>("query");
  const example = examples.find((item) => item.key === selected) ?? examples.at(0);
  return (
    <Block
      actions={
        <a
          className={styles.docsLink}
          href={osdkExamplesUrl()}
          rel="noopener noreferrer"
          target="_blank"
        >
          {k("osdk.moreExamples")} <ExportOutlined />
        </a>
      }
      description={k("osdk.description")}
      title={k("osdk.title")}
    >
      <ol className={styles.steps}>
        <li>
          <p>{k("osdk.generate")}</p>
          <PythonToolTabs onToolChange={onToolChange} tool={tool} />
          <CodeBlock code={osdkGenerateCommand(knId, tool)} language="shell" />
          <CodeBlock code={osdkLayout(k, tool)} language="text" />
          <p className={styles.note}>{k(`osdk.layoutNote.${tool}`)}</p>
        </li>
        <li>
          <p>{k("osdk.use")}</p>
          {example ? (
            <>
              <Tabs
                items={examples.map((item) => ({ key: item.key, label: item.title }))}
                onChange={setSelected}
                value={example.key}
              />
              <p className={styles.note}>{example.note}</p>
              <CodeBlock code={example.code} language="python" />
            </>
          ) : (
            <p className={styles.empty}>
              {data.queryObjects
                ? k("osdk.unavailable", { name: data.queryObjects.name })
                : k("osdk.empty")}
            </p>
          )}
          <p className={styles.note}>{k("osdk.check")}</p>
          <p className={styles.note}>{k("osdk.scope")}</p>
        </li>
      </ol>
    </Block>
  );
}

function Capabilities({
  data,
  env,
  auth,
  networkId,
}: {
  data: AppDevelopmentData;
  env: ContextLoaderEnv;
  auth: McpAuth;
  networkId: string;
}) {
  const k = useCopy();
  const entries = capabilityEntries(data, `/knowledge-network/workspace/${networkId}`, k);
  return (
    <Block title={k("capabilitiesTitle")}>
      {entries.map((entry) => (
        <Capability entry={entry} key={entry.key} tools={data.tools} version={data.platformVersion}>
          {entry.key === "search" ? <SearchTry auth={auth} env={env} /> : null}
          {entry.key === "cypher" && entry.call ? (
            <CypherTry auth={auth} call={entry.call} env={env} />
          ) : null}
        </Capability>
      ))}
    </Block>
  );
}

/** One sign-in method in the languages this platform supports, as tabs. */
function LoginCode({ data, flow }: { data: AppDevelopmentData; flow: LoginFlow }) {
  const k = useCopy();
  const languages = loginLanguages(data);
  const [language, setLanguage] = useState<LoginLanguage>("rest");
  const code = loginCode(data, platformOrigin(), flow, language, k);
  return (
    <>
      <Tabs
        items={languages.map((key) => ({ key, label: k(LANGUAGE_TAB[key]) }))}
        onChange={setLanguage}
        value={language}
      />
      {language === "rest" ? null : <p className={styles.note}>{k(`login.sdk.${language}`)}</p>}
      {code ? <CodeBlock code={code} language={language === "rest" ? "shell" : language} /> : null}
      {languages.includes("typescript") ? null : (
        <p className={styles.note}>{k("login.sdk.typescriptUnavailable")}</p>
      )}
    </>
  );
}

function LoginBlock({ data }: { data: AppDevelopmentData }) {
  const k = useCopy();
  const device = data.oauth?.device;
  const registration = data.oauth?.registration;

  return (
    <Block
      actions={<DocsLink page="auth" version={data.platformVersion} />}
      description={k("login.description")}
      title={k("login.title")}
    >
      <section className={styles.capability}>
        <h3 className={styles.capabilityTitle}>{k("login.deviceTitle")}</h3>
        {device ? (
          <>
            <p className={styles.note}>{k("login.device")}</p>
            <LoginCode data={data} flow="device" />
          </>
        ) : (
          <p className={styles.empty}>{k("login.deviceUnavailable")}</p>
        )}
      </section>
      <section className={styles.capability}>
        <h3 className={styles.capabilityTitle}>{k("login.codeTitle")}</h3>
        {registration ? (
          <>
            <p className={styles.note}>{k("login.code")}</p>
            <RegisterClient endpoint={registration} />
            <LoginCode data={data} flow="code" />
            <p className={styles.note}>
              {k("login.codeRules")}{" "}
              <Link to={CONNECTED_CLIENTS_PATH}>{k("login.connectedClients")}</Link>
            </p>
          </>
        ) : (
          <p className={styles.empty}>{k("login.codeUnavailable")}</p>
        )}
      </section>
    </Block>
  );
}

function AgentBlock({ data, knId }: { data: AppDevelopmentData; knId: string }) {
  const k = useCopy();
  const scenarios = agentScenarios(data, knId, k);
  const question = scenarios[0]?.example ?? "";

  return (
    <Block
      actions={<DocsLink page="agent" version={data.platformVersion} />}
      description={k("agent.description")}
      title={k("agent.title")}
    >
      <h3 className={styles.subTitle}>{k("agent.scenariosTitle")}</h3>
      <ul className={styles.scenarios}>
        {scenarios.map((scenario) => (
          <li key={scenario.key}>
            <strong>{scenario.title}</strong>
            <span>{scenario.description}</span>
            {scenario.example ? (
              <span className={styles.scenarioExample}>
                {k("agent.exampleQuestion", { question: scenario.example })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className={styles.note}>{k("agent.request")}</p>
      <CodeBlock code={renderAgentExecution(platformOrigin(), knId, question)} language="shell" />
      <p className={styles.note}>{k("agent.response")}</p>
      <p className={styles.note}>{k("agent.ownAgent")}</p>
    </Block>
  );
}

function SampleAppBlock({
  data,
  knId,
  tool,
  onToolChange,
}: { data: AppDevelopmentData; knId: string } & PythonToolProps) {
  const k = useCopy();
  const [version, setVersion] = useState<SampleAppVersion>("oauth");
  const [mode, setMode] = useState<SampleAppMode>("generated");
  const [fullCode, setFullCode] = useState(false);
  const code = sampleAppCode(data, knId, platformOrigin(), k, version, tool, mode);
  const keyCode = sampleAppKeyCode(data, knId, platformOrigin(), k, version, tool, mode);
  // The file is long and mostly page and routes, so it is downloaded rather than pasted.
  const save = (text: string) => ({
    text,
    action: code ? (
      <Button
        icon={<DownloadOutlined />}
        onClick={() => download("app.py", code, "text/x-python;charset=utf-8")}
        size="small"
      >
        {k("sampleApp.download")}
      </Button>
    ) : null,
  });
  // Before starting: app.py beside bkn/, and the commands run from qa-app.
  const layout = { text: k("sampleApp.layout.check"), tree: sampleAppLayout(k, tool, mode) };
  const generate = (text: string, generateVersion: SampleAppVersion) =>
    mode === "generated"
      ? [{ text, code: sampleAppGenerateCommand(knId, generateVersion, tool) }]
      : [];
  const steps =
    version === "oauth"
      ? [
          { text: k("sampleApp.register", { redirectUri: EXAMPLE_REDIRECT_URI }) },
          { text: k("sampleApp.install"), code: sampleAppSetupCommands(tool, k) },
          ...generate(k("sampleApp.generate"), "oauth"),
          save(k("sampleApp.save")),
          layout,
          {
            text: k("sampleApp.start", { url: SAMPLE_APP_URL }),
            code: sampleAppStartCommand("oauth", tool),
          },
        ]
      : [
          {
            text: k("sampleApp.apiKey.create"),
            link: <Link to="/account/api-keys">{k("start.apiKeyLink")}</Link>,
          },
          { text: k("sampleApp.apiKey.install"), code: sampleAppSetupCommands(tool, k) },
          ...generate(k("sampleApp.apiKey.generate"), "apiKey"),
          save(k("sampleApp.apiKey.save")),
          layout,
          {
            text: k("sampleApp.apiKey.start", { url: SAMPLE_APP_URL }),
            code: sampleAppStartCommand("apiKey", tool),
          },
        ];
  return (
    <Block description={k("sampleApp.description")} title={k("sampleApp.title")}>
      <Tabs
        items={[
          { key: "oauth", label: k("sampleApp.oauthTab") },
          { key: "apiKey", label: k("sampleApp.apiKeyTab") },
        ]}
        onChange={setVersion}
        value={version}
      />
      <Tabs
        items={[
          { key: "generated", label: k("sampleApp.modes.generated") },
          { key: "runtime", label: k("sampleApp.modes.runtime") },
        ]}
        onChange={setMode}
        value={mode}
      />
      <p className={styles.note}>{k(`sampleApp.modeNotes.${mode}`)}</p>
      <PythonToolTabs onToolChange={onToolChange} tool={tool} />
      {code ? (
        <>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.text}>
                <p>
                  {step.text}
                  {"link" in step ? <> {step.link}</> : null}
                </p>
                {"action" in step ? step.action : null}
                {"tree" in step ? <CodeBlock code={step.tree} language="text" /> : null}
                {"code" in step && step.code ? (
                  <CodeBlock code={step.code} language="shell" />
                ) : null}
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            {k(version === "oauth" ? "sampleApp.limits" : "sampleApp.apiKey.limits")}
          </p>
          <section className={styles.keyCode}>
            <h3 className={styles.subTitle}>{k("sampleApp.keyCode")}</h3>
            <p className={styles.note}>{k("sampleApp.keyCodeNote")}</p>
            {keyCode.map((excerpt) => (
              <div className={styles.excerpt} key={excerpt.key}>
                <p className={styles.excerptTitle}>
                  <strong>{excerpt.title}</strong> {excerpt.description}
                </p>
                <CodeBlock code={excerpt.code} language="python" />
              </div>
            ))}
          </section>
          <Button
            className={styles.fullCodeToggle}
            onClick={() => setFullCode((open) => !open)}
            type="link"
          >
            {fullCode
              ? k("sampleApp.hideFullCode")
              : k("sampleApp.showFullCode", { count: code.split("\n").length - 1 })}
          </Button>
          {fullCode ? <CodeBlock code={code} language="python" /> : null}
        </>
      ) : (
        <p className={styles.empty}>{k("sampleApp.unavailable")}</p>
      )}
    </Block>
  );
}

function McpBlock({ knId }: { knId: string }) {
  const k = useCopy();
  return (
    <Block description={k("mcp.description")} title={k("mcp.title")}>
      <CodeBlock code={mcpUrl(platformOrigin())} language="shell" />
      <p className={styles.note}>
        {k("mcp.network", { knId })}{" "}
        <Link to="/knowledge-network/integration">{k("mcp.link")}</Link>
      </p>
    </Block>
  );
}

function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ExportActions({
  data,
  knId,
  networkName,
}: {
  data: AppDevelopmentData;
  knId: string;
  networkName: string;
}) {
  const k = useCopy();
  const { i18n } = useTranslation();
  const nodes = () => buildGuide({ data, knId, networkName, origin: platformOrigin() }, k);
  return (
    <div className={styles.exportActions}>
      <Button
        icon={<DownloadOutlined />}
        onClick={() =>
          download(guideFileName(knId, "md"), toMarkdown(nodes()), "text/markdown;charset=utf-8")
        }
      >
        {k("guide.download")}
      </Button>
      <Button
        icon={<GlobalOutlined />}
        onClick={() => {
          const html = toHtml(k("guide.title", { name: networkName }), nodes(), i18n.language);
          const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
          window.open(url, "_blank", "noopener");
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }}
      >
        {k("guide.view")}
      </Button>
    </div>
  );
}

export function WorkspaceDevelopSection({
  knId,
  networkId,
  networkName,
}: {
  /** Context Loader kn_id. */
  knId: string;
  /** bkn-backend id of the network, for workspace links and resource lists. */
  networkId: string;
  networkName: string;
}) {
  const k = useCopy();
  const { state, env, auth } = useAppDevelopmentData(networkId, knId);
  const [pythonTool, setPythonTool] = useState<PythonTool>("venv");
  const toolProps = { tool: pythonTool, onToolChange: setPythonTool };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{k("title")}</h1>
          <p className={styles.pageDescription}>{k("description")}</p>
        </div>
        {state.status === "ready" ? (
          <ExportActions data={state.data} knId={knId} networkName={networkName} />
        ) : null}
      </header>
      {state.status === "loading" ? (
        <div className={styles.loading}>
          <Spin /> {k("loading")}
        </div>
      ) : state.status === "error" ? (
        <Alert message={k("loadFailed", { message: state.message })} showIcon type="error" />
      ) : (
        <>
          <GetStarted platformVersion={state.data.platformVersion} {...toolProps} />
          <LoginBlock data={state.data} />
          <OsdkBlock data={state.data} knId={knId} {...toolProps} />
          <Capabilities auth={auth} data={state.data} env={env} networkId={networkId} />
          <AgentBlock data={state.data} knId={knId} />
          <SampleAppBlock data={state.data} knId={knId} {...toolProps} />
          <McpBlock knId={knId} />
        </>
      )}
    </div>
  );
}
