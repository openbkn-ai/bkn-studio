/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { releaseNotes } from "@/modules/bkn-project/components/release/releaseMessages";
import type { LineageRelease } from "@/modules/bkn-project/types/release";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.versions";

/** Every release of the project's network, by this project or another, newest first. */
export function ReleaseVersions({
  inUseNetworkId,
  onRetry,
  projectId,
  releases,
}: {
  /** The network consumers use, when the page knows it. */
  inUseNetworkId: string | null;
  onRetry: () => void;
  projectId: string;
  /** Null while loading; "failed" when they could not be read. */
  releases: LineageRelease[] | "failed" | null;
}) {
  const { t } = useTranslation();
  const { runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();

  const who = (id: string) =>
    id === runtimeConfig.currentUser.id
      ? t(`${PREFIX}.you`)
      : (directory.get(id) ?? t(`${PREFIX}.someone`));

  const columns: ColumnsType<LineageRelease> = [
    {
      dataIndex: "version",
      key: "version",
      render: (version: string, release) => (
        <span className={styles.row}>
          {t(`${PREFIX}.version`, { version })}
          {release.state === "live" ? (
            <LightStatusTag tone="info">{t(`${PREFIX}.newest`)}</LightStatusTag>
          ) : null}
          {release.networkId === inUseNetworkId ? (
            <LightStatusTag tone="success">{t(`${PREFIX}.inUse`)}</LightStatusTag>
          ) : null}
        </span>
      ),
      title: t(`${PREFIX}.columns.version`),
    },
    {
      key: "source",
      render: (_, release) =>
        t(`${PREFIX}.${release.projectId === projectId ? "thisProject" : "otherProject"}`),
      title: t(`${PREFIX}.columns.source`),
    },
    {
      key: "publisher",
      render: (_, release) => who(release.publisherId),
      title: t(`${PREFIX}.columns.publisher`),
    },
    {
      dataIndex: "createTime",
      key: "time",
      render: (time: number) => dayjs(time).format("YYYY/MM/DD HH:mm"),
      title: t(`${PREFIX}.columns.time`),
    },
    {
      key: "notes",
      render: (_, release) => {
        const notes = releaseNotes(t, release.notes);
        return (
          <span className={styles.question}>
            {notes.text ? <span className={styles.notes}>{notes.text}</span> : null}
            {notes.accepted ? (
              <span className={styles.questionMeta}>
                {t(`${PREFIX}.accepted`, { accepted: notes.accepted })}
              </span>
            ) : null}
            {notes.text || notes.accepted ? null : <span className={styles.muted}>-</span>}
          </span>
        );
      },
      title: t(`${PREFIX}.columns.notes`),
    },
  ];

  return (
    <Section description={t(`${PREFIX}.description`)} title={t(`${PREFIX}.title`)}>
      {releases === "failed" ? (
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
      ) : releases === null ? (
        <Spin />
      ) : releases.length ? (
        <AppTable<LineageRelease>
          columns={columns}
          dataSource={releases}
          // A long-lived network has many releases: page them rather than list them all.
          pagination={releases.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          rowKey="networkId"
          size="small"
        />
      ) : (
        <p className={styles.muted}>{t(`${PREFIX}.none`)}</p>
      )}
    </Section>
  );
}
