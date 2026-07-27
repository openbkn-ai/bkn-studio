/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, InputNumber, Modal, Select, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveActionTypeToolInputSchema } from "@/modules/knowledge-network/services/action-type-tool.service";
import type {
  ActionTypeActionSource,
  ActionTypeExecutionParameter,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  buildActionTypeDynamicParams,
  indexActionTypeToolInputSchema,
  parseActionTypeDynamicParamValue,
} from "@/modules/knowledge-network/utils/action-type-dynamic-params";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";

import styles from "./ActionTypeExecuteModal.module.css";

type ActionTypeExecuteModalProps = {
  actionSource?: ActionTypeActionSource;
  actionTypeName: string;
  onCancel: () => void;
  onSubmit: (dynamicParams: Record<string, unknown>) => Promise<boolean>;
  open: boolean;
  parameters: ActionTypeExecutionParameter[];
  submitting?: boolean;
};

function resolveParameterType(
  parameter: ActionTypeExecutionParameter,
  schemaByName: Map<string, ActionTypeToolInputParam>,
) {
  return schemaByName.get(parameter.name)?.type ?? parameter.type ?? "string";
}

export function ActionTypeExecuteModal({
  actionSource,
  actionTypeName,
  onCancel,
  onSubmit,
  open,
  parameters,
  submitting = false,
}: ActionTypeExecuteModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<Record<string, unknown>>();
  const [schema, setSchema] = useState<ActionTypeToolInputParam[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setSchema([]);
      setSchemaLoading(false);
      return;
    }

    if (!actionSource || actionSource.type === "manual") {
      setSchema([]);
      setSchemaLoading(false);
      return;
    }

    let cancelled = false;
    setSchemaLoading(true);

    void resolveActionTypeToolInputSchema(actionSource)
      .then((nextSchema) => {
        if (!cancelled) {
          setSchema(nextSchema);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSchema([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSchemaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actionSource, form, open]);

  const schemaByName = useMemo(() => indexActionTypeToolInputSchema(schema), [schema]);
  const resolvedParameters = useMemo(
    () =>
      parameters.map((parameter) => ({
        ...parameter,
        description: schemaByName.get(parameter.name)?.description ?? parameter.description,
        type: resolveParameterType(parameter, schemaByName),
      })),
    [parameters, schemaByName],
  );

  const submit = async () => {
    const values = await form.validateFields();
    const dynamicParams = buildActionTypeDynamicParams(resolvedParameters, values);
    await onSubmit(dynamicParams);
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      destroyOnHidden
      maskClosable={!submitting}
      okText={t("knowledgeNetwork.actionTypeExecuteImmediately")}
      onCancel={submitting ? undefined : onCancel}
      onOk={() => {
        void submit().catch(() => undefined);
      }}
      okButtonProps={{ disabled: schemaLoading }}
      open={open}
      rootClassName={styles.modalRoot}
      title={t("knowledgeNetwork.actionTypeExecuteParamsTitle")}
      width={560}
    >
      <p className={styles.summary}>
        {t("knowledgeNetwork.actionTypeExecuteParamsDescription", { name: actionTypeName })}
      </p>

      {schemaLoading ? (
        <div className={styles.loading}>
          <Spin size="small" />
          <span>{t("knowledgeNetwork.actionTypeExecuteParamsLoading")}</span>
        </div>
      ) : null}

      {!schemaLoading && schema.length === 0 ? (
        <Alert
          className={styles.schemaAlert}
          message={t("knowledgeNetwork.actionTypeExecuteParamsSchemaFallback")}
          showIcon
          type="info"
        />
      ) : null}

      <Form className={styles.form} form={form} layout="vertical">
        {resolvedParameters.map((parameter) => {
          const type = parameter.type?.toLowerCase() ?? "string";
          const isJson = type === "array" || type === "object";

          return (
            <Form.Item
              extra={parameter.description}
              key={parameter.name}
              label={
                <span className={styles.fieldLabel}>
                  <span>{parameter.name}</span>
                  <span className={styles.typeLabel}>{type}</span>
                </span>
              }
              name={parameter.name}
              rules={[
                {
                  required: true,
                  message: t("knowledgeNetwork.actionTypeExecuteParamRequired", {
                    name: parameter.name,
                  }),
                },
                ...(type === "string"
                  ? [
                      {
                        validator: (_rule: unknown, value: unknown) =>
                          typeof value === "string" && value.trim()
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error(
                                  t("knowledgeNetwork.actionTypeExecuteParamRequired", {
                                    name: parameter.name,
                                  }),
                                ),
                              ),
                      },
                    ]
                  : []),
                ...(isJson
                  ? [
                      {
                        validator: (_rule: unknown, value: unknown) => {
                          if (typeof value !== "string" || !value.trim()) {
                            return Promise.resolve();
                          }
                          try {
                            const parsed = parseActionTypeDynamicParamValue(type, value);
                            const valid =
                              type === "array"
                                ? Array.isArray(parsed)
                                : Boolean(
                                    parsed &&
                                      typeof parsed === "object" &&
                                      !Array.isArray(parsed),
                                  );
                            return valid
                              ? Promise.resolve()
                              : Promise.reject(
                                  new Error(
                                    t("knowledgeNetwork.actionTypeExecuteParamJsonInvalid", {
                                      type,
                                    }),
                                  ),
                                );
                          } catch {
                            return Promise.reject(
                              new Error(
                                t("knowledgeNetwork.actionTypeExecuteParamJsonInvalid", {
                                  type,
                                }),
                              ),
                            );
                          }
                        },
                      },
                    ]
                  : []),
              ]}
            >
              {type === "integer" || type === "number" ? (
                <InputNumber
                  className={styles.fullWidth}
                  precision={type === "integer" ? 0 : undefined}
                />
              ) : type === "boolean" ? (
                <Select
                  options={[
                    { label: "true", value: true },
                    { label: "false", value: false },
                  ]}
                />
              ) : isJson ? (
                <Input.TextArea
                  autoSize={{ maxRows: 8, minRows: 3 }}
                  placeholder={type === "array" ? "[...]" : "{...}"}
                />
              ) : (
                <Input />
              )}
            </Form.Item>
          );
        })}
      </Form>
    </Modal>
  );
}
