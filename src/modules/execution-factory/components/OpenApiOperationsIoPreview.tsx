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

export function OpenApiOperationsIoPreview({
  limit = DEFAULT_LIMIT,
  openapiSpec = "",
}: OpenApiOperationsIoPreviewProps) {
  const { t } = useTranslation();
  const operations = useMemo(() => extractOpenApiOperationsIo(openapiSpec), [openapiSpec]);
  const visibleOperations = operations.slice(0, limit);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    if (visibleOperations[0]) {
      setActiveKeys([operationKey(visibleOperations[0])]);
      return;
    }

    setActiveKeys([]);
  }, [openapiSpec, limit]);

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
          const hasRequestBody =
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
                  {t("executionFactory.openapiOperationIoSummary", {
                    paramCount,
                    responseCount,
                  })}
                  {hasRequestBody
                    ? ` · ${t("executionFactory.openapiOperationIoRequestBody")}`
                    : ""}
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
