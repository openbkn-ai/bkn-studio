/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CaretRightOutlined, CopyOutlined, DatabaseOutlined, DownOutlined, FileTextOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Modal, Select, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className={styles.codeBlk}>
      <div className={styles.codeBlkHead}>
        <span>{title}</span>
        <button type="button" className={styles.mini} onClick={onCopy}>
          <CopyOutlined /> {t("knowledgeNetwork.contextLoaderPanel.common.copy")}
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
  const { t } = useTranslation();
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
  const appKeyPlaceholder = t("knowledgeNetwork.contextLoaderPanel.appKey.placeholder");
  const configAppKey = mcpConfigKey || appKeyPlaceholder;
  const mcpUrlWithSlash = withMcpTrailingSlash(mcpUrl);
  const apiKeyPagePath = buildApiKeyPagePath(`${location.pathname}${location.search}`);
  const mcpRemoteJsonConfig = createMcpRemoteJsonConfig(mcpUrlWithSlash, configAppKey);
  const claudeCliConfig = createClaudeCodeMcpCommand(mcpUrlWithSlash, configAppKey);
  // Display names and groups come from tools/list metadata first, with local fallback for old servers.
  const toolMetaByName = useMemo(() => new Map((toolDefs ?? []).map((tool) => [tool.name, tool])), [toolDefs]);
  const displayOf = useCallback(
    (target: ContextLoaderOp) => {
      const display = toolDisplayOf(target.id, toolMetaByName.get(target.id));
      const groupPrefix = `knowledgeNetwork.contextLoaderPanel.toolGroups.${display.groupKey}`;
      return {
        ...display,
        groupLabel: t(`${groupPrefix}.label`, { defaultValue: display.groupLabel }),
        groupDescription: display.groupDescription === null ? null : t(`${groupPrefix}.description`, { defaultValue: display.groupDescription }),
        name: t(`knowledgeNetwork.contextLoaderPanel.toolNames.${target.id}`, { defaultValue: display.name }),
      };
    },
    [t, toolMetaByName],
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
      ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.conceptGroup")
      : dataAssistantKind === "object-type"
        ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.objectType")
        : dataAssistantKind === "resource"
          ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.resource")
          : dataAssistantKind === "relation"
            ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.relation")
            : "";
  const hasCallState = sending || response !== null || reqError !== null;
  const resultContentVisible = !isVerifyView || (hasCallState && resultOpen && mcpResultTab === "result");
  const mainClassName = [
    styles.main,
    isVerifyView ? styles.mainMcpVerifyStack : "",
    mode === "mcp" && showMcpConnect ? styles.mainMcpConnectStack : "",
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
      setMcpConfigKeyError(t("knowledgeNetwork.contextLoaderPanel.appKey.invalid"));
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
              <div className={styles.listTitle}>{t("knowledgeNetwork.contextLoaderPanel.common.mcpServices")}</div>
              <div className={styles.listMeta}>{t("knowledgeNetwork.contextLoaderPanel.common.mcpLoaded", { count: 0 })}</div>
            </div>
            <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
              {toolsLoading ? <Spin size="small" /> : null}
              {t("knowledgeNetwork.contextLoaderPanel.common.refreshServices")}
            </button>
          </div>
          <div className={styles.listSearch}>
            <Input value={filter} onChange={(event) => onFilterChange(event.target.value)} placeholder={t("knowledgeNetwork.contextLoaderPanel.common.filterMcpServices")} disabled />
          </div>
          <div className={styles.resEmpty}>
            <h3>{t("knowledgeNetwork.contextLoaderPanel.empty.noMcpServices")}</h3>
            <p>{toolsError || t("knowledgeNetwork.contextLoaderPanel.empty.noMcpServicesDescription")}</p>
          </div>
        </aside>
        <div className={styles.mcpWork}>
          <section className={styles.req}>
            <div className={styles.resEmpty}>
              <h3>{t("knowledgeNetwork.contextLoaderPanel.empty.noDebuggableMcpServices")}</h3>
              <p>{t("knowledgeNetwork.contextLoaderPanel.empty.noDebuggableMcpServicesDescription")}</p>
              <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
                {toolsLoading ? <Spin size="small" /> : null}
                {t("knowledgeNetwork.contextLoaderPanel.common.refreshServices")}
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
              <h2 className={styles.mcpConnectTitle}>{t("knowledgeNetwork.contextLoaderPanel.mcpConnect.title")}</h2>
              <p className={styles.mcpConnectDesc}>
                {t("knowledgeNetwork.contextLoaderPanel.mcpConnect.description")}
              </p>
              <ol className={styles.mcpSteps}>
                <li>{t("knowledgeNetwork.contextLoaderPanel.mcpConnect.stepIssueKey")}</li>
                <li>{t("knowledgeNetwork.contextLoaderPanel.mcpConnect.stepCopyConfig")}</li>
                <li>{t("knowledgeNetwork.contextLoaderPanel.mcpConnect.stepUseAgent")}</li>
              </ol>
            </div>
            <div className={styles.mcpConnectMain}>
              <div className={styles.mcpConfigHeader}>
                <div className={styles.mcpConfigTabs}>
                  {[
                    ["claude", "Claude Code"],
                    ["cursor", "Cursor"],
                    ["generic", t("knowledgeNetwork.contextLoaderPanel.mcpConnect.genericTab")],
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
                    {t("knowledgeNetwork.contextLoaderPanel.appKey.issue")}
                  </Link>
                  <button type="button" className={styles.mcpConfigureKeyBtn} onClick={openMcpConfigKeyModal}>
                    {mcpConfigKey ? t("knowledgeNetwork.contextLoaderPanel.appKey.configured") : t("knowledgeNetwork.contextLoaderPanel.appKey.configure")}
                  </button>
                </div>
              </div>
              <div className={styles.mcpConfigBody}>
                {mcpConfigTab === "claude" ? (
                  <>
                    <CodeBlock title={t("knowledgeNetwork.contextLoaderPanel.mcpConnect.cliTitle")} code={claudeCliConfig} onCopy={() => onCopy(claudeCliConfig, t("knowledgeNetwork.contextLoaderPanel.mcpConnect.copiedClaude"))} />
                    <CodeBlock title={t("knowledgeNetwork.contextLoaderPanel.mcpConnect.projectConfigTitle")} code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, t("knowledgeNetwork.contextLoaderPanel.mcpConnect.copiedProject"))} />
                  </>
                ) : null}
                {mcpConfigTab === "cursor" ? (
                  <CodeBlock title={t("knowledgeNetwork.contextLoaderPanel.mcpConnect.cursorConfigTitle")} code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, t("knowledgeNetwork.contextLoaderPanel.mcpConnect.copiedCursor"))} />
                ) : null}
                {mcpConfigTab === "generic" ? (
                  <CodeBlock title={t("knowledgeNetwork.contextLoaderPanel.mcpConnect.genericConfigTitle")} code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, t("knowledgeNetwork.contextLoaderPanel.mcpConnect.copiedGeneric"))} />
                ) : null}
              </div>
              </div>
            </div>
            <Modal
              open={mcpConfigKeyModalOpen}
              title={t("knowledgeNetwork.contextLoaderPanel.appKey.modalTitle")}
              okText={t("knowledgeNetwork.contextLoaderPanel.appKey.apply")}
              cancelText={t("common.cancel")}
              onCancel={() => setMcpConfigKeyModalOpen(false)}
              onOk={applyMcpConfigKey}
              className={styles.mcpConfigKeyModal}
            >
              <p className={styles.mcpConfigKeyModalDescription}>
                {t("knowledgeNetwork.contextLoaderPanel.appKey.description")}
              </p>
              <Input.Password
                value={mcpConfigKeyDraft}
                placeholder={t("knowledgeNetwork.contextLoaderPanel.appKey.inputPlaceholder")}
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
              <p className={styles.mcpConfigKeyModalHint}>{t("knowledgeNetwork.contextLoaderPanel.appKey.hint")}</p>
            </Modal>
          </section>
      ) : (
        <>
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <div>
            <div className={styles.listTitle}>{mode === "mcp" ? t("knowledgeNetwork.contextLoaderPanel.common.mcpServices") : t("knowledgeNetwork.contextLoaderPanel.common.restApis")}</div>
            <div className={styles.listMeta}>{mode === "mcp" ? t("knowledgeNetwork.contextLoaderPanel.common.mcpLoaded", { count: activeOps.length }) : t("knowledgeNetwork.contextLoaderPanel.common.restAvailable", { count: activeOps.length })}</div>
          </div>
          {mode === "mcp" ? (
            <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
              {toolsLoading ? <Spin size="small" /> : null}
              {t("knowledgeNetwork.contextLoaderPanel.common.refreshServices")}
            </button>
          ) : null}
        </div>
        <div className={styles.listSearch}>
          <Input value={filter} onChange={(e) => onFilterChange(e.target.value)} placeholder={mode === "mcp" ? t("knowledgeNetwork.contextLoaderPanel.common.filterMcpServices") : t("knowledgeNetwork.contextLoaderPanel.common.filterApis")} />
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
                    <FileTextOutlined /> {t("knowledgeNetwork.contextLoaderPanel.request.doc")}
                  </button>
                ) : null}
                <button type="button" className={styles.runBtn} onClick={onSend} disabled={sending}>
                  {sending ? <Spin size="small" /> : <CaretRightOutlined />}
                  {sending ? t("knowledgeNetwork.contextLoaderPanel.request.running") : t("knowledgeNetwork.contextLoaderPanel.request.run")}
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
                      {mode === "mcp" ? t("knowledgeNetwork.contextLoaderPanel.request.params") : t("knowledgeNetwork.contextLoaderPanel.request.queryParams")} <span className={styles.cnt}>{visibleQuery.length}</span>
                    </div>
                    {queryParamsCollapsible && !queryParamsOpen ? (
                      <span className={styles.callParamsCollapsedHint}>{t("knowledgeNetwork.contextLoaderPanel.request.queryCollapsed", { count: visibleQuery.length })}</span>
                    ) : null}
                  </div>
                  {queryParamsCollapsible ? (
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setQueryParamsOpen((value) => !value)}
                      aria-expanded={queryParamsOpen}
                    >
                      <span className={styles.callParamsState}>{queryParamsOpen ? t("knowledgeNetwork.contextLoaderPanel.common.collapse") : t("knowledgeNetwork.contextLoaderPanel.common.expand")}</span>
                      <DownOutlined className={queryParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              ) : mode !== "mcp" ? (
                <div className={styles.secHead}>
                  {t("knowledgeNetwork.contextLoaderPanel.request.queryParams")} <span className={styles.cnt}>{visibleQuery.length}</span>
                </div>
              ) : null}
              {!queryParamsCollapsible || queryParamsOpen ? (
                <div className={styles.qp}>
                  {visibleQuery.map((param) => (
                    <QueryParamRow
                      key={param.name}
                      param={param}
                      locked={param.name === "kn_id"}
                      label={mode === "mcp" && param.name === "response_format" ? t("knowledgeNetwork.contextLoaderPanel.request.params") : undefined}
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
                      {t("knowledgeNetwork.contextLoaderPanel.request.body")} <span className={styles.sub}>application/json</span>
                    </div>
                    {!callParamsOpen ? <span className={styles.callParamsCollapsedHint}>{t("knowledgeNetwork.contextLoaderPanel.request.bodyCollapsed")}</span> : null}
                  </div>
                  <div className={styles.callParamsTools}>
                    {opSupportsTestData(op.id) ? (
                      <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.request.autoFillTooltip")}>
                        <button type="button" className={styles.paramToolBtn} onClick={onFillTestData} disabled={fillingTest}>
                          {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />}
                          {t("knowledgeNetwork.contextLoaderPanel.request.autoFill")}
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
                        <DatabaseOutlined /> {dataAssistantOpen ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.close") : t("knowledgeNetwork.contextLoaderPanel.dataAssistant.open")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setCallParamsOpen((value) => !value)}
                      aria-expanded={callParamsOpen}
                    >
                      <span className={styles.callParamsState}>{callParamsOpen ? t("knowledgeNetwork.contextLoaderPanel.common.collapse") : t("knowledgeNetwork.contextLoaderPanel.common.expand")}</span>
                      <DownOutlined className={callParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secHead}>
                  {t("knowledgeNetwork.contextLoaderPanel.request.body")} <span className={styles.sub}>application/json</span>
                </div>
              )}
              {!isVerifyView || callParamsOpen ? (
                <div className={styles.editor}>
                  <div className={styles.editbar}>
                    <span className={styles.editLbl}>body.json</span>
                    <div className={styles.editActions}>
                      <button type="button" className={styles.mini} onClick={onFormatBody}>
                        {t("knowledgeNetwork.contextLoaderPanel.common.format")}
                      </button>
                      {isVerifyView ? (
                        <button type="button" className={styles.mini} onClick={onResetBody}>
                          {t("knowledgeNetwork.contextLoaderPanel.common.resetExample")}
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
              {t("knowledgeNetwork.contextLoaderPanel.request.sendRequest")}
            </button>
            {opSupportsTestData(op.id) ? (
              <Tooltip title={t("knowledgeNetwork.contextLoaderPanel.request.autoFillRestTooltip")}>
                <button type="button" className={styles.testBtn} onClick={onFillTestData} disabled={fillingTest}>
                  {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />} {t("knowledgeNetwork.contextLoaderPanel.request.fillTestParams")}
                </button>
              </Tooltip>
            ) : null}
            <button type="button" className={styles.resetBtn} onClick={onResetBody}>
              {t("knowledgeNetwork.contextLoaderPanel.common.resetExample")}
            </button>
            {dataAssistantAvailable ? (
              <button type="button" className={styles.dataBtn} onClick={() => onRightTabChange(dataAssistantOpen ? "res" : "data")}>
                <DatabaseOutlined /> {dataAssistantOpen ? t("knowledgeNetwork.contextLoaderPanel.dataAssistant.close") : t("knowledgeNetwork.contextLoaderPanel.dataAssistant.open")}
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
              <DatabaseOutlined /> {t("knowledgeNetwork.contextLoaderPanel.dataAssistant.title")}
            </span>
          }
          footer={null}
          width={980}
          className={styles.requestDataAssistantModal}
          onCancel={() => onRightTabChange("res")}
        >
          <div className={styles.requestDataAssistantModalIntro}>
            <div>
              <strong>{t("knowledgeNetwork.contextLoaderPanel.dataAssistant.modalTitle", { name: opDisplay.name })}</strong>
              <p>{dataAssistantDescription}</p>
            </div>
            <span className={styles.requestDataAssistantModalTip}>{t("knowledgeNetwork.contextLoaderPanel.dataAssistant.tip")}</span>
          </div>
          <div className={styles.requestDataAssistantModalBody}>{dataBrowserPanel}</div>
        </Modal>
      ) : null}

      {mode === "mcp" ? (
        <Modal
          open={schemaOpen}
          title={t("knowledgeNetwork.contextLoaderPanel.schema.title", { name: opDisplay.name })}
          footer={null}
          width={920}
          className={styles.schemaModal}
          onCancel={() => setSchemaOpen(false)}
        >
          <div className={styles.schemaModalIntro}>
            {t("knowledgeNetwork.contextLoaderPanel.schema.intro")}
          </div>
          {toolsLoading ? (
            <div className={styles.schemaHint}>
              <Spin size="small" /> {t("knowledgeNetwork.contextLoaderPanel.schema.loading")}
            </div>
          ) : toolsError ? (
            <div className={styles.schemaHint}>{t("knowledgeNetwork.contextLoaderPanel.schema.loadFailed", { error: toolsError })}</div>
          ) : currentTool ? (
            <div className={styles.schemaGrid}>
              <CodeBlock
                title={t("knowledgeNetwork.contextLoaderPanel.schema.inputTitle")}
                code={JSON.stringify(currentTool.inputSchema ?? {}, null, 2)}
                json
                onCopy={() => onCopy(JSON.stringify(currentTool.inputSchema ?? {}, null, 2), t("knowledgeNetwork.contextLoaderPanel.schema.copiedInput"))}
              />
              {currentTool.outputSchema !== undefined ? (
                <CodeBlock
                  title={t("knowledgeNetwork.contextLoaderPanel.schema.outputTitle")}
                  code={JSON.stringify(currentTool.outputSchema, null, 2)}
                  json
                  onCopy={() => onCopy(JSON.stringify(currentTool.outputSchema, null, 2), t("knowledgeNetwork.contextLoaderPanel.schema.copiedOutput"))}
                />
              ) : (
                <div className={styles.schemaHint}>{t("knowledgeNetwork.contextLoaderPanel.schema.noOutput")}</div>
              )}
            </div>
          ) : toolDefs ? (
            <div className={styles.schemaHint}>{t("knowledgeNetwork.contextLoaderPanel.schema.missingTool", { id: op.id })}</div>
          ) : (
            <div className={styles.schemaHint}>{t("knowledgeNetwork.contextLoaderPanel.schema.notLoaded")}</div>
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
                {t("knowledgeNetwork.contextLoaderPanel.response.result")}
              </button>
              <button
                type="button"
                className={`${styles.rightTab} ${mcpResultTab === "debug" ? styles.rightTabOn : ""}`}
                onClick={() => setMcpResultTab("debug")}
                disabled={!hasCallState}
                title={hasCallState ? t("knowledgeNetwork.contextLoaderPanel.response.debugReadyTitle") : t("knowledgeNetwork.contextLoaderPanel.response.debugPendingTitle")}
              >
                {t("knowledgeNetwork.contextLoaderPanel.response.debug")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.rightTab} ${rightTab === "res" ? styles.rightTabOn : ""}`}
                onClick={() => onRightTabChange("res")}
              >
                {t("knowledgeNetwork.contextLoaderPanel.response.responseResult")}
              </button>
            </>
          )}
        </div>
        <div className={`${styles.rightView} ${!isVerifyView && rightTab !== "res" ? styles.rightHidden : ""} ${isVerifyView && mcpResultTab !== "result" ? styles.rightHidden : ""}`}>
          <div className={styles.resHead}>
            <span className={styles.resTitle}>{t("knowledgeNetwork.contextLoaderPanel.response.result")}</span>
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
                    onClick={() => onCopy(responseView?.text ?? response.text, t("knowledgeNetwork.contextLoaderPanel.response.copiedResponse"))}
                  >
                    <CopyOutlined /> {t("knowledgeNetwork.contextLoaderPanel.response.copyResult")}
                  </button>
                  {isVerifyView ? (
                    <button
                      type="button"
                      className={styles.resultToggle}
                      onClick={() => setResultOpen((value) => !value)}
                      aria-expanded={resultOpen}
                    >
                      {resultOpen ? t("knowledgeNetwork.contextLoaderPanel.common.collapse") : t("knowledgeNetwork.contextLoaderPanel.common.expand")}
                      <DownOutlined className={resultOpen ? styles.resultToggleOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <span className={styles.resHint}>{mode === "mcp" ? t("knowledgeNetwork.contextLoaderPanel.response.notRun") : t("knowledgeNetwork.contextLoaderPanel.response.notSent")}</span>
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
                  <strong>{t("knowledgeNetwork.contextLoaderPanel.response.failed")}</strong>
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
                <h3>{t("knowledgeNetwork.contextLoaderPanel.response.waitingTitle")}</h3>
                <p>{t("knowledgeNetwork.contextLoaderPanel.response.waitingDescription", { mode: mode === "mcp" ? "MCP" : "REST" })}</p>
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
                  onCopy(curl, t("knowledgeNetwork.contextLoaderPanel.common.copiedCurl"));
                }}
              >
                {t("knowledgeNetwork.contextLoaderPanel.common.copy")}
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
                <span className={styles.resTitle}>{t("knowledgeNetwork.contextLoaderPanel.response.debug")}</span>
                <span className={styles.debugHint}>{t("knowledgeNetwork.contextLoaderPanel.response.debugHint")}</span>
              </div>
              <button type="button" className={styles.copyResp} onClick={() => onCopy(curl, t("knowledgeNetwork.contextLoaderPanel.common.copiedCurl"))}>
                <CopyOutlined /> {t("knowledgeNetwork.contextLoaderPanel.response.copyCommand")}
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
