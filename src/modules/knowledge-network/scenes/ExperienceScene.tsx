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
  ReadOutlined,
  ThunderboltFilled,
} from "@ant-design/icons";
import { App, Drawer, Empty, Input, Modal, Spin, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  CONTEXT_LOADER_OPS,
  MCP_PATH,
  buildCurl,
  exampleBodyText,
  fetchKnDetail,
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
  token,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  mcpUrl: string;
  token: string;
  copy: (text: string, label?: string) => void;
}) {
  const tk = token || "<your-token>";
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
      <p className={styles.guideNote}>
        本服务为 <b>Streamable HTTP</b> MCP，需带鉴权头。下方已自动填入当前服务地址与登录态——
        Bearer Token 为短期令牌（<code>ory_at_…</code>），正式接入请换用长期令牌。
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
    </Modal>
  );
}

/* ============================ 数据浏览器（右侧抽屉：schema + 资源 id，点击填入请求体） ============================ */
function ObjectTypeCard({
  ot,
  onFillField,
  onFillResource,
  copy,
}: {
  ot: KnObjectType;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
  copy: (text: string, label?: string) => void;
}) {
  const res = ot.data_source ?? null;
  const propCount = ot.data_properties?.length ?? 0;
  return (
    <div className={styles.dbCard}>
      <div className={styles.dbCardHead}>
        <span className={styles.dbOtName}>{ot.name || ot.id}</span>
        <button
          type="button"
          className={styles.dbChip}
          title="填入请求体 ot_id"
          onClick={() => onFillField("ot_id", ot.id)}
        >
          {ot.id}
        </button>
      </div>
      <div className={styles.dbCardMeta}>
        {res?.id ? (
          <button
            type="button"
            className={styles.dbRes}
            title="填入 run_sql 的 {{资源}} 占位（其它接口则复制）"
            onClick={() => onFillResource(res.id)}
          >
            <DatabaseOutlined /> {res.name || "资源"} · {res.id}
          </button>
        ) : (
          <span className={styles.dbNoRes}>无资源绑定</span>
        )}
        <span className={styles.dbProps}>{propCount} 字段</span>
        <button type="button" className={styles.dbCopy} title="复制 ot_id" onClick={() => copy(ot.id, "已复制 ot_id")}>
          <CopyOutlined />
        </button>
      </div>
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
  copy,
}: {
  open: boolean;
  onClose: () => void;
  env: ContextLoaderEnv;
  knName: string;
  onFillField: (key: string, value: string) => void;
  onFillResource: (resourceId: string) => void;
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
      title: group.name || group.id,
      ots: (group.object_type_ids ?? []).map((oid) => byId.get(oid)).filter((o): o is KnObjectType => Boolean(o)),
    }));
    const inGroup = new Set(detail.concept_groups.flatMap((g) => g.object_type_ids ?? []));
    const ungrouped = detail.object_types.filter((o) => !inGroup.has(o.id));
    if (ungrouped.length) grouped.push({ title: "未分组", ots: ungrouped });
    return grouped
      .map((section) => ({ ...section, ots: section.ots.filter(match) }))
      .filter((section) => section.ots.length > 0);
  }, [detail, q]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={`数据浏览器 · ${knName || "知识网络"}`}
      styles={{ body: { padding: 0 } }}
    >
      <div className={styles.dbWrap}>
        <p className={styles.dbHint}>
          点对象类型 id → 填入请求体 <code>ot_id</code>；点资源 → 填入 run_sql 的 <code>{"{{资源}}"}</code> 占位。
          样本行预览将在数据资源就绪后开放。
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
                <div className={styles.dbGroup}>{section.title}</div>
                {section.ots.map((ot) => (
                  <ObjectTypeCard
                    key={ot.id}
                    ot={ot}
                    onFillField={onFillField}
                    onFillResource={onFillResource}
                    copy={copy}
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

  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://agent-retrieval:30779"));
  // 自动带 studio 当前登录态（仍可见/可改）：Bearer = 访问令牌。网关从 token 派生账号，无需 x-account-*。
  const [token, setToken] = useState(() => runtimeConfig.auth.tokenManager.getAccessToken() ?? "");

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

  const curl = useMemo(
    () => buildCurl(env, op, mode, queryVals, bodyText),
    [env, op, mode, queryVals, bodyText],
  );

  const displayPath = mode === "mcp" ? mcpPathOf(op) : op.path;

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
      const result = await sendRequest(env, op, mode, queryVals, bodyText);
      setResponse(result);
    } catch (error) {
      setReqError(error instanceof Error ? error.message : "请求失败（可能是跨域或服务不可达）");
    } finally {
      setSending(false);
    }
  }, [env, op, mode, queryVals, bodyText]);

  // 数据浏览器「填入请求体」：把对象类型 id / 资源占位写进当前 body JSON（非 JSON 则复制兜底）。
  const fillBodyField = useCallback(
    (key: string, value: string) => {
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
      copy(value, `已复制（当前请求体无法自动填入 ${key}）`);
    },
    [bodyText, copy, message],
  );

  const fillResource = useCallback(
    (resourceId: string) => {
      const token = `{{${resourceId}}}`;
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
            <div className={styles.addr} title={mode === "mcp" ? `${base}${MCP_PATH}` : base}>
              {mode === "mcp" ? `${base}${MCP_PATH}` : base}
            </div>
          </div>
          <div className={styles.ef}>
            <label>Bearer Token</label>
            <Input className={styles.tokInput} value={token} onChange={(e) => setToken(e.target.value)} placeholder="可选" />
          </div>
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
              {mode === "rest" && op.query.length > 0 ? (
                <div className={styles.sec}>
                  <div className={styles.secHead}>
                    QUERY 参数 <span className={styles.cnt}>{op.query.length}</span>
                  </div>
                  <div className={styles.qp}>
                    {op.query.map((param) => (
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
                    <textarea
                      className={styles.ta}
                      value={bodyText}
                      spellCheck={false}
                      onChange={(e) => setBodyText(e.target.value)}
                    />
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
        mcpUrl={`${base}${MCP_PATH}`}
        token={token}
        copy={copy}
      />
      <DataBrowserDrawer
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        env={env}
        knName={network?.name ?? ""}
        onFillField={fillBodyField}
        onFillResource={fillResource}
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
        <select className={styles.qpInput} value={value} onChange={(e) => onChange(e.target.value)}>
          {param.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input className={styles.qpInput} value={value} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      )}
    </>
  );
}
