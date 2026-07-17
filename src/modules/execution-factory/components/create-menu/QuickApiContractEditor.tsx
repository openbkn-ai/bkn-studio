/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Collapse, Form, Input, Select, Space } from "antd";
import { useTranslation } from "react-i18next";

import { CapabilityBusinessIntro } from "@/modules/execution-factory/components/CapabilityBusinessIntro";

const PARAMETER_LOCATIONS = ["query", "path", "header", "cookie"];
const PARAMETER_TYPES = ["string", "integer", "number", "boolean"];
const CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
];

export function QuickApiContractEditor() {
  const { t } = useTranslation();
  const requestBodyEnabled = Form.useWatch("requestBodyEnabled") as boolean | undefined;

  return (
    <>
      <CapabilityBusinessIntro
        messageKey="executionFactory.quickApiContractParameters"
        variant="section"
      />
      <Form.List name="parameters">
        {(fields, { add, remove }) => (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {fields.map((field) => (
              <Card
                extra={
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                    size="small"
                    type="text"
                  />
                }
                key={field.key}
                size="small"
              >
                <Space align="start" size={8} wrap>
                  <Form.Item
                    label={t("executionFactory.parameterName")}
                    name={[field.name, "name"]}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <Input style={{ width: 160 }} />
                  </Form.Item>
                  <Form.Item
                    label={t("executionFactory.globalParameterIn")}
                    name={[field.name, "in"]}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <Select
                      options={PARAMETER_LOCATIONS.map((value) => ({ label: value, value }))}
                      style={{ width: 120 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t("executionFactory.parameterType")}
                    name={[field.name, "type"]}
                  >
                    <Select
                      options={PARAMETER_TYPES.map((value) => ({ label: value, value }))}
                      style={{ width: 120 }}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t("executionFactory.globalParameterRequired")}
                    name={[field.name, "required"]}
                    valuePropName="checked"
                  >
                    <Checkbox />
                  </Form.Item>
                  <Form.Item
                    label={t("executionFactory.quickApiParameterExample")}
                    name={[field.name, "example"]}
                  >
                    <Input style={{ width: 160 }} />
                  </Form.Item>
                </Space>
                <Form.Item
                  label={t("executionFactory.parameterDescription")}
                  name={[field.name, "description"]}
                >
                  <Input />
                </Form.Item>
              </Card>
            ))}
            <Button
              block
              icon={<PlusOutlined />}
              onClick={() =>
                add({
                  in: "query",
                  required: false,
                  type: "string",
                })
              }
              type="dashed"
            >
              {t("executionFactory.quickApiAddParameter")}
            </Button>
          </Space>
        )}
      </Form.List>

      <CapabilityBusinessIntro
        messageKey="executionFactory.quickApiContractRequestBody"
        variant="section"
      />
      <Form.Item name="requestBodyEnabled" valuePropName="checked">
        <Checkbox>{t("executionFactory.quickApiEnableRequestBody")}</Checkbox>
      </Form.Item>
      {requestBodyEnabled ? (
        <Card size="small">
          <Space align="start" size={12} wrap>
            <Form.Item
              label={t("executionFactory.quickApiContentType")}
              name="requestBodyContentType"
              rules={[{ required: true, message: t("common.required") }]}
            >
              <Select
                options={CONTENT_TYPES.map((value) => ({ label: value, value }))}
                style={{ width: 260 }}
              />
            </Form.Item>
            <Form.Item
              label={t("executionFactory.globalParameterRequired")}
              name="requestBodyRequired"
              valuePropName="checked"
            >
              <Checkbox />
            </Form.Item>
          </Space>
          <Form.Item
            label={t("executionFactory.quickApiExampleJson")}
            name="requestBodyExampleText"
          >
            <Input.TextArea placeholder="{}" rows={4} />
          </Form.Item>
          <Collapse
            items={[
              {
                key: "request-schema",
                label: t("executionFactory.quickApiAdvancedSchema"),
                children: (
                  <Form.Item
                    label={t("executionFactory.quickApiSchemaJson")}
                    name="requestBodySchemaText"
                  >
                    <Input.TextArea
                      placeholder='{"type":"object","properties":{}}'
                      rows={5}
                    />
                  </Form.Item>
                ),
              },
            ]}
            size="small"
          />
        </Card>
      ) : null}

      <CapabilityBusinessIntro
        messageKey="executionFactory.quickApiContractResponses"
        variant="section"
      />
      <Form.List name="responses">
        {(fields, { add, remove }) => (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {fields.map((field) => (
              <Card
                extra={
                  <Button
                    danger
                    disabled={fields.length === 1}
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                    size="small"
                    type="text"
                  />
                }
                key={field.key}
                size="small"
              >
                <Space align="start" size={12} wrap>
                  <Form.Item
                    label={t("executionFactory.quickApiResponseStatus")}
                    name={[field.name, "statusCode"]}
                    rules={[
                      { required: true, message: t("common.required") },
                      { pattern: /^[1-5][0-9]{2}$|^default$/, message: "HTTP status or default" },
                    ]}
                  >
                    <Input style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item
                    label={t("common.description")}
                    name={[field.name, "description"]}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <Input style={{ width: 220 }} />
                  </Form.Item>
                  <Form.Item
                    label={t("executionFactory.quickApiContentType")}
                    name={[field.name, "contentType"]}
                  >
                    <Select
                      allowClear
                      options={CONTENT_TYPES.map((value) => ({ label: value, value }))}
                      style={{ width: 260 }}
                    />
                  </Form.Item>
                </Space>
                <Form.Item
                  label={t("executionFactory.quickApiExampleJson")}
                  name={[field.name, "exampleText"]}
                >
                  <Input.TextArea placeholder="{}" rows={3} />
                </Form.Item>
                <Collapse
                  items={[
                    {
                      key: "response-schema",
                      label: t("executionFactory.quickApiAdvancedSchema"),
                      children: (
                        <Form.Item
                          label={t("executionFactory.quickApiSchemaJson")}
                          name={[field.name, "schemaText"]}
                        >
                          <Input.TextArea placeholder='{"type":"object"}' rows={4} />
                        </Form.Item>
                      ),
                    },
                  ]}
                  size="small"
                />
              </Card>
            ))}
            <Button
              block
              icon={<PlusOutlined />}
              onClick={() =>
                add({
                  contentType: "application/json",
                  description: "Response",
                  schemaText: '{\n  "type": "object"\n}',
                })
              }
              type="dashed"
            >
              {t("executionFactory.quickApiAddResponse")}
            </Button>
          </Space>
        )}
      </Form.List>
    </>
  );
}
