/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Segmented } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { McpAuthMode } from "@/modules/knowledge-network/hooks/useMcpAuthMode";

import styles from "./ExperienceScene.module.css";

export function McpAuthModeSwitch({
  value,
  onChange,
  block = false,
}: {
  value: McpAuthMode;
  onChange: (mode: McpAuthMode) => void;
  block?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Segmented<McpAuthMode>
      className={styles.choice}
      size="small"
      block={block}
      value={value}
      onChange={onChange}
      aria-label={t("knowledgeNetwork.contextLoaderPanel.mcpAuth.label")}
      options={[
        { value: "oauth", label: t("knowledgeNetwork.contextLoaderPanel.mcpAuth.oauth") },
        { value: "apiKey", label: t("knowledgeNetwork.contextLoaderPanel.mcpAuth.apiKey") },
      ]}
    />
  );
}

/** Personal API key page, opened on its connected-clients tab. */
const CONNECTED_CLIENTS_PATH = "/account/api-keys?tab=clients";

/** Steps for the sign-in mode: copy the URL-only config, sign in once, the client renews itself. */
export function McpOauthSteps() {
  const { t } = useTranslation();
  return (
    <ol className={styles.mcpSteps}>
      <li>{t("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepCopy")}</li>
      <li>{t("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepSignIn")}</li>
      <li>
        {t("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepRenew")}{" "}
        <Link to={CONNECTED_CLIENTS_PATH}>
          {t("knowledgeNetwork.contextLoaderPanel.mcpAuth.connectedClients")}
        </Link>
      </li>
    </ol>
  );
}
