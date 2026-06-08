import { Form } from "antd";
import { useTranslation } from "react-i18next";

import { FunctionCodeField } from "@/modules/execution-factory/components/FunctionCodeField";
import { FunctionParameterEditor } from "@/modules/execution-factory/components/FunctionParameterEditor";

type FunctionDefinitionFieldsProps = {
  codeFieldName?: string | (string | number)[];
  inputsNamePath?: (string | number)[];
  outputsNamePath?: (string | number)[];
};

export function FunctionDefinitionFields({
  codeFieldName = "functionCode",
  inputsNamePath = ["functionInputs"],
  outputsNamePath = ["functionOutputs"],
}: FunctionDefinitionFieldsProps) {
  const { t } = useTranslation();

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
          <FunctionCodeField />
        </Form.Item>
      </div>
      <div id="function-outputs">
        <FunctionParameterEditor outputsNamePath={outputsNamePath} section="outputs" />
      </div>
    </>
  );
}
