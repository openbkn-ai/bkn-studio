/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The built-in Agents as cards, laid out like the knowledge network list. Agents are seeded
 * with each release, so there is no create action; a card opens the Agent's configuration.
 */

import {
  BranchesOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import { AppButton } from "@/framework/ui/common/AppButton";
import { executionRequestError } from "@/modules/knowledge-network/services/bkn-agent-execution.service";
import {
  listShared,
  type SharedAgent,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";

import { agentConfigPath, useAgentAdminParams } from "./agent-config-admin";
import styles from "./AgentConfigListScene.module.css";
import { agentDisplayName } from "./agent-config-names";

const P = "systemAdmin.agentConfig";

function AgentCard({ agent, onOpen }: { agent: SharedAgent; onOpen: () => void }) {
  const { t } = useTranslation();
  const versions = [
    agent.prompt_version != null
      ? t(`${P}.promptVersion`, { version: agent.prompt_version })
      : null,
    agent.version != null ? t(`${P}.configVersion`, { version: agent.version }) : null,
  ]
    .filter(Boolean)
    .join(" | ");
  return (
    <article
      className={styles.card}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.header}>
        <span className={styles.iconBox}>
          <RobotOutlined />
        </span>
        <div className={styles.titleContent}>
          <div className={styles.titleText}>{agentDisplayName(agent, t)}</div>
          <div className={styles.agentId}>{agent.agent_id}</div>
          <span className={styles.builtinTag}>{t(`${P}.builtinTag`)}</span>
        </div>
      </div>
      <div className={styles.footer}>
        {versions ? (
          <span className={styles.versionInfo} title={versions}>
            <BranchesOutlined aria-hidden />
            <span className={styles.versionText}>{versions}</span>
          </span>
        ) : null}
        <Tooltip title={t(`${P}.updateTime`)}>
          <span className={styles.metaItem}>
            <ClockCircleOutlined />
            <span>{formatDateTimeYmdHms(agent.update_time)}</span>
          </span>
        </Tooltip>
      </div>
    </article>
  );
}

export function AgentConfigListScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useAgentAdminParams();
  const [agents, setAgents] = useState<SharedAgent[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgents(await listShared(params));
    } catch (e) {
      setError(executionRequestError(e).message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void load();
  }, [load]);

  const query = keyword.trim().toLowerCase();
  const visible = query
    ? agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agentDisplayName(agent, t).toLowerCase().includes(query) ||
          agent.agent_id.toLowerCase().includes(query),
      )
    : agents;

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>{t(`${P}.listHint`)}</span>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t(`${P}.searchPlaceholder`)}
            prefix={<SearchOutlined />}
            value={keyword}
          />
          <button
            aria-label={t("common.refresh")}
            className={styles.iconButton}
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            <ReloadOutlined />
          </button>
        </div>
      </div>

      {error ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} type="link">
              {t("common.retry")}
            </AppButton>
          }
          message={error}
          showIcon
          type="error"
        />
      ) : null}

      <Spin spinning={loading}>
        {!error && !loading && visible.length === 0 ? (
          <div className={styles.emptyPanel}>
            <Empty description={t(agents.length ? `${P}.noMatch` : `${P}.empty`)} />
          </div>
        ) : (
          <div className={styles.grid}>
            {visible.map((agent) => (
              <AgentCard
                agent={agent}
                key={agent.agent_id}
                onOpen={() => void navigate(agentConfigPath(agent.agent_id))}
              />
            ))}
          </div>
        )}
      </Spin>
    </section>
  );
}
