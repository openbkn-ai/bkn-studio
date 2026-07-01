/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined } from "@ant-design/icons";
import { Tabs } from "antd";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  buildClaudeCliSnippet,
  buildCodexSnippet,
  buildMcpSnippet,
  buildRestSnippet,
} from "@/modules/api-keys/utils/api-key-usage";

import styles from "./UsageBlocks.module.css";

function CodeBlock({ title, code, onCopy }: { title: string; code: string; onCopy: () => void }) {
  return (
    <div className={styles.block}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <button type="button" className={styles.copy} onClick={onCopy}>
          <CopyOutlined />
        </button>
      </div>
      <pre className={styles.pre}>{code}</pre>
    </div>
  );
}

/** 把密钥（或 <YOUR_API_KEY> 占位）填进各客户端用法示例：REST / Claude Code / Codex / Cursor / 通用。 */
export function UsageBlocks({ keyValue }: { keyValue: string }) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const rest = buildRestSnippet(keyValue);
  const mcp = buildMcpSnippet(keyValue);
  const claudeCli = buildClaudeCliSnippet(keyValue);
  const codex = buildCodexSnippet(keyValue);

  const copy = (text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => message.success(t("apiKeys.secretModal.copied")))
      .catch(() => message.error(t("apiKeys.secretModal.copyFailed")));
  };

  return (
    <Tabs
      defaultActiveKey="claude"
      items={[
        {
          key: "claude",
          label: t("apiKeys.usage.tabClaude"),
          children: (
            <div className={styles.stack}>
              <CodeBlock title={t("apiKeys.usage.claudeCli")} code={claudeCli} onCopy={() => copy(claudeCli)} />
              <CodeBlock title={t("apiKeys.usage.claudeJson")} code={mcp} onCopy={() => copy(mcp)} />
            </div>
          ),
        },
        {
          key: "codex",
          label: t("apiKeys.usage.tabCodex"),
          children: (
            <div className={styles.stack}>
              <CodeBlock title={t("apiKeys.usage.codexToml")} code={codex} onCopy={() => copy(codex)} />
            </div>
          ),
        },
        {
          key: "cursor",
          label: t("apiKeys.usage.tabCursor"),
          children: (
            <div className={styles.stack}>
              <p className={styles.note}>{t("apiKeys.usage.cursorHint")}</p>
              <CodeBlock title={t("apiKeys.usage.cursorFile")} code={mcp} onCopy={() => copy(mcp)} />
            </div>
          ),
        },
        {
          key: "generic",
          label: t("apiKeys.usage.tabGeneric"),
          children: (
            <div className={styles.stack}>
              <CodeBlock title={t("apiKeys.usage.mcp")} code={mcp} onCopy={() => copy(mcp)} />
            </div>
          ),
        },
        {
          key: "rest",
          label: t("apiKeys.usage.tabRest"),
          children: (
            <div className={styles.stack}>
              <CodeBlock title={t("apiKeys.usage.rest")} code={rest} onCopy={() => copy(rest)} />
            </div>
          ),
        },
      ]}
    />
  );
}
