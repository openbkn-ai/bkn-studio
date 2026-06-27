/**
 * 知识网络「立即体验」—— ContextLoader 接口调试台 (agent-retrieval)。
 * 三个 Tab：Agent 对话 / REST 接口 / MCP 工具。REST 与 MCP 一一对应；发送为真实 HTTP 调用。
 */

import {
  ArrowLeftOutlined,
  ApiOutlined,
  CopyOutlined,
  DatabaseOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import { App, Drawer, Empty, Input, Modal, Select, Spin, Tabs, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  CONTEXT_LOADER_OPS,
  MCP_PATH,
  buildCurl,
  exampleBodyText,
  fetchKnDetail,
  fetchObjectInstances,
  mcpPathOf,
  sendRequest,
  type ContextLoaderEnv,
  type ContextLoaderMode,
  type ContextLoaderOp,
  type ContextLoaderResponse,
  type KnDetail,
  type KnObjectType,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./ExperienceScene.module.css";

const GROUPS = ["Schema & 查询", "Skills & Logic", "Knowledge Network"];

function prettyResponse(text: string): string {
  // MCP 走 Streamable HTTP，响应可能是 SSE（event:/data: 行），取最后一条 data 解析。
  const dataLines = text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("data:"))
    .map((line) => line.replace(/^\s*data:/, "").trim())
    .filter(Boolean);
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1]! : text;
  try {
    return JSON.stringify(JSON.parse(candidate), null, 2);
  } catch {
    return text;
  }
}

/** 递归查找名为 key 且值为数组的属性（如嵌套在 search_scope 里的 concept_groups），返回该数组引用。 */
function findArrayProp(node: unknown, key: string): unknown[] | null {
  if (!node || typeof node !== "object") return null;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === key && Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const found = findArrayProp(v, key);
      if (found) return found;
    }
  }
  return null;
}

/* ============================ JSON 语法高亮（无依赖，正则分词） ============================ */
const JSON_TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function JsonHighlight({ text }: { text: string }) {
  // 超大响应不逐 token 渲染，避免卡顿。
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
        // 字符串后紧跟冒号 → 属性名（key）
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

/* ============================ 可编辑 JSON 编辑器（透明 textarea + 背后高亮 pre，滚动同步） ============================ */
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

/* ============================ API Key 掩码输入（失焦掩码头+尾，聚焦显全编辑） ============================ */
function maskKey(value: string): string {
  const v = value.trim();
  return v.length <= 12 ? v : `${v.slice(0, 8)}****${v.slice(-4)}`;
}

function MaskedKeyInput({
  value,
  onChange,
  onIssue,
}: {
  value: string;
  onChange: (next: string) => void;
  onIssue: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={styles.keyField}>
      <input
        className={styles.keyInput}
        value={focused ? value : value ? maskKey(value) : ""}
        placeholder="粘贴 bak_ API Key"
        spellCheck={false}
        autoComplete="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" className={styles.keyIssue} onClick={onIssue}>
        去签发
      </button>
    </div>
  );
}

/* ============================ MCP 接入指南（Claude Code / Cursor / 通用） ============================ */
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

function McpSetupModal({
  open,
  onClose,
  mcpUrl,
  onIssueKey,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  mcpUrl: string;
  onIssueKey: () => void;
  copy: (text: string, label?: string) => void;
}) {
  const tk = "bak_<在「API Key」页签发的长期 Key>";
  const jsonConfig = JSON.stringify(
    {
      mcpServers: {
        "bkn-agent-retrieval": {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${tk}` },
        },
      },
    },
    null,
    2,
  );
  const claudeCli = [
    `claude mcp add --transport http bkn-agent-retrieval ${mcpUrl} \\`,
    `  --header "Authorization: Bearer ${tk}"`,
  ].join("\n");

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={680} title="接入 MCP（Claude Code / Cursor）">
      <div className={styles.guideRoot}>
      <p className={styles.guideNote}>
        接入指南用于<b>外部 MCP 客户端 / SDK</b>（Cursor、Claude Code 等）。鉴权填 <b>AppKey</b>（<code>bak_</code> 开头的长期 Key），
        在左下角「API Key」页签发。
        <button type="button" className={styles.guideLink} onClick={onIssueKey}>
          去签发 AppKey →
        </button>
      </p>
      <p className={styles.guideNote}>
        <b>和本页登录态的差异：</b>本页调试用的是你的<b>会话 token</b>（<code>ory_at_</code>，几十分钟就过期，只够即时调试）；
        外部客户端要长期可用，必须用 <b>AppKey</b>（<code>bak_</code>，长期有效、可撤销、可轮换）。两者都放同一个
        <code>Authorization: Bearer</code> 头，网关按前缀自动识别。
      </p>
      <Tabs
        defaultActiveKey="claude"
        items={[
          {
            key: "claude",
            label: "Claude Code",
            children: (
              <>
                <CodeBlock title="① CLI 一行接入" code={claudeCli} onCopy={() => copy(claudeCli, "命令已复制")} />
                <CodeBlock
                  title="② 或写入项目 .mcp.json"
                  code={jsonConfig}
                  json
                  onCopy={() => copy(jsonConfig, "配置已复制")}
                />
              </>
            ),
          },
          {
            key: "cursor",
            label: "Cursor",
            children: (
              <>
                <p className={styles.guideNote}>
                  写入 <code>~/.cursor/mcp.json</code>（全局）或项目内 <code>.cursor/mcp.json</code>，重启 Cursor 后生效。
                </p>
                <CodeBlock title="~/.cursor/mcp.json" code={jsonConfig} json onCopy={() => copy(jsonConfig, "配置已复制")} />
              </>
            ),
          },
          {
            key: "generic",
            label: "通用 (mcp.json)",
            children: (
              <CodeBlock title="mcpServers 配置" code={jsonConfig} json onCopy={() => copy(jsonConfig, "配置已复制")} />
            ),
          },
        ]}
      />
      </div>
    </Modal>
  );
}

/* ============================ 数据浏览器（右侧抽屉：schema + 资源 id，点击填入请求体） ============================ */
function ObjectTypeCard({
  ot,
  onFillField,
  onFillResource,
  copy,
  env,
}: {
  ot: KnObjectType;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
  copy: (text: string, label?: string) => void;
  env: ContextLoaderEnv;
}) {
  const [open, setOpen] = useState(false);
  const res = ot.data_source ?? null;
  const props = ot.data_properties ?? [];

  // 样本行预览（按需拉取 query_object_instance）
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const togglePreview = () => {
    const next = !previewOpen;
    setPreviewOpen(next);
    if (next && previewRows === null && !previewLoading) {
      setPreviewLoading(true);
      setPreviewError(null);
      fetchObjectInstances(env, ot.id, 5)
        .then((rows) => setPreviewRows(rows))
        .catch((error) => setPreviewError(error instanceof Error ? error.message : "查询失败"))
        .finally(() => setPreviewLoading(false));
    }
  };

  const previewColumns =
    props.length > 0
      ? props.map((p) => p.name)
      : previewRows && previewRows[0]
        ? Object.keys(previewRows[0]).filter((k) => !k.startsWith("_"))
        : [];

  return (
    <div className={styles.dbCard}>
      <div className={styles.dbCardHead}>
        <span className={styles.dbOtName} title={ot.name || ot.id}>
          {ot.name || ot.id}
        </span>
        <button
          type="button"
          className={`${styles.dbFields} ${open ? styles.dbFieldsOpen : ""}`}
          onClick={() => setOpen((value) => !value)}
          disabled={props.length === 0}
        >
          {props.length} 字段 <span className={styles.dbChev}>▾</span>
        </button>
      </div>

      <div className={styles.dbRow}>
        <span className={styles.dbRowLabel}>对象类型</span>
        <Tooltip title="点击填入当前接口的 ot_id">
          <button type="button" className={styles.dbChip} onClick={() => onFillField("ot_id", ot.id)}>
            {ot.id}
          </button>
        </Tooltip>
        <Tooltip title="复制 ot_id">
          <button type="button" className={styles.dbCopy} onClick={() => copy(ot.id, "已复制 ot_id")}>
            <CopyOutlined />
          </button>
        </Tooltip>
      </div>

      <div className={styles.dbRow}>
        <span className={styles.dbRowLabel}>数据资源</span>
        {res?.id ? (
          <>
            <Tooltip title="点击填入 run_sql 的 {{资源}} 占位（其它接口则复制）">
              <button type="button" className={styles.dbRes} onClick={() => onFillResource(res.id)}>
                <DatabaseOutlined /> {res.name || "资源"} · {res.id}
              </button>
            </Tooltip>
            <Tooltip title="复制资源 id">
              <button type="button" className={styles.dbCopy} onClick={() => copy(res.id, "已复制资源 id")}>
                <CopyOutlined />
              </button>
            </Tooltip>
          </>
        ) : (
          <span className={styles.dbNoRes}>无绑定</span>
        )}
      </div>

      {open && props.length > 0 ? (
        <div className={styles.dbPropList}>
          <div className={styles.dbPropHead}>字段 · 点击复制名称</div>
          {props.map((prop) => (
            <Tooltip key={prop.name} title={`复制字段名 ${prop.name}`}>
              <button
                type="button"
                className={styles.dbProp}
                onClick={() => copy(prop.name, `已复制 ${prop.name}`)}
              >
                <span className={styles.dbPropName}>{prop.name}</span>
                {prop.display_name && prop.display_name !== prop.name ? (
                  <span className={styles.dbPropDisp}>{prop.display_name}</span>
                ) : null}
                <span className={styles.dbPropType}>{prop.type || "—"}</span>
                <CopyOutlined className={styles.dbPropCopy} />
              </button>
            </Tooltip>
          ))}
        </div>
      ) : null}

      <div className={styles.dbRow}>
        <span className={styles.dbRowLabel}>样本数据</span>
        <button
          type="button"
          className={`${styles.dbFields} ${previewOpen ? styles.dbFieldsOpen : ""}`}
          onClick={togglePreview}
        >
          {previewOpen ? "收起预览" : "预览数据"} <span className={styles.dbChev}>▾</span>
        </button>
      </div>

      {previewOpen ? (
        <div className={styles.dbPreview}>
          {previewLoading ? (
            <div className={styles.dbPreviewMsg}>
              <Spin size="small" /> 加载中…
            </div>
          ) : previewError ? (
            <div className={styles.dbPreviewErr}>{previewError}</div>
          ) : previewRows && previewRows.length > 0 && previewColumns.length > 0 ? (
            <div className={styles.dbPreviewTableWrap}>
              <table className={styles.dbPreviewTable}>
                <thead>
                  <tr>
                    {previewColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {previewColumns.map((col) => {
                        const value = row[col];
                        const text = value === null || value === undefined ? "—" : String(value);
                        return (
                          <td key={col} title={text}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.dbPreviewMsg}>无数据</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DataBrowserDrawer({
  open,
  onClose,
  env,
  knName,
  onFillField,
  onFillResource,
  onFillConceptGroup,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  env: ContextLoaderEnv;
  knName: string;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
  onFillConceptGroup: (groupId: string) => void;
  copy: (text: string, label?: string) => void;
}) {
  const [detail, setDetail] = useState<KnDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchKnDetail(env)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, env]);

  const sections = useMemo(() => {
    if (!detail) return [];
    const needle = q.trim().toLowerCase();
    const match = (ot: KnObjectType) =>
      !needle ||
      `${ot.id} ${ot.name ?? ""} ${ot.data_source?.id ?? ""} ${ot.data_source?.name ?? ""}`
        .toLowerCase()
        .includes(needle);
    const byId = new Map(detail.object_types.map((o) => [o.id, o]));
    const grouped = detail.concept_groups.map((group) => ({
      id: group.id,
      title: group.name || group.id,
      ots: (group.object_type_ids ?? []).map((oid) => byId.get(oid)).filter((o): o is KnObjectType => Boolean(o)),
    }));
    const inGroup = new Set(detail.concept_groups.flatMap((g) => g.object_type_ids ?? []));
    const ungrouped = detail.object_types.filter((o) => !inGroup.has(o.id));
    if (ungrouped.length) grouped.push({ id: "", title: "未分组", ots: ungrouped });
    return grouped
      .map((section) => ({ ...section, ots: section.ots.filter(match) }))
      .filter((section) => section.ots.length > 0);
  }, [detail, q]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(600px, 92vw)"
      title={`数据浏览器 · ${knName || "知识网络"}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.dbWrap}>
        <p className={styles.dbHint}>
          点「<b>+ 资源组</b>」→ 加入 <code>concept_groups</code>；点「对象类型」→ 填入当前接口的 <code>ot_id</code>；
          点「数据资源」→ 填入 run_sql 的 <code>{"{{资源}}"}</code> 占位；点「预览数据」看样本行。
        </p>
        <div className={styles.dbSearch}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选对象类型 / 资源…" allowClear />
        </div>
        <div className={styles.dbList}>
          {loading ? (
            <div className={styles.dbCenter}>
              <Spin />
            </div>
          ) : error ? (
            <div className={styles.dbError}>
              <ApiOutlined />
              <div>
                <strong>加载失败</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : sections.length === 0 ? (
            <div className={styles.dbCenter}>
              <Empty description="无对象类型" />
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className={styles.dbSection}>
                {section.id ? (
                  <div className={styles.dbGroupRow}>
                    <span className={styles.dbGroup}>{section.title}</span>
                    <Tooltip title={`加入 concept_groups：${section.id}`}>
                      <button
                        type="button"
                        className={styles.dbGroupAdd}
                        onClick={() => onFillConceptGroup(section.id)}
                      >
                        + 资源组
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <div className={styles.dbGroup}>{section.title}</div>
                )}
                {section.ots.map((ot) => (
                  <ObjectTypeCard
                    key={ot.id}
                    ot={ot}
                    onFillField={onFillField}
                    onFillResource={onFillResource}
                    copy={copy}
                    env={env}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </Drawer>
  );
}

/* ============================ Agent 对话（待接入真实 Agent，先留空） ============================ */
function AgentBlank() {
  return (
    <div className={styles.chat}>
      <div className={styles.agentBlank}>
        <div className={styles.introGlyph}>
          <ThunderboltFilled />
        </div>
        <h3>Agent 对话</h3>
        <p>待接入真实 Agent 检索对话，敬请期待。</p>
      </div>
    </div>
  );
}

/* ============================ 主场景 ============================ */
export function ExperienceScene() {
  const navigate = useNavigate();
  const runtimeConfig = useRuntimeConfig();
  const { message } = App.useApp();
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";

  const copy = useCallback(
    (text: string, label = "已复制") => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => message.success(label))
        .catch(() => message.error("复制失败"));
    },
    [message],
  );

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [mode, setMode] = useState<ContextLoaderMode>("rest");

  // 请求基址：走当前源（dev 经 vite 代理转后端，避免浏览器跨域）。
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://agent-retrieval:30779"));
  // 展示/接入指南用真实服务器（网关）地址：dev 取 VITE_DEV_AUTH_ORIGIN，prod 同源。
  const serverAddress = gatewayOrigin() || base;
  // 认证方式：OAuth 会话令牌（默认，每次现取避免过期）或用户粘贴的长期 API Key（bak_）。
  const sessionToken = runtimeConfig.auth.tokenManager.getAccessToken() ?? "";
  const [authMode, setAuthMode] = useState<"oauth" | "apikey">("oauth");
  const [appKey, setAppKey] = useState("");
  const token = authMode === "apikey" ? appKey.trim() : sessionToken;

  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState(CONTEXT_LOADER_OPS[0]!.id);
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [queryVals, setQueryVals] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<ContextLoaderResponse | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [curlOpen, setCurlOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getKnowledgeNetwork(id)
      .then((record) => {
        if (!cancelled && record) {
          setNetwork({ name: record.name, slug: record.identifier });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const knId = network?.slug ?? "kn_legal";
  const env: ContextLoaderEnv = useMemo(
    () => ({ base, token, knId }),
    [base, token, knId],
  );

  const op = useMemo(
    () => CONTEXT_LOADER_OPS.find((item) => item.id === selectedId) ?? CONTEXT_LOADER_OPS[0]!,
    [selectedId],
  );

  // 选中接口 / 模式 / 网络变化时重置请求体与 query 默认值
  useEffect(() => {
    setBodyText(exampleBodyText(op, mode, knId));
    setBodyError(null);
    const next: Record<string, string> = {};
    op.query.forEach((param) => {
      next[param.name] = param.name === "kn_id" ? knId : param.value;
    });
    setQueryVals(next);
    setResponse(null);
    setReqError(null);
  }, [op, mode, knId]);

  // cURL 展示真实网关地址（终端可直接跑，无浏览器跨域顾虑）；请求本体仍走 env.base 代理。
  const curl = useMemo(
    () => buildCurl({ ...env, base: serverAddress }, op, mode, queryVals, bodyText),
    [env, serverAddress, op, mode, queryVals, bodyText],
  );

  const displayPath = mode === "mcp" ? mcpPathOf(op) : op.path;
  // MCP 没有 query；但 response_format 必须可调（注入进 arguments），故 MCP 也露出这一项。
  const visibleQuery = mode === "rest" ? op.query : op.query.filter((param) => param.name === "response_format");

  const onSend = useCallback(async () => {
    if (op.body !== null) {
      try {
        JSON.parse(bodyText || "{}");
        setBodyError(null);
      } catch (error) {
        setBodyError(error instanceof Error ? error.message : "JSON 解析失败");
        return;
      }
    }
    setSending(true);
    setResponse(null);
    setReqError(null);
    try {
      // OAuth：发送时再取一次最新会话令牌（可能已刷新）；API Key：用粘贴的长期 key。
      const freshToken =
        authMode === "apikey" ? appKey.trim() : runtimeConfig.auth.tokenManager.getAccessToken() ?? env.token;
      const freshEnv = { ...env, token: freshToken };
      const result = await sendRequest(freshEnv, op, mode, queryVals, bodyText);
      setResponse(result);
    } catch (error) {
      setReqError(error instanceof Error ? error.message : "请求失败（可能是跨域或服务不可达）");
    } finally {
      setSending(false);
    }
  }, [env, op, mode, queryVals, bodyText, runtimeConfig, authMode, appKey]);

  // 数据浏览器「填入」：字段可能是 REST 的 query 参数（如 query_object_instance 的 ot_id），
  // 也可能在请求体里（如 MCP 的 arguments）。按实际位置填，落不到则复制兜底。
  const fillBodyField = useCallback(
    (key: string, value: string) => {
      // 1) 当前接口把该字段作为 REST query 参数 → 填 query
      if (mode === "rest" && op.query.some((param) => param.name === key)) {
        setQueryVals((prev) => ({ ...prev, [key]: value }));
        message.success(`已填入 ${key}`);
        return;
      }
      // 2) 否则写进请求体 JSON
      try {
        const obj = JSON.parse(bodyText || "{}");
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          (obj as Record<string, unknown>)[key] = value;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(`已填入 ${key}`);
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(value, `已复制（当前接口无 ${key} 字段，可手动粘贴）`);
    },
    [mode, op, bodyText, copy, message],
  );

  const fillResource = useCallback(
    (resourceId: string) => {
      // 后端 SQL 表名占位需前导点：{{.<data_source.id>}}（无点会被当作裸表名报错）。
      const token = `{{.${resourceId}}}`;
      try {
        const obj = JSON.parse(bodyText || "{}") as Record<string, unknown>;
        if (obj && typeof obj === "object" && typeof obj.sql === "string") {
          obj.sql = /\{\{[^}]*\}\}/.test(obj.sql)
            ? obj.sql.replace(/\{\{[^}]*\}\}/, token)
            : `SELECT * FROM ${token} LIMIT 20`;
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success("资源已填入 SQL");
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(token, "已复制资源占位");
    },
    [bodyText, copy, message],
  );

  // 资源组（concept_group）→ 加入请求体的 concept_groups 数组（可能嵌套在 search_scope 下）。
  const fillConceptGroup = useCallback(
    (groupId: string) => {
      try {
        const obj = JSON.parse(bodyText || "{}");
        const arr = findArrayProp(obj, "concept_groups");
        if (arr) {
          if (!arr.includes(groupId)) arr.push(groupId);
          setBodyText(JSON.stringify(obj, null, 2));
          setBodyError(null);
          message.success(`已加入资源组 ${groupId}`);
          return;
        }
      } catch {
        /* 落到复制兜底 */
      }
      copy(groupId, `已复制资源组 ${groupId}（当前接口无 concept_groups）`);
    },
    [bodyText, copy, message],
  );

  const verb = mode === "mcp" ? "MCP" : "POST";

  return (
    <section className={styles.page}>
      <div className={styles.topbar}>
        {network ? (
          <button type="button" className={styles.back} onClick={() => navigate(`/knowledge-network/workspace/${id}/overview`)}>
            <ArrowLeftOutlined /> 返回 {network.name}
          </button>
        ) : null}
        <div className={styles.tabs}>
          {(["agent", "rest", "mcp"] as ContextLoaderMode[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.tab} ${mode === value ? styles.tabActive : ""}`}
              onClick={() => setMode(value)}
            >
              {value === "agent" ? "Agent 对话" : value === "rest" ? "REST 接口" : "MCP 工具"}
            </button>
          ))}
        </div>
        <div className={styles.envset}>
          <div className={styles.ef}>
            <label>知识网络 kn_id</label>
            <div className={styles.knLock}>
              <KeyOutlined />
              <span className={styles.knName}>{network?.name ?? "—"}</span>
              <span className={styles.knSlug}>{knId}</span>
            </div>
          </div>
          <div className={styles.ef}>
            <label>服务地址</label>
            <div
              className={styles.addr}
              title={mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            >
              {mode === "mcp" ? `${serverAddress}${MCP_PATH}` : serverAddress}
            </div>
          </div>
          <div className={styles.ef}>
            <label>
              认证方式
              <Tooltip title="OAuth Token：用你当前登录态（短期，仅本页调试）。API Key：填长期 bak_ Key（右上角「API Key」页签发），仅对 Context Loader 有效。">
                <QuestionCircleOutlined className={styles.hintIcon} />
              </Tooltip>
            </label>
            <Select
              className={styles.authSelect}
              value={authMode}
              onChange={setAuthMode}
              options={[
                { value: "oauth", label: "OAuth Token" },
                { value: "apikey", label: "API Key" },
              ]}
            />
          </div>
          {authMode === "apikey" ? (
            <div className={styles.ef}>
              <label>API Key</label>
              <MaskedKeyInput value={appKey} onChange={setAppKey} onIssue={() => navigate("/account")} />
            </div>
          ) : null}
        </div>
      </div>

      {mode === "agent" ? (
        <AgentBlank />
      ) : (
        <div className={styles.main}>
          {/* 接口列表 */}
          <aside className={styles.list}>
            {mode === "mcp" ? (
              <button type="button" className={styles.guideBtn} onClick={() => setGuideOpen(true)}>
                <ReadOutlined /> 接入 Claude Code / Cursor
              </button>
            ) : null}
            <div className={styles.listSearch}>
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="筛选接口…" />
            </div>
            <div className={styles.eplist}>
              {GROUPS.map((group) => {
                const items = CONTEXT_LOADER_OPS.filter(
                  (item) =>
                    item.group === group &&
                    (!filter || (item.id + item.path + item.summary).toLowerCase().includes(filter.toLowerCase())),
                );
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className={styles.grp}>{group}</div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${styles.ep} ${item.id === selectedId ? styles.epActive : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span className={`${styles.epVerb} ${mode === "mcp" ? styles.epVerbTool : ""}`}>
                          {mode === "mcp" ? "TOOL" : "POST"}
                        </span>
                        <span className={styles.epName}>{item.id}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* 请求 */}
          <section className={styles.req}>
            <div className={styles.reqHead}>
              <div className={styles.reqRow1}>
                <span className={styles.verb}>{verb}</span>
                <span className={styles.path}>{displayPath}</span>
              </div>
              <h2 className={styles.reqTitle}>{op.id}</h2>
              <p className={styles.reqSum}>{op.summary}</p>
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
                        onChange={(value) => setQueryVals((prev) => ({ ...prev, [param.name]: value }))}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {op.body !== null ? (
                <div className={styles.sec}>
                  <div className={styles.secHead}>
                    请求体 <span className={styles.sub}>application/json</span>
                  </div>
                  <div className={styles.editor}>
                    <div className={styles.editbar}>
                      <span className={styles.editLbl}>body.json</span>
                      <button
                        type="button"
                        className={styles.mini}
                        onClick={() => {
                          try {
                            setBodyText(JSON.stringify(JSON.parse(bodyText), null, 2));
                            setBodyError(null);
                          } catch (error) {
                            setBodyError(error instanceof Error ? error.message : "JSON 解析失败");
                          }
                        }}
                      >
                        格式化
                      </button>
                    </div>
                    <JsonEditor value={bodyText} onChange={setBodyText} />
                    {bodyError ? <div className={styles.bodyErr}>{bodyError}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.sendReq} onClick={() => void onSend()} disabled={sending}>
                {sending ? <Spin size="small" /> : null}
                发送请求
              </button>
              <button type="button" className={styles.resetBtn} onClick={() => setBodyText(exampleBodyText(op, mode, knId))}>
                恢复示例
              </button>
              <button type="button" className={styles.dataBtn} onClick={() => setDataOpen(true)}>
                <DatabaseOutlined /> 数据浏览器
              </button>
              <span className={styles.kbd}>⌘ + ↵ 发送</span>
            </div>
          </section>

          {/* 响应 */}
          <section className={styles.res}>
            <div className={styles.resHead}>
              <span className={styles.resTitle}>响应</span>
              {response ? (
                <>
                  <span className={`${styles.pill} ${response.ok ? styles.pillOk : styles.pillErr}`}>
                    <span className={styles.pillDot} />
                    {response.status} {response.statusText}
                  </span>
                  <span className={styles.resMeta}>
                    {response.latencyMs}ms · {response.sizeBytes}B
                  </span>
                  <button
                    type="button"
                    className={styles.copyResp}
                    onClick={() => copy(prettyResponse(response.text), "响应已复制")}
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
              ) : response ? (
                <pre className={styles.out}>
                  <JsonHighlight text={prettyResponse(response.text)} />
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
              <div className={styles.curlHead} onClick={() => setCurlOpen((value) => !value)}>
                <span className={styles.curlLbl}>
                  <span className={styles.chev}>▶</span> cURL
                </span>
                <button
                  type="button"
                  className={styles.mini}
                  onClick={(event) => {
                    event.stopPropagation();
                    copy(curl, "cURL 已复制");
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
          </section>
        </div>
      )}

      <McpSetupModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        mcpUrl={`${serverAddress}${MCP_PATH}`}
        onIssueKey={() => navigate("/account")}
        copy={copy}
      />
      <DataBrowserDrawer
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        env={env}
        knName={network?.name ?? ""}
        onFillField={fillBodyField}
        onFillResource={fillResource}
        onFillConceptGroup={fillConceptGroup}
        copy={copy}
      />
    </section>
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
