/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, ForkOutlined } from "@ant-design/icons";
import { useState, type ReactNode } from "react";

import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";
import type { ContextLoaderMode } from "@/modules/knowledge-network/services/context-loader.service";

import styles from "./KnowledgeNetworkIntegrationPage.module.css";

type IntegrationTab = Extract<ContextLoaderMode, "mcp" | "rest">;

const tabs: Array<{
  description: string;
  icon: ReactNode;
  key: IntegrationTab;
  label: string;
}> = [
  {
    key: "mcp",
    label: "MCP 对接",
    description: "复制平台级 MCP 配置到智能体平台，并验证 OpenBKN 暴露的能力集。",
    icon: <ForkOutlined />,
  },
  {
    key: "rest",
    label: "RESTful 对接",
    description: "查看 REST 接口、请求参数和实时响应，用于外部系统 HTTP 集成。",
    icon: <ApiOutlined />,
  },
];

export function KnowledgeNetworkIntegrationPage() {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("mcp");
  const active = tabs.find((item) => item.key === activeTab) ?? tabs[0];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>知识网络调用</div>
          <h1 className={styles.title}>对接 OpenBKN 能力</h1>
          <p className={styles.description}>
            面向智能体平台和外部系统提供统一调用入口。MCP 用于智能体工具调用，RESTful 用于标准 HTTP 接入。
          </p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="知识网络调用方式">
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
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelIcon} aria-hidden>
            {active.icon}
          </span>
          <div>
            <h2>{active.label}</h2>
            <p>{active.description}</p>
          </div>
        </div>
        <div className={styles.experienceHost}>
          <ExperienceScene embedded initialMode={activeTab} lockMode showMcpConnect={activeTab === "mcp"} />
        </div>
      </div>
    </section>
  );
}
