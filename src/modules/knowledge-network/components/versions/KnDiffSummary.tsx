/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Empty, Space, Spin, Typography } from "antd";
import { useTranslation } from "react-i18next";

import {
  KnStatusText,
  type KnStatusTone,
} from "@/modules/knowledge-network/components/versions/KnStatusText";
import type { KnDiffDefinition, KnDiffResult } from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type KnDiffSummaryProps = {
  error?: string | null;
  loading?: boolean;
  result?: KnDiffResult | null;
};

const ACTION_TONE: Record<KnDiffDefinition["action"], KnStatusTone> = {
  create: "success",
  delete: "error",
  skip: "neutral",
  update: "warning",
};

function entryTitle(entry: KnDiffDefinition) {
  return entry.name?.new || entry.name?.old || entry.id;
}

/** Counts and per-definition changes of one comparison (`POST /bkns/diff`). */
export function KnDiffSummary({ error, loading, result }: KnDiffSummaryProps) {
  const { t } = useTranslation();

  if (loading) {
    return <Spin size="small" />;
  }
  if (error) {
    return <Alert message={error} showIcon type="warning" />;
  }
  if (!result) {
    return null;
  }

  // The server counts definitions only; the network itself is listed too, so it is counted here.
  const counted = result.summary ?? {};
  const networkAction = result.network?.action;
  const summary = {
    created: (counted.created ?? 0) + (networkAction === "create" ? 1 : 0),
    updated: (counted.updated ?? 0) + (networkAction === "update" ? 1 : 0),
    deleted: (counted.deleted ?? 0) + (networkAction === "delete" ? 1 : 0),
    unchanged: counted.unchanged ?? 0,
  };
  const entries = [...(result.network ? [result.network] : []), ...(result.entries ?? [])].filter(
    (entry) => entry.action !== "skip",
  );

  return (
    <div className={styles.diff}>
      <div className={styles.diffCounts}>
        <KnStatusText tone="success">
          {t("knowledgeNetwork.versions.diff.created", { n: summary.created })}
        </KnStatusText>
        <KnStatusText tone="warning">
          {t("knowledgeNetwork.versions.diff.updated", { n: summary.updated })}
        </KnStatusText>
        <KnStatusText tone="error">
          {t("knowledgeNetwork.versions.diff.deleted", { n: summary.deleted })}
        </KnStatusText>
        <KnStatusText tone="neutral">
          {t("knowledgeNetwork.versions.diff.unchanged", { n: summary.unchanged })}
        </KnStatusText>
      </div>
      {entries.length === 0 ? (
        <Empty
          description={t("knowledgeNetwork.versions.diff.noDifferences")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Collapse
          className={styles.diffEntries}
          items={entries.map((entry) => ({
            key: `${entry.type}:${entry.id}`,
            label: (
              <Space size={8}>
                <KnStatusText tone={ACTION_TONE[entry.action]}>
                  {t(`knowledgeNetwork.versions.diff.action.${entry.action}`)}
                </KnStatusText>
                <Typography.Text type="secondary">{entry.type}</Typography.Text>
                <Typography.Text strong>{entryTitle(entry)}</Typography.Text>
              </Space>
            ),
            children: entry.changes?.length ? (
              <ul className={styles.changeList}>
                {entry.changes.map((change, index) => (
                  <li key={`${change.path}-${index}`}>
                    <code>{change.path}</code>
                    {change.old ? <span className={styles.changeOld}>{change.old}</span> : null}
                    {change.new ? <span className={styles.changeNew}>{change.new}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null,
          }))}
          size="small"
        />
      )}
    </div>
  );
}
