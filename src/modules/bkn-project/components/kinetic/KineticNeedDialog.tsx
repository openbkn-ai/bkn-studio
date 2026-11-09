/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  executionText,
  KINETIC,
  logicKindText,
  metricTypeText,
} from "@/modules/bkn-project/components/kinetic/kineticMessages";
import { LOGIC_KINDS, METRIC_TYPES } from "@/modules/bkn-project/components/kinetic/needs";
import { useUnsavedChanges } from "@/modules/bkn-project/components/unsaved/unsaved";
import type { RequirementItemFields } from "@/modules/bkn-project/services/requirements.service";
import type { RequirementLogicNeed } from "@/modules/bkn-project/types/requirements";

type Values = {
  definition?: string;
  executedBy?: string;
  kind: string;
  name?: string;
  objectTypeIds?: string[];
  suggestedMetricType?: string;
};

/** Adds a kinetic need a person writes, or edits one: its kind, name, definition and objects. */
export function KineticNeedDialog({
  executors,
  need,
  objectTypes,
  onCancel,
  onSave,
  saving,
}: {
  /** The api and mcp_tool needs that may carry out an action type. */
  executors: RequirementLogicNeed[];
  /** null to add one. */
  need: RequirementLogicNeed | null;
  /** The draft's object types to choose from. */
  objectTypes: { id: string; name: string }[];
  onCancel: () => void;
  /** Saves the need; true once it is saved. */
  onSave: (fields: RequirementItemFields) => Promise<boolean>;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<Values>();
  const [typed, setTyped] = useState(false);
  const kind = Form.useWatch("kind", form) ?? need?.kind ?? "metric";

  const fieldsOf = (values: Values): RequirementItemFields => ({
    definition: values.definition?.trim() ?? "",
    logicKind: values.kind,
    name: values.name?.trim() ?? "",
    objectTypeIds: values.objectTypeIds ?? [],
    // Sent when it differs from the need's: a cleared one goes as empty, else the old one stays.
    ...(values.kind === "metric" &&
    (values.suggestedMetricType ?? "") !== (need?.suggestedMetricType ?? "")
      ? { suggestedMetricType: values.suggestedMetricType ?? "" }
      : {}),
    // Likewise what carries out an action type.
    ...(values.kind === "action_type" && (values.executedBy ?? "") !== (need?.executedBy ?? "")
      ? { executedBy: values.executedBy ?? "" }
      : {}),
  });
  useUnsavedChanges(typed, async () => {
    const values = await form.validateFields().catch(() => null);
    return values !== null && onSave(fieldsOf(values));
  });

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => form.submit()}
      open
      title={t(`${KINETIC}.editing.${need ? "editTitle" : "addTitle"}`)}
      width={640}
    >
      <Form<Values>
        form={form}
        initialValues={
          need
            ? {
                definition: need.definition,
                kind: need.kind,
                name: need.name,
                objectTypeIds: need.objectTypeIds,
                suggestedMetricType: need.suggestedMetricType || undefined,
                executedBy: need.executedBy || undefined,
              }
            : { kind: "metric", objectTypeIds: [] }
        }
        layout="vertical"
        onFinish={(values) => void onSave(fieldsOf(values))}
        onValuesChange={() => setTyped(true)}
      >
        <Form.Item
          label={t(`${KINETIC}.fields.name`)}
          name="name"
          rules={[{ message: t(`${KINETIC}.editing.required`), required: true, whitespace: true }]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item label={t(`${KINETIC}.fields.kind`)} name="kind">
          <Select
            options={LOGIC_KINDS.map((value) => ({ label: logicKindText(t, value), value }))}
          />
        </Form.Item>
        <Form.Item label={t(`${KINETIC}.fields.definition`)} name="definition">
          <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} maxLength={2000} />
        </Form.Item>
        <Form.Item
          extra={t(`${KINETIC}.fields.${objectTypes.length ? "objectsHint" : "nothingDrafted"}`)}
          label={t(`${KINETIC}.fields.objects`)}
          name="objectTypeIds"
        >
          <Select
            disabled={!objectTypes.length}
            mode="multiple"
            optionFilterProp="label"
            options={objectTypes.map((item) => ({ label: item.name, value: item.id }))}
          />
        </Form.Item>
        {kind === "metric" ? (
          <Form.Item label={t(`${KINETIC}.fields.metricType`)} name="suggestedMetricType">
            <Select
              allowClear
              options={METRIC_TYPES.map((value) => ({ label: metricTypeText(t, value), value }))}
            />
          </Form.Item>
        ) : null}
        {kind === "action_type" ? (
          <Form.Item
            extra={t(`${KINETIC}.fields.${executors.length ? "executedByHint" : "noExecutors"}`)}
            label={t(`${KINETIC}.fields.executedBy`)}
            name="executedBy"
          >
            <Select
              allowClear
              disabled={!executors.length}
              optionFilterProp="label"
              options={executors.map((executor) => ({
                label: executionText(t, executor),
                value: executor.id,
              }))}
              showSearch
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
