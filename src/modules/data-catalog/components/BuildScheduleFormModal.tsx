/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, DatePicker, Form, Input, Modal, Select, Switch } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  BuildSchedule,
  BuildScheduleInput,
} from "@/modules/data-catalog/types/build-schedule";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import { isHourlyCron } from "@/shared/schedule";

type FormValues = {
  resourceId: string;
  name: string;
  cronExpr: string;
  executeType: "full" | "incremental";
  enabled: boolean;
  startTime?: Dayjs;
  endTime?: Dayjs;
};

type BuildScheduleFormModalProps = {
  open: boolean;
  initialValue?: BuildSchedule;
  resource: CatalogResource;
  submitting: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (input: BuildScheduleInput) => Promise<void>;
};

export function BuildScheduleFormModal({
  open,
  initialValue,
  resource,
  submitting,
  error,
  onCancel,
  onSubmit,
}: BuildScheduleFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      resourceId: initialValue?.resourceId ?? resource.id,
      name: initialValue?.name ?? "",
      cronExpr: initialValue?.cronExpr ?? "0 2 * * *",
      executeType: initialValue?.executeType ?? "full",
      enabled: initialValue?.enabled ?? false,
      startTime: initialValue?.startTime ? dayjs(initialValue.startTime) : undefined,
      endTime: initialValue?.endTime ? dayjs(initialValue.endTime) : undefined,
    });
  }, [form, initialValue, open, resource.id]);

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnHidden
      onCancel={submitting ? undefined : onCancel}
      onOk={() => form.submit()}
      okText={t(initialValue ? "common.save" : "common.create")}
      open={open}
      title={t(
        initialValue ? "dataCatalog.buildSchedule.edit" : "dataCatalog.buildSchedule.create",
      )}
      width={560}
    >
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void onSubmit({
            resourceId: values.resourceId,
            name: values.name.trim(),
            cronExpr: values.cronExpr.trim(),
            executeType: values.executeType,
            enabled: values.enabled,
            startTime: values.startTime?.valueOf() ?? 0,
            endTime: values.endTime?.valueOf() ?? 0,
          });
        }}
      >
        <Form.Item
          label={t("dataCatalog.taskManagement.columns.resource")}
          name="resourceId"
          rules={[{ required: true }]}
        >
          <Input disabled />
        </Form.Item>
        <p>{resource.name}</p>
        <Form.Item
          label={t("dataCatalog.buildSchedule.name")}
          name="name"
          rules={[{ required: true, whitespace: true }, { max: 255 }]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item
          label={t("dataCatalog.buildSchedule.executeType")}
          name="executeType"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: t("dataCatalog.build.executeFull"), value: "full" },
              { label: t("dataCatalog.build.executeIncremental"), value: "incremental" },
            ]}
          />
        </Form.Item>
        <Form.Item
          extra={t("dataCatalog.buildSchedule.cronHint")}
          label={t("dataCatalog.buildSchedule.cron")}
          name="cronExpr"
          rules={[
            { required: true },
            {
              validator: (_, value: unknown) =>
                typeof value === "string" && isHourlyCron(value.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("dataCatalog.buildSchedule.invalidCron"))),
            },
          ]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item label={t("dataCatalog.buildSchedule.startTime")} name="startTime">
          <DatePicker showTime />
        </Form.Item>
        <Form.Item
          dependencies={["startTime"]}
          label={t("dataCatalog.buildSchedule.endTime")}
          name="endTime"
          rules={[
            {
              validator: (_, end: Dayjs | undefined) => {
                const start = form.getFieldValue("startTime") as Dayjs | undefined;
                return !end || !start || end.valueOf() >= start.valueOf()
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("dataCatalog.buildSchedule.invalidTimeRange")));
              },
            },
          ]}
        >
          <DatePicker showTime />
        </Form.Item>
        <Form.Item
          extra={t(
            initialValue
              ? "dataCatalog.buildSchedule.enableSeparately"
              : "dataCatalog.buildSchedule.createDisabledHint",
          )}
          label={t("dataCatalog.buildSchedule.enabled")}
          name="enabled"
          valuePropName="checked"
        >
          <Switch disabled={Boolean(initialValue)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
