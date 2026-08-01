/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal, Select } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  DataConnectHealthCheckSchedule,
  DataConnectHealthCheckScheduleMode,
} from "@/modules/data-connect/types/data-connect";
import { isHourlyHealthCheckCron } from "@/modules/data-connect/utils/health-check-cron";
import type { CatalogHealthCheckScheduleInput } from "@/shared/catalog";

type HealthCheckScheduleFormValues = {
  cronExpr?: string;
  mode: DataConnectHealthCheckScheduleMode;
};

type HealthCheckScheduleFormModalProps = {
  loading: boolean;
  onCancel: () => void;
  onSubmit: (input: CatalogHealthCheckScheduleInput) => Promise<void>;
  open: boolean;
  schedule: DataConnectHealthCheckSchedule;
};

export function HealthCheckScheduleFormModal({
  loading,
  onCancel,
  onSubmit,
  open,
  schedule,
}: HealthCheckScheduleFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<HealthCheckScheduleFormValues>();
  const mode = Form.useWatch("mode", form);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      cronExpr: schedule.cronExpr || "0 * * * *",
      mode: schedule.mode,
    });
  }, [form, open, schedule]);

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={loading}
      destroyOnHidden
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => {
        void form
          .validateFields()
          .then((values) =>
            onSubmit({
              cronExpr:
                values.mode === "enabled"
                  ? values.cronExpr?.trim()
                  : undefined,
              mode: values.mode,
            }),
          )
          .catch(() => undefined);
      }}
      open={open}
      title={t("dataConnect.healthCheckSchedule.editTitle")}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          extra={t("dataConnect.healthCheckSchedule.modeHint")}
          label={t("dataConnect.healthCheckSchedule.mode")}
          name="mode"
          rules={[{ message: t("common.required"), required: true }]}
        >
          <Select
            options={(["inherit", "enabled", "disabled"] as const).map(
              (value) => ({
                label: t(`dataConnect.healthCheckSchedule.modes.${value}`),
                value,
              }),
            )}
          />
        </Form.Item>
        {mode === "enabled" ? (
          <Form.Item
            extra={t("dataConnect.healthCheckSchedule.cronHint")}
            label={t("dataConnect.healthCheckSchedule.cronExpr")}
            name="cronExpr"
            rules={[
              { message: t("common.required"), required: true },
              {
                validator: (_, value: unknown) => {
                  if (isHourlyHealthCheckCron(value)) {
                    return Promise.resolve();
                  }

                  return Promise.reject(
                    new Error(t("dataConnect.healthCheckSchedule.cronInvalid")),
                  );
                },
              },
            ]}
          >
            <Input
              placeholder={t(
                "dataConnect.healthCheckSchedule.cronPlaceholder",
              )}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
