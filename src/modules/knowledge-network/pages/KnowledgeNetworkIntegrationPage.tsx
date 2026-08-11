/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, CodeOutlined, CopyOutlined, ForkOutlined, KeyOutlined } from "@ant-design/icons";
import { App } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { gatewayOrigin } from "@/framework/auth/oauth";
import { buildApiKeyPagePath } from "@/modules/api-keys/utils/api-key-handoff";
import { ExperienceScene } from "@/modules/knowledge-network/scenes/ExperienceScene";

import styles from "./KnowledgeNetworkIntegrationPage.module.css";

type IntegrationTab = "mcp" | "cli" | "sdk";
type CliExampleKey = "setup" | "context" | "agent-skill";
type SdkExampleKey = "quick-start" | "instance-query" | "dynamic-tool";
type CodeExample = { code: string; label: string; title: string };

const platformOrigin =
  gatewayOrigin() ||
  (typeof window !== "undefined" ? window.location.origin : "https://your-platform");

const tabIcons: Record<IntegrationTab, ReactNode> = {
  cli: <CodeOutlined />,
  mcp: <ForkOutlined />,
  sdk: <ApiOutlined />,
};

const cliExampleKeys: CliExampleKey[] = ["setup", "context", "agent-skill"];
const sdkExampleKeys: SdkExampleKey[] = ["quick-start", "instance-query", "dynamic-tool"];

type CodeIntegrationPanelProps<T extends string> = {
  ariaLabel: string;
  copyFailedMessage: string;
  copyLabel: string;
  examples: Record<T, CodeExample>;
  eyebrow: string;
  guideDescription: string;
  guideSteps: string[];
  guideTitle: string;
  installCommand?: string;
  installSuccessMessage?: string;
  installTitle?: string;
  issueApiKeyLabel: string;
  note: string;
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
  installCommand,
  installSuccessMessage,
  installTitle,
  issueApiKeyLabel,
  note,
  packageLabel,
  packageUrl,
  successMessage,
  title,
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
        <div className={styles.sdkKeyNote}>
          <KeyOutlined aria-hidden />
          <span>{note}</span>
          <Link to={apiKeyPagePath}>{issueApiKeyLabel}</Link>
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
                <CopyOutlined /> {copyLabel}
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

function useSdkExamples() {
  const { t } = useTranslation();
  return useMemo(
    () =>
      Object.fromEntries(
        sdkExampleKeys.map((key) => [
          key,
          {
            code: t(`knowledgeNetwork.integration.sdk.examples.${key}.code`),
            label: t(`knowledgeNetwork.integration.sdk.examples.${key}.label`),
            title: t(`knowledgeNetwork.integration.sdk.examples.${key}.title`),
          },
        ]),
      ) as Record<SdkExampleKey, CodeExample>,
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
      issueApiKeyLabel={t("knowledgeNetwork.integration.issueApiKey")}
      note={t("knowledgeNetwork.integration.cli.note")}
      packageLabel={t("knowledgeNetwork.integration.packageLabel")}
      packageUrl="https://www.npmjs.com/package/@openbkn/bkn-sdk"
      successMessage={t("knowledgeNetwork.integration.cli.successMessage")}
      title={t("knowledgeNetwork.integration.cli.title")}
    />
  );
}

function SdkIntegrationPanel() {
  const { t } = useTranslation();
  const examples = useSdkExamples();

  return (
    <CodeIntegrationPanel
      ariaLabel={t("knowledgeNetwork.integration.sdk.ariaLabel")}
      copyFailedMessage={t("knowledgeNetwork.integration.copyFailed")}
      copyLabel={t("knowledgeNetwork.integration.copy")}
      examples={examples}
      eyebrow="TypeScript / Node.js"
      guideDescription={t("knowledgeNetwork.integration.sdk.guideDescription")}
      guideSteps={[
        t("knowledgeNetwork.integration.sdk.steps.install"),
        t("knowledgeNetwork.integration.sdk.steps.token"),
        t("knowledgeNetwork.integration.sdk.steps.client"),
        t("knowledgeNetwork.integration.sdk.steps.tools"),
      ]}
      guideTitle={t("knowledgeNetwork.integration.sdk.guideTitle")}
      installCommand="npm install @openbkn/bkn-sdk"
      installSuccessMessage={t("knowledgeNetwork.integration.sdk.installSuccessMessage")}
      installTitle={t("knowledgeNetwork.integration.sdk.installTitle")}
      issueApiKeyLabel={t("knowledgeNetwork.integration.issueApiKey")}
      note={t("knowledgeNetwork.integration.sdk.note")}
      packageLabel={t("knowledgeNetwork.integration.packageLabel")}
      packageUrl="https://www.npmjs.com/package/@openbkn/bkn-sdk"
      successMessage={t("knowledgeNetwork.integration.sdk.successMessage")}
      title={t("knowledgeNetwork.integration.sdk.title")}
    />
  );
}

export function KnowledgeNetworkIntegrationPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<IntegrationTab>("mcp");
  const tabs: IntegrationTab[] = ["mcp", "cli", "sdk"];

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{t("knowledgeNetwork.integration.title")}</h1>
          <p className={styles.description}>
            {t("knowledgeNetwork.integration.description")}
          </p>
        </div>
      </header>

      <div className={styles.modeSection}>
        <span className={styles.modeLabel}>{t("knowledgeNetwork.integration.modeLabel")}</span>
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
              onClick={() => setActiveTab(key)}
            >
              <span className={styles.tabIcon} aria-hidden>
                {tabIcons[key]}
              </span>
              <span className={styles.tabLabel}>
                {t(`knowledgeNetwork.integration.tabs.${key}`)}
              </span>
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
