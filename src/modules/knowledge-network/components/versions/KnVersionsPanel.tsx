/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Card, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { EnableVersioningModal } from "@/modules/knowledge-network/components/versions/EnableVersioningModal";
import { KnDiffModal } from "@/modules/knowledge-network/components/versions/KnDiffModal";
import { PublishVersionModal } from "@/modules/knowledge-network/components/versions/PublishVersionModal";
import {
  confirmActivate,
  confirmResetDraft,
  confirmStatusChange,
} from "@/modules/knowledge-network/components/versions/kn-version-actions";
import { knAccountName, knVersionName } from "@/modules/knowledge-network/lib/kn-version-format";
import {
  listKnVersionEvents,
  listKnVersions,
} from "@/modules/knowledge-network/services/kn-version.service";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  KnVersion,
  KnVersionEvent,
  KnVersionStatus,
  KnVersionView,
  KnVersioning,
} from "@/modules/knowledge-network/types/kn-version";

import styles from "./KnVersions.module.css";

type KnVersionsPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  hasCapabilities?: boolean;
  networkId: string;
  /** Reload the workspace after the versions or the draft changed. */
  onChanged: () => void;
  onViewChange: (view: KnVersionView) => void;
  /** Absent when the network has no versioning. */
  versioning?: KnVersioning;
};

const STATUS_COLOR: Record<KnVersionStatus, string> = {
  deprecated: "default",
  history: "blue",
  purged: "default",
  running: "success",
};

/** Version list, events and the actions on them; for an unversioned network, the way to turn it on. */
export function KnVersionsPanel({
  canDelete,
  canModify,
  hasCapabilities,
  networkId,
  onChanged,
  onViewChange,
  versioning,
}: KnVersionsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [versions, setVersions] = useState<KnVersion[]>([]);
  const [events, setEvents] = useState<KnVersionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableOpen, setEnableOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [diff, setDiff] = useState<{ base: KnVersionView; target: KnVersionView } | null>(null);
  const enabled = Boolean(versioning?.enabled);
  const running = versioning?.running_version ?? 0;
  const revision = versioning?.draft?.revision;

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [versionPage, eventPage] = await Promise.all([
        listKnVersions(networkId, { limit: 200 }),
        listKnVersionEvents(networkId, { limit: 100 }),
      ]);
      setVersions(versionPage.items);
      setEvents(eventPage.items);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [enabled, networkId]);

  useEffect(() => {
    void load();
    // A new running version or draft revision means the lists moved too.
  }, [load, running, revision]);

  if (!enabled || !versioning) {
    return (
      <div className={styles.page}>
        <Card title={t("knowledgeNetwork.versions.title")}>
          <Typography.Paragraph>{t("knowledgeNetwork.versions.enable.intro")}</Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            {t("knowledgeNetwork.versions.enable.warning")}
          </Typography.Paragraph>
          <Button disabled={!canModify} onClick={() => setEnableOpen(true)} type="primary">
            {t("knowledgeNetwork.versions.enable.action")}
          </Button>
        </Card>
        <EnableVersioningModal
          networkId={networkId}
          onClose={() => setEnableOpen(false)}
          onEnabled={() => {
            setEnableOpen(false);
            message.success(t("common.success"));
            onChanged();
          }}
          open={enableOpen}
        />
      </div>
    );
  }

  const draft = versioning.draft;
  const actionContext = { networkId, notify: message, onChanged, t, versioning };
  const professional = versioning.full_history;
  const previous = versioning.previous_version;

  const columns: ColumnsType<KnVersion> = [
    {
      dataIndex: "version",
      key: "version",
      render: (value: number) => knVersionName(value),
      title: t("knowledgeNetwork.versions.columns.version"),
      width: 90,
    },
    {
      dataIndex: "label",
      key: "label",
      render: (value?: string) => value || "-",
      title: t("knowledgeNetwork.versions.columns.label"),
    },
    {
      dataIndex: "status",
      key: "status",
      render: (value: KnVersionStatus) => (
        <Tag color={STATUS_COLOR[value]}>{t(`knowledgeNetwork.versions.status.${value}`)}</Tag>
      ),
      title: t("knowledgeNetwork.versions.columns.status"),
      width: 110,
    },
    {
      dataIndex: "base_version",
      key: "base",
      render: (value?: number) => (value ? knVersionName(value) : "-"),
      title: t("knowledgeNetwork.versions.columns.base"),
      width: 90,
    },
    {
      dataIndex: "notes",
      key: "notes",
      render: (value?: string) => <div className={styles.notes}>{value || "-"}</div>,
      title: t("knowledgeNetwork.versions.columns.notes"),
    },
    {
      key: "publisher",
      render: (_value, record) => knAccountName(record.publisher),
      title: t("knowledgeNetwork.versions.columns.publisher"),
    },
    {
      key: "time",
      render: (_value, record) =>
        record.publish_time ? formatTimestamp(record.publish_time) : "-",
      title: t("knowledgeNetwork.versions.columns.time"),
      width: 170,
    },
    {
      key: "actions",
      render: (_value, record) => {
        const readable = record.status !== "purged";
        return (
          <Space size={0} wrap>
            {readable ? (
              <Button
                onClick={() => {
                  onViewChange(record.version);
                  void navigate(`/knowledge-network/workspace/${networkId}/overview`);
                }}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.view")}
              </Button>
            ) : null}
            {readable ? (
              <Button
                onClick={() =>
                  setDiff({
                    base: record.version,
                    target: canModify ? "draft" : "running",
                  })
                }
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.compare")}
              </Button>
            ) : null}
            {canModify && record.status === "history" ? (
              <Button
                onClick={() => confirmActivate(actionContext, record.version)}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.activate.action")}
              </Button>
            ) : null}
            {canModify && readable ? (
              <Button
                onClick={() => confirmResetDraft(actionContext, record.version)}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.copyToDraft")}
              </Button>
            ) : null}
            {canModify && professional && record.status === "history" ? (
              <Button
                onClick={() => confirmStatusChange(actionContext, record.version, "deprecate")}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.deprecate")}
              </Button>
            ) : null}
            {canModify && professional && record.status === "deprecated" ? (
              <Button
                onClick={() => confirmStatusChange(actionContext, record.version, "restore")}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.restore")}
              </Button>
            ) : null}
            {canDelete &&
            professional &&
            (record.status === "history" || record.status === "deprecated") ? (
              <Button
                danger
                onClick={() => confirmStatusChange(actionContext, record.version, "purge")}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.versions.purge")}
              </Button>
            ) : null}
          </Space>
        );
      },
      title: t("knowledgeNetwork.versions.columns.actions"),
    },
  ];

  const eventColumns: ColumnsType<KnVersionEvent> = [
    {
      dataIndex: "create_time",
      key: "time",
      render: (value?: number) => (value ? formatTimestamp(value) : "-"),
      title: t("knowledgeNetwork.versions.columns.time"),
      width: 170,
    },
    {
      dataIndex: "type",
      key: "type",
      render: (value: string) => t(`knowledgeNetwork.versions.event.${value}`),
      title: t("knowledgeNetwork.versions.columns.event"),
      width: 160,
    },
    {
      key: "versions",
      render: (_value, record) =>
        [record.from_version, record.to_version]
          .filter((value): value is number => Boolean(value))
          .map(knVersionName)
          .join(" → ") || "-",
      title: t("knowledgeNetwork.versions.columns.version"),
      width: 120,
    },
    {
      key: "operator",
      render: (_value, record) => knAccountName(record.operator),
      title: t("knowledgeNetwork.versions.columns.operator"),
    },
    {
      key: "notes",
      render: (_value, record) => (
        <div className={styles.notes}>
          {record.reason === "retention"
            ? t("knowledgeNetwork.versions.event.retention")
            : record.notes || "-"}
        </div>
      ),
      title: t("knowledgeNetwork.versions.columns.notes"),
    },
  ];

  return (
    <div className={styles.page}>
      <Card title={t("knowledgeNetwork.versions.title")}>
        <div className={styles.summary}>
          <div>
            <div className={styles.summaryLabel}>
              {t("knowledgeNetwork.versions.runningVersion")}
            </div>
            <div className={styles.summaryValue}>
              {running > 0 ? knVersionName(running) : t("knowledgeNetwork.versions.notPublished")}
            </div>
          </div>
          <div>
            <div className={styles.summaryLabel}>
              {t("knowledgeNetwork.versions.previousVersion")}
            </div>
            <div className={styles.summaryValue}>
              {previous > 0 ? knVersionName(previous) : "-"}
            </div>
          </div>
          <div>
            <div className={styles.summaryLabel}>{t("knowledgeNetwork.versions.draftStatus")}</div>
            <Space size={4} wrap>
              {running > 0 ? (
                <Tag>
                  {t("knowledgeNetwork.versions.basedOn", {
                    version: knVersionName(draft?.base_version ?? 0),
                  })}
                </Tag>
              ) : null}
              {draft?.has_changes ? (
                <Tag color="warning">{t("knowledgeNetwork.versions.hasChanges")}</Tag>
              ) : (
                <Tag color="success">{t("knowledgeNetwork.versions.noChanges")}</Tag>
              )}
              {draft?.outdated ? (
                <Tag color="error">{t("knowledgeNetwork.versions.outdatedTag")}</Tag>
              ) : null}
            </Space>
          </div>
        </div>
        {!professional ? (
          <Alert
            message={t("knowledgeNetwork.versions.communityNote")}
            showIcon
            style={{ marginTop: 12 }}
            type="info"
          />
        ) : null}
        {draft?.outdated ? (
          <Alert
            message={t("knowledgeNetwork.versions.outdated", {
              base: knVersionName(draft.base_version ?? 0),
              running: knVersionName(running),
            })}
            showIcon
            style={{ marginTop: 12 }}
            type="warning"
          />
        ) : null}
        <Space style={{ marginTop: 16 }} wrap>
          {canModify ? (
            <Button
              disabled={!draft?.has_changes && running > 0}
              onClick={() => setPublishOpen(true)}
              type="primary"
            >
              {t("knowledgeNetwork.versions.publish.action")}
            </Button>
          ) : null}
          {running > 0 ? (
            <Button
              onClick={() => setDiff({ base: "running", target: canModify ? "draft" : "running" })}
            >
              {t("knowledgeNetwork.versions.diff.title")}
            </Button>
          ) : null}
          {canModify && draft?.has_changes ? (
            <Button danger onClick={() => confirmResetDraft(actionContext)}>
              {t("knowledgeNetwork.versions.discard")}
            </Button>
          ) : null}
          {canModify && previous > 0 && running > 0 ? (
            <Button onClick={() => confirmActivate(actionContext, previous, true)}>
              {t("knowledgeNetwork.versions.rollback")}
            </Button>
          ) : null}
        </Space>
      </Card>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Card>
        <Tabs
          items={[
            {
              children: (
                <Table<KnVersion>
                  columns={columns}
                  dataSource={versions}
                  loading={loading}
                  pagination={{ hideOnSinglePage: true, pageSize: 20 }}
                  rowKey="version"
                  scroll={{ x: "max-content" }}
                  size="small"
                />
              ),
              key: "versions",
              label: t("knowledgeNetwork.versions.tabVersions"),
            },
            {
              children: (
                <Table<KnVersionEvent>
                  columns={eventColumns}
                  dataSource={events}
                  loading={loading}
                  pagination={{ hideOnSinglePage: true, pageSize: 20 }}
                  rowKey="id"
                  scroll={{ x: "max-content" }}
                  size="small"
                />
              ),
              key: "events",
              label: t("knowledgeNetwork.versions.tabEvents"),
            },
          ]}
        />
      </Card>
      <PublishVersionModal
        hasCapabilities={hasCapabilities}
        networkId={networkId}
        onChanged={onChanged}
        onClose={() => setPublishOpen(false)}
        open={publishOpen}
        versioning={versioning}
      />
      <KnDiffModal
        canDraft={canModify}
        initialBase={diff?.base}
        initialTarget={diff?.target}
        networkId={networkId}
        onClose={() => setDiff(null)}
        open={diff !== null}
        versioning={versioning}
      />
    </div>
  );
}
