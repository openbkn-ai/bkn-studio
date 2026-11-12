/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { EditionBadge } from "@/framework/entitlement/EditionBadge";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { CopyVersionDialog } from "@/modules/bkn-project/components/release/CopyVersionDialog";
import {
  passedCount,
  releaseNotes,
  versionName,
  versionNameIn,
} from "@/modules/bkn-project/components/release/releaseMessages";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { RollbackDialog } from "@/modules/bkn-project/components/release/RollbackDialog";
import { getRegression } from "@/modules/bkn-project/services/release.service";
import type { NetworkVersion, ProjectVersions } from "@/modules/bkn-project/types/release";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.versions";
const ORIGINS = new Set(["project", "other_project", "workspace"]);

/** How the scenario questions did on the release that published a version; read per row. */
function RegressionCell({
  onOpen,
  projectId,
  version,
}: {
  onOpen: () => void;
  projectId: string;
  version: string;
}) {
  const { t } = useTranslation();
  // undefined while reading; null for none or a failed read.
  const [counts, setCounts] = useState<{ passed: number; total: number } | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let active = true;
    getRegression(projectId, version).then(
      (regression) => active && setCounts(regression ? passedCount(regression) : null),
      () => active && setCounts(null),
    );
    return () => {
      active = false;
    };
  }, [projectId, version]);
  if (counts === undefined) {
    return <Spin size="small" />;
  }
  if (!counts?.total) {
    return <span className={styles.small}>{t(`${PREFIX}.noRegression`)}</span>;
  }
  return (
    <AppButton onClick={onOpen} size="small" type="link">
      {t(`${PREFIX}.regressionPassed`, counts)}
    </AppButton>
  );
}

/**
 * The versions of the project's network, newest first, by this project, another one or the
 * workspace. The professional edition keeps them all; the community edition keeps the running
 * and the previous version, and only the record of earlier ones.
 */
export function ReleaseVersions({
  canManage,
  onChanged,
  onOpenRegression,
  onRetry,
  projectId,
  versions,
}: {
  /** The owner of an unarchived project switches and copies versions. */
  canManage: boolean;
  /** A version was switched to or copied: the page reads status and versions again. */
  onChanged: () => void;
  /** Opens how the scenario questions did on a release of the project. */
  onOpenRegression: (version: string) => void;
  onRetry: () => void;
  projectId: string;
  /** null while loading; "failed" when they could not be read. */
  versions: ProjectVersions | "failed" | null;
}) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  const [showEarlier, setShowEarlier] = useState(false);
  const [switchTo, setSwitchTo] = useState<NetworkVersion | null>(null);
  const [copyOf, setCopyOf] = useState<NetworkVersion | null>(null);

  // The name the reply carries, else the user list the caller may read.
  const who = (id: string, name = "") =>
    id === runtimeConfig.currentUser.id
      ? t(`${PREFIX}.you`)
      : name || (directory.get(id) ?? t(`${PREFIX}.someone`));

  const loaded = versions && versions !== "failed" ? versions : null;
  const versioning = loaded?.versioning;
  const fullHistory = versioning?.fullHistory ?? true;
  const entries = loaded?.entries ?? [];
  const running = versioning?.runningVersion ?? 0;
  const previous = versioning?.previousVersion ?? 0;
  const isRunning = (entry: NetworkVersion) => entry.version === running;
  // The community edition keeps only the record of versions before the previous one.
  const recordOnly = (entry: NetworkVersion) =>
    entry.status === "purged" || (!fullHistory && !isRunning(entry) && entry.version !== previous);
  const earlier = entries.filter(recordOnly);
  const shown =
    fullHistory || showEarlier ? entries : entries.filter((entry) => !recordOnly(entry));
  const name = (entry: NetworkVersion) => versionName(t, entry.version, entry.label);

  const statusTag = (entry: NetworkVersion) =>
    isRunning(entry) ? (
      <LightStatusTag tone="success">{t(`${PREFIX}.status.running`)}</LightStatusTag>
    ) : recordOnly(entry) ? (
      <LightStatusTag tone="neutral">{t(`${PREFIX}.status.recordOnly`)}</LightStatusTag>
    ) : entry.status === "deprecated" ? (
      <LightStatusTag tone="warning">{t(`${PREFIX}.status.deprecated`)}</LightStatusTag>
    ) : (
      <LightStatusTag tone="neutral">{t(`${PREFIX}.status.history`)}</LightStatusTag>
    );

  const columns: ColumnsType<NetworkVersion> = [
    {
      key: "version",
      render: (_, entry) => (
        <span className={styles.question}>
          <span className={styles.versionName}>{name(entry)}</span>
          {entry.label ? (
            <span className={styles.small}>{t(`${PREFIX}.number`, { number: entry.version })}</span>
          ) : null}
        </span>
      ),
      title: t(`${PREFIX}.columns.version`),
    },
    {
      key: "status",
      render: (_, entry) => statusTag(entry),
      title: t(`${PREFIX}.columns.status`),
    },
    {
      key: "base",
      render: (_, entry) =>
        entry.baseVersion ? versionNameIn(t, entries, entry.baseVersion) : t(`${PREFIX}.empty`),
      title: t(`${PREFIX}.columns.base`),
    },
    {
      key: "notes",
      render: (_, entry) => {
        const notes = releaseNotes(t, entry.notes);
        return (
          <span className={styles.question}>
            {notes.text ? <span className={styles.notes}>{notes.text}</span> : null}
            {notes.accepted ? (
              <span className={styles.questionMeta}>
                {t(`${PREFIX}.accepted`, { accepted: notes.accepted })}
              </span>
            ) : null}
            {notes.text || notes.accepted ? null : (
              <span className={styles.muted}>{t(`${PREFIX}.empty`)}</span>
            )}
          </span>
        );
      },
      title: t(`${PREFIX}.columns.notes`),
    },
    {
      key: "publisher",
      render: (_, entry) => (
        <span className={styles.question}>
          <span>{who(entry.publisherId, entry.publisherName)}</span>
          <span className={styles.small}>{dayjs(entry.createTime).format("YYYY/MM/DD HH:mm")}</span>
        </span>
      ),
      title: t(`${PREFIX}.columns.publisher`),
    },
    {
      key: "origin",
      render: (_, entry) =>
        t(`${PREFIX}.origin.${ORIGINS.has(entry.origin) ? entry.origin : "other"}`),
      title: t(`${PREFIX}.columns.origin`),
    },
    {
      key: "regression",
      // Only the project's own releases have its scenario questions asked of them.
      render: (_, entry) =>
        recordOnly(entry) ? (
          t(`${PREFIX}.empty`)
        ) : entry.origin === "project" && entry.release ? (
          <RegressionCell
            onOpen={() => onOpenRegression(entry.release)}
            projectId={projectId}
            version={entry.release}
          />
        ) : (
          <span className={styles.small}>{t(`${PREFIX}.noRegression`)}</span>
        ),
      title: t(`${PREFIX}.columns.regression`),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            render: (_: unknown, entry: NetworkVersion) => (
              <span className={styles.row}>
                {!isRunning(entry) && !recordOnly(entry) && entry.status !== "deprecated" ? (
                  <AppButton onClick={() => setSwitchTo(entry)} size="small" type="link">
                    {t(
                      `${PREFIX}.${
                        entry.version === previous && entry.version < running
                          ? "rollBack"
                          : "switch"
                      }`,
                    )}
                  </AppButton>
                ) : null}
                <AppButton onClick={() => setCopyOf(entry)} size="small" type="link">
                  {t(`${PREFIX}.copy`)}
                </AppButton>
              </span>
            ),
            title: t(`${PREFIX}.columns.actions`),
          },
        ]
      : []),
  ];

  return (
    <Section
      description={t(`${PREFIX}.${fullHistory ? "descriptionFull" : "descriptionCommunity"}`)}
      title={
        <span className={styles.row}>
          {t(`${PREFIX}.title`)}
          {loaded && fullHistory ? <EditionBadge alwaysShow edition="professional" /> : null}
        </span>
      }
    >
      {versions === "failed" ? (
        <Alert
          action={
            <AppButton onClick={onRetry} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="error"
        />
      ) : versions === null ? (
        <Spin />
      ) : entries.length ? (
        <>
          <AppTable<NetworkVersion>
            columns={columns}
            dataSource={shown}
            // A long-lived network has many versions: page them rather than list them all.
            pagination={shown.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
            rowClassName={(entry) => (recordOnly(entry) ? styles.mutedRow : "")}
            rowKey="version"
            scroll={{ x: 900 }}
            size="small"
          />
          {!fullHistory && earlier.length ? (
            <span>
              <AppButton onClick={() => setShowEarlier((value) => !value)} size="small" type="link">
                {showEarlier
                  ? t(`${PREFIX}.hideEarlier`)
                  : t(`${PREFIX}.showEarlier`, { count: earlier.length })}
              </AppButton>
            </span>
          ) : null}
        </>
      ) : (
        <p className={styles.muted}>{t(`${PREFIX}.none`)}</p>
      )}
      {switchTo ? (
        <RollbackDialog
          canRollBack={canManage}
          onCancel={() => setSwitchTo(null)}
          onRolledBack={() => {
            setSwitchTo(null);
            onChanged();
          }}
          projectId={projectId}
          rollback={switchTo.version === previous && switchTo.version < running}
          toVersion={switchTo.version}
        />
      ) : null}
      {copyOf ? (
        <CopyVersionDialog
          knVersion={copyOf.version}
          name={name(copyOf)}
          onCancel={() => setCopyOf(null)}
          onCopied={() => {
            setCopyOf(null);
            onChanged();
          }}
          projectId={projectId}
          recordOnly={recordOnly(copyOf)}
        />
      ) : null}
    </Section>
  );
}
