/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Modal, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { convertOperatorToTool } from "@/modules/execution-factory/services/tool.service";
import { listToolboxes } from "@/modules/execution-factory/services/toolbox.service";
import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { ToolboxRecord } from "@/modules/execution-factory/types/toolbox";
import { eligibleOperatorConversionTargets } from "@/modules/execution-factory/utils/operator-conversion-targets";

type ConvertOperatorToToolModalProps = {
  onClose: () => void;
  onSuccess?: () => void;
  open: boolean;
  record: OperatorRecord | null;
};

type ConvertFormValues = {
  boxId: string;
};

export function ConvertOperatorToToolModal({
  onClose,
  onSuccess,
  open,
  record,
}: ConvertOperatorToToolModalProps) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const [form] = Form.useForm<ConvertFormValues>();
  const [toolboxes, setToolboxes] = useState<ToolboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligibleToolboxes = eligibleOperatorConversionTargets(record, toolboxes, runtimeConfig.currentUser.permissions);

  useEffect(() => {
    if (!open || !record?.metadataType) {
      form.resetFields();
      setError(null);
      setToolboxes([]);
      return;
    }

    void (async () => {
      setLoading(true);

      try {
        const listResult = await listToolboxes({
          page: 1,
          pageSize: 100,
          metadataType: record.metadataType,
        });
        setToolboxes(listResult.items);
      } catch (caughtError) {
        setError(extractRequestErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, open, record?.metadataType]);

  const handleConvert = async () => {
    if (!record) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const values = await form.validateFields();
      if (!eligibleToolboxes.some((toolbox) => toolbox.boxId === values.boxId)) {
        throw new Error(t("executionFactory.convertTargetUnauthorized"));
      }
      await convertOperatorToTool({
        boxId: values.boxId,
        operatorId: record.operatorId,
        operatorVersion: record.version,
      });
      void message.success(t("common.success"));
      onSuccess?.();
      onClose();
    } catch (caughtError) {
      setError(extractRequestErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t("executionFactory.convertToTool")}
      onCancel={onClose}
      onOk={() => {
        void handleConvert();
      }}
      open={open}
      title={t("executionFactory.convertToToolTitle")}
    >
      {record ? (
        <p>
          {record.name} ({record.operatorId} @ {record.version})
        </p>
      ) : null}
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("executionFactory.targetToolbox")}
          name="boxId"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Select
            loading={loading}
            options={eligibleToolboxes.map((item) => ({
              label: item.name,
              value: item.boxId,
            }))}
            placeholder={t("executionFactory.targetToolboxPlaceholder")}
          />
        </Form.Item>
      </Form>
      {error ? <Alert message={error} showIcon type="error" /> : null}
    </Modal>
  );
}
