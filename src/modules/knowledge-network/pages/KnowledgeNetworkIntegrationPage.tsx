/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import { App, Tooltip } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { McpIntegrationWorkspace } from "@/modules/knowledge-network/scenes/McpIntegrationWorkspace";

import styles from "./KnowledgeNetworkIntegrationPage.module.css";
import { SdkAppDevelopmentPanel } from "./SdkAppDevelopmentPanel";

type IntegrationTab = "mcp" | "cli" | "sdk";
type CliExampleKey = "setup" | "context" | "agent-skill";
type CodeExample = { code: string; label: string; title: string };

const platformOrigin =
  gatewayOrigin() ||
  (typeof window !== "undefined" ? window.location.origin : "https://your-platform");

const cliExampleKeys: CliExampleKey[] = ["setup", "context", "agent-skill"];

type CodeIntegrationPanelProps<T extends string> = {
  ariaLabel: string;
  copyFailedMessage: string;
  copyLabel: string;
  examples: Record<T, CodeExample>;
  eyebrow: string;
  guideDescription: string;
  guideSteps: string[];
  guideTitle: string;
  packageLabel: string;
  packageUrl: string;
  successMessage: string;
  title: string;
};

function CodeIntegrationPanel<T extends string>({
  ariaLabel,
  copyFailedMessage,
  copyLabel,
  examples,
  eyebrow,
  guideDescription,
  guideSteps,
  guideTitle,
  packageLabel,
  packageUrl,
  successMessage,
  title,
}: CodeIntegrationPanelProps<T>) {
  const { message } = App.useApp();
  const [activeExample, setActiveExample] = useState<T>(() => Object.keys(examples)[0] as T);
  const example = examples[activeExample];

  const copyText = async (text: string, successText: string) => {
    try {
      await writeTextToClipboard(text);
      void message.success(successText);
    } catch {
      void message.error(copyFailedMessage);
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

        <div className={styles.sdkExampleTabs} role="tablist" aria-label={ariaLabel}>
          {(Object.keys(examples) as T[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeExample === key}
              className={`${styles.sdkExampleTab} ${
                activeExample === key ? styles.sdkExampleTabActive : ""
              }`}
              onClick={() => setActiveExample(key)}
            >
              {examples[key].label}
            </button>
          ))}
        </div>

        <div className={styles.sdkCodeBlock}>
          <div className={styles.sdkCodeHeader}>
            <span>{example.title}</span>
            <button
              type="button"
              className={styles.sdkCopyButton}
              onClick={() => void copyText(example.code, successMessage)}
            >
              <CopyOutlined /> {copyLabel}
            </button>
          </div>
          <pre className={styles.sdkCode}>{example.code}</pre>
        </div>
      </div>
    </section>
  );
}

function useCliExamples() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      Object.fromEntries(
        cliExampleKeys.map((key) => [
          key,
          {
            code: t(`knowledgeNetwork.integration.cli.examples.${key}.code`, {
              platformOrigin,
            }),
            label: t(`knowledgeNetwork.integration.cli.examples.${key}.label`),
            title: t(`knowledgeNetwork.integration.cli.examples.${key}.title`),
          },
        ]),
      ) as Record<CliExampleKey, CodeExample>,
    [t],
  );
}

function CliIntegrationPanel() {
  const { t } = useTranslation();
  const examples = useCliExamples();

  return (
    <CodeIntegrationPanel
      ariaLabel={t("knowledgeNetwork.integration.cli.ariaLabel")}
      copyFailedMessage={t("knowledgeNetwork.integration.copyFailed")}
      copyLabel={t("knowledgeNetwork.integration.copy")}
      examples={examples}
      eyebrow="Terminal / CI/CD / Agent"
      guideDescription={t("knowledgeNetwork.integration.cli.guideDescription")}
      guideSteps={[
        t("knowledgeNetwork.integration.cli.steps.install"),
        t("knowledgeNetwork.integration.cli.steps.token"),
        t("knowledgeNetwork.integration.cli.steps.context"),
        t("knowledgeNetwork.integration.cli.steps.skill"),
      ]}
      guideTitle={t("knowledgeNetwork.integration.cli.guideTitle")}
      packageLabel={t("knowledgeNetwork.integration.packageLabel")}
      packageUrl="https://www.npmjs.com/package/@openbkn/bkn-sdk"
      successMessage={t("knowledgeNetwork.integration.cli.successMessage")}
      title={t("knowledgeNetwork.integration.cli.title")}
    />
  );
}

export function KnowledgeNetworkIntegrationPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: IntegrationTab =
    requestedTab === "cli" || requestedTab === "sdk" ? requestedTab : "mcp";
  const tabs: IntegrationTab[] = ["mcp", "cli", "sdk"];

  const selectTab = (nextTab: IntegrationTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    if (nextTab !== "mcp") {
      next.delete("mcpView");
      next.delete("networkId");
    }
    setSearchParams(next);
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{t("knowledgeNetwork.integration.title")}</h1>
          <Tooltip title={t("knowledgeNetwork.integration.description")} placement="bottomLeft">
            <QuestionCircleOutlined
              className={styles.descriptionHelp}
              aria-label={t("knowledgeNetwork.integration.descriptionHelpLabel")}
              tabIndex={0}
            />
          </Tooltip>
        </div>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label={t("knowledgeNetwork.integration.tabsAriaLabel")}
        >
          {tabs.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`${styles.tab} ${activeTab === key ? styles.tabActive : ""}`}
              onClick={() => selectTab(key)}
            >
              <span className={styles.tabLabel}>
                {t(`knowledgeNetwork.integration.tabs.${key}`)}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className={styles.panel}>
        {activeTab === "mcp" ? (
          <div className={styles.experienceHost}>
            <McpIntegrationWorkspace />
          </div>
        ) : activeTab === "cli" ? (
          <CliIntegrationPanel />
        ) : (
          <SdkAppDevelopmentPanel />
        )}
      </div>
    </section>
  );
}
