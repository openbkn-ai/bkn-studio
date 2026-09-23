/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  GlobalOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Alert, Input, Spin, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import {
  createOAuthAccessOrigin,
  deleteOAuthAccessOrigin,
  listOAuthAccessOrigins,
  reconcileOAuthAccessOrigins,
  resolveOAuthAccessOriginError,
  validateOAuthAccessOrigin,
} from "@/modules/system-admin/services/oauth-access-origin.service";
import type {
  OAuthAccessOrigin,
  OAuthAccessOriginSyncState,
} from "@/modules/system-admin/types/oauth-access-origin";

import adminStyles from "./admin.module.css";
import styles from "./OAuthAccessOriginsScene.module.css";

type EffectiveSyncState = OAuthAccessOriginSyncState | "deleting";

function effectiveSyncState(entry: OAuthAccessOrigin): EffectiveSyncState {
  return entry.desiredState === "deleting" ? "deleting" : entry.syncState;
}

const statusTones: Record<EffectiveSyncState, LightStatusTone> = {
  deleting: "warning",
  error: "error",
  pending: "warning",
  synced: "success",
};

export function OAuthAccessOriginsScene() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [entries, setEntries] = useState<OAuthAccessOrigin[]>([]);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEntries(await listOAuthAccessOrigins());
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReconcile = async () => {
    setSyncing(true);
    setLoadError(null);
    try {
      const result = await reconcileOAuthAccessOrigins();
      setEntries(result.entries);
      if (result.pending) {
        await message.warning(t("systemAdmin.accessOrigins.toast.syncPending"));
      } else {
        await message.success(t("systemAdmin.accessOrigins.toast.synced"));
      }
    } catch (error) {
      await message.error(
        t("systemAdmin.accessOrigins.errors.sync", {
          error: extractRequestErrorMessage(error),
        }),
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const value = origin.trim();
    setDuplicateId(null);
    if (!validateOAuthAccessOrigin(value)) {
      setInputError(t("systemAdmin.accessOrigins.validation.invalid"));
      return;
    }
    setInputError(null);
    setSubmitting(true);
    try {
      const result = await createOAuthAccessOrigin(value);
      setOrigin("");
      if (result.pending) {
        await message.warning(t("systemAdmin.accessOrigins.toast.savedPending"));
      } else {
        await message.success(t("systemAdmin.accessOrigins.toast.created"));
      }
      await load();
    } catch (error) {
      const resolved = resolveOAuthAccessOriginError(error);
      if (resolved.code === "invalid") {
        setInputError(t("systemAdmin.accessOrigins.validation.invalid"));
      } else if (resolved.code === "conflict") {
        setDuplicateId(resolved.existingId ?? null);
        setInputError(t("systemAdmin.accessOrigins.validation.duplicate"));
      } else {
        await message.error(
          t("systemAdmin.accessOrigins.errors.create", {
            error: extractRequestErrorMessage(error),
          }),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (entry: OAuthAccessOrigin) => {
    modal.confirm({
      cancelText: t("common.cancel"),
      content: t("systemAdmin.accessOrigins.deleteConfirm", { origin: entry.origin }),
      okButtonProps: { danger: true },
      okText: t("systemAdmin.accessOrigins.delete"),
      title: t("systemAdmin.accessOrigins.deleteTitle"),
      onOk: async () => {
        setDeletingId(entry.id);
        try {
          const result = await deleteOAuthAccessOrigin(entry.id);
          if (result.pending) {
            await message.warning(t("systemAdmin.accessOrigins.toast.deletePending"));
          } else {
            await message.success(t("systemAdmin.accessOrigins.toast.deleted"));
          }
          await load();
        } catch (error) {
          const resolved = resolveOAuthAccessOriginError(error);
          if (resolved.code === "notFound") {
            await message.warning(t("systemAdmin.accessOrigins.errors.notFound"));
            await load();
          } else if (resolved.code === "conflict") {
            await message.warning(t("systemAdmin.accessOrigins.errors.deleteConflict"));
            await load();
          } else {
            await message.error(
              t("systemAdmin.accessOrigins.errors.delete", {
                error: extractRequestErrorMessage(error),
              }),
            );
          }
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const columns: ColumnsType<OAuthAccessOrigin> = [
    {
      dataIndex: "origin",
      key: "origin",
      title: t("systemAdmin.accessOrigins.columns.origin"),
      width: 420,
      render: (_, entry) => (
        <div className={styles.originCell}>
          <strong>{entry.origin}</strong>
          <dl className={styles.uriDetails}>
            <div>
              <dt>{t("systemAdmin.accessOrigins.callback")}</dt>
              <dd>{entry.redirectUri}</dd>
            </div>
            <div>
              <dt>{t("systemAdmin.accessOrigins.logout")}</dt>
              <dd>{entry.postLogoutRedirectUri}</dd>
            </div>
          </dl>
        </div>
      ),
    },
    {
      dataIndex: "source",
      key: "source",
      title: t("systemAdmin.accessOrigins.columns.source"),
      width: 120,
      render: (source: OAuthAccessOrigin["source"]) => (
        <LightStatusTag tone={source === "runtime" ? "info" : "neutral"}>
          {t(`systemAdmin.accessOrigins.sources.${source}`)}
        </LightStatusTag>
      ),
    },
    {
      key: "syncState",
      title: t("systemAdmin.accessOrigins.columns.syncState"),
      width: 180,
      render: (_, entry) => {
        const state = effectiveSyncState(entry);
        const status = (
          <LightStatusTag tone={statusTones[state]}>
            {t(`systemAdmin.accessOrigins.status.${state}`)}
          </LightStatusTag>
        );
        return entry.lastSyncError ? (
          <div className={styles.statusCell}>
            <Tooltip title={entry.lastSyncError}>{status}</Tooltip>
            <span role="alert">{entry.lastSyncError}</span>
          </div>
        ) : (
          status
        );
      },
    },
    {
      key: "security",
      title: t("systemAdmin.accessOrigins.columns.security"),
      width: 150,
      render: (_, entry) =>
        entry.origin.startsWith("https://") ? (
          <span className={styles.securityText}>
            <LockOutlined /> {t("systemAdmin.accessOrigins.security.https")}
          </span>
        ) : (
          <Tooltip title={t("systemAdmin.accessOrigins.security.httpHint")}>
            <span className={styles.httpWarning}>
              <WarningOutlined /> {t("systemAdmin.accessOrigins.security.http")}
            </span>
          </Tooltip>
        ),
    },
    {
      fixed: "right",
      key: "actions",
      title: t("systemAdmin.accessOrigins.columns.actions"),
      width: 100,
      render: (_, entry) =>
        entry.readOnly ? (
          <Tooltip title={t(`systemAdmin.accessOrigins.readOnly.${entry.source}`)}>
            <span className={styles.readOnly}>{t("systemAdmin.accessOrigins.readOnly.label")}</span>
          </Tooltip>
        ) : (
          <AppButton
            className={[adminStyles.actionLink, adminStyles.actionDanger].join(" ")}
            disabled={entry.desiredState === "deleting"}
            loading={deletingId === entry.id}
            onClick={() => handleDelete(entry)}
            size="small"
            type="link"
          >
            {t("systemAdmin.accessOrigins.delete")}
          </AppButton>
        ),
    },
  ];

  return (
    <div className={adminStyles.contentSurface}>
      <div className={adminStyles.operationBar}>
        <div className={adminStyles.operationPrimary}>
          <GlobalOutlined className={styles.pageIcon} />
          <div>
            <div className={adminStyles.pageTitle}>{t("systemAdmin.accessOrigins.title")}</div>
            <div className={adminStyles.pageSubtitle}>
              {t("systemAdmin.accessOrigins.description")}
            </div>
          </div>
        </div>
        <div className={adminStyles.toolbarActions}>
          <AppButton
            disabled={loading}
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={() => void handleReconcile()}
          >
            {t("systemAdmin.accessOrigins.sync")}
          </AppButton>
          <AppButton
            disabled={syncing}
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void load()}
          >
            {t("common.refresh")}
          </AppButton>
        </div>
      </div>

      <form className={styles.addForm} onSubmit={(event) => void handleCreate(event)}>
        <div className={styles.fieldBody}>
          <div className={styles.fieldLabel}>
            <label htmlFor="oauth-access-origin">{t("systemAdmin.accessOrigins.form.label")}</label>
            <Tooltip
              classNames={{ root: styles.helpTooltip }}
              title={t("systemAdmin.accessOrigins.form.helpTooltip")}
            >
              <span
                aria-label={t("systemAdmin.accessOrigins.form.helpTooltipLabel")}
                className={styles.helpIcon}
                tabIndex={0}
              >
                <InfoCircleOutlined />
              </span>
            </Tooltip>
          </div>
          <Input
            aria-describedby={inputError ? "oauth-access-origin-error" : "oauth-access-origin-help"}
            id="oauth-access-origin"
            onChange={(event) => {
              setOrigin(event.target.value);
              setInputError(null);
              setDuplicateId(null);
            }}
            placeholder={t("systemAdmin.accessOrigins.form.placeholder")}
            status={inputError ? "error" : undefined}
            value={origin}
          />
          <span
            className={inputError ? styles.fieldError : styles.fieldHelp}
            id={inputError ? "oauth-access-origin-error" : "oauth-access-origin-help"}
            role={inputError ? "alert" : undefined}
          >
            {inputError ?? t("systemAdmin.accessOrigins.form.help")}
          </span>
        </div>
        <AppButton
          disabled={!origin.trim()}
          htmlType="submit"
          icon={<PlusOutlined />}
          loading={submitting}
          type="primary"
        >
          {t("systemAdmin.accessOrigins.add")}
        </AppButton>
      </form>

      {loadError ? (
        <Alert
          action={
            <AppButton size="small" onClick={() => void load()}>
              {t("common.retry")}
            </AppButton>
          }
          className={styles.loadError}
          message={loadError}
          showIcon
          type="error"
        />
      ) : null}

      <Spin spinning={loading && entries.length === 0}>
        <div className={styles.tableSection}>
          <AppTable<OAuthAccessOrigin>
            columns={columns}
            dataSource={entries}
            locale={{ emptyText: t("systemAdmin.accessOrigins.empty") }}
            pagination={false}
            rowClassName={(entry) => (entry.id === duplicateId ? styles.duplicateRow : "")}
            rowKey="id"
            scroll={{ x: 970 }}
            size="middle"
          />
        </div>
      </Spin>
    </div>
  );
}
