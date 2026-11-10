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

import type { McpClient } from "./McpAuthMode";

import styles from "./ExperienceScene.module.css";

const SECURITY_KEY = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";

const TLS_OFF = "NODE_TLS_REJECT_UNAUTHORIZED";

/** Claude Code starts from a shell, so its commands carry no localized placeholder. */
const CLAUDE_LAUNCH_COMMANDS = [
  { label: "launchTipsUnix", command: `${TLS_OFF}=0 claude` },
  {
    label: "launchTipsWindows",
    command: `$env:${TLS_OFF} = "0"\nclaude\nRemove-Item Env:${TLS_OFF}`,
  },
] as const;

const APP_LAUNCH_PLATFORMS = [
  { label: "launchTipsMac", command: "launchCommandMac" },
  { label: "launchTipsWindows", command: "launchCommandWindows" },
  { label: "launchTipsLinux", command: "launchCommandLinux" },
] as const;

/** Desktop clients with a known app name and default Windows install path (PowerShell syntax). */
const APP_CLIENTS: Partial<Record<McpClient, { client: string; examplePath: string }>> = {
  // Cursor installs per user by default, not under Program Files.
  cursor: { client: "Cursor", examplePath: "$env:LOCALAPPDATA\\Programs\\cursor\\Cursor.exe" },
  workbuddy: { client: "WorkBuddy", examplePath: "C:\\Program Files\\WorkBuddy\\WorkBuddy.exe" },
};

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

/** Per-OS commands for restarting the selected sign-in client with certificate checks off. */
function ClientLaunchTips({ client }: { client: McpClient }) {
  const { t } = useTranslation();
  const app = APP_CLIENTS[client];
  let intro: string;
  let note: string;
  let commands: { label: string; command: string }[];

  if (client === "claude") {
    intro = t(`${SECURITY_KEY}.launchTipsIntroClaude`);
    note = t(`${SECURITY_KEY}.launchTipsNoteClaude`);
    commands = CLAUDE_LAUNCH_COMMANDS.map(({ label, command }) => ({
      label: t(`${SECURITY_KEY}.${label}`),
      command,
    }));
  } else {
    // A client without a known app name gets the same commands with a placeholder name.
    const suffix = app ? "" : "Generic";
    const values = { ...app };
    intro = t(`${SECURITY_KEY}.launchTipsIntro${suffix}`, values);
    note = t(`${SECURITY_KEY}.launchTipsNote${suffix}`, values);
    commands = APP_LAUNCH_PLATFORMS.map(({ label, command }) => ({
      label: t(`${SECURITY_KEY}.${label}`),
      command: t(`${SECURITY_KEY}.${command}${suffix}`, values),
    }));
  }

  const content = (
    <div className={styles.mcpLaunchTips}>
      <p>{intro}</p>
      {commands.map(({ label, command }) => (
        <div key={label} className={styles.mcpLaunchTipsItem}>
          <div className={styles.mcpLaunchTipsHead}>
            <strong>{label}</strong>
            <CopyCommandButton text={command} />
          </div>
          <code>{command}</code>
        </div>
      ))}
      <p className={styles.mcpLaunchTipsNote}>{note}</p>
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
  client = "generic",
  likelySelfSigned = false,
  allowInsecureTls,
  onAllowInsecureTlsChange,
}: {
  protocol: McpConnectionProtocol;
  authMode?: McpAuthMode;
  /** Client tab selected next to the strip; the launch tip shows that client's commands. */
  client?: McpClient;
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
            {descriptionKey === "oauthInsecureDescription" ? (
              <ClientLaunchTips client={client} />
            ) : null}
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
