/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Select } from "antd";
import { useTranslation } from "react-i18next";

type FunctionParameterEditorProps = {
  inputsNamePath?: (string | number)[];
  outputsNamePath?: (string | number)[];
  section?: "both" | "inputs" | "outputs";
};

const typeOptions = ["string", "integer", "number", "boolean", "object", "array"];

function ParameterList({ namePath, title }: { namePath: (string | number)[]; title: string }) {
  const { t } = useTranslation();

  return (
    <Form.List name={namePath}>
      {(fields, { add, remove }) => (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <strong>{title}</strong>
            <a onClick={() => add({ type: "string" })}>{t("executionFactory.addParameter")}</a>
          </div>
          {fields.length === 0 ? (
            <p style={{ color: "rgba(0,0,0,0.45)", margin: 0 }}>
              {t("executionFactory.noParameters")}
            </p>
          ) : null}
          {fields.map((field) => (
            <div
              key={field.key}
              style={{
                border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8,
                marginBottom: 8,
                padding: 12,
              }}
            >
              <Form.Item
                label={t("executionFactory.parameterName")}
                name={[field.name, "name"]}
                rules={[{ required: true, message: t("common.required") }]}
                style={{ marginBottom: 8 }}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label={t("executionFactory.parameterType")}
                name={[field.name, "type"]}
                style={{ marginBottom: 8 }}
              >
                <Select options={typeOptions.map((value) => ({ label: value, value }))} />
              </Form.Item>
              <Form.Item
                label={t("executionFactory.parameterDescription")}
                name={[field.name, "description"]}
                style={{ marginBottom: 8 }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <a onClick={() => remove(field.name)}>{t("common.delete")}</a>
            </div>
          ))}
        </div>
      )}
    </Form.List>
  );
}

export function FunctionParameterEditor({
  inputsNamePath = ["functionInputs"],
  outputsNamePath = ["functionOutputs"],
  section = "both",
}: FunctionParameterEditorProps) {
  const { t } = useTranslation();

  return (
    <>
      {section === "both" || section === "inputs" ? (
        <ParameterList namePath={inputsNamePath} title={t("executionFactory.functionInputs")} />
      ) : null}
      {section === "both" || section === "outputs" ? (
        <ParameterList namePath={outputsNamePath} title={t("executionFactory.functionOutputs")} />
      ) : null}
    </>
  );
}
