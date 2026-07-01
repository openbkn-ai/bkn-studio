/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { debugOperator } from "@/modules/execution-factory/services/operator.service";
import type { FunctionInputPayload } from "@/modules/execution-factory/types/function-input";
import type {
  OperatorDebugResult,
  OperatorRecord,
  OperatorRunLogEntry,
} from "@/modules/execution-factory/types/operator";
import { buildDefaultDebugBody } from "@/modules/execution-factory/utils/generate-sample-json";
import { extractOpenApiOperationsIo } from "@/modules/execution-factory/utils/openapi-operation-io";

type OperatorDebugPanelProps = {
  functionInput?: FunctionInputPayload;
  onRunComplete?: (entry: OperatorRunLogEntry) => void;
  openapiSpec?: string;
  record: OperatorRecord | null;
};

type DebugFormValues = {
  requestBody?: string;
};

export function OperatorDebugPanel({
  functionInput,
  onRunComplete,
  openapiSpec,
  record,
}: OperatorDebugPanelProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DebugFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperatorDebugResult | null>(null);

  const generatedBody = useMemo(() => {
    const ioSpec = openapiSpec ? extractOpenApiOperationsIo(openapiSpec)[0]?.io : undefined;

    return buildDefaultDebugBody({
      functionInput,
      ioSpec,
    });
  }, [functionInput, openapiSpec]);

  useEffect(() => {
    form.setFieldsValue({ requestBody: generatedBody });
    setError(null);
    setResult(null);
  }, [form, generatedBody, record?.operatorId, record?.version]);

  const handleDebug = async () => {
    if (!record) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const values = await form.validateFields();
      let body: Record<string, unknown> | undefined;

      if (values.requestBody?.trim()) {
        body = JSON.parse(values.requestBody) as Record<string, unknown>;
      }

      const debugResult = await debugOperator({
        body,
        operatorId: record.operatorId,
        version: record.version,
      });
      setResult(debugResult);
      onRunComplete?.({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        statusCode: debugResult.statusCode,
        durationMs: debugResult.durationMs,
        error: debugResult.error,
        body: debugResult.body,
        requestBody: body,
      });
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!record) {
    return null;
  }

  return (
    <div>
      <Typography.Paragraph type="secondary">{t("executionFactory.debugSampleHint")}</Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item label={t("executionFactory.debugRequestBody")} name="requestBody">
          <Input.TextArea rows={8} />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}
      <AppButton loading={submitting} onClick={() => void handleDebug()} type="primary">
        {t("executionFactory.runDebug")}
      </AppButton>
      {result ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Title level={5}>{t("executionFactory.debugResultTitle")}</Typography.Title>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
