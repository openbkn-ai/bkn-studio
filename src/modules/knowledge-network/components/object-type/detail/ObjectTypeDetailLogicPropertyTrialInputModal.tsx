/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber, Modal, Select } from "antd";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  buildLogicPropertyTrialDynamicParams,
  type LogicPropertyTrialInputParameter,
} from "@/modules/knowledge-network/lib/logic-property-trial-inputs";
import { parseDynamicParamValue } from "@/modules/knowledge-network/utils/action-type-dynamic-params";

import styles from "./ObjectTypeDetailLogicPropertyTrialInputModal.module.css";

type ObjectTypeDetailLogicPropertyTrialInputModalProps = {
  onCancel: () => void;
  onSubmit: (dynamicParams: Record<string, Record<string, unknown>>) => Promise<boolean>;
  open: boolean;
  parameters: LogicPropertyTrialInputParameter[];
  submitting?: boolean;
};

export function ObjectTypeDetailLogicPropertyTrialInputModal({
  onCancel,
  onSubmit,
  open,
  parameters,
  submitting = false,
}: ObjectTypeDetailLogicPropertyTrialInputModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<Record<string, unknown>>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const groupedParameters = useMemo(() => {
    const groups = new Map<string, LogicPropertyTrialInputParameter[]>();
    for (const parameter of parameters) {
      const group = groups.get(parameter.logicPropertyName) ?? [];
      group.push(parameter);
      groups.set(parameter.logicPropertyName, group);
    }
    return [...groups.values()];
  }, [parameters]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(buildLogicPropertyTrialDynamicParams(parameters, values));
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={submitting}
      destroyOnHidden
      maskClosable={!submitting}
      okText={t("knowledgeNetwork.objectTypeDetailLogicTrialInputConfirm")}
      onCancel={submitting ? undefined : onCancel}
      onOk={() => {
        void submit().catch(() => undefined);
      }}
      open={open}
      rootClassName={styles.modalRoot}
      title={t("knowledgeNetwork.objectTypeDetailLogicTrialInputTitle")}
      width={560}
    >
      <p className={styles.description}>
        {t("knowledgeNetwork.objectTypeDetailLogicTrialInputDescription")}
      </p>

      <Form className={styles.form} form={form} layout="vertical">
        {groupedParameters.map((group) => (
          <section className={styles.propertyGroup} key={group[0].logicPropertyName}>
            <div className={styles.propertyTitle}>{group[0].logicPropertyDisplayName}</div>
            {group.map((input) => {
              const type = input.parameter.type?.toLowerCase() ?? "string";
              const isJson = type === "array" || type === "object";
              const name = input.parameter.name;
              const required = input.parameter.required === true;

              return (
                <Form.Item
                  className={isJson ? styles.stackedField : styles.inlineField}
                  extra={input.parameter.description}
                  key={input.fieldName}
                  label={
                    <span className={styles.fieldLabel}>
                      <span>{name}</span>
                      <span className={styles.typeLabel}>{type}</span>
                    </span>
                  }
                  name={input.fieldName}
                  rules={[
                    {
                      required,
                      message: t("knowledgeNetwork.objectTypeDetailLogicTrialInputRequired", {
                        name,
                      }),
                    },
                    ...(required && type === "string"
                      ? [
                          {
                            validator: (_rule: unknown, value: unknown) =>
                              typeof value === "string" && value.trim()
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      t(
                                        "knowledgeNetwork.objectTypeDetailLogicTrialInputRequired",
                                        {
                                          name,
                                        },
                                      ),
                                    ),
                                  ),
                          },
                        ]
                      : []),
                    ...(isJson
                      ? [
                          {
                            validator: (_rule: unknown, value: unknown) => {
                              if (typeof value !== "string") {
                                return Promise.resolve();
                              }
                              if (!value.trim()) {
                                return required
                                  ? Promise.reject(
                                      new Error(
                                        t(
                                          "knowledgeNetwork.objectTypeDetailLogicTrialInputRequired",
                                          { name },
                                        ),
                                      ),
                                    )
                                  : Promise.resolve();
                              }
                              try {
                                const parsed = parseDynamicParamValue(type, value);
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
                                        t(
                                          "knowledgeNetwork.objectTypeDetailLogicTrialInputJsonInvalid",
                                          {
                                            type,
                                          },
                                        ),
                                      ),
                                    );
                              } catch {
                                return Promise.reject(
                                  new Error(
                                    t(
                                      "knowledgeNetwork.objectTypeDetailLogicTrialInputJsonInvalid",
                                      {
                                        type,
                                      },
                                    ),
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
                      className={styles.fullWidth}
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
                    <Input className={styles.fullWidth} />
                  )}
                </Form.Item>
              );
            })}
          </section>
        ))}
      </Form>
    </Modal>
  );
}
