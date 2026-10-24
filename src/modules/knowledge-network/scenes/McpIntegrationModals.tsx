/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CopyOutlined } from "@ant-design/icons";
import { Modal, Spin, Tabs } from "antd";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useMcpAuthMode } from "@/modules/knowledge-network/hooks/useMcpAuthMode";
import { useSelfSignedChoice } from "@/modules/knowledge-network/hooks/useSelfSignedChoice";
import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";
import {
  createClaudeCodeMcpCommand,
  createClaudeCodeMcpUrlCommand,
  createMcpRemoteJsonConfig,
  createMcpUrlJsonConfig,
  getMcpConnectionProtocol,
  isLikelySelfSignedMcpHost,
} from "@/modules/knowledge-network/services/mcp-client-config";

import styles from "./ExperienceScene.module.css";
import { McpAuthModeSwitch, McpOauthSteps } from "./McpAuthMode";
import { McpConnectionSecurity } from "./McpConnectionSecurity";

const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function JsonHighlight({ text }: { text: string }) {
  // Avoid token-by-token rendering for very large responses.
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
        // A string followed by a colon is a JSON property key.
        nodes.push(
          <span key={key++} className={styles.jKey}>
            {m[1]}
          </span>,
        );
        nodes.push(
          <span key={key++} className={styles.jPunct}>
            {m[2]}
          </span>,
        );
      } else {
        nodes.push(
          <span key={key++} className={styles.jStr}>
            {m[1]}
          </span>,
        );
      }
    } else if (m[3] !== undefined) {
      nodes.push(
        <span key={key++} className={styles.jKw}>
          {m[3]}
        </span>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <span key={key++} className={styles.jNum}>
          {m[4]}
        </span>,
      );
    }
    last = JSON_TOKEN_RE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

/* ============================ Code blocks ============================ */

function CodeBlock({
  title,
  code,
  json,
  onCopy,
  copyLabel,
}: {
  title: string;
  code: string;
  json?: boolean;
  onCopy: () => void;
  copyLabel: string;
}) {
  return (
    <div className={styles.codeBlk}>
      <div className={styles.codeBlkHead}>
        <span>{title}</span>
        <button type="button" className={styles.mini} onClick={onCopy}>
          <CopyOutlined /> {copyLabel}
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
  onManageApiKey,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  mcpUrl: string;
  /** API Key page; it also lists the clients connected through sign-in. */
  onManageApiKey: () => void;
  copy: (text: string, label?: string) => void;
}) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useMcpAuthMode();
  const isOauthMode = authMode === "oauth";
  const [tab, setTab] = useState("claude");
  // WorkBuddy is only offered for the sign-in mode; fall back when switching to API Key.
  const activeTab = !isOauthMode && tab === "workbuddy" ? "claude" : tab;
  const tk = t("knowledgeNetwork.contextLoaderPanel.appKey.placeholder");
  const protocol = getMcpConnectionProtocol(mcpUrl);
  const [allowInsecureTls, setAllowInsecureTls] = useSelfSignedChoice(
    isLikelySelfSignedMcpHost(mcpUrl),
    protocol,
  );
  const options = { allowInsecureTls };
  const jsonConfig = isOauthMode
    ? createMcpUrlJsonConfig(mcpUrl)
    : createMcpRemoteJsonConfig(mcpUrl, tk, options);
  const claudeCli = isOauthMode
    ? createClaudeCodeMcpUrlCommand(mcpUrl)
    : createClaudeCodeMcpCommand(mcpUrl, tk, options);
  const workbuddyTab = {
    key: "workbuddy",
    label: "WorkBuddy",
    children: (
      <>
        <p className={styles.guideNote}>
          {t("knowledgeNetwork.contextLoaderPanel.mcpAuth.workbuddyHint")}
        </p>
        <CodeBlock
          title="~/.workbuddy/mcp.json"
          code={jsonConfig}
          json
          onCopy={() =>
            copy(jsonConfig, t("knowledgeNetwork.contextLoaderPanel.mcpAuth.copiedWorkbuddy"))
          }
          copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
        />
      </>
    ),
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      title={t("knowledgeNetwork.contextLoaderPanel.mcpSetup.title")}
    >
      <div className={styles.guideRoot}>
        <p className={styles.guideNote}>
          {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.intro")}
        </p>
        <ul className={styles.guideNote}>
          <li>
            <b>{t("knowledgeNetwork.contextLoaderPanel.mcpAuth.oauth")}</b>
            {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.oauthNote")}
          </li>
          <li>
            <b>{t("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey")}</b>
            {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.apiKeyNote")}
          </li>
        </ul>
        <McpAuthModeSwitch value={authMode} onChange={setAuthMode} />
        {isOauthMode ? (
          <McpOauthSteps />
        ) : (
          <p className={styles.guideNote}>
            {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.apiKeyHeaderNote")}
            <code>Authorization: Bearer</code>
            {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.apiKeyHeaderSuffix")}
            <button type="button" className={styles.guideLink} onClick={onManageApiKey}>
              {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.issueApiKey")}
            </button>
          </p>
        )}
        <McpConnectionSecurity
          protocol={protocol}
          authMode={authMode}
          likelySelfSigned={isLikelySelfSignedMcpHost(mcpUrl)}
          allowInsecureTls={allowInsecureTls}
          onAllowInsecureTlsChange={setAllowInsecureTls}
        />
        <Tabs
          activeKey={activeTab}
          onChange={setTab}
          items={[
            {
              key: "claude",
              label: "Claude Code",
              children: (
                <>
                  <CodeBlock
                    title={t("knowledgeNetwork.contextLoaderPanel.mcpSetup.cliTitle")}
                    code={claudeCli}
                    onCopy={() =>
                      copy(
                        claudeCli,
                        t("knowledgeNetwork.contextLoaderPanel.mcpSetup.commandCopied"),
                      )
                    }
                    copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
                  />
                  <CodeBlock
                    title={t("knowledgeNetwork.contextLoaderPanel.mcpSetup.projectConfigTitle")}
                    code={jsonConfig}
                    json
                    onCopy={() =>
                      copy(
                        jsonConfig,
                        t("knowledgeNetwork.contextLoaderPanel.mcpSetup.configCopied"),
                      )
                    }
                    copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
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
                    {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.cursorHintPrefix")}
                    <code>~/.cursor/mcp.json</code>
                    {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.cursorHintMiddle")}
                    <code>.cursor/mcp.json</code>
                    {t("knowledgeNetwork.contextLoaderPanel.mcpSetup.cursorHintSuffix")}
                  </p>
                  <CodeBlock
                    title="~/.cursor/mcp.json"
                    code={jsonConfig}
                    json
                    onCopy={() =>
                      copy(
                        jsonConfig,
                        t("knowledgeNetwork.contextLoaderPanel.mcpSetup.configCopied"),
                      )
                    }
                    copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
                  />
                </>
              ),
            },
            ...(isOauthMode ? [workbuddyTab] : []),
            {
              key: "generic",
              label: t("knowledgeNetwork.contextLoaderPanel.mcpSetup.genericTab"),
              children: (
                <CodeBlock
                  title={t("knowledgeNetwork.contextLoaderPanel.mcpSetup.genericConfigTitle")}
                  code={jsonConfig}
                  json
                  onCopy={() =>
                    copy(jsonConfig, t("knowledgeNetwork.contextLoaderPanel.mcpSetup.configCopied"))
                  }
                  copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
                />
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}

/* ============================ Tool discovery ============================ */
function SchemaPre({
  title,
  value,
  copy,
  copyLabel,
  copiedLabel,
}: {
  title: string;
  value: unknown;
  copy: (text: string, label?: string) => void;
  copyLabel: string;
  copiedLabel: string;
}) {
  const text = JSON.stringify(value ?? {}, null, 2);
  return (
    <div className={styles.toolSchema}>
      <div className={styles.codeBlkHead}>
        <span>{title}</span>
        <button type="button" className={styles.mini} onClick={() => copy(text, copiedLabel)}>
          <CopyOutlined /> {copyLabel}
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
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.title")}
    >
      <div className={styles.guideRoot}>
        <p className={styles.guideNote}>
          {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.descriptionPrefix")}
          <code>tools/list</code>
          {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.descriptionMiddle")}
          <code>inputSchema</code> / <code>outputSchema</code>
          {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.descriptionSuffix")}
          <b>{t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.realtimeList")}</b>
          {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.descriptionEnd")}
          <button type="button" className={styles.guideLink} onClick={onReload}>
            {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.reload")}
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
              <strong>{t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.loadFailed")}</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : tools ? (
          <>
            <div className={styles.driftRow}>
              <span className={styles.driftStat}>
                {t("knowledgeNetwork.contextLoaderPanel.toolDiscovery.onlineCount", {
                  count: tools.length,
                })}
              </span>
            </div>
            <div className={styles.toolList}>
              {tools.map((tool) => (
                <details key={tool.name} className={styles.toolItem}>
                  <summary className={styles.toolSummary}>
                    <span className={styles.toolName}>{tool.name}</span>
                    {/* title / grouping come from server _meta; old servers omit them, so no local mapping is added here. */}
                    {tool.title ? <span className={styles.toolTitle}>{tool.title}</span> : null}
                    {tool.groupTitle ? (
                      <span className={styles.toolGroupTag}>{tool.groupTitle}</span>
                    ) : null}
                    {tool.description ? (
                      <span className={styles.toolDesc}>{tool.description}</span>
                    ) : null}
                  </summary>
                  <SchemaPre
                    title="inputSchema"
                    value={tool.inputSchema}
                    copy={copy}
                    copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
                    copiedLabel={t(
                      "knowledgeNetwork.contextLoaderPanel.toolDiscovery.schemaCopied",
                      { title: "inputSchema" },
                    )}
                  />
                  {tool.outputSchema !== undefined ? (
                    <SchemaPre
                      title="outputSchema"
                      value={tool.outputSchema}
                      copy={copy}
                      copyLabel={t("knowledgeNetwork.contextLoaderPanel.common.copy")}
                      copiedLabel={t(
                        "knowledgeNetwork.contextLoaderPanel.toolDiscovery.schemaCopied",
                        { title: "outputSchema" },
                      )}
                    />
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
