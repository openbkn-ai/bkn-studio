/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CopyOutlined } from "@ant-design/icons";
import { Modal, Spin, Tabs } from "antd";
import type { ReactNode } from "react";

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./ExperienceScene.module.css";

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

/* ============================ API Key 掩码输入（失焦掩码头+尾，聚焦显全编辑） ============================ */

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

export function McpSetupModal({
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

/* ============================ 工具发现（tools/list：动态发现 + 与本地硬编码漂移对照） ============================ */
function SchemaPre({ title, value, copy }: { title: string; value: unknown; copy: (text: string, label?: string) => void }) {
  const text = JSON.stringify(value ?? {}, null, 2);
  return (
    <div className={styles.toolSchema}>
      <div className={styles.codeBlkHead}>
        <span>{title}</span>
        <button type="button" className={styles.mini} onClick={() => copy(text, `${title} 已复制`)}>
          <CopyOutlined /> 复制
        </button>
      </div>
      <pre className={styles.codeBlkPre}>
        <JsonHighlight text={text} />
      </pre>
    </div>
  );
}

export function ToolDiscoveryModal({
  open,
  onClose,
  tools,
  loading,
  error,
  onReload,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  tools: McpToolDef[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  copy: (text: string, label?: string) => void;
}) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={720} title="工具发现 · tools/list">
      <div className={styles.guideRoot}>
        <p className={styles.guideNote}>
          直接向 MCP <code>tools/list</code> 拉取所有线上工具及其 <code>inputSchema</code> / <code>outputSchema</code>。
          左侧 MCP 接口列表已<b>实时由 tools/list 驱动</b>（后端新增工具自动出现）；这里查看各工具完整 schema。
          <button type="button" className={styles.guideLink} onClick={onReload}>
            重新拉取 →
          </button>
        </p>
        {loading ? (
          <div className={styles.discoverEmpty}>
            <Spin />
          </div>
        ) : error ? (
          <div className={styles.resError}>
            <ApiOutlined />
            <div>
              <strong>拉取失败</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : tools ? (
          <>
            <div className={styles.driftRow}>
              <span className={styles.driftStat}>线上 {tools.length} 个</span>
            </div>
            <div className={styles.toolList}>
              {tools.map((tool) => (
                <details key={tool.name} className={styles.toolItem}>
                  <summary className={styles.toolSummary}>
                    <span className={styles.toolName}>{tool.name}</span>
                    {tool.description ? <span className={styles.toolDesc}>{tool.description}</span> : null}
                  </summary>
                  <SchemaPre title="inputSchema" value={tool.inputSchema} copy={copy} />
                  {tool.outputSchema !== undefined ? (
                    <SchemaPre title="outputSchema" value={tool.outputSchema} copy={copy} />
                  ) : null}
                </details>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/* ============================ 数据浏览器（右侧抽屉：schema + 资源 id，点击填入请求体） ============================ */
