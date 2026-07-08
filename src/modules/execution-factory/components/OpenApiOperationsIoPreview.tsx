/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Collapse } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ToolIoPanel } from "@/modules/execution-factory/components/ToolIoPanel";
import { extractOpenApiOperationsIo } from "@/modules/execution-factory/utils/openapi-operation-io";

import styles from "./OpenApiOperationsIoPreview.module.css";

type OpenApiOperationsIoPreviewProps = {
  limit?: number;
  openapiSpec?: string;
};

const DEFAULT_LIMIT = 8;

function operationKey(operation: { method: string; path: string }) {
  return `${operation.method}:${operation.path}`;
}

function countRequestBodyFields(schema: unknown, example: unknown) {
  if (schema && typeof schema === "object") {
    const properties = (schema as { properties?: unknown }).properties;
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      return Object.keys(properties).length;
    }
  }

  if (example && typeof example === "object" && !Array.isArray(example)) {
    return Object.keys(example).length;
  }

  return 0;
}

export function OpenApiOperationsIoPreview({
  limit = DEFAULT_LIMIT,
  openapiSpec = "",
}: OpenApiOperationsIoPreviewProps) {
  const { t } = useTranslation();
  const operations = useMemo(() => extractOpenApiOperationsIo(openapiSpec), [openapiSpec]);
  const visibleOperations = operations.slice(0, limit);
  const firstOperationKey = visibleOperations[0] ? operationKey(visibleOperations[0]) : undefined;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    if (firstOperationKey) {
      setActiveKeys([firstOperationKey]);
      return;
    }

    setActiveKeys([]);
  }, [firstOperationKey]);

  if (operations.length === 0) {
    return null;
  }

  return (
    <div className={styles.root}>
      <p className={styles.hint}>{t("executionFactory.openapiOperationsIoPreviewHint")}</p>
      <Collapse
        activeKey={activeKeys}
        items={visibleOperations.map((operation) => {
          const paramCount = operation.io.parameters.length;
          const responseCount = Object.keys(operation.io.responses ?? {}).length;
          const bodyFieldCount = countRequestBodyFields(
            operation.io.requestBodySchema,
            operation.io.requestBodyExample,
          );
          const hasRequestBody =
            bodyFieldCount > 0 ||
            Boolean(operation.io.requestBodyDescription) ||
            operation.io.requestBodyExample !== undefined ||
            operation.io.requestBodySchema !== undefined;

          return {
            key: operationKey(operation),
            label: (
              <div className={styles.panelHeader}>
                <code className={styles.methodPath}>
                  {operation.method} {operation.path}
                </code>
                {operation.summary ? (
                  <span className={styles.summary}>{operation.summary}</span>
                ) : null}
                <span className={styles.ioMeta}>
                  {hasRequestBody
                    ? t("executionFactory.openapiOperationIoSummaryWithBody", {
                        bodyFieldCount,
                        paramCount,
                        responseCount,
                      })
                    : t("executionFactory.openapiOperationIoSummary", {
                        paramCount,
                        responseCount,
                      })}
                </span>
              </div>
            ),
            children: (
              <div className={styles.panelBody}>
                {operation.description ? (
                  <p className={styles.hint}>{operation.description}</p>
                ) : null}
                <ToolIoPanel ioSpec={operation.io} />
              </div>
            ),
          };
        })}
        onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
        size="small"
      />
      {operations.length > limit ? (
        <div className={styles.more}>
          {t("executionFactory.openapiPreviewMore", {
            count: operations.length - limit,
          })}
        </div>
      ) : null}
    </div>
  );
}
