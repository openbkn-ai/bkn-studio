/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty, Table } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { JsonCodeBlock } from "./JsonCodeBlock";

import styles from "./ToolIoPanel.module.css";

type JsonSchemaIoPanelProps = {
  schema?: unknown;
  outputSchema?: unknown;
};

type SchemaPropertyRow = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
};

function extractSchemaProperties(schema: unknown): SchemaPropertyRow[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  const record = schema as Record<string, unknown>;
  const properties = record.properties;

  if (!properties || typeof properties !== "object") {
    return [];
  }

  const requiredSet = new Set(
    Array.isArray(record.required)
      ? record.required.filter((item): item is string => typeof item === "string")
      : [],
  );

  return Object.entries(properties as Record<string, unknown>).map(([name, definition]) => {
    const def = definition && typeof definition === "object" ? (definition as Record<string, unknown>) : {};
    const typeValue = def.type;
    const type =
      typeof typeValue === "string"
        ? typeValue
        : Array.isArray(typeValue)
          ? typeValue.join(" | ")
          : "-";

    return {
      key: name,
      name,
      type,
      required: requiredSet.has(name),
      description: typeof def.description === "string" ? def.description : undefined,
    };
  });
}

export function JsonSchemaIoPanel({ outputSchema, schema }: JsonSchemaIoPanelProps) {
  const { t } = useTranslation();
  const properties = useMemo(() => extractSchemaProperties(schema), [schema]);
  const outputProperties = useMemo(
    () => extractSchemaProperties(outputSchema),
    [outputSchema],
  );
  const hasSchema = Boolean(schema);

  if (!hasSchema) {
    return (
      <div className={styles.panel}>
        <Empty description={t("executionFactory.ioPanelEmpty")}>
          <p className={styles.emptyHint}>{t("executionFactory.mcpToolSchemaEmptyHint")}</p>
        </Empty>
      </div>
    );
  }

  const propertyTable = (rows: SchemaPropertyRow[]) => (
    <Table
      columns={[
        { dataIndex: "name", key: "name", title: t("executionFactory.parameterName") },
        { dataIndex: "type", key: "type", title: t("executionFactory.parameterType") },
        {
          dataIndex: "required",
          key: "required",
          render: (value: boolean) => (value ? "✓" : "-"),
          title: t("executionFactory.globalParameterRequired"),
        },
        {
          dataIndex: "description",
          key: "description",
          render: (value?: string) => value || "-",
          title: t("executionFactory.parameterDescription"),
        },
      ]}
      dataSource={rows}
      pagination={false}
      rowKey="key"
      size="small"
    />
  );

  return (
    <div className={styles.panel}>
      {properties.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>{t("executionFactory.ioParameters")}</h4>
          {propertyTable(properties)}
        </section>
      ) : null}
      <section style={{ marginTop: properties.length > 0 ? 16 : 0 }}>
        <h4 className={styles.sectionTitle}>{t("executionFactory.mcpToolSchemaRawTitle")}</h4>
        <JsonCodeBlock value={schema} />
      </section>
      {/* 面板叫「输入输出」，输出这半边此前从不渲染。MCP 的 outputSchema 是可选的，
          多数服务不给，那就明说没声明，而不是留白让人以为工具没有返回。 */}
      <section style={{ marginTop: 16 }}>
        <h4 className={styles.sectionTitle}>
          {t("executionFactory.mcpToolOutputSchemaTitle")}
        </h4>
        {outputSchema ? (
          <>
            {outputProperties.length > 0 ? propertyTable(outputProperties) : null}
            <div style={{ marginTop: outputProperties.length > 0 ? 12 : 0 }}>
              <JsonCodeBlock value={outputSchema} />
            </div>
          </>
        ) : (
          <p className={styles.emptyHint}>
            {t("executionFactory.mcpToolOutputSchemaUndeclared")}
          </p>
        )}
      </section>
    </div>
  );
}
