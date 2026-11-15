/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Table } from "antd";

import { extractSchemaProperties } from "./schema-properties";

export type SchemaFieldLabels = {
  name: string;
  type: string;
  required: string;
  description: string;
};

export function JsonSchemaFields({
  schema,
  labels,
  compact = false,
}: {
  schema: unknown;
  labels: SchemaFieldLabels;
  compact?: boolean;
}) {
  const rows = extractSchemaProperties(schema);
  if (!rows.length) return null;
  return (
    <Table
      columns={[
        { dataIndex: "name", title: labels.name, ellipsis: compact },
        {
          dataIndex: "type",
          title: labels.type,
          width: compact ? 110 : undefined,
          ellipsis: compact,
        },
        {
          dataIndex: "required",
          title: labels.required,
          width: compact ? 80 : undefined,
          render: (value: boolean) => (value ? "✓" : "-"),
        },
        {
          dataIndex: "description",
          title: labels.description,
          ellipsis: compact,
          render: (value?: string) => value || "-",
        },
      ]}
      dataSource={rows}
      pagination={false}
      rowKey="key"
      size="small"
      tableLayout={compact ? "fixed" : undefined}
    />
  );
}
