/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { HttpDebugRequestFields } from "@/modules/execution-factory/components/HttpDebugRequestFields";
import { debugTool } from "@/modules/execution-factory/services/tool.service";
import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  ToolDebugResult,
  ToolIoSpec,
  ToolRecord,
  ToolRunLogEntry,
} from "@/modules/execution-factory/types/tool";
import {
  buildHttpDebugInitialValues,
  buildHttpDebugRequest,
  type HttpDebugFormValues,
} from "@/modules/execution-factory/utils/http-debug-request";

import { JsonCodeBlock } from "./JsonCodeBlock";
import styles from "./ToolDebugPanel.module.css";

type ToolDebugPanelProps = {
  boxId: string;
  defaultRequestBody?: string;
  functionInput?: FunctionInputPayload;
  ioSpec?: ToolIoSpec;
  onRunComplete?: (entry: ToolRunLogEntry) => void;
  record: ToolRecord | null;
};

export function ToolDebugPanel({
  boxId,
  defaultRequestBody,
  functionInput,
  ioSpec,
  onRunComplete,
  record,
}: ToolDebugPanelProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<HttpDebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolDebugResult | null>(null);

  const initialValues = useMemo(
    () => buildHttpDebugInitialValues(ioSpec, functionInput, defaultRequestBody),
    [defaultRequestBody, functionInput, ioSpec],
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const handleDebug = async () => {
    if (!record) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      const debugRequest = buildHttpDebugRequest(values, ioSpec, record.path);
      const debugResult = await debugTool(boxId, record.toolId, debugRequest);
      setResult(debugResult);
      onRunComplete?.({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        statusCode: debugResult.statusCode,
        durationMs: debugResult.durationMs,
        error: debugResult.error,
        body: debugResult.body,
        requestBody: debugRequest,
      });
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{t("executionFactory.toolDebugWorkbenchTitle")}</h3>
          <p className={styles.desc}>{t("executionFactory.toolDebugWorkbenchDesc")}</p>
        </div>
        <AppButton
          disabled={!record}
          loading={submitting}
          onClick={() => {
            void handleDebug();
          }}
          type="primary"
        >
          {t("executionFactory.runDebug")}
        </AppButton>
      </div>
      {record ? (
        <p className={styles.desc}>
          {record.name} ({record.toolId})
        </p>
      ) : null}
      <div className={styles.content}>
        <div className={styles.requestCard}>
          <Form form={form} layout="vertical">
            <HttpDebugRequestFields
              ioSpec={ioSpec}
              method={record?.method}
              path={record?.path}
              serverUrl={record?.serverUrl}
            />
          </Form>
          {error ? <Alert message={error} showIcon type="error" /> : null}
        </div>
        <div className={styles.resultCard}>
          {result ? (
            <section
              className={result.error ? styles.resultPanelWarning : styles.resultPanelSuccess}
              data-testid="tool-debug-inline-result"
            >
              <div className={styles.resultHeader}>
                <span className={result.error ? styles.statusDotWarning : styles.statusDotSuccess} />
                <span className={styles.resultTitle}>
                  {t("executionFactory.debugResultTitle")}
                </span>
                <span className={styles.resultMeta}>
                  HTTP {result.statusCode || "-"}
                  {typeof result.durationMs === "number" ? ` · ${result.durationMs} ms` : ""}
                </span>
              </div>
              <JsonCodeBlock value={result} />
            </section>
          ) : (
            <div className={styles.resultEmpty}>
              {t("executionFactory.toolDebugWorkbenchEmpty")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
