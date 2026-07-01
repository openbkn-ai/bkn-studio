/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input } from "antd";
import { useTranslation } from "react-i18next";

import { CapabilityCategoryFields } from "@/modules/execution-factory/components/CapabilityCategoryFields";

export function ToolboxMetadataFormFields() {
  const { t } = useTranslation();

  return (
    <>
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
      <Form.Item label={t("executionFactory.serviceUrl")} name="serviceUrl">
        <Input placeholder="https://example.com/toolbox" />
      </Form.Item>
      <CapabilityCategoryFields />
    </>
  );
}
