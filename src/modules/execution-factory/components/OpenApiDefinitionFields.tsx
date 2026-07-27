/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form } from "antd";
import { useTranslation } from "react-i18next";

import { OpenApiSpecInput } from "@/modules/execution-factory/components/OpenApiSpecInput";
import { normalizeGeneratedCapabilityName } from "@/modules/execution-factory/utils/metadata-content";

type OpenApiDefinitionFieldsProps = {
  specNamePath?: string | (string | number)[];
  nameNamePath?: (string | number)[];
  descriptionNamePath?: (string | number)[];
  registrationTarget?: "operator" | "toolbox" | "default";
  required?: boolean;
  rows?: number;
  showEndpointReview?: boolean;
};

/**
 * Composable OpenAPI editing fields, mirroring FunctionDefinitionFields: no own
 * Form instance, wires into the host form via Form.useFormInstance() + namePath,
 * so operator / tool-create / tool-edit hosts render one identical fragment.
 */
export function OpenApiDefinitionFields({
  specNamePath = "openapiSpec",
  nameNamePath = ["name"],
  descriptionNamePath = ["description"],
  registrationTarget = "default",
  required = true,
  rows = 10,
  showEndpointReview = false,
}: OpenApiDefinitionFieldsProps) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  const applyHints = (hints: { title?: string; description?: string }) => {
    if (!form.getFieldValue(nameNamePath) && hints.title) {
      form.setFieldValue(
        nameNamePath,
        normalizeGeneratedCapabilityName(hints.title) ?? hints.title,
      );
    }
    if (!form.getFieldValue(descriptionNamePath) && hints.description) {
      form.setFieldValue(descriptionNamePath, hints.description);
    }
  };

  return (
    <Form.Item
      extra={t("executionFactory.openapiImportHint")}
      label={t("executionFactory.openapiSpec")}
      name={specNamePath}
      rules={required ? [{ required: true, message: t("common.required") }] : undefined}
    >
      <OpenApiSpecInput
        onMetadataHints={applyHints}
        registrationTarget={registrationTarget}
        rows={rows}
        showEndpointReview={showEndpointReview}
      />
    </Form.Item>
  );
}
