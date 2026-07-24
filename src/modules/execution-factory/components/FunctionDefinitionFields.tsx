/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form } from "antd";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { FunctionCodeField } from "@/modules/execution-factory/components/FunctionCodeField";
import { FunctionParameterEditor } from "@/modules/execution-factory/components/FunctionParameterEditor";
import type { FunctionAiApplyResult } from "@/modules/execution-factory/utils/function-ai-content";

type FunctionDefinitionFieldsProps = {
  codeFieldName?: string | (string | number)[];
  descriptionNamePath?: (string | number)[];
  inputsNamePath?: (string | number)[];
  nameNamePath?: (string | number)[];
  outputsNamePath?: (string | number)[];
  useRuleNamePath?: (string | number)[];
};

export function FunctionDefinitionFields({
  codeFieldName = "functionCode",
  descriptionNamePath = ["description"],
  inputsNamePath = ["functionInputs"],
  nameNamePath = ["name"],
  outputsNamePath = ["functionOutputs"],
  useRuleNamePath = ["useRule"],
}: FunctionDefinitionFieldsProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const form = Form.useFormInstance();

  const applyMetadata = (result: Extract<FunctionAiApplyResult, { type: "metadata" }>) => {
    const applied: Array<[(string | number)[], unknown]> = [];

    if (result.name) {
      applied.push([nameNamePath, result.name]);
    }
    if (result.description) {
      applied.push([descriptionNamePath, result.description]);
    }
    if (result.useRule) {
      applied.push([useRuleNamePath, result.useRule]);
    }
    if (result.inputs) {
      applied.push([inputsNamePath, result.inputs]);
    }
    if (result.outputs) {
      applied.push([outputsNamePath, result.outputs]);
    }

    applied.forEach(([path, value]) => form.setFieldValue(path, value));
    void message.success(t("executionFactory.functionAiParamsApplied"));
  };

  return (
    <>
      <div id="function-inputs">
        <FunctionParameterEditor inputsNamePath={inputsNamePath} section="inputs" />
      </div>
      <div id="function-logic">
        <Form.Item
          extra={t("executionFactory.functionLogicHint")}
          label={t("executionFactory.functionLogic")}
          name={codeFieldName}
          rules={[{ required: true, message: t("common.required") }]}
        >
          <FunctionCodeField onMetadataApply={applyMetadata} />
        </Form.Item>
      </div>
      <div id="function-outputs">
        <FunctionParameterEditor outputsNamePath={outputsNamePath} section="outputs" />
      </div>
    </>
  );
}
