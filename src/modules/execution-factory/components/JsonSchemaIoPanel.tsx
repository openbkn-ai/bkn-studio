/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { JsonSchemaFields } from "@/framework/json/JsonSchemaFields";
import { extractSchemaProperties } from "@/framework/json/schema-properties";
import { JsonCodeBlock } from "./JsonCodeBlock";

import styles from "./ToolIoPanel.module.css";

type JsonSchemaIoPanelProps = {
  schema?: unknown;
  outputSchema?: unknown;
};

export function JsonSchemaIoPanel({ outputSchema, schema }: JsonSchemaIoPanelProps) {
  const { t } = useTranslation();
  const properties = useMemo(() => extractSchemaProperties(schema), [schema]);
  const outputProperties = useMemo(() => extractSchemaProperties(outputSchema), [outputSchema]);
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

  const fieldLabels = {
    name: t("executionFactory.parameterName"),
    type: t("executionFactory.parameterType"),
    required: t("executionFactory.globalParameterRequired"),
    description: t("executionFactory.parameterDescription"),
  };

  return (
    <div className={styles.panel}>
      {properties.length > 0 ? (
        <section>
          <h4 className={styles.sectionTitle}>{t("executionFactory.ioParameters")}</h4>
          <JsonSchemaFields schema={schema} labels={fieldLabels} />
        </section>
      ) : null}
      <section style={{ marginTop: properties.length > 0 ? 16 : 0 }}>
        <h4 className={styles.sectionTitle}>{t("executionFactory.mcpToolSchemaRawTitle")}</h4>
        <JsonCodeBlock value={schema} />
      </section>
      {/* 面板叫「输入输出」，输出这半边此前从不渲染。MCP 的 outputSchema 是可选的，
          多数服务不给，那就明说没声明，而不是留白让人以为工具没有返回。 */}
      <section style={{ marginTop: 16 }}>
        <h4 className={styles.sectionTitle}>{t("executionFactory.mcpToolOutputSchemaTitle")}</h4>
        {outputSchema ? (
          <>
            {outputProperties.length > 0 ? (
              <JsonSchemaFields schema={outputSchema} labels={fieldLabels} />
            ) : null}
            <div style={{ marginTop: outputProperties.length > 0 ? 12 : 0 }}>
              <JsonCodeBlock value={outputSchema} />
            </div>
          </>
        ) : (
          <p className={styles.emptyHint}>{t("executionFactory.mcpToolOutputSchemaUndeclared")}</p>
        )}
      </section>
    </div>
  );
}
