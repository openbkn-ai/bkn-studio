/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Form, Input, Modal, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getActionTypeExecutionSchema } from "@/modules/knowledge-network/services/action-type.service";
import {
  parseActionExecutionInput,
  type ActionExecutionInput,
  type ActionExecutionSchema,
} from "@/modules/knowledge-network/utils/action-execution-input";
import styles from "./ActionTypeExecuteModal.module.css";

type ActionTypeExecuteModalProps = {
  networkId: string;
  actionTypeId: string;
  actionTypeName: string;
  onCancel: () => void;
  onSubmit: (input: ActionExecutionInput) => Promise<boolean>;
  open: boolean;
  submitting?: boolean;
};

function ExecutionFields({
  schema,
  path = [],
}: {
  schema: ActionExecutionSchema;
  path?: (string | number)[];
}) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    dynamic_params: t("knowledgeNetwork.actionExecutionDynamicParams"),
    _instance_identities: t("knowledgeNetwork.actionExecutionObjects"),
    relation_target: t("knowledgeNetwork.actionExecutionRelation"),
    source_identity: t("knowledgeNetwork.actionExecutionSource"),
    target_identity: t("knowledgeNetwork.actionExecutionTarget"),
    object_input: t("knowledgeNetwork.actionExecutionObjectInput"),
  };
  return Object.entries(schema.properties ?? {}).map(([key, field]) => {
    const name = [...path, key];
    const title = field.title || key;
    const label = labels[key] ? `${labels[key]}${field.title ? ` · ${field.title}` : ""}` : title;
    if (field.type === "object" && field.properties) {
      return (
        <fieldset key={key}>
          <legend>{label}</legend>
          <ExecutionFields path={name} schema={field} />
        </fieldset>
      );
    }
    if (field.type === "array" && field.items?.properties) {
      return (
        <fieldset key={key}>
          <legend>{label}</legend>
          <Form.List
            name={name}
            initialValue={[{}]}
            rules={[
              {
                validator: (_rule: unknown, values: unknown) =>
                  Array.isArray(values) && values.length > 0
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(t("knowledgeNetwork.actionExecutionObjectRequired")),
                      ),
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((item) => (
                  <div key={item.key}>
                    <ExecutionFields path={[...name, item.name]} schema={field.items!} />
                    {fields.length > 1 ? (
                      <Button onClick={() => remove(item.name)}>{t("common.delete")}</Button>
                    ) : null}
                  </div>
                ))}
                <Button onClick={() => add({})}>
                  {t("knowledgeNetwork.actionExecutionAddObject")}
                </Button>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </fieldset>
      );
    }
    const json = field.type === "array" || field.type === "object";
    const rules = [
      {
        required: schema.required?.includes(key),
        message: t("knowledgeNetwork.actionTypeExecuteParamRequired", { name: title }),
      },
      {
        validator: (_rule: unknown, value: unknown) => {
          if (value === undefined || value === "") return Promise.resolve();
          try {
            parseActionExecutionInput(field, value);
            return Promise.resolve();
          } catch {
            return Promise.reject(
              new Error(
                t("knowledgeNetwork.actionTypeExecuteParamJsonInvalid", { type: field.type }),
              ),
            );
          }
        },
      },
    ];
    return (
      <Form.Item key={key} name={name} label={label} extra={field.description} rules={rules}>
        {field.enum ? (
          <Select options={field.enum.map((value) => ({ label: String(value), value }))} />
        ) : field.type === "boolean" ? (
          <Select
            options={[
              { label: "true", value: true },
              { label: "false", value: false },
            ]}
          />
        ) : json ? (
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
        ) : (
          <Input
            inputMode={field.type === "integer" || field.type === "number" ? "decimal" : undefined}
          />
        )}
      </Form.Item>
    );
  });
}

export function ActionTypeExecuteModal({
  networkId,
  actionTypeId,
  actionTypeName,
  onCancel,
  onSubmit,
  open,
  submitting = false,
}: ActionTypeExecuteModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [schema, setSchema] = useState<ActionExecutionSchema>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    form.resetFields();
    setSchema(undefined);
    setFailed(false);
    setLoading(true);
    void getActionTypeExecutionSchema(networkId, actionTypeId)
      .then((value) => {
        if (!cancelled) setSchema(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, actionTypeId, form, open]);
  const submit = async () => {
    if (!schema) return;
    const values: unknown = await form.validateFields();
    await onSubmit(parseActionExecutionInput(schema, values) ?? {});
  };
  return (
    <Modal
      title={t("knowledgeNetwork.actionTypeExecuteParamsTitle")}
      open={open}
      confirmLoading={submitting}
      destroyOnHidden
      maskClosable={!submitting}
      onCancel={submitting ? undefined : onCancel}
      onOk={() => {
        void submit().catch(() => undefined);
      }}
      okButtonProps={{ disabled: loading || failed || !schema }}
      okText={t("knowledgeNetwork.actionTypeExecuteImmediately")}
      cancelText={t("common.cancel")}
      rootClassName={styles.modalRoot}
      width={600}
    >
      <p className={styles.summary}>
        {t("knowledgeNetwork.actionTypeExecuteParamsDescription", { name: actionTypeName })}
      </p>
      {loading ? <Spin /> : null}
      {failed ? (
        <Alert
          type="error"
          showIcon
          message={t("knowledgeNetwork.actionExecutionSchemaUnavailable")}
        />
      ) : null}
      <Form form={form} layout="vertical" className={styles.form}>
        {schema ? <ExecutionFields schema={schema} /> : null}
      </Form>
    </Modal>
  );
}
