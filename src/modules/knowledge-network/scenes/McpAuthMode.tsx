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

/** The clients the connect guide has a tab for; the steps beside it follow the selected one. */
export type McpClient = "claude" | "cursor" | "workbuddy" | "generic";

/** Names the selected client above the steps, so switching clients visibly changes them. */
export function McpClientStepsHeading({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <p className={styles.mcpStepsHeading}>
      {t("knowledgeNetwork.contextLoaderPanel.mcpClientSteps.heading", { client: label })}
    </p>
  );
}

/** Where the selected client takes the config. The same in both connect modes. */
export function McpClientCopyStep({ client }: { client: McpClient }) {
  const { t } = useTranslation();
  return <>{t(`knowledgeNetwork.contextLoaderPanel.mcpClientSteps.${client}.copy`)}</>;
}

/**
 * Steps for the sign-in mode: copy the URL-only config, sign in once, the client renews itself.
 * The first two are written for the selected client, using the server name its config registers.
 */
export function McpOauthSteps({ client, serverName }: { client: McpClient; serverName: string }) {
  const { t } = useTranslation();
  return (
    <ol className={styles.mcpSteps}>
      <li>
        <McpClientCopyStep client={client} />
      </li>
      <li>
        {t(`knowledgeNetwork.contextLoaderPanel.mcpClientSteps.${client}.signIn`, {
          name: serverName,
        })}
      </li>
      <li>
        {t("knowledgeNetwork.contextLoaderPanel.mcpAuth.stepRenew")}{" "}
        <Link to={CONNECTED_CLIENTS_PATH}>
          {t("knowledgeNetwork.contextLoaderPanel.mcpAuth.connectedClients")}
        </Link>
      </li>
    </ol>
  );
}
