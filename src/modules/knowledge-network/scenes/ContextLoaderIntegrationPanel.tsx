/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CaretRightOutlined, CopyOutlined, DatabaseOutlined, DownOutlined, FileTextOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Modal, Select, Spin, Tooltip } from "antd";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

import styles from "./ExperienceScene.module.css";

export type ResponseView = { kind: "json" | "toon"; text: string };

type ToolBusinessInfo = {
  groupKey: "model" | "query" | "data" | "logic" | "network" | "other";
  name: string;
};

const TOOL_GROUPS: Array<{
  key: ToolBusinessInfo["groupKey"];
  label: string;
  description: string;
}> = [
  { key: "model", label: "知识模型检索", description: "查找对象类、关系类、行动类和指标定义" },
  { key: "query", label: "对象与图谱查询", description: "查询对象实例和关系子图" },
  { key: "data", label: "数据资源访问", description: "查看资源、字段结构并执行 SQL" },
  { key: "logic", label: "逻辑属性与行动", description: "计算逻辑属性、召回行动和 Skill" },
  { key: "network", label: "知识网络信息", description: "查看可用网络与当前网络详情" },
  { key: "other", label: "其他能力", description: "线上新增或暂未归类的 MCP 能力" },
];

const TOOL_BUSINESS_NAMES: Record<string, ToolBusinessInfo> = {
  search_schema: { groupKey: "model", name: "知识模型语义检索" },
  get_object_types: { groupKey: "model", name: "对象类定义查询" },
  get_relation_types: { groupKey: "model", name: "关系类定义查询" },
  get_action_types: { groupKey: "model", name: "行动类定义查询" },
  get_metric_types: { groupKey: "model", name: "指标定义查询" },
  query_object_instance: { groupKey: "query", name: "对象实例查询" },
  query_instance_subgraph: { groupKey: "query", name: "关系子图查询" },
  list_resources: { groupKey: "data", name: "数据资源列表" },
  describe_resource: { groupKey: "data", name: "资源字段结构" },
  run_sql: { groupKey: "data", name: "SQL 数据查询" },
  get_logic_properties_values: { groupKey: "logic", name: "逻辑属性计算" },
  get_action_info: { groupKey: "logic", name: "行动工具召回" },
  execute_action: { groupKey: "logic", name: "执行行动" },
  get_action_execution: { groupKey: "logic", name: "行动执行结果" },
  find_skills: { groupKey: "logic", name: "Skill 能力检索" },
  list_knowledge_networks: { groupKey: "network", name: "知识网络列表" },
  get_kn_detail: { groupKey: "network", name: "知识网络详情" },
};

function businessInfoOf(op: ContextLoaderOp): ToolBusinessInfo {
  const exact = TOOL_BUSINESS_NAMES[op.id];
  if (exact) return exact;
  const id = op.id.toLowerCase();
  if (id.includes("object") || id.includes("relation") || id.includes("schema") || id.includes("metric_type")) {
    return { groupKey: "model", name: "知识模型工具" };
  }
  if (id.includes("resource") || id.includes("sql") || id.includes("catalog")) {
    return { groupKey: "data", name: "数据资源工具" };
  }
  if (id.includes("action") || id.includes("skill") || id.includes("logic") || id.includes("metric")) {
    return { groupKey: "logic", name: "逻辑与行动工具" };
  }
  if (id.includes("instance") || id.includes("subgraph") || id.includes("query")) {
    return { groupKey: "query", name: "对象查询工具" };
  }
  if (id.includes("kn") || id.includes("network")) {
    return { groupKey: "network", name: "知识网络工具" };
  }
  return { groupKey: "other", name: "MCP 能力" };
}

type ContextLoaderIntegrationPanelProps = {
  mode: Exclude<ContextLoaderMode, "agent">;
  knId: string;
  activeOps: ContextLoaderOp[];
  op: ContextLoaderOp;
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
          <CopyOutlined /> 复制
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
  const filterText = filter.trim().toLowerCase();
  const appKeyPlaceholder = "bak_<在个人中心 API Key 签发的长期 Key>";
  const configAppKey = appKeyValue || appKeyPlaceholder;
  const mcpUrlWithSlash = withMcpTrailingSlash(mcpUrl);
  const apiKeyPagePath = buildApiKeyPagePath(`${location.pathname}${location.search}`);
  const mcpRemoteJsonConfig = createMcpRemoteJsonConfig(mcpUrlWithSlash, configAppKey);
  const claudeCliConfig = createClaudeCodeMcpCommand(mcpUrlWithSlash, configAppKey);
  const treeGroups = TOOL_GROUPS.map((group) => ({
    ...group,
    items: activeOps.filter((item) => {
      const info = businessInfoOf(item);
      const searchable = `${info.name} ${item.id} ${item.path} ${item.summary} ${group.label}`.toLowerCase();
      return info.groupKey === group.key && (!filterText || searchable.includes(filterText));
    }),
  })).filter(({ items }) => items.length > 0);

  const isMcpVerifyView = mode === "mcp" && !showMcpConnect;
  const isRestVerifyView = mode === "rest";
  const isVerifyView = isMcpVerifyView || isRestVerifyView;
  const queryParamsCollapsible = isVerifyView && visibleQuery.length > 1;
  const dataAssistantKind = requestDataAssistantKindOf(op.id);
  const dataAssistantAvailable = dataAssistantKind !== null;
  const dataAssistantOpen = dataAssistantAvailable && rightTab === "data";
  const dataAssistantDescription =
    dataAssistantKind === "concept-group"
      ? "选择资源组并填入 concept_groups，缩小语义检索范围。"
      : dataAssistantKind === "object-type"
        ? "选择对象类并填入 ot_id；可使用真实样本行生成测试请求。"
        : dataAssistantKind === "resource"
          ? "选择数据资源并填入 SQL 的资源占位；可查看字段和样本数据。"
          : dataAssistantKind === "relation"
            ? "选择关系类并生成子图查询所需的关系路径。"
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
  }, [op.id]);

  useEffect(() => {
    if (bodyError) setCallParamsOpen(true);
  }, [bodyError]);

  useEffect(() => {
    if (sending || response !== null || reqError !== null) {
      setResultOpen(true);
      setMcpResultTab("result");
    }
  }, [sending, response, reqError]);

  return (
    <div className={mainClassName}>
      {mode === "mcp" && showMcpConnect ? (
        <section className={styles.mcpConnectPage}>
          <div className={styles.mcpConnectPanel}>
            <div className={styles.mcpConnectTitleBlock}>
              <h2 className={styles.mcpConnectTitle}>让智能体调用 OpenBKN 能力</h2>
              <p className={styles.mcpConnectDesc}>
                这里生成的是 MCP 接入配置。复制到智能体平台后，智能体可通过 MCP 工具访问 OpenBKN 暴露的检索、查询和行动能力。
              </p>
              <ol className={styles.mcpSteps}>
                <li>前往个人中心签发 API Key，并将 bak_ 开头的长期 Key 填入右侧配置的 Bearer Key。</li>
                <li>选择智能体平台类型，复制整段配置并粘贴到对应的 MCP 服务配置中。</li>
                <li>保存后回到智能体对话，直接提问并让智能体通过 MCP 工具完成检索、查询或行动调用。</li>
              </ol>
            </div>
            <div className={styles.mcpConnectMain}>
              <div className={styles.mcpConfigHeader}>
                <div className={styles.mcpConfigTabs}>
                  {[
                    ["claude", "Claude Code"],
                    ["cursor", "Cursor"],
                    ["generic", "通用 mcp.json"],
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
                    签发 API Key
                  </Link>
                </div>
              </div>
              <div className={styles.mcpConfigBody}>
                {mcpConfigTab === "claude" ? (
                  <>
                    <CodeBlock title="CLI 一行接入" code={claudeCliConfig} onCopy={() => onCopy(claudeCliConfig, "Claude Code 命令已复制")} />
                    <CodeBlock title="项目 .mcp.json" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, ".mcp.json 配置已复制")} />
                  </>
                ) : null}
                {mcpConfigTab === "cursor" ? (
                  <CodeBlock title="~/.cursor/mcp.json 或项目 .cursor/mcp.json" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, "Cursor 配置已复制")} />
                ) : null}
                {mcpConfigTab === "generic" ? (
                  <CodeBlock title="mcpServers 配置" code={mcpRemoteJsonConfig} json onCopy={() => onCopy(mcpRemoteJsonConfig, "mcp.json 配置已复制")} />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <div>
            <div className={styles.listTitle}>{mode === "mcp" ? "MCP 服务" : "REST 接口"}</div>
            <div className={styles.listMeta}>{mode === "mcp" ? `已获取 ${activeOps.length} 项服务` : `${activeOps.length} 项可用`}</div>
          </div>
          {mode === "mcp" ? (
            <button type="button" className={styles.reloadCapabilitiesBtn} onClick={onReloadTools} disabled={toolsLoading}>
              {toolsLoading ? <Spin size="small" /> : null}
              刷新服务列表
            </button>
          ) : null}
        </div>
        <div className={styles.listSearch}>
          <Input value={filter} onChange={(e) => onFilterChange(e.target.value)} placeholder={mode === "mcp" ? "筛选 MCP 服务" : "筛选接口"} />
        </div>
        <div className={styles.eplist}>
          {treeGroups.map(({ key, label, description, items }) => {
            return (
              <details key={key} className={styles.toolTreeGroup} open>
                <summary className={styles.grp}>
                  <span className={styles.grpLabel}>{label}</span>
                  <span className={styles.grpCount}>{items.length}</span>
                </summary>
                <div className={styles.grpDesc}>{description}</div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.ep} ${item.id === selectedId ? styles.epActive : ""}`}
                    onClick={() => onSelectOp(item.id)}
                  >
                    {mode === "mcp" ? null : <span className={styles.epVerb}>POST</span>}
                    <span className={styles.epText}>
                      <span className={styles.epBusinessName}>{businessInfoOf(item).name}</span>
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
                    <FileTextOutlined /> 接口文档
                  </button>
                ) : null}
                <button type="button" className={styles.runBtn} onClick={onSend} disabled={sending}>
                  {sending ? <Spin size="small" /> : <CaretRightOutlined />}
                  {sending ? "运行中..." : "运行"}
                </button>
              </div>
            ) : null}
          </div>
          <div className={styles.reqTitleRow}>
            <h2 className={styles.reqTitle}>{mode === "mcp" ? businessInfoOf(op).name : op.id}</h2>
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
                      {mode === "mcp" ? "参数" : "QUERY 参数"} <span className={styles.cnt}>{visibleQuery.length}</span>
                    </div>
                    {queryParamsCollapsible && !queryParamsOpen ? (
                      <span className={styles.callParamsCollapsedHint}>已收起，展开后编辑 {visibleQuery.length} 个参数</span>
                    ) : null}
                  </div>
                  {queryParamsCollapsible ? (
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setQueryParamsOpen((value) => !value)}
                      aria-expanded={queryParamsOpen}
                    >
                      <span className={styles.callParamsState}>{queryParamsOpen ? "收起" : "展开"}</span>
                      <DownOutlined className={queryParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              ) : mode !== "mcp" ? (
                <div className={styles.secHead}>
                  QUERY 参数 <span className={styles.cnt}>{visibleQuery.length}</span>
                </div>
              ) : null}
              {!queryParamsCollapsible || queryParamsOpen ? (
                <div className={styles.qp}>
                  {visibleQuery.map((param) => (
                    <QueryParamRow
                      key={param.name}
                      param={param}
                      locked={param.name === "kn_id"}
                      label={mode === "mcp" && param.name === "response_format" ? "参数" : undefined}
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
                      请求体 <span className={styles.sub}>application/json</span>
                    </div>
                    {!callParamsOpen ? <span className={styles.callParamsCollapsedHint}>已收起，可展开编辑 body.json</span> : null}
                  </div>
                  <div className={styles.callParamsTools}>
                    {opSupportsTestData(op.id) ? (
                      <Tooltip title="用当前网络真实 schema 和样本行填充，可直接调用">
                        <button type="button" className={styles.paramToolBtn} onClick={onFillTestData} disabled={fillingTest}>
                          {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />}
                          自动填参
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
                        <DatabaseOutlined /> {dataAssistantOpen ? "收起助手" : "请求数据助手"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.callParamsToggle}
                      onClick={() => setCallParamsOpen((value) => !value)}
                      aria-expanded={callParamsOpen}
                    >
                      <span className={styles.callParamsState}>{callParamsOpen ? "收起" : "展开"}</span>
                      <DownOutlined className={callParamsOpen ? styles.callParamsChevronOpen : undefined} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.secHead}>
                  请求体 <span className={styles.sub}>application/json</span>
                </div>
              )}
              {!isVerifyView || callParamsOpen ? (
                <div className={styles.editor}>
                  <div className={styles.editbar}>
                    <span className={styles.editLbl}>body.json</span>
                    <div className={styles.editActions}>
                      <button type="button" className={styles.mini} onClick={onFormatBody}>
                        格式化
                      </button>
                      {isVerifyView ? (
                        <button type="button" className={styles.mini} onClick={onResetBody}>
                          恢复示例
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
              发送请求
            </button>
            {opSupportsTestData(op.id) ? (
              <Tooltip title="用当前网络真实 schema + 样本行填充，可直接发送">
                <button type="button" className={styles.testBtn} onClick={onFillTestData} disabled={fillingTest}>
                  {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />} 填充测试参数
                </button>
              </Tooltip>
            ) : null}
            <button type="button" className={styles.resetBtn} onClick={onResetBody}>
              恢复示例
            </button>
            {dataAssistantAvailable ? (
              <button type="button" className={styles.dataBtn} onClick={() => onRightTabChange(dataAssistantOpen ? "res" : "data")}>
                <DatabaseOutlined /> {dataAssistantOpen ? "收起助手" : "请求数据助手"}
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
              <DatabaseOutlined /> 请求数据助手
            </span>
          }
          footer={null}
          width={980}
          className={styles.requestDataAssistantModal}
          onCancel={() => onRightTabChange("res")}
        >
          <div className={styles.requestDataAssistantModalIntro}>
            <div>
              <strong>为「{businessInfoOf(op).name}」补充请求参数</strong>
              <p>{dataAssistantDescription}</p>
            </div>
            <span className={styles.requestDataAssistantModalTip}>选择后会写入当前请求体</span>
          </div>
          <div className={styles.requestDataAssistantModalBody}>{dataBrowserPanel}</div>
        </Modal>
      ) : null}

      {mode === "mcp" ? (
        <Modal
          open={schemaOpen}
          title={`${businessInfoOf(op).name} · 接口文档`}
          footer={null}
          width={920}
          className={styles.schemaModal}
          onCancel={() => setSchemaOpen(false)}
        >
          <div className={styles.schemaModalIntro}>
            输入字段定义说明调用时可传入的参数、类型和填写规则；输出字段定义说明调用后可能返回的数据结构和字段含义。
          </div>
          {toolsLoading ? (
            <div className={styles.schemaHint}>
              <Spin size="small" /> 正在拉取字段定义…
            </div>
          ) : toolsError ? (
            <div className={styles.schemaHint}>加载失败：{toolsError}</div>
          ) : currentTool ? (
            <div className={styles.schemaGrid}>
              <CodeBlock
                title="输入字段定义"
                code={JSON.stringify(currentTool.inputSchema ?? {}, null, 2)}
                json
                onCopy={() => onCopy(JSON.stringify(currentTool.inputSchema ?? {}, null, 2), "输入字段定义已复制")}
              />
              {currentTool.outputSchema !== undefined ? (
                <CodeBlock
                  title="输出字段定义"
                  code={JSON.stringify(currentTool.outputSchema, null, 2)}
                  json
                  onCopy={() => onCopy(JSON.stringify(currentTool.outputSchema, null, 2), "输出字段定义已复制")}
                />
              ) : (
                <div className={styles.schemaHint}>该能力未提供输出字段定义。</div>
              )}
            </div>
          ) : toolDefs ? (
            <div className={styles.schemaHint}>tools/list 未包含「{op.id}」。</div>
          ) : (
            <div className={styles.schemaHint}>尚未获取能力字段定义。</div>
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
                调用结果
              </button>
              <button
                type="button"
                className={`${styles.rightTab} ${mcpResultTab === "debug" ? styles.rightTabOn : ""}`}
                onClick={() => setMcpResultTab("debug")}
                disabled={!hasCallState}
                title={hasCallState ? "查看本次调用的 cURL 请求命令" : "运行后生成请求命令"}
              >
                请求调试
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${styles.rightTab} ${rightTab === "res" ? styles.rightTabOn : ""}`}
                onClick={() => onRightTabChange("res")}
              >
                响应结果
              </button>
            </>
          )}
        </div>
        <div className={`${styles.rightView} ${!isVerifyView && rightTab !== "res" ? styles.rightHidden : ""} ${isVerifyView && mcpResultTab !== "result" ? styles.rightHidden : ""}`}>
          <div className={styles.resHead}>
            <span className={styles.resTitle}>调用结果</span>
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
                    onClick={() => onCopy(responseView?.text ?? response.text, "响应已复制")}
                  >
                    <CopyOutlined /> 复制结果
                  </button>
                  {isVerifyView ? (
                    <button
                      type="button"
                      className={styles.resultToggle}
                      onClick={() => setResultOpen((value) => !value)}
                      aria-expanded={resultOpen}
                    >
                      {resultOpen ? "收起" : "展开"}
                      <DownOutlined className={resultOpen ? styles.resultToggleOpen : undefined} />
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <span className={styles.resHint}>{mode === "mcp" ? "尚未运行" : "尚未发送请求"}</span>
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
                  <strong>请求失败</strong>
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
                <h3>等待调用</h3>
                <p>确认请求参数后点击「运行」，这里会展示{mode === "mcp" ? " MCP" : " REST"} 返回结果。</p>
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
                  onCopy(curl, "cURL 已复制");
                }}
              >
                复制
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
                <span className={styles.resTitle}>请求调试</span>
                <span className={styles.debugHint}>本次运行对应的 cURL 请求命令</span>
              </div>
              <button type="button" className={styles.copyResp} onClick={() => onCopy(curl, "cURL 已复制")}>
                <CopyOutlined /> 复制命令
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
