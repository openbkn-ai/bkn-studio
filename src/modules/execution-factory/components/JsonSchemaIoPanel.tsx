import { Empty, Table } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import styles from "./ToolIoPanel.module.css";

type JsonSchemaIoPanelProps = {
  schema?: unknown;
};

type SchemaPropertyRow = {
  key: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
};

function renderJson(value: unknown) {
  if (value === undefined || value === null) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

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

export function JsonSchemaIoPanel({ schema }: JsonSchemaIoPanelProps) {
  const { t } = useTranslation();
  const properties = useMemo(() => extractSchemaProperties(schema), [schema]);
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

  return (
    <div className={styles.panel}>
      {properties.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>{t("executionFactory.ioParameters")}</h4>
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
            dataSource={properties}
            pagination={false}
            rowKey="key"
            size="small"
          />
        </section>
      ) : null}
      <section style={{ marginTop: properties.length > 0 ? 16 : 0 }}>
        <h4 className={styles.sectionTitle}>{t("executionFactory.mcpToolSchemaRawTitle")}</h4>
        <pre className={styles.jsonPreview}>{renderJson(schema)}</pre>
      </section>
    </div>
  );
}
