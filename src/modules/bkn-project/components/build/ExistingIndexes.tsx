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
import { Link } from "react-router-dom";

import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { ExistingDot } from "@/modules/bkn-project/components/existing/ExistingMark";
import {
  INDEX_STATE_TONE,
  indexStateText,
} from "@/modules/bkn-project/components/publish/messages";
import { getExistingIndex } from "@/modules/bkn-project/services/publish.service";
import type { IndexItem, ProjectIndex } from "@/modules/bkn-project/types/publish";
import { networkObjectTypePath } from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectBuild.module.css";

const PREFIX = "bknProject.networkExisting.index";
const PAGE_SIZE = 10;

/**
 * States of an index the network has not built, which only the network can change: the project
 * cannot build it, nor set what building it needs.
 */
const NOT_INDEXED = new Set(["not_built", "not_configured"]);

/**
 * The indexes of the tables the network's existing object types read, beside the project's own:
 * the network keeps them, so they are read only here and never built. Nothing shows on a new
 * network, or when they cannot be read.
 */
export function ExistingIndexes({
  networkId,
  projectId,
}: {
  networkId: string;
  projectId: string;
}) {
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
      // Named as vega-backend or the definition names it; never by its id, which says nothing.
      render: (_value, item) =>
        item.table.name && item.table.name !== item.table.resourceId ? (
          item.table.name
        ) : (
          <span className={styles.muted}>{t(`${PREFIX}.tableUnnamed`)}</span>
        ),
      title: t("bknProject.release.index.table"),
    },
    {
      key: "state",
      render: (_value, item) =>
        NOT_INDEXED.has(item.state) ? (
          // Said as the network has it, with where it is built.
          <span className={styles.name}>
            <LightStatusTag tone="neutral">{t(`${PREFIX}.notIndexed`)}</LightStatusTag>
            {networkId ? (
              <Link to={networkObjectTypePath(networkId, item.id)}>{t(`${PREFIX}.open`)}</Link>
            ) : null}
          </span>
        ) : (
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
