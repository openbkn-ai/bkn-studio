/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CopyOutlined, DatabaseOutlined, ReadOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Select, Spin, Tooltip } from "antd";
import { useRef, useState, type ReactNode } from "react";

import {
  opSupportsTestData,
  type ContextLoaderMode,
  type ContextLoaderOp,
  type ContextLoaderResponse,
  type McpToolDef,
} from "@/modules/knowledge-network/services/context-loader.service";

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
  { key: "other", label: "其他工具", description: "线上新增或暂未归类的 MCP 工具" },
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
  return { groupKey: "other", name: "MCP 工具" };
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
  onOpenGuide: () => void;
  onOpenDiscover: () => void;
  toolDefs: McpToolDef[] | null;
  toolsLoading: boolean;
  toolsError: string | null;
  currentTool: McpToolDef | null;
  onReloadTools: () => void;
  dataBrowserPanel: ReactNode;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

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
  onChange,
}: {
  param: ContextLoaderOp["query"][number];
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div className={styles.qpKey}>
        {param.name}
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
  onOpenGuide,
  onOpenDiscover,
  toolDefs,
  toolsLoading,
  toolsError,
  currentTool,
  onReloadTools,
  dataBrowserPanel,
}: ContextLoaderIntegrationPanelProps) {
  const verb = mode === "mcp" ? "MCP" : "POST";
  const [schemaOpen, setSchemaOpen] = useState(false);
  const filterText = filter.trim().toLowerCase();
  const treeGroups = TOOL_GROUPS.map((group) => ({
    ...group,
    items: activeOps.filter((item) => {
      const info = businessInfoOf(item);
      const searchable = `${info.name} ${item.id} ${item.path} ${item.summary} ${group.label}`.toLowerCase();
      return info.groupKey === group.key && (!filterText || searchable.includes(filterText));
    }),
  })).filter(({ items }) => items.length > 0);

  return (
    <div className={styles.main}>
      <aside className={styles.list}>
        <div className={styles.listHead}>
          <div>
            <div className={styles.listTitle}>{mode === "mcp" ? "MCP 工具" : "REST 接口"}</div>
            <div className={styles.listMeta}>{activeOps.length} 项可用</div>
          </div>
          {toolsLoading && mode === "mcp" ? <Spin size="small" /> : null}
        </div>
        <div className={styles.listSearch}>
          <Input value={filter} onChange={(e) => onFilterChange(e.target.value)} placeholder={mode === "mcp" ? "筛选工具" : "筛选接口"} />
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
                    <span className={`${styles.epVerb} ${mode === "mcp" ? styles.epVerbTool : ""}`}>
                      {mode === "mcp" ? "TOOL" : "POST"}
                    </span>
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

      <section className={styles.req}>
        <div className={styles.reqHead}>
          <div className={styles.reqToolbar}>
            <div className={styles.reqRow1}>
              <span className={styles.verb}>{verb}</span>
              <span className={styles.path} title={displayPath}>{displayPath}</span>
            </div>
            {mode === "mcp" ? (
              <div className={styles.mcpTools}>
                <button type="button" className={styles.guideBtn} onClick={onOpenGuide}>
                  <ReadOutlined /> 接入配置
                </button>
                <button type="button" className={styles.discoverBtn} onClick={onOpenDiscover}>
                  <ApiOutlined /> tools/list
                </button>
              </div>
            ) : null}
          </div>
          <h2 className={styles.reqTitle}>{op.id}</h2>
          <p className={styles.reqSum}>{op.summary}</p>
          {mode === "mcp" ? (
            <div className={styles.mcpStatusBar}>
              <span>当前网络：{knId}</span>
              <span>工具来源：{toolDefs ? "线上 tools/list" : "本地预置"}</span>
              <span>Schema：{toolsError ? "加载失败" : currentTool ? "已匹配" : toolsLoading ? "加载中" : "待匹配"}</span>
            </div>
          ) : null}
        </div>
        <div className={styles.reqBody}>
          {visibleQuery.length > 0 ? (
            <div className={styles.sec}>
              <div className={styles.secHead}>
                {mode === "mcp" ? "参数" : "QUERY 参数"} <span className={styles.cnt}>{visibleQuery.length}</span>
              </div>
              <div className={styles.qp}>
                {visibleQuery.map((param) => (
                  <QueryParamRow
                    key={param.name}
                    param={param}
                    locked={param.name === "kn_id"}
                    value={param.name === "kn_id" ? knId : queryVals[param.name] ?? param.value}
                    onChange={(value) => onQueryChange(param.name, value)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {mode === "mcp" ? (
            <div className={styles.sec}>
              <div className={styles.schemaSummary}>
                <div>
                  <div className={styles.secHead}>
                    Schema <span className={styles.sub}>tools/list</span>
                  </div>
                  <div className={styles.schemaBrief}>
                    {toolsError
                      ? `加载失败：${toolsError}`
                      : currentTool
                        ? "已获取当前工具的输入/输出结构"
                        : toolsLoading
                          ? "正在拉取工具 schema"
                          : "等待 tools/list 匹配当前工具"}
                  </div>
                </div>
                <div className={styles.schemaActions}>
                  {toolDefs || toolsError ? (
                    <button type="button" className={styles.mini} onClick={onReloadTools}>
                      刷新
                    </button>
                  ) : null}
                  <button type="button" className={styles.mini} onClick={() => setSchemaOpen((value) => !value)}>
                    {schemaOpen ? "收起" : "展开"}
                  </button>
                </div>
              </div>
              {toolsLoading ? (
                <div className={styles.schemaHint}>
                  <Spin size="small" /> 拉取工具 schema…
                </div>
              ) : toolsError ? (
                <div className={styles.schemaHint}>加载失败：{toolsError}</div>
              ) : currentTool && schemaOpen ? (
                <div className={styles.schemaGrid}>
                  <CodeBlock
                    title="Input Schema"
                    code={JSON.stringify(currentTool.inputSchema ?? {}, null, 2)}
                    json
                    onCopy={() => onCopy(JSON.stringify(currentTool.inputSchema ?? {}, null, 2), "Input Schema 已复制")}
                  />
                  {currentTool.outputSchema !== undefined ? (
                    <CodeBlock
                      title="Output Schema"
                      code={JSON.stringify(currentTool.outputSchema, null, 2)}
                      json
                      onCopy={() => onCopy(JSON.stringify(currentTool.outputSchema, null, 2), "Output Schema 已复制")}
                    />
                  ) : (
                    <div className={styles.schemaHint}>后端未在 tools/list 提供 Output Schema。</div>
                  )}
                </div>
              ) : toolDefs && !currentTool ? (
                <div className={styles.schemaHint}>tools/list 未包含「{op.id}」。</div>
              ) : null}
            </div>
          ) : null}

          {op.body !== null ? (
            <div className={styles.sec}>
              <div className={styles.secHead}>
                {mode === "mcp" ? "调用参数" : "请求体"} <span className={styles.sub}>application/json</span>
              </div>
              <div className={styles.editor}>
                <div className={styles.editbar}>
                  <span className={styles.editLbl}>{mode === "mcp" ? "arguments.json" : "body.json"}</span>
                  <button type="button" className={styles.mini} onClick={onFormatBody}>
                    格式化
                  </button>
                </div>
                <JsonEditor value={bodyText} onChange={onBodyTextChange} />
                {bodyError ? <div className={styles.bodyErr}>{bodyError}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.sendReq} onClick={onSend} disabled={sending}>
            {sending ? <Spin size="small" /> : null}
            发送请求
          </button>
          <button type="button" className={styles.resetBtn} onClick={onResetBody}>
            恢复示例
          </button>
          {opSupportsTestData(op.id) ? (
            <Tooltip title="用当前网络真实 schema + 样本行填充，可直接发送">
              <button type="button" className={styles.testBtn} onClick={onFillTestData} disabled={fillingTest}>
                {fillingTest ? <Spin size="small" /> : <ThunderboltFilled />} 填充测试数据
              </button>
            </Tooltip>
          ) : null}
          <button type="button" className={styles.dataBtn} onClick={() => onRightTabChange("data")}>
            <DatabaseOutlined /> 数据浏览器
          </button>
          <span className={styles.kbd}>⌘ + ↵ 发送</span>
        </div>
      </section>

      <section className={styles.res}>
        <div className={styles.rightTabs}>
          <button
            type="button"
            className={`${styles.rightTab} ${rightTab === "res" ? styles.rightTabOn : ""}`}
            onClick={() => onRightTabChange("res")}
          >
            响应
          </button>
          <button
            type="button"
            className={`${styles.rightTab} ${rightTab === "data" ? styles.rightTabOn : ""}`}
            onClick={() => onRightTabChange("data")}
          >
            <DatabaseOutlined /> 数据浏览器
          </button>
        </div>
        <div className={`${styles.rightView} ${rightTab === "res" ? "" : styles.rightHidden}`}>
          <div className={styles.resHead}>
            <span className={styles.resTitle}>响应</span>
            {response ? (
              <>
                <span className={`${styles.pill} ${response.ok ? styles.pillOk : styles.pillErr}`}>
                  <span className={styles.pillDot} />
                  {response.status} {response.statusText}
                </span>
                <span className={styles.resMeta}>
                  {response.latencyMs}ms · {formatBytes(response.sizeBytes)}
                </span>
                <button
                  type="button"
                  className={styles.copyResp}
                  onClick={() => onCopy(responseView?.text ?? response.text, "响应已复制")}
                >
                  <CopyOutlined /> 复制结果
                </button>
              </>
            ) : (
              <span className={styles.resHint}>尚未发送请求</span>
            )}
          </div>
          <div className={styles.resBody}>
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
                <h3>准备就绪</h3>
                <p>选择接口、确认 kn_id 与参数后点击「发送请求」查看实时响应。</p>
              </div>
            )}
          </div>
          <div className={`${styles.curl} ${curlOpen ? styles.curlOpen : ""}`}>
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
          </div>
        </div>
        <div className={`${styles.rightView} ${rightTab === "data" ? "" : styles.rightHidden}`}>
          {dataBrowserPanel}
        </div>
      </section>
    </div>
  );
}
