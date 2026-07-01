/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Radio } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";
import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";
import { createToolbox } from "@/modules/execution-factory/services/toolbox.service";
import type { ToolboxMetadataType } from "@/modules/execution-factory/types/toolbox";

import styles from "./create-menu.module.css";

type FormValues = {
  name: string;
  description?: string;
  category: string;
  metadataType: ToolboxMetadataType;
  serviceUrl?: string;
};

type CreateToolboxFormProps = {
  formId?: string;
  lockMetadataType?: ToolboxMetadataType;
  onCreated: (boxId: string) => void;
};

export function CreateToolboxForm({
  formId,
  lockMetadataType,
  onCreated,
}: CreateToolboxFormProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const metadataType = Form.useWatch("metadataType", form);

  const metadataOptions = useMemo(
    () => [
      {
        key: "openapi" as const,
        icon: ApiOutlined,
        title: t("executionFactory.metadataTypes.openapi"),
        desc: t("executionFactory.createToolboxOpenApiDesc"),
      },
      {
        key: "function" as const,
        icon: ThunderboltOutlined,
        title: t("executionFactory.metadataTypes.function"),
        desc: t("executionFactory.createToolboxFunctionDesc"),
      },
    ],
    [t],
  );

  useEffect(() => {
    form.setFieldsValue({
      metadataType: lockMetadataType ?? "openapi",
      serviceUrl: "http://127.0.0.1:9000",
    });
  }, [form, lockMetadataType]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);

    try {
      const record = await createToolbox({
        name: values.name,
        description: values.description,
        category: values.category,
        metadataType: values.metadataType,
        serviceUrl: values.serviceUrl ?? "http://127.0.0.1:9000",
      });
      void message.success(t("executionFactory.createToolboxSuccess"));
      onCreated(record.boxId);
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      id={formId}
      layout="vertical"
      onFinish={(values) => void handleSubmit(values)}
    >
      <fieldset disabled={submitting} style={{ border: 0, margin: 0, padding: 0 }}>
        <CapabilityBusinessIntro messageKey="executionFactory.businessIntro.functionToolboxTop" />
        <Form.Item
          label={t("executionFactory.toolboxName")}
          name="name"
          rules={[{ required: true, message: t("common.required") }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label={t("common.description")} name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <CapabilityCategoryFields />
        {metadataType === "openapi" ? (
          <Form.Item
            label={t("executionFactory.serviceUrl")}
            name="serviceUrl"
            rules={[{ required: true, message: t("common.required") }]}
          >
            <Input placeholder="http://127.0.0.1:9000" />
          </Form.Item>
        ) : null}
        {lockMetadataType ? (
          <Form.Item hidden name="metadataType">
            <Input />
          </Form.Item>
        ) : (
          <Form.Item label={t("executionFactory.createToolboxTypeLabel")} required>
            <p className={styles.modalHint}>{t("executionFactory.createToolboxTypeHint")}</p>
            {metadataType === "function" ? (
              <Alert
                message={t("executionFactory.createToolboxFunctionNextStep")}
                showIcon
                style={{ marginBottom: 12 }}
                type="info"
              />
            ) : null}
            <Form.Item name="metadataType" noStyle rules={[{ required: true }]}>
              <Radio.Group style={{ width: "100%" }}>
                <div className={styles.optionGrid}>
                  {metadataOptions.map(({ key, title, desc, icon: Icon }) => (
                    <label
                      className={`${styles.optionCard} ${
                        metadataType === key ? styles.optionCardActive : ""
                      }`}
                      key={key}
                    >
                      <Radio value={key} />
                      <Icon style={{ fontSize: 22, color: "#1677ff" }} />
                      <div className={styles.optionTitle}>{title}</div>
                      <div className={styles.optionDesc}>{desc}</div>
                    </label>
                  ))}
                </div>
              </Radio.Group>
            </Form.Item>
          </Form.Item>
        )}
        {lockMetadataType === "function" ? (
          <Alert
            message={t("executionFactory.createToolboxFunctionNextStep")}
            showIcon
            type="info"
          />
        ) : null}
      </fieldset>
    </Form>
  );
}
