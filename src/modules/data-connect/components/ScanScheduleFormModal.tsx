/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal, Select, Switch } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { DataConnectRecord } from "@/modules/data-connect/types/data-connect";
import type {
  DataConnectScanSchedule,
  DataConnectScanStrategy,
} from "@/modules/data-connect/types/scan";

import styles from "./ScanScheduleFormModal.module.css";

type ScanScheduleFormModalProps = {
  catalogs: DataConnectRecord[];
  initialValue?: DataConnectScanSchedule | null;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (payload: ScanScheduleFormModalSubmitPayload) => Promise<void>;
  open: boolean;
  submitting: boolean;
};

type ScanScheduleFormValues = {
  catalogId: string;
  cronExpr: string;
  enabled: boolean;
  endTime?: string;
  name: string;
  startTime?: string;
  strategy: DataConnectScanStrategy;
};

export type ScanScheduleFormModalSubmitPayload = {
  catalogId: string;
  cronExpr: string;
  enabled: boolean;
  endTime?: number;
  name: string;
  startTime?: number;
  strategy: DataConnectScanStrategy;
};

export function ScanScheduleFormModal({
  catalogs,
  initialValue,
  mode,
  onCancel,
  onSubmit,
  open,
  submitting,
}: ScanScheduleFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ScanScheduleFormValues>();

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      catalogId: initialValue?.catalogId,
      cronExpr: initialValue?.cronExpr ?? "",
      enabled: initialValue?.enabled ?? true,
      endTime: formatDateTimeLocal(initialValue?.endTimeValue),
      name: initialValue?.name ?? "",
      startTime: formatDateTimeLocal(initialValue?.startTimeValue),
      strategy: initialValue?.strategy ?? "full_sync",
    });
  }, [form, initialValue, open]);

  return (
    <Modal
      destroyOnHidden
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(async (values) => {
          await onSubmit({
            catalogId: values.catalogId,
            cronExpr: values.cronExpr.trim(),
            enabled: values.enabled,
            endTime: parseDateTimeLocal(values.endTime),
            name: values.name.trim(),
            startTime: parseDateTimeLocal(values.startTime),
            strategy: values.strategy,
          });
        });
      }}
      open={open}
      title={
        mode === "create"
          ? t("dataConnect.scanCreateTitle")
          : t("dataConnect.scanEditTitle")
      }
      width={720}
    >
      <Form form={form} layout="vertical">
        {mode === "edit" ? (
          <Alert
            message={t("dataConnect.scanEditHint")}
            showIcon
            style={{ marginBottom: 16 }}
            type="info"
          />
        ) : null}
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
          <div className={styles.formGrid}>
            <Form.Item
              className={styles.full}
              label={t("dataConnect.scanScheduleName")}
              name="name"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item
              label={t("dataConnect.scanCatalog")}
              name="catalogId"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select
                disabled={mode === "edit"}
                options={catalogs.map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
                optionFilterProp="label"
                placeholder={t("dataConnect.scanCatalogFilterPlaceholder")}
                showSearch
              />
            </Form.Item>
            <Form.Item
              label={t("dataConnect.scanStrategy")}
              name="strategy"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select
                options={[
                  {
                    label: t("dataConnect.scanStrategies.full_sync"),
                    value: "full_sync",
                  },
                  {
                    label: t("dataConnect.scanStrategies.create_only"),
                    value: "create_only",
                  },
                  {
                    label: t("dataConnect.scanStrategies.cleanup_only"),
                    value: "cleanup_only",
                  },
                ]}
              />
            </Form.Item>
            {mode === "create" ? (
              <Form.Item
                initialValue={true}
                label={t("common.enabled")}
                name="enabled"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            ) : null}
          </div>
        </div>
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("common.advancedConfig")}</h3>
          <div className={styles.formGrid}>
            <Form.Item
              className={styles.full}
              label={t("dataConnect.scanCronExpr")}
              name="cronExpr"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Input placeholder={t("dataConnect.scanCronExprPlaceholder")} />
            </Form.Item>
            <Form.Item label={t("dataConnect.scanStartTime")} name="startTime">
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item label={t("dataConnect.scanEndTime")} name="endTime">
              <Input type="datetime-local" />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Modal>
  );
}

function formatDateTimeLocal(value?: number) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocal(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}
