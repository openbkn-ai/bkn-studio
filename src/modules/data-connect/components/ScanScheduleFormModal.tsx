/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal, Select, Switch } from "antd";
import type { FormItemProps, Rule } from "antd/es/form";
import type { ReactNode } from "react";
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
  defaultCatalogId?: string;
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

/** Vega discover-schedule 使用标准 5 段 cron：分 时 日 月 周 */
const CRON_PRESETS = [
  { key: "daily2am", value: "0 2 * * *" },
  { key: "hourly", value: "0 * * * *" },
  { key: "monday2am", value: "0 2 * * 1" },
] as const;

export function ScanScheduleFormModal({
  catalogs,
  defaultCatalogId,
  initialValue,
  mode,
  onCancel,
  onSubmit,
  open,
  submitting,
}: ScanScheduleFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ScanScheduleFormValues>();
  const catalogLocked = mode === "edit" || Boolean(defaultCatalogId);
  const cronExpr = Form.useWatch("cronExpr", form);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      catalogId: initialValue?.catalogId ?? defaultCatalogId,
      cronExpr: initialValue?.cronExpr ?? "0 2 * * *",
      enabled: initialValue?.enabled ?? true,
      endTime: formatDateTimeLocal(initialValue?.endTimeValue),
      name: initialValue?.name ?? "",
      startTime: formatDateTimeLocal(initialValue?.startTimeValue),
      strategy: initialValue?.strategy ?? "full_sync",
    });
  }, [defaultCatalogId, form, initialValue, open]);

  return (
    <Modal
      cancelText={t("common.cancel")}
      className={styles.modal}
      confirmLoading={submitting}
      destroyOnHidden
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(async (values) => {
          const enabled =
            mode === "edit"
              ? (initialValue?.enabled ?? true)
              : (values.enabled ?? true);
          await onSubmit({
            catalogId: values.catalogId,
            cronExpr: values.cronExpr.trim(),
            enabled,
            endTime: parseDateTimeLocal(values.endTime),
            name: values.name.trim(),
            startTime: parseDateTimeLocal(values.startTime),
            strategy: values.strategy,
          });
        });
      }}
      open={open}
      rootClassName={styles.modalRoot}
      title={
        mode === "create"
          ? t("dataConnect.scanCreateTitle")
          : t("dataConnect.scanEditTitle")
      }
      width={640}
    >
      <Form className={styles.form} colon={false} form={form} requiredMark={false}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t("common.basicInfo")}</div>
          <div className={styles.grid}>
            <InlineField
              label={t("dataConnect.scanScheduleName")}
              name="name"
              required
              rules={[{ required: true, message: t("common.required") }]}
              span="half"
            >
              <Input
                maxLength={255}
                placeholder={t("dataConnect.scanScheduleNamePlaceholder")}
              />
            </InlineField>
            {mode === "create" ? (
              <InlineField
                label={t("common.status")}
                name="enabled"
                span="half"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren={t("common.enabled")}
                  unCheckedChildren={t("common.disabled")}
                />
              </InlineField>
            ) : (
              <div className={styles.spanHalf} />
            )}
            <InlineField
              label={t("dataConnect.scanCatalog")}
              name="catalogId"
              required
              rules={[{ required: true, message: t("common.required") }]}
              span="half"
            >
              <Select
                disabled={catalogLocked}
                options={catalogs.map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
                optionFilterProp="label"
                placeholder={t("dataConnect.scanCatalogFilterPlaceholder")}
                showSearch
              />
            </InlineField>
            <InlineField
              label={t("dataConnect.scanStrategy")}
              name="strategy"
              required
              rules={[{ required: true, message: t("common.required") }]}
              span="half"
            >
              <Select
                optionLabelProp="label"
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
                optionRender={(option) => (
                  <div className={styles.strategyOption}>
                    <span className={styles.strategyTitle}>{option.label}</span>
                    <span className={styles.strategyHint}>
                      {t(`dataConnect.scanStrategyHints.${String(option.value)}`)}
                    </span>
                  </div>
                )}
              />
            </InlineField>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t("dataConnect.scanScheduleConfig")}</div>
          <div className={styles.grid}>
            <InlineField
              label={t("dataConnect.scanCronExpr")}
              name="cronExpr"
              required
              rules={[{ required: true, message: t("common.required") }]}
              span="full"
            >
              <Input placeholder={t("dataConnect.scanCronExprPlaceholder")} />
            </InlineField>
            <div className={styles.cronPresets}>
              <span className={styles.cronPresetsLabel}>
                {t("dataConnect.scanCronPresets")}
              </span>
              <div className={styles.cronPresetList}>
                {CRON_PRESETS.map((preset) => (
                  <button
                    className={
                      cronExpr === preset.value
                        ? `${styles.cronPreset} ${styles.cronPresetActive}`
                        : styles.cronPreset
                    }
                    key={preset.key}
                    onClick={() => {
                      form.setFieldValue("cronExpr", preset.value);
                    }}
                    type="button"
                  >
                    {t(`dataConnect.scanCronPresetLabels.${preset.key}`)}
                  </button>
                ))}
              </div>
            </div>
            <InlineField
              label={t("dataConnect.scanStartTime")}
              name="startTime"
              span="half"
            >
              <Input type="datetime-local" />
            </InlineField>
            <InlineField
              label={t("dataConnect.scanEndTime")}
              name="endTime"
              span="half"
            >
              <Input type="datetime-local" />
            </InlineField>
          </div>
        </div>
      </Form>
    </Modal>
  );
}

type InlineFieldProps = {
  children: ReactNode;
  label: string;
  name: FormItemProps["name"];
  required?: boolean;
  rules?: Rule[];
  span?: "full" | "half";
  valuePropName?: string;
};

function InlineField({
  children,
  label,
  name,
  required = false,
  rules,
  span = "half",
  valuePropName,
}: InlineFieldProps) {
  return (
    <div
      className={[styles.field, span === "full" ? styles.spanFull : styles.spanHalf]
        .filter(Boolean)
        .join(" ")}
    >
      <label className={styles.fieldLabel}>
        {required ? <span className={styles.requiredMark}>*</span> : null}
        <span>{label}</span>
      </label>
      <div className={styles.fieldBody}>
        <Form.Item
          className={styles.fieldItem}
          name={name}
          rules={rules}
          valuePropName={valuePropName}
        >
          {children}
        </Form.Item>
      </div>
    </div>
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
