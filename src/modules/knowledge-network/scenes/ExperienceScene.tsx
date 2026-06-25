/**
 * 知识网络「立即体验」—— ContextLoader 接口调试台 (agent-retrieval)。
 * 三个 Tab：Agent 对话 / REST 接口 / MCP 工具。REST 与 MCP 一一对应；发送为真实 HTTP 调用。
 */

import { ArrowLeftOutlined, ApiOutlined, KeyOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useRuntimeConfig } from "@/framework/context/use-runtime-config";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  CONTEXT_LOADER_OPS,
  MCP_PATH,
  buildCurl,
  exampleBodyText,
  mcpPathOf,
  sendRequest,
  type AccountType,
  type ContextLoaderEnv,
  type ContextLoaderMode,
  type ContextLoaderOp,
  type ContextLoaderResponse,
} from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./ExperienceScene.module.css";

const GROUPS = ["Schema & 查询", "Skills & Logic", "Knowledge Network"];

function prettyResponse(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
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
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [mode, setMode] = useState<ContextLoaderMode>("rest");

  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://agent-retrieval:30779"));
  // 自动带 studio 当前登录态（仍可见/可改）：Bearer = 访问令牌，x-account-id/type = 当前用户。
  const [token, setToken] = useState(() => runtimeConfig.auth.tokenManager.getAccessToken() ?? "");
  const [acctId, setAcctId] = useState(() => runtimeConfig.currentUser.id ?? "");
  const [acctType, setAcctType] = useState<AccountType>(() => (runtimeConfig.currentUser.id ? "user" : ""));

  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState(CONTEXT_LOADER_OPS[0]!.id);
  const [bodyText, setBodyText] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [queryVals, setQueryVals] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<ContextLoaderResponse | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [curlOpen, setCurlOpen] = useState(true);

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
    () => ({ base, token, acctId, acctType, knId }),
    [base, token, acctId, acctType, knId],
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
          <div className={styles.ef}>
            <label>x-account-id</label>
            <Input className={styles.accInput} value={acctId} onChange={(e) => setAcctId(e.target.value)} placeholder="可选" />
          </div>
          <div className={styles.ef}>
            <label>x-account-type</label>
            <Select<AccountType>
              className={styles.accType}
              value={acctType}
              onChange={setAcctType}
              options={[
                { value: "", label: "—" },
                { value: "user", label: "user" },
                { value: "app", label: "app" },
                { value: "anonymous", label: "anonymous" },
              ]}
            />
          </div>
        </div>
      </div>

      {mode === "agent" ? (
        <AgentBlank />
      ) : (
        <div className={styles.main}>
          {/* 接口列表 */}
          <aside className={styles.list}>
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
                <pre className={styles.out}>{prettyResponse(response.text)}</pre>
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
                    void navigator.clipboard?.writeText(curl);
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
