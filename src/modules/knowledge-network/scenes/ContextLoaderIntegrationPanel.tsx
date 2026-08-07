/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CaretRightOutlined, CopyOutlined, DatabaseOutlined, DownOutlined, FileTextOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Modal, Select, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { buildApiKeyPagePath } from "@/modules/api-keys/utils/api-key-handoff";
import {
  opSupportsTestData,
  requestDataAssistantKindOf,
  type ContextLoaderMode,
  type ContextLoaderOp,
  type ContextLoaderResponse,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";
import { createClaudeCodeMcpCommand, createMcpRemoteJsonConfig, withMcpTrailingSlash } from "@/modules/knowledge-network/services/mcp-client-config";
import { buildMcpToolGroups, toolDisplayOf } from "@/modules/knowledge-network/services/mcp-tool-display";

import styles from "./ExperienceScene.module.css";

export type ResponseView = { kind: "json" | "toon"; text: string };

type ContextLoaderIntegrationPanelProps = {
  mode: Exclude<ContextLoaderMode, "agent">;
  knId: string;
  activeOps: ContextLoaderOp[];
  op: ContextLoaderOp | null;
  selectedId: string;
  onSelectOp: (id: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  visibleQuery: ContextLoaderOp["query"];
  queryVals: Record<string, string>;
  onQueryChange: (name: string, value: string) => void;
  bodyText: string;
  onBodyTextChange: (value: string) => void;
  bodyError: string | null;
  onFormatBody: () => void;
  displayPath: string;
  response: ContextLoaderResponse | null;
  responseView: ResponseView | null;
  reqError: string | null;
  sending: boolean;
  onSend: () => void;
  onResetBody: () => void;
  fillingTest: boolean;
  onFillTestData: () => void;
  rightTab: "res" | "data";
  onRightTabChange: (tab: "res" | "data") => void;
  curlOpen: boolean;
  onCurlOpenChange: (open: boolean) => void;
  curl: string;
  onCopy: (text: string, label?: string) => void;
  toolDefs: McpToolDef[] | null;
  toolsLoading: boolean;
  toolsError: string | null;
  currentTool: McpToolDef | null;
  onReloadTools: () => void;
  dataBrowserPanel: ReactNode;
  mcpUrl: string;
  appKeyValue: string;
  showMcpConnect?: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:[.]\d+)?(?:[eE][+-]?\d+)?)/g;

function JsonHighlight({ text }: { text: string }) {
  if (text.length > 200_000) return <>{text}</>;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  JSON_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = JSON_TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        nodes.push(<span key={key++} className={styles.jKey}>{m[1]}</span>);
        nodes.push(<span key={key++} className={styles.jPunct}>{m[2]}</span>);
      } else {
        nodes.push(<span key={key++} className={styles.jStr}>{m[1]}</span>);
      }
    } else if (m[3] !== undefined) {
      nodes.push(<span key={key++} className={styles.jKw}>{m[3]}</span>);
    } else if (m[4] !== undefined) {
      nodes.push(<span key={key++} className={styles.jNum}>{m[4]}</span>);
    }
    last = JSON_TOKEN_RE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function JsonEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };
  return (
    <div className={styles.editWrap}>
      <pre ref={preRef} className={styles.editHl} aria-hidden="true">
        <JsonHighlight text={value} />
        {"\n"}
      </pre>
      <textarea
        ref={taRef}
        className={styles.ta}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
      />
    </div>
  );
}

function CodeBlock({
  title,
  code,
  json,
  onCopy,
}: {
  title: string;
  code: string;
  json?: boolean;
  onCopy: () => void;
}) {
  return (
    <div className={styles.codeBlk}>
      <div className={styles.codeBlkHead}>
        <span>{title}</span>
        <button type="button" className={styles.mini} onClick={onCopy}>
          <CopyOutlined /> Copy
        </button>
      </div>
      <pre className={styles.codeBlkPre}>{json ? <JsonHighlight text={code} /> : code}</pre>
    </div>
  );
}

function QueryParamRow({
  param,
  value,
  locked,
  label,
  emphasized,
  onChange,
}: {
  param: ContextLoaderOp["query"][number];
  value: string;
  locked: boolean;
  label?: string;
  emphasized?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div className={styles.qpKey}>
        {emphasized ? <strong>{label ?? param.name}</strong> : label ?? param.name}
        {param.required ? <span className={styles.star}>*</span> : null}
      </div>
      {param.options ? (
        <Select
          className={styles.qpSelect}
          value={value}
          onChange={(next) => onChange(next)}
          options={param.options.map((option) => ({ value: option, label: option }))}
          popupMatchSelectWidth={false}
        />
      ) : (
        <input className={styles.qpInput} value={value} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      )}
    </>
  );
}

export function ContextLoaderIntegrationPanel({
  mode,
  knId,
  activeOps,
  op,
  selectedId,
  onSelectOp,
  filter,
  onFilterChange,
  visibleQuery,
  queryVals,
  onQueryChange,
  bodyText,
  onBodyTextChange,
  bodyError,
  onFormatBody,
  displayPath,
  response,
  responseView,
  reqError,
  sending,
  onSend,
  onResetBody,
  fillingTest,
  onFillTestData,
  rightTab,
  onRightTabChange,
  curlOpen,
  onCurlOpenChange,
  curl,
  onCopy,
  toolDefs,
  toolsLoading,
  toolsError,
  currentTool,
  onReloadTools,
  dataBrowserPanel,
  mcpUrl,
  appKeyValue,
  showMcpConnect = false,
}: ContextLoaderIntegrationPanelProps) {
  const location = useLocation();
  const verb = mode === "mcp" ? "MCP" : "POST";
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [queryParamsOpen, setQueryParamsOpen] = useState(true);
  const [callParamsOpen, setCallParamsOpen] = useState(true);
  const [resultOpen, setResultOpen] = useState(true);
  const [mcpResultTab, setMcpResultTab] = useState<"result" | "debug">("result");
  const [mcpConfigTab, setMcpConfigTab] = useState<"claude" | "cursor" | "generic">("claude");
  const [mcpConfigKey, setMcpConfigKey] = useState(appKeyValue);
  const [mcpConfigKeyDraft, setMcpConfigKeyDraft] = useState("");
  const [mcpConfigKeyError, setMcpConfigKeyError] = useState("");
  const [mcpConfigKeyModalOpen, setMcpConfigKeyModalOpen] = useState(false);
  const filterText = filter.trim().toLowerCase();
  const appKeyPlaceholder = "bak_<long-lived API Key issued from Profile>";
  const configAppKey = mcpConfigKey || appKeyPlaceholder;
  const mcpUrlWithSlash = withMcpTrailingSlash(mcpUrl);
  const apiKeyPagePath = buildApiKeyPagePath(`${location.pathname}${location.search}`);
  const mcpRemoteJsonConfig = createMcpRemoteJsonConfig(mcpUrlWithSlash, configAppKey);
  const claudeCliConfig = createClaudeCodeMcpCommand(mcpUrlWithSlash, configAppKey);
  // Display names and groups come from tools/list metadata first, with local fallback for old servers.
  const toolMetaByName = useMemo(() => new Map((toolDefs ?? []).map((tool) => [tool.name, tool])), [toolDefs]);
  const displayOf = useCallback(
    (target: ContextLoaderOp) => toolDisplayOf(target.id, toolMetaByName.get(target.id)),
    [toolMetaByName],
  );
  const treeGroups = useMemo(() => {
    const groups = buildMcpToolGroups(activeOps, displayOf);
    if (!filterText) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(({ item, display }) =>
          `${display.name} ${item.id} ${item.path} ${item.summary} ${group.label}`.toLowerCase().includes(filterText),
        ),
      }))
      .filter(({ items }) => items.length > 0);
  }, [activeOps, displayOf, filterText]);

  const isMcpVerifyView = mode === "mcp" && !showMcpConnect;
  const isRestVerifyView = mode === "rest";
  const isVerifyView = isMcpVerifyView || isRestVerifyView;
  const queryParamsCollapsible = isVerifyView && visibleQuery.length > 1;
  const dataAssistantKind = requestDataAssistantKindOf(op?.id ?? "");
  // The request data assistant is a Studio-side debugging aid, not part of the MCP contract.
  const dataAssistantAvailable = mode !== "mcp" && dataAssistantKind !== null;
  const dataAssistantOpen = dataAssistantAvailable && rightTab === "data";
  const dataAssistantDescription =
    dataAssistantKind === "concept-group"
      ? "Select a concept group and fill concept_groups to narrow semantic search."
      : dataAssistantKind === "object-type"
        ? "Select an object type and fill ot_id; real sample rows can generate test requests."
        : dataAssistantKind === "resource"
          ? "Select a data resource and fill SQL resource placeholders; fields and samples are available."
          : dataAssistantKind === "relation"
            ? "Select a relation type and generate the relation path required for subgraph queries."
            : "";
  const hasCallState = sending || response !== null || reqError !== null;
  const resultContentVisible = !isVerifyView || (hasCallState && resultOpen && mcpResultTab === "result");
  const mainClassName = [
    styles.main,
    isVerifyView ? styles.mainMcpVerifyStack : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setQueryParamsOpen(true);
    setCallParamsOpen(true);
  }, [op?.id]);

  useEffect(() => {
    if (bodyError) setCallParamsOpen(true);
  }, [bodyError]);

  useEffect(() => {
    if (appKeyValue) setMcpConfigKey(appKeyValue);
  }, [appKeyValue]);

  useEffect(() => {
    if (sending || response !== null || reqError !== null) {
      setResultOpen(true);
      setMcpResultTab("result");
    }
  }, [sending, response, reqError]);

  const openMcpConfigKeyModal = () => {
    setMcpConfigKeyDraft(mcpConfigKey);
    setMcpConfigKeyError("");
    setMcpConfigKeyModalOpen(true);
  };

  const applyMcpConfigKey = () => {
    const nextKey = mcpConfigKeyDraft.trim();
    if (nextKey && !nextKey.startsWith("bak_")) {
      setMcpConfigKeyError("Paste a long-lived API Key starting with bak_");
      return;
    }

    setMcpConfigKey(nextKey);
    setMcpConfigKeyModalOpen(false);
  };

  if (!op) {
    return (
      <div className={mainClassName}>
        <aside className={styles.list}>
          <div className={styles.listHead}>
            <div>
              <div className={styles.listTitle}>MCP Services</div>
              <div className={styles.listMeta}>0 services loaded</div>
            </div>
            <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
              {toolsLoading ? <Spin size="small" /> : null}
              Refresh Service List
            </button>
          </div>
          <div className={styles.listSearch}>
            <Input value={filter} onChange={(event) => onFilterChange(event.target.value)} placeholder="Filter MCP services" disabled />
          </div>
          <div className={styles.resEmpty}>
            <h3>No MCP Services</h3>
            <p>{toolsError || "The MCP server returned no available tools. Check the service configuration and refresh the service list."}</p>
          </div>
        </aside>
        <div className={styles.mcpWork}>
          <section className={styles.req}>
            <div className={styles.resEmpty}>
              <h3>No Debuggable MCP Services</h3>
              <p>After the service list loads, select a tool on the left and run it.</p>
              <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
                {toolsLoading ? <Spin size="small" /> : null}
                Refresh Service List
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const opDisplay = displayOf(op);

  return (
    <div className={mainClassName}>
      {mode === "mcp" && showMcpConnect ? (
        <section className={styles.mcpConnectPage}>
          <div className={styles.mcpConnectPanel}>
            <div className={styles.mcpConnectTitleBlock}>
              <h2 className={styles.mcpConnectTitle}>Let Agents Call OpenBKN Capabilities</h2>
              <p className={styles.mcpConnectDesc}>
                This generates MCP connection config. After copying it into an agent platform, the agent can access OpenBKN retrieval, query, and action capabilities through MCP tools.
              </p>
              <ol className={styles.mcpSteps}>
                <li>Issue an API Key from Profile, then paste the long-lived bak_ key as the Bearer Key in the config.</li>
                <li>Choose the agent platform type, copy the full config, and paste it into the corresponding MCP service config.</li>
                <li>After saving, return to the agent chat and ask questions directly; the agent can use MCP tools for retrieval, queries, or actions.</li>
              </ol>
            </div>
            <div className={styles.mcpConnectMain}>
              <div className={styles.mcpConfigHeader}>
                <div className={styles.mcpConfigTabs}>
                  {[
                    ["claude", "Claude Code"],
                    ["cursor", "Cursor"],
                    ["generic", "Generic mcp.json"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`${styles.mcpConfigTab} ${mcpConfigTab === key ? styles.mcpConfigTabActive : ""}`}
                      onClick={() => setMcpConfigTab(key as typeof mcpConfigTab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.mcpConfigMeta}>
                  <Link className={styles.mcpIssueKeyBtn} to={apiKeyPagePath}>
                    Issue API Key
                  </Link>
                  <button type="button" className={styles.mcpConfigureKeyBtn} onClick={openMcpConfigKeyModal}>
                    {mcpConfigKey ? "API Key Configured" : "Configure API Key"}
                  </button>
                </div>
              </div>
              <div className={styles.mcpConfigBody}>
                {mcpConfigTab === "claude" ? (
                  <>
                    <CodeBlock title="CLI One-Line Setup" code={claudeCliConfig} onCopy={() => onCopy(claudeCliConfig, "Claude Code command copied")} />
                    <CodeBlock title="Project .mcp.json" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, ".mcp.json config copied")} />
                  </>
                ) : null}
                {mcpConfigTab === "cursor" ? (
                  <CodeBlock title="~/.cursor/mcp.json or project .cursor/mcp.json" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, "Cursor config copied")} />
                ) : null}
                {mcpConfigTab === "generic" ? (
                  <CodeBlock title="mcpServers Config" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, "mcp.json config copied")} />
                ) : null}
              </div>
              </div>
            </div>
            <Modal
              open={mcpConfigKeyModalOpen}
              title="Configure API Key"
              okText="Apply Config"
              cancelText="Cancel"
              onCancel={() => setMcpConfigKeyModalOpen(false)}
              onOk={applyMcpConfigKey}
              className={styles.mcpConfigKeyModal}
            >
              <p className={styles.mcpConfigKeyModalDescription}>
                Paste a long-lived API Key starting with bak_. The page will update the Bearer Key in the MCP config below.
              </p>
              <Input.Password
                value={mcpConfigKeyDraft}
                placeholder="Paste API Key"
                autoComplete="off"
                spellCheck={false}
                allowClear
                status={mcpConfigKeyError ? "error" : undefined}
                onChange={(event) => {
                  setMcpConfigKeyDraft(event.target.value);
                  setMcpConfigKeyError("");
                }}
              />
              {mcpConfigKeyError ? <p className={styles.mcpConfigKeyModalError}>{mcpConfigKeyError}</p> : null}
              <p className={styles.mcpConfigKeyModalHint}>Only used to generate config on this page; it is not saved.</p>
            </Modal>
          </section>
      ) : (
        <>
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <div>
            <div className={styles.listTitle}>{mode === "mcp" ? "MCP Services" : "REST APIs"}</div>
            <div className={styles.listMeta}>{mode === "mcp" ? `${activeOps.length} services loaded` : `${activeOps.length} available`}</div>
          </div>
          {mode === "mcp" ? (
            <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
              {toolsLoading ? <Spin size="small" /> : null}
              Refresh Service List
            </button>
          ) : null}
        </div>
        <div className={styles.listSearch}>
          <Input value={filter} onChange={(e) => onFilterChange(e.target.value)} placeholder={mode === "mcp" ? "Filter MCP services" : "Filter APIs"} />
        </div>
        <div className={styles.eplist}>
          {treeGroups.map(({ key, label, description, items }) => {
            return (
              <details key={key} className={styles.toolTreeGroup} open>
                <summary className={styles.grp}>
                  <span className={styles.grpLabel}>{label}</span>
                  <span className={styles.grpCount}>{items.length}</span>
                </summary>
                {description ? <div className={styles.grpDesc}>{description}</div> : null}
                {items.map(({ item, display }) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.ep} ${item.id === selectedId ? styles.epActive : ""}`}
                    onClick={() => onSelectOp(item.id)}
                  >
                    {mode === "mcp" ? null : <span className={styles.epVerb}>POST</span>}
                    <span className={styles.epText}>
                      <span className={styles.epBusinessName}>{display.name}</span>
                      <span className={styles.epName}>{item.id}</span>
                    </span>
                  </button>
                ))}
              </details>
            );
          })}
        </div>
      </aside>

      <div className={isVerifyView ? styles.mcpWork : styles.mcpWorkInline}>
      <section className={styles.req}>
        <div className={styles.reqHead}>
          <div className={styles.reqToolbar}>
            <div className={styles.reqRow1}>
              <span className={styles.verb}>{verb}</span>
              <span className={styles.path} title={displayPath}>{displayPath}</span>
            </div>
            {isVerifyView ? (
              <div className={styles.reqActions}>
                {mode === "mcp" ? (
                  <button type="button" className={styles.docBtn} onClick={() => setSchemaOpen(true)}>
                    <FileTextOutlined /> API Docs
                  </button>
                ) : null}
                <button type="button" className={styles.runBtn} onClick={onSend} disabled={sending}>
                  {sending ? <Spin size="small" /> : <CaretRightOutlined />}
                  {sending ? "Running..." : "Run"}
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.reqTitleRow}>
            <h2 className={styles.reqTitle}>{mode === "mcp" ? opDisplay.name : op.id}</h2>
            {mode === "mcp" ? <span className={styles.reqId}>{op.id}</span> : null}
          </div>
          <p className={styles.reqSum}>{op.summary}</p>
        </div>
        <div className={styles.reqBody}>
          {visibleQuery.length > 0 ? (
            <div className={`${styles.sec} ${isVerifyView ? styles.compactSettingsSec : ""}`}>
              {isVerifyView ? (
                <div className={styles.callParamsHead}>
                  <div className={styles.callParamsTitle}>
                    <div className={styles.secHead}>
                      {mode === "mcp" ? "Parameters" : "QUERY Parameters"} <span className={styles.cnt}>{visibleQuery.length}</span>
                    </div>
                    {queryParamsCollapsible && !queryParamsOpen ? (
                      <span className={styles.callParamsCollapsedHint}>Collapsed; expand to edit {visibleQuery.length} parameters</span>
                    ) : null}
                  </div>
                  {queryParamsCollapsible ? (
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setQueryParamsOpen((value) => !value)}
                      aria-expanded={queryParamsOpen}
                    >
                      <span className={styles.callParamsState}>{queryParamsOpen ? "Collapse" : "Expand"}</span>
                      <DownOutlined className={queryParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              ) : mode !== "mcp" ? (
                <div className={styles.secHead}>
                  QUERY Parameters <span className={styles.cnt}>{visibleQuery.length}</span>
                </div>
              ) : null}
              {!queryParamsCollapsible || queryParamsOpen ? (
                <div className={styles.qp}>
                  {visibleQuery.map((param) => (
                    <QueryParamRow
                      key={param.name}
                      param={param}
                      locked={param.name === "kn_id"}
                      label={mode === "mcp" && param.name === "response_format" ? "Parameter" : undefined}
                      emphasized={mode === "mcp" && param.name === "response_format"}
                      value={param.name === "kn_id" ? knId : queryVals[param.name] ?? param.value}
                      onChange={(value) => onQueryChange(param.name, value)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {op.body !== null ? (
            <div className={`${styles.sec} ${isVerifyView ? styles.callParamsSec : ""}`}>
              {isVerifyView ? (
                <div className={styles.callParamsHead}>
                  <div className={styles.callParamsTitle}>
                    <div className={styles.secHead}>
                      Request Body <span className={styles.sub}>application/json</span>
                    </div>
                    {!callParamsOpen ? <span className={styles.callParamsCollapsedHint}>Collapsed; expand to edit body.json</span> : null}
                  </div>
                  <div className={styles.callParamsTools}>
                    {opSupportsTestData(op.id) ? (
                      <Tooltip title="Fill from the current network schema and sample rows; ready to call">
                        <button type="button" className={styles.paramToolBtn} onClick={onFillTestData} disabled={fillingTest}>
                          {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />}
                          Auto-Fill Params
                        </button>
                      </Tooltip>
                    ) : null}
                    {dataAssistantAvailable ? (
                      <button
                        type="button"
                        className={styles.paramToolBtn}
                        onClick={() => onRightTabChange(dataAssistantOpen ? "res" : "data")}
                        aria-expanded={dataAssistantOpen}
                      >
                        <DatabaseOutlined /> {dataAssistantOpen ? "Collapse Assistant" : "Request Data Assistant"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setCallParamsOpen((value) => !value)}
                      aria-expanded={callParamsOpen}
                    >
                      <span className={styles.callParamsState}>{callParamsOpen ? "Collapse" : "Expand"}</span>
                      <DownOutlined className={callParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secHead}>
                  Request Body <span className={styles.sub}>application/json</span>
                </div>
              )}
              {!isVerifyView || callParamsOpen ? (
                <div className={styles.editor}>
                  <div className={styles.editbar}>
                    <span className={styles.editLbl}>body.json</span>
                    <div className={styles.editActions}>
                      <button type="button" className={styles.mini} onClick={onFormatBody}>
                        Format
                      </button>
                      {isVerifyView ? (
                        <button type="button" className={styles.mini} onClick={onResetBody}>
                          Restore Example
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <JsonEditor value={bodyText} onChange={onBodyTextChange} />
                  {bodyError ? <div className={styles.bodyErr}>{bodyError}</div> : null}
                </div>
              ) : null}
            </div>
          ) : null}

        </div>
        {!isVerifyView ? (
          <div className={styles.actions}>
            <button type="button" className={styles.sendReq} onClick={onSend} disabled={sending}>
              {sending ? <Spin size="small" /> : null}
              Send Request
            </button>
            {opSupportsTestData(op.id) ? (
              <Tooltip title="Fill from current network schema and sample rows; ready to send">
                <button type="button" className={styles.testBtn} onClick={onFillTestData} disabled={fillingTest}>
                  {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />} Fill Test Params
                </button>
              </Tooltip>
            ) : null}
            <button type="button" className={styles.resetBtn} onClick={onResetBody}>
              Restore Example
            </button>
            {dataAssistantAvailable ? (
              <button type="button" className={styles.dataBtn} onClick={() => onRightTabChange(dataAssistantOpen ? "res" : "data")}>
                <DatabaseOutlined /> {dataAssistantOpen ? "Collapse Assistant" : "Request Data Assistant"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {dataAssistantOpen ? (
        <Modal
          open
          title={
            <span className={styles.requestDataAssistantModalTitle}>
              <DatabaseOutlined /> Request Data Assistant
            </span>
          }
          footer={null}
          width={980}
          className={styles.requestDataAssistantModal}
          onCancel={() => onRightTabChange("res")}
        >
          <div className={styles.requestDataAssistantModalIntro}>
            <div>
              <strong>Add request parameters for {opDisplay.name}</strong>
              <p>{dataAssistantDescription}</p>
            </div>
            <span className={styles.requestDataAssistantModalTip}>Selection will be written into the current request body</span>
          </div>
          <div className={styles.requestDataAssistantModalBody}>{dataBrowserPanel}</div>
        </Modal>
      ) : null}

      {mode === "mcp" ? (
        <Modal
          open={schemaOpen}
          title={`${opDisplay.name} · API Docs`}
          footer={null}
          width={920}
          className={styles.schemaModal}
          onCancel={() => setSchemaOpen(false)}
        >
          <div className={styles.schemaModalIntro}>
            Input schema describes accepted parameters, types, and rules. Output schema describes possible returned data structures and fields.
          </div>
          {toolsLoading ? (
            <div className={styles.schemaHint}>
              <Spin size="small" /> Fetching field definitions...
            </div>
          ) : toolsError ? (
            <div className={styles.schemaHint}>Load failed: {toolsError}</div>
          ) : currentTool ? (
            <div className={styles.schemaGrid}>
              <CodeBlock
                title="Input Schema"
                code={JSON.stringify(currentTool.inputSchema ?? {}, null, 2)}
                json
                onCopy={() => onCopy(JSON.stringify(currentTool.inputSchema ?? {}, null, 2), "Input schema copied")}
              />
              {currentTool.outputSchema !== undefined ? (
                <CodeBlock
                  title="Output Schema"
                  code={JSON.stringify(currentTool.outputSchema, null, 2)}
                  json
                  onCopy={() => onCopy(JSON.stringify(currentTool.outputSchema, null, 2), "Output schema copied")}
                />
              ) : (
                <div className={styles.schemaHint}>This capability does not provide an output schema.</div>
              )}
            </div>
          ) : toolDefs ? (
            <div className={styles.schemaHint}>tools/list does not include {op.id}.</div>
          ) : (
            <div className={styles.schemaHint}>Capability schemas have not been loaded yet.</div>
          )}
        </Modal>
      ) : null}

      <section className={`${styles.res} ${isVerifyView && !hasCallState ? styles.resIdle : ""}`}>
        <div className={styles.rightTabs}>
          {isVerifyView ? (
            <>
              <button
                type="button"
                className={`${styles.rightTab} ${mcpResultTab === "result" ? styles.rightTabOn : ""}`}
                onClick={() => setMcpResultTab("result")}
              >
                Call Result
              </button>
              <button
                type="button"
                className={`${styles.rightTab} ${mcpResultTab === "debug" ? styles.rightTabOn : ""}`}
                onClick={() => setMcpResultTab("debug")}
                disabled={!hasCallState}
                title={hasCallState ? "View the cURL command for this call" : "Run to generate the request command"}
              >
                Request Debug
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.rightTab} ${rightTab === "res" ? styles.rightTabOn : ""}`}
                onClick={() => onRightTabChange("res")}
              >
                Response Result
              </button>
            </>
          )}
        </div>
        <div className={`${styles.rightView} ${!isVerifyView && rightTab !== "res" ? styles.rightHidden : ""} ${isVerifyView && mcpResultTab !== "result" ? styles.rightHidden : ""}`}>
          <div className={styles.resHead}>
            <span className={styles.resTitle}>Call Result</span>
            {response ? (
              <>
                <span className={`${styles.pill} ${response.ok ? styles.pillOk : styles.pillErr}`}>
                  <span className={styles.pillDot} />
                  {response.status} {response.statusText}
                </span>
                <span className={styles.resMeta}>
                  {response.latencyMs}ms · {formatBytes(response.sizeBytes)}
                </span>
                <div className={styles.resActions}>
                  <button
                    type="button"
                    className={styles.copyResp}
                    onClick={() => onCopy(responseView?.text ?? response.text, "Response copied")}
                  >
                    <CopyOutlined /> Copy Result
                  </button>
                  {isVerifyView ? (
                    <button
                      type="button"
                      className={styles.resultToggle}
                      onClick={() => setResultOpen((value) => !value)}
                      aria-expanded={resultOpen}
                    >
                      {resultOpen ? "Collapse" : "Expand"}
                      <DownOutlined className={resultOpen ? styles.resultToggleOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <span className={styles.resHint}>{mode === "mcp" ? "Not run yet" : "Request not sent yet"}</span>
            )}
          </div>
          {resultContentVisible ? <div className={styles.resBody}>
            {sending ? (
              <div className={styles.resEmpty}>
                <Spin />
              </div>
            ) : reqError ? (
              <div className={styles.resError}>
                <ApiOutlined />
                <div>
                  <strong>Request Failed</strong>
                  <p>{reqError}</p>
                </div>
              </div>
            ) : responseView ? (
              <pre className={styles.out}>
                {responseView.kind === "toon" ? (
                  <>
                    <span className={styles.toonTag}>TOON</span>
                    {responseView.text}
                  </>
                ) : (
                  <JsonHighlight text={responseView.text} />
                )}
              </pre>
            ) : (
              <div className={styles.resEmpty}>
                <ApiOutlined className={styles.resEmptyIc} />
                <h3>Waiting to Call</h3>
                <p>Confirm request parameters and click Run. This panel will show the{mode === "mcp" ? " MCP" : " REST"} response.</p>
              </div>
            )}
          </div> : null}
          {!isVerifyView && resultContentVisible ? <div className={`${styles.curl} ${curlOpen ? styles.curlOpen : ""}`}>
            <div className={styles.curlHead} onClick={() => onCurlOpenChange(!curlOpen)}>
              <span className={styles.curlLbl}>
                <span className={styles.chev}>▶</span> cURL
              </span>
              <button
                type="button"
                className={styles.mini}
                onClick={(event) => {
                  event.stopPropagation();
                  onCopy(curl, "cURL copied");
                }}
              >
                Copy
              </button>
            </div>
            {curlOpen ? (
              <div className={styles.curlBody}>
                <pre className={styles.curlPre}>{curl}</pre>
              </div>
            ) : null}
          </div> : null}
        </div>
        {isVerifyView ? (
          <div className={`${styles.rightView} ${mcpResultTab === "debug" ? "" : styles.rightHidden}`}>
            <div className={styles.debugHead}>
              <div>
                <span className={styles.resTitle}>Request Debug</span>
                <span className={styles.debugHint}>cURL request command for this run</span>
              </div>
              <button type="button" className={styles.copyResp} onClick={() => onCopy(curl, "cURL copied")}>
                <CopyOutlined /> Copy Command
              </button>
            </div>
            <div className={styles.debugBody}>
              <pre className={styles.curlPre}>{curl}</pre>
            </div>
          </div>
        ) : null}
      </section>
      </div>
        </>
      )}
    </div>
  );
}
