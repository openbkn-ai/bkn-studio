/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { SafetyCertificateOutlined, WarningOutlined } from "@ant-design/icons";
import { Checkbox } from "antd";
import { useTranslation } from "react-i18next";

import type { McpConnectionProtocol } from "@/modules/knowledge-network/services/mcp-client-config";

import styles from "./ExperienceScene.module.css";

export function McpConnectionSecurity({
  protocol,
  allowInsecureTls,
  onAllowInsecureTlsChange,
}: {
  protocol: McpConnectionProtocol;
  allowInsecureTls: boolean;
  onAllowInsecureTlsChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const isWarning = protocol === "http" || allowInsecureTls;
  const titleKey =
    protocol === "http"
      ? "httpTitle"
      : allowInsecureTls
        ? "insecureTitle"
        : "httpsTitle";
  const descriptionKey =
    protocol === "http"
      ? "httpDescription"
      : allowInsecureTls
        ? "insecureDescription"
        : "httpsDescription";

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
