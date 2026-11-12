/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { ExistingDot } from "@/modules/bkn-project/components/existing/ExistingMark";
import {
  INDEX_STATE_TONE,
  indexStateText,
} from "@/modules/bkn-project/components/publish/messages";
import { getExistingIndex } from "@/modules/bkn-project/services/publish.service";
import type { IndexItem, ProjectIndex } from "@/modules/bkn-project/types/publish";

import styles from "./ProjectBuild.module.css";

const PREFIX = "bknProject.networkExisting.index";
const PAGE_SIZE = 10;

/**
 * The indexes of the tables the network's existing object types read, beside the project's own:
 * the network keeps them, so they are read only here and never built. Nothing shows on a new
 * network, or when they cannot be read.
 */
export function ExistingIndexes({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<ProjectIndex | null>(null);

  useEffect(() => {
    let active = true;
    getExistingIndex(projectId)
      .then((next) => active && setIndex(next))
      .catch(() => active && setIndex(null));
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!index?.objectTypes.length) {
    return null;
  }
  const items = index.objectTypes;
  const columns: ColumnsType<IndexItem> = [
    {
      key: "name",
      render: (_value, item) => (
        <span className={styles.name}>
          <ExistingDot />
          {item.name}
        </span>
      ),
      title: t("bknProject.release.index.objectType"),
    },
    {
      key: "table",
      render: (_value, item) => item.table.name || item.table.resourceId,
      title: t("bknProject.release.index.table"),
    },
    {
      key: "state",
      render: (_value, item) => (
        <LightStatusTag tone={INDEX_STATE_TONE[item.state] ?? "neutral"}>
          {indexStateText(t, item)}
        </LightStatusTag>
      ),
      title: t("bknProject.release.index.stateColumn"),
    },
    {
      key: "built",
      render: (_value, item) =>
        item.builtTime
          ? t("bknProject.release.index.builtAt", {
              time: dayjs(item.builtTime).format("YYYY/MM/DD HH:mm"),
            })
          : "-",
      title: t("bknProject.release.index.buildColumn"),
    },
  ];

  return (
    <section className={styles.existing} data-testid="existing-indexes">
      <div className={styles.existingHead}>
        <span className={styles.existingTitle}>
          <ExistingDot />
          {t(`${PREFIX}.title`)}
        </span>
        <span className={styles.muted}>
          {t(`${PREFIX}.summary`, {
            ready: items.filter((item) => item.state === "ready").length,
            total: items.length,
          })}
        </span>
      </div>
      <p className={styles.muted}>{t(`${PREFIX}.description`)}</p>
      <AppTable<IndexItem>
        columns={columns}
        dataSource={items}
        pagination={items.length > PAGE_SIZE ? { pageSize: PAGE_SIZE } : false}
        rowKey="id"
        size="small"
      />
    </section>
  );
}
