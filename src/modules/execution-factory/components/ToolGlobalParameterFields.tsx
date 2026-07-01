/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Select, Switch } from "antd";
import { useTranslation } from "react-i18next";

type ToolGlobalParameterFieldsProps = {
  namePrefix?: (string | number)[];
};

const inOptions = ["query", "path", "header", "cookie", "body"] as const;
const typeOptions = ["string", "integer", "boolean", "array", "object"] as const;

export function ToolGlobalParameterFields({
  namePrefix = ["globalParameters"],
}: ToolGlobalParameterFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t("executionFactory.globalParameterName")}
        name={[...namePrefix, "name"]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        label={t("executionFactory.globalParameterDescription")}
        name={[...namePrefix, "description"]}
      >
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item label={t("executionFactory.globalParameterIn")} name={[...namePrefix, "in"]}>
        <Select
          allowClear
          options={inOptions.map((value) => ({ label: value, value }))}
        />
      </Form.Item>
      <Form.Item label={t("executionFactory.globalParameterType")} name={[...namePrefix, "type"]}>
        <Select
          allowClear
          options={typeOptions.map((value) => ({ label: value, value }))}
        />
      </Form.Item>
      <Form.Item
        label={t("executionFactory.globalParameterRequired")}
        name={[...namePrefix, "required"]}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
      <Form.Item label={t("executionFactory.globalParameterValue")} name={[...namePrefix, "value"]}>
        <Input.TextArea placeholder="{}" rows={3} />
      </Form.Item>
    </>
  );
}
