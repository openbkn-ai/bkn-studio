/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Popover, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  describeCell,
  objectKey,
  textOf,
  type CypherResult,
  type CypherSchemaNames,
  type ObjectValue,
} from "@/modules/knowledge-network/cypher/graph-values";

import styles from "./CypherQueryScene.module.css";

type Row = Record<string, unknown> & { __row: number };

function PropertyList({ value }: { value: Record<string, unknown> }) {
  const entries = Object.entries(value);
  if (entries.length === 0) return <span className={styles.muted}>-</span>;
  return (
    <dl className={styles.propertyList}>
      {entries.map(([name, item]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{textOf(item)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ObjectDetail({ value }: { value: ObjectValue }) {
  const { t } = useTranslation();
  return (
    <div className={styles.cellDetail}>
      <div className={styles.cellDetailTitle}>{t("knowledgeNetwork.cypherQuery.table.key")}</div>
      <PropertyList value={objectKey(value)} />
      {value.properties && Object.keys(value.properties).length > 0 ? (
        <>
          <div className={styles.cellDetailTitle}>
            {t("knowledgeNetwork.cypherQuery.table.properties")}
          </div>
          <PropertyList value={value.properties} />
        </>
      ) : null}
    </div>
  );
}

function Cell({ value, names }: { value: unknown; names: CypherSchemaNames }) {
  const { t } = useTranslation();
  const cell = describeCell(value, names);
  if (cell.kind === "scalar") {
    return cell.text === "" ? (
      <span className={styles.muted}>null</span>
    ) : (
      <Typography.Text copyable={{ text: cell.text }}>{cell.text}</Typography.Text>
    );
  }
  let detail;
  if (cell.kind === "object") detail = <ObjectDetail value={cell.value} />;
  else if (cell.kind === "relation")
    detail = (
      <div className={styles.cellDetail}>
        <div className={styles.cellDetailTitle}>
          {t("knowledgeNetwork.cypherQuery.table.source")}
        </div>
        <ObjectDetail value={cell.value.source} />
        <div className={styles.cellDetailTitle}>
          {t("knowledgeNetwork.cypherQuery.table.target")}
        </div>
        <ObjectDetail value={cell.value.target} />
      </div>
    );
  else detail = <pre className={styles.jsonDetail}>{JSON.stringify(cell.value, null, 2)}</pre>;
  const copyText = cell.kind === "json" ? JSON.stringify(cell.value) : cell.text;
  return (
    <span className={styles.cellValue}>
      <Popover content={detail} trigger="click" placement="bottomLeft">
        <button className={cell.kind === "json" ? styles.jsonChip : styles.graphChip} type="button">
          {cell.text}
        </button>
      </Popover>
      <Typography.Text copyable={{ text: copyText }} />
    </span>
  );
}

export function CypherResultTable({
  result,
  names,
  fullHeight,
}: {
  result: CypherResult;
  names: CypherSchemaNames;
  /** The frame is full screen: let the table use the height. */
  fullHeight?: boolean;
}) {
  const { t } = useTranslation();
  const columnNames = useMemo(
    () =>
      result.columns.length > 0
        ? result.columns.map((column) => column.name)
        : Object.keys(result.entries[0] ?? {}),
    [result],
  );
  const rows = useMemo<Row[]>(
    () => result.entries.map((entry, index) => ({ ...entry, __row: index })),
    [result],
  );
  const columns = useMemo<ColumnsType<Row>>(
    () =>
      columnNames.map((name) => ({
        dataIndex: name,
        key: name,
        title: name,
        render: (_: unknown, row: Row) => <Cell names={names} value={row[name]} />,
      })),
    [columnNames, names],
  );

  return (
    <div className={styles.tableView}>
      <Table<Row>
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: t("knowledgeNetwork.cypherQuery.table.empty") }}
        pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
        rowKey="__row"
        // A fixed height keeps a long result inside its frame; the header stays in view.
        scroll={{ x: "max-content", y: fullHeight ? "calc(100vh - 260px)" : 400 }}
        size="small"
      />
    </div>
  );
}
