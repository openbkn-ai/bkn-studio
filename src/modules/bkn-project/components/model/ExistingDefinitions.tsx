/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Segmented, Table } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";
import { getExistingDefinitions } from "@/modules/bkn-project/services/draft.service";
import type {
  ExistingDefinitions as Existing,
  ExistingObjectType,
  ExistingRelationType,
} from "@/modules/bkn-project/types/draft";
import { networkObjectTypePath } from "@/modules/bkn-project/types/workspace";

import styles from "./ExistingDefinitions.module.css";

const PREFIX = "bknProject.model.existing";

/**
 * What the project's network already has, before the draft holds it: kept on the network as it
 * is, so read only here and opened in the network's workspace. Nothing shows on a new network.
 * Once drafted, the draft lists these among its own items.
 */
export function ExistingDefinitions({
  networkId,
  projectId,
  skippedTables = [],
}: {
  networkId: string;
  projectId: string;
  /** Tables drafting left out because an existing object type reads them. */
  skippedTables?: string[];
}) {
  const { t } = useTranslation();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [tab, setTab] = useState<"objects" | "relations">("objects");

  useEffect(() => {
    let active = true;
    // A project the network has nothing for shows nothing; a failed read only hides the list.
    getExistingDefinitions(projectId)
      .then((value) => active && setExisting(value))
      .catch(() => active && setExisting(null));
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!existing || existing.objectTypes.length + existing.relationTypes.length === 0) {
    return null;
  }
  const names = Object.fromEntries(existing.objectTypes.map((item) => [item.id, item.name]));

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>
          <ExistingMark />
          {t(`${PREFIX}.title`)}
        </span>
        <span className={styles.hint}>
          {t(`${PREFIX}.summary`, {
            objects: existing.objectTypes.length,
            relations: existing.relationTypes.length,
          })}
        </span>
      </div>
      {skippedTables.length ? (
        <span className={styles.hint}>
          {t(`${PREFIX}.skipped`, {
            count: skippedTables.length,
            tables: skippedTables.join(t(`${PREFIX}.separator`)),
          })}
        </span>
      ) : null}
      <Segmented<"objects" | "relations">
        onChange={setTab}
        options={[
          {
            label: t(`${PREFIX}.objects`, { count: existing.objectTypes.length }),
            value: "objects",
          },
          {
            label: t(`${PREFIX}.relations`, { count: existing.relationTypes.length }),
            value: "relations",
          },
        ]}
        value={tab}
      />
      {tab === "objects" ? (
        <Table<ExistingObjectType>
          columns={[
            {
              key: "name",
              render: (_, item) => (
                <span className={styles.name}>
                  <ExistingMark />
                  {item.name}
                </span>
              ),
              title: t(`${PREFIX}.columns.name`),
            },
            {
              key: "keys",
              render: (_, item) => item.primaryKeys.join(t(`${PREFIX}.separator`)) || "—",
              title: t(`${PREFIX}.columns.identity`),
            },
            {
              dataIndex: "propertyCount",
              key: "properties",
              title: t(`${PREFIX}.columns.properties`),
            },
            {
              key: "open",
              render: (_, item) => (
                <Link to={networkObjectTypePath(networkId, item.id)}>{t(`${PREFIX}.open`)}</Link>
              ),
              title: "",
            },
          ]}
          dataSource={existing.objectTypes}
          pagination={existing.objectTypes.length > 10 ? { pageSize: 10, size: "small" } : false}
          rowKey="id"
          size="small"
        />
      ) : (
        <Table<ExistingRelationType>
          columns={[
            {
              key: "name",
              render: (_, item) => (
                <span className={styles.name}>
                  <ExistingMark />
                  {item.name}
                </span>
              ),
              title: t(`${PREFIX}.columns.name`),
            },
            {
              key: "ends",
              render: (_, item) =>
                t(`${PREFIX}.ends`, {
                  source: names[item.source] ?? item.source,
                  target: names[item.target] ?? item.target,
                }),
              title: t(`${PREFIX}.columns.ends`),
            },
          ]}
          dataSource={existing.relationTypes}
          pagination={existing.relationTypes.length > 10 ? { pageSize: 10, size: "small" } : false}
          rowKey="id"
          size="small"
        />
      )}
    </section>
  );
}
