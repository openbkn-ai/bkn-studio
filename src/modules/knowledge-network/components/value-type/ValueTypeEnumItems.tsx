/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import type { ValueTypeEnumItem } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ValueTypeEnumItems.module.css";

const PREFIX = "knowledgeNetwork.valueTypes";

/**
 * The items of an enum value type: a table in the value type list, a row of tags where a property
 * that names the value type is shown. A deprecated item is marked so.
 */
export function ValueTypeEnumItems({
  items,
  label,
  variant = "table",
}: {
  items: readonly ValueTypeEnumItem[];
  label?: string;
  variant?: "table" | "tags";
}) {
  const { t } = useTranslation();

  if (variant === "tags") {
    return (
      <div className={styles.tags}>
        {label ? <span className={styles.label}>{label}</span> : null}
        {items.map((item) => (
          <Tag color={item.deprecated ? "gold" : undefined} key={item.value}>
            <span className={styles.code}>{item.value}</span> {item.display}
            {item.deprecated ? ` · ${t(`${PREFIX}.enumColumn.deprecated`)}` : null}
          </Tag>
        ))}
      </div>
    );
  }

  const columns: ColumnsType<ValueTypeEnumItem> = [
    {
      dataIndex: "value",
      key: "value",
      render: (value: string) => <span className={styles.code}>{value}</span>,
      title: t(`${PREFIX}.enumColumn.value`),
      width: 120,
    },
    { dataIndex: "display", key: "display", title: t(`${PREFIX}.enumColumn.display`) },
    {
      dataIndex: "deprecated",
      key: "status",
      render: (deprecated?: boolean) =>
        deprecated ? <Tag color="gold">{t(`${PREFIX}.enumColumn.deprecated`)}</Tag> : null,
      title: t(`${PREFIX}.enumColumn.status`),
      width: 96,
    },
    {
      dataIndex: "description",
      key: "description",
      title: t(`${PREFIX}.enumColumn.description`),
    },
  ];

  return (
    <Table<ValueTypeEnumItem>
      className={styles.table}
      columns={columns}
      dataSource={[...items]}
      pagination={false}
      rowKey="value"
      size="small"
    />
  );
}
