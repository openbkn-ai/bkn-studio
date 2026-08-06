/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CodeOutlined, CopyOutlined, ForkOutlined, KeyOutlined } from "@ant-design/icons";
import { App } from "antd";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { buildApiKeyPagePath } from "@/modules/api-keys/utils/api-key-handoff";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";

import styles from "./KnowledgeNetworkIntegrationPage.module.css";

type IntegrationTab = "mcp" | "cli" | "sdk";
type CliExampleKey = "setup" | "context" | "agent-skill";
type SdkExampleKey = "quick-start" | "instance-query" | "dynamic-tool";
type CodeExample = { code: string; label: string; title: string };

const tabs: Array<{
  icon: ReactNode;
  key: IntegrationTab;
  label: string;
}> = [
  {
    key: "mcp",
    label: "MCP 对接",
    icon: <ForkOutlined />,
  },
  {
    key: "cli",
    label: "CLI 对接",
    icon: <CodeOutlined />,
  },
  {
    key: "sdk",
    label: "SDK 对接",
    icon: <ApiOutlined />,
  },
];

const cliExamples: Record<CliExampleKey, CodeExample> = {
  setup: {
    label: "安装与认证",
    title: "安装 OpenBKN CLI 并配置访问凭证",
    code: `npm install -g @openbkn/bkn-sdk

export BKN_BASE_URL="https://your-platform"
export BKN_TOKEN="bak_<在个人中心 API Key 签发>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn --version`,
  },
  context: {
    label: "知识网络查询",
    title: "从终端检索知识模型、查询实例和发现工具",
    code: `openbkn context search-schema <kn-id> "查询订单相关对象和关系"

openbkn context query-object-instance <kn-id> --args '{
  "ot_id": "order",
  "limit": 20
}'

openbkn context tools <kn-id>`,
  },
  "agent-skill": {
    label: "Agent Skill",
    title: "为具备终端能力的 Agent 安装 OpenBKN Skill",
    code: `npm install -g @openbkn/bkn-sdk
npx skills add openbkn-ai/bkn-sdk@openbkn -g -y

export BKN_BASE_URL="https://your-platform"
export BKN_TOKEN="bak_<在个人中心 API Key 签发>"

openbkn auth login "$BKN_BASE_URL" --token "$BKN_TOKEN"
openbkn help all`,
  },
};

const sdkExamples: Record<SdkExampleKey, CodeExample> = {
  "quick-start": {
    label: "快速开始",
    title: "创建 SDK 客户端并检索知识模型",
    code: `import { createClient } from "@openbkn/bkn-sdk";

const bkn = createClient({
  baseUrl: process.env.BKN_BASE_URL!,
  token: process.env.BKN_TOKEN!,
});

const result = await bkn.context.searchSchema(
  "your_kn_id",
  "查询订单相关对象和关系",
  { searchScope: ["object", "relation"], maxConcepts: 10 },
);`,
  },
  "instance-query": {
    label: "查询实例",
    title: "按对象类与条件查询对象实例",
    code: `const result = await bkn.context.queryObjectInstance("your_kn_id", {
  ot_id: "order",
  condition: {
    operation: "and",
    sub_conditions: [
      { field: "status", operation: "==", value_from: "const", value: "paid" },
    ],
  },
  limit: 20,
});`,
  },
  "dynamic-tool": {
    label: "动态工具",
    title: "发现并调用当前知识网络开放的 MCP 工具",
    code: `const tools = await bkn.context.tools("your_kn_id");

const result = await bkn.context.toolCall("your_kn_id", "search_schema", {
  query: "查询订单相关对象和关系",
  response_format: "json",
});`,
  },
};

type CodeIntegrationPanelProps<T extends string> = {
  examples: Record<T, CodeExample>;
  guideDescription: string;
  guideSteps: string[];
  guideTitle: string;
  installCommand?: string;
  installSuccessMessage?: string;
  installTitle?: string;
  note: string;
  packageLabel: string;
  packageUrl: string;
  title: string;
  eyebrow: string;
  ariaLabel: string;
  successMessage: string;
};

function CodeIntegrationPanel<T extends string>({
  examples,
  guideDescription,
  guideSteps,
  guideTitle,
  installCommand,
  installSuccessMessage,
  installTitle,
  note,
  packageLabel,
  packageUrl,
  title,
  eyebrow,
  ariaLabel,
  successMessage,
}: CodeIntegrationPanelProps<T>) {
  const { message } = App.useApp();
  const location = useLocation();
  const [activeExample, setActiveExample] = useState<T>(() => Object.keys(examples)[0] as T);
  const example = examples[activeExample];
  const apiKeyPagePath = buildApiKeyPagePath(`${location.pathname}${location.search}`);

  const copyText = async (text: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(text);
      void message.success(successText);
    } catch {
      void message.error("复制失败，请手动复制代码");
    }
  };

  return (
    <section className={styles.sdkPage}>
      <aside className={styles.sdkGuide}>
        <h2 className={styles.sdkTitle}>{guideTitle}</h2>
        <p className={styles.sdkDescription}>{guideDescription}</p>
        <ol className={styles.sdkSteps}>
          {guideSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className={styles.sdkKeyNote}>
          <KeyOutlined aria-hidden />
          <span>{note}</span>
          <Link to={apiKeyPagePath}>签发 API Key</Link>
        </div>
      </aside>

      <div className={styles.sdkContent}>
        <div className={styles.sdkContentHeader}>
          <div>
            <span className={styles.sdkEyebrow}>{eyebrow}</span>
            <h2 className={styles.sdkContentTitle}>{title}</h2>
          </div>
          <a className={styles.sdkPackageLink} href={packageUrl} target="_blank" rel="noreferrer">
            {packageLabel}
          </a>
        </div>

        {installCommand && installTitle && installSuccessMessage ? (
          <div className={styles.sdkInstallBlock}>
            <div className={styles.sdkInstallHeader}>
              <span>{installTitle}</span>
              <button
                type="button"
                className={styles.sdkCopyButton}
                onClick={() => void copyText(installCommand, installSuccessMessage)}
              >
                <CopyOutlined /> 复制
              </button>
            </div>
            <pre className={styles.sdkInstallCode}>{installCommand}</pre>
          </div>
        ) : null}

        <div className={styles.sdkExampleTabs} role="tablist" aria-label={ariaLabel}>
          {(Object.keys(examples) as T[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeExample === key}
              className={`${styles.sdkExampleTab} ${activeExample === key ? styles.sdkExampleTabActive : ""}`}
              onClick={() => setActiveExample(key)}
            >
              {examples[key].label}
            </button>
          ))}
        </div>

        <div className={styles.sdkCodeBlock}>
          <div className={styles.sdkCodeHeader}>
            <span>{example.title}</span>
            <button type="button" className={styles.sdkCopyButton} onClick={() => void copyText(example.code, successMessage)}>
              <CopyOutlined /> 复制
            </button>
          </div>
          <pre className={styles.sdkCode}>{example.code}</pre>
        </div>
      </div>
    </section>
  );
}

function CliIntegrationPanel() {
  return (
    <CodeIntegrationPanel
      examples={cliExamples}
      guideTitle="通过 CLI 调用 OpenBKN"
      guideDescription="适用于本地终端、CI/CD 和具备 Shell 能力的 Agent。CLI 使用同一套平台能力，无需自行实现接口协议。"
      guideSteps={[
        "全局安装 @openbkn/bkn-sdk，获得 openbkn 命令。",
        "在个人中心签发 API Key，并通过 BKN_TOKEN 环境变量登录目标 OpenBKN 环境。",
        "通过 context 命令检索知识模型、查询实例或发现 MCP 工具。",
        "为 Agent 安装 OpenBKN Skill 后，可按自然语言选择对应命令。",
      ]}
      note="API Key 当前用于 Context Loader 命令；在个人中心签发后通过 BKN_TOKEN 注入终端环境。"
      eyebrow="Terminal / CI/CD / Agent"
      title="CLI 调用示例"
      packageLabel="查看 npm 包"
      packageUrl="https://www.npmjs.com/package/@openbkn/bkn-sdk"
      ariaLabel="CLI 示例"
      successMessage="CLI 示例已复制"
    />
  );
}

function SdkIntegrationPanel() {
  return (
    <CodeIntegrationPanel
      examples={sdkExamples}
      guideTitle="通过 SDK 集成 OpenBKN"
      guideDescription="适用于 Node.js 服务端项目。SDK 已封装认证、MCP 会话、JSON-RPC 调用与响应解析，无需自行维护 HTTP 请求协议。"
      guideSteps={[
        "安装 @openbkn/bkn-sdk。",
        "在个人中心签发 API Key，并通过 BKN_BASE_URL 和 BKN_TOKEN 配置服务端。",
        "创建客户端后，通过 bkn.context 调用知识网络能力。",
        "按需查询对象实例，或发现并调用动态 MCP 工具。",
      ]}
      installCommand="npm install @openbkn/bkn-sdk"
      installSuccessMessage="SDK 安装命令已复制"
      installTitle="安装 SDK"
      note="API Key 当前用于 bkn.context；仅在个人中心管理，服务端通过 BKN_TOKEN 环境变量读取。"
      eyebrow="TypeScript / Node.js"
      title="SDK 调用示例"
      packageLabel="查看 npm 包"
      packageUrl="https://www.npmjs.com/package/@openbkn/bkn-sdk"
      ariaLabel="SDK 示例"
      successMessage="SDK 示例已复制"
    />
  );
}

export function KnowledgeNetworkIntegrationPage() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("mcp");

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>对接 OpenBKN 能力</h1>
          <p className={styles.description}>
            面向智能体平台和业务系统提供统一调用入口。MCP 用于智能体工具调用，CLI 用于终端与 Agent，SDK 用于 Node.js 服务端集成。
          </p>
        </div>
      </header>

      <div className={styles.modeSection}>
        <span className={styles.modeLabel}>接入方式</span>
        <div className={styles.tabs} role="tablist" aria-label="知识网络对接方式">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTab === item.key}
              className={`${styles.tab} ${activeTab === item.key ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className={styles.tabIcon} aria-hidden>
                {item.icon}
              </span>
              <span className={styles.tabLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.panel}>
        {activeTab === "mcp" ? (
          <div className={styles.experienceHost}>
            <ExperienceScene embedded initialMode="mcp" lockMode showMcpConnect />
          </div>
        ) : activeTab === "cli" ? (
          <CliIntegrationPanel />
        ) : (
          <SdkIntegrationPanel />
        )}
      </div>
    </section>
  );
}
