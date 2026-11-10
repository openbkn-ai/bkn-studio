/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Empty, Space, Spin, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";

import type { KnDiffDefinition, KnDiffResult } from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type KnDiffSummaryProps = {
  error?: string | null;
  loading?: boolean;
  result?: KnDiffResult | null;
};

const ACTION_COLOR: Record<string, string> = {
  create: "success",
  delete: "error",
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

  const summary = result.summary ?? {};
  const entries = [...(result.network ? [result.network] : []), ...(result.entries ?? [])].filter(
    (entry) => entry.action !== "skip",
  );

  return (
    <div className={styles.diff}>
      <Space size={[8, 4]} wrap>
        <Tag color="success">
          {t("knowledgeNetwork.versions.diff.created", { n: summary.created ?? 0 })}
        </Tag>
        <Tag color="warning">
          {t("knowledgeNetwork.versions.diff.updated", { n: summary.updated ?? 0 })}
        </Tag>
        <Tag color="error">
          {t("knowledgeNetwork.versions.diff.deleted", { n: summary.deleted ?? 0 })}
        </Tag>
        <Tag>{t("knowledgeNetwork.versions.diff.unchanged", { n: summary.unchanged ?? 0 })}</Tag>
      </Space>
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
                <Tag color={ACTION_COLOR[entry.action]}>
                  {t(`knowledgeNetwork.versions.diff.action.${entry.action}`)}
                </Tag>
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
