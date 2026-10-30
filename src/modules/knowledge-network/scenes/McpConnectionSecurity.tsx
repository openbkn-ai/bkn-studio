/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  CheckOutlined,
  CopyOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Checkbox, Popover } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { writeTextToClipboard } from "@/framework/compat/clipboard";

import type { McpAuthMode } from "@/modules/knowledge-network/hooks/useMcpAuthMode";
import type { McpConnectionProtocol } from "@/modules/knowledge-network/services/mcp-client-config";

import styles from "./ExperienceScene.module.css";

const SECURITY_KEY = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";

const LAUNCH_PLATFORMS = [
  { label: "launchTipsMac", command: "launchCommandMac" },
  { label: "launchTipsWindows", command: "launchCommandWindows" },
  { label: "launchTipsLinux", command: "launchCommandLinux" },
] as const;

const COPY_FEEDBACK_MS = 1500;

/** Copy button that reports the result on itself: a toast would sit behind the popover. */
function CopyCommandButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    void writeTextToClipboard(text)
      .then(() => setState("copied"))
      .catch(() => setState("failed"))
      .finally(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
      });
  };

  const label =
    state === "copied"
      ? t("knowledgeNetwork.contextLoaderPanel.experience.copied")
      : state === "failed"
        ? t("knowledgeNetwork.contextLoaderPanel.experience.copyFailed")
        : t("knowledgeNetwork.contextLoaderPanel.common.copy");

  return (
    <button type="button" className={styles.mcpLaunchTipsCopy} onClick={copy}>
      {state === "copied" ? <CheckOutlined /> : <CopyOutlined />} {label}
    </button>
  );
}

/** Per-OS commands for restarting a sign-in client with certificate checks off. */
function ClientLaunchTips() {
  const { t } = useTranslation();
  const content = (
    <div className={styles.mcpLaunchTips}>
      <p>{t(`${SECURITY_KEY}.launchTipsIntro`)}</p>
      {LAUNCH_PLATFORMS.map(({ label, command }) => {
        const commandText = t(`${SECURITY_KEY}.${command}`);
        return (
          <div key={label} className={styles.mcpLaunchTipsItem}>
            <div className={styles.mcpLaunchTipsHead}>
              <strong>{t(`${SECURITY_KEY}.${label}`)}</strong>
              <CopyCommandButton text={commandText} />
            </div>
            <code>{commandText}</code>
          </div>
        );
      })}
      <p className={styles.mcpLaunchTipsNote}>{t(`${SECURITY_KEY}.launchTipsNote`)}</p>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomLeft">
      <button type="button" className={styles.mcpLaunchTipsTrigger}>
        {t(`${SECURITY_KEY}.launchTipsTrigger`)}
      </button>
    </Popover>
  );
}

function securityCopyKeys(
  protocol: McpConnectionProtocol,
  authMode: McpAuthMode,
  allowInsecureTls: boolean,
  likelySelfSigned: boolean,
): { warning: boolean; title: string; description: string } {
  if (authMode === "oauth") {
    if (protocol === "http") {
      return { warning: true, title: "oauthHttpTitle", description: "oauthHttpDescription" };
    }
    if (allowInsecureTls) {
      return { warning: true, title: "insecureTitle", description: "oauthInsecureDescription" };
    }
    if (likelySelfSigned) {
      return { warning: true, title: "selfSignedTitle", description: "selfSignedDescription" };
    }
    return { warning: false, title: "httpsTitle", description: "oauthHttpsDescription" };
  }
  if (protocol === "http") {
    return { warning: true, title: "httpTitle", description: "httpDescription" };
  }
  if (allowInsecureTls) {
    return { warning: true, title: "insecureTitle", description: "insecureDescription" };
  }
  // Verification on against a certificate that is probably self-signed: the
  // client will fail, so this is not the green, all-good state.
  if (likelySelfSigned) {
    return { warning: true, title: "selfSignedTitle", description: "selfSignedApiKeyDescription" };
  }
  return { warning: false, title: "httpsTitle", description: "httpsDescription" };
}

export function McpConnectionSecurity({
  protocol,
  authMode = "apiKey",
  likelySelfSigned = false,
  allowInsecureTls,
  onAllowInsecureTlsChange,
}: {
  protocol: McpConnectionProtocol;
  authMode?: McpAuthMode;
  /** https on an IP literal or `.local` name: probably a self-signed certificate. */
  likelySelfSigned?: boolean;
  allowInsecureTls: boolean;
  onAllowInsecureTlsChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const {
    warning: isWarning,
    title: titleKey,
    description: descriptionKey,
  } = securityCopyKeys(protocol, authMode, allowInsecureTls, likelySelfSigned);

  return (
    <div
      className={`${styles.mcpSecurityStrip} ${isWarning ? styles.mcpSecurityWarning : styles.mcpSecuritySecure}`}
      aria-live="polite"
    >
      <div className={styles.mcpSecurityStatus}>
        <span className={styles.mcpSecurityIcon} aria-hidden>
          {isWarning ? <WarningOutlined /> : <SafetyCertificateOutlined />}
        </span>
        <span className={styles.mcpSecurityProtocol}>{protocol.toUpperCase()}</span>
        <div className={styles.mcpSecurityCopy}>
          <strong>{t(`${SECURITY_KEY}.${titleKey}`)}</strong>
          <span>
            {t(`${SECURITY_KEY}.${descriptionKey}`)}
            {descriptionKey === "oauthInsecureDescription" ? <ClientLaunchTips /> : null}
          </span>
        </div>
      </div>
      {protocol === "https" ? (
        <Checkbox
          className={styles.mcpSecurityCheckbox}
          checked={allowInsecureTls}
          onChange={(event) => onAllowInsecureTlsChange(event.target.checked)}
        >
          {t(`${SECURITY_KEY}.allowSelfSigned`)}
        </Checkbox>
      ) : null}
    </div>
  );
}
