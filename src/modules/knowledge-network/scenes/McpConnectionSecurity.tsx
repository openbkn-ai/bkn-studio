/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { SafetyCertificateOutlined, WarningOutlined } from "@ant-design/icons";
import { Checkbox } from "antd";
import { useTranslation } from "react-i18next";

import type { McpAuthMode } from "@/modules/knowledge-network/hooks/useMcpAuthMode";
import type { McpConnectionProtocol } from "@/modules/knowledge-network/services/mcp-client-config";

import styles from "./ExperienceScene.module.css";

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
          <strong>{t(`knowledgeNetwork.contextLoaderPanel.mcpSecurity.${titleKey}`)}</strong>
          <span>{t(`knowledgeNetwork.contextLoaderPanel.mcpSecurity.${descriptionKey}`)}</span>
        </div>
      </div>
      {protocol === "https" ? (
        <Checkbox
          className={styles.mcpSecurityCheckbox}
          checked={allowInsecureTls}
          onChange={(event) => onAllowInsecureTlsChange(event.target.checked)}
        >
          {t("knowledgeNetwork.contextLoaderPanel.mcpSecurity.allowSelfSigned")}
        </Checkbox>
      ) : null}
    </div>
  );
}
