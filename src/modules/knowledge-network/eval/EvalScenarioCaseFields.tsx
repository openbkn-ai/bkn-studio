/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input } from "antd";
import { useEvalTranslation } from "./useEvalTranslation";

/** Public business task; scoring criteria and gold are edited separately. */
export function EvalScenarioCaseFields() {
  const { t } = useEvalTranslation();
  const text = (key: string) => t(`knowledgeNetwork.eval.scenarioCase.${key}`);
  return (
    <>
      <Form.Item
        name="question"
        label={text("goal")}
        rules={[{ required: true, whitespace: true }]}
      >
        <Input.TextArea rows={3} maxLength={4000} placeholder={text("goalPlaceholder")} />
      </Form.Item>
      <Form.Item name="scenarioContext" label={text("context")}>
        <Input.TextArea rows={2} maxLength={3000} placeholder={text("contextPlaceholder")} />
      </Form.Item>
      <Form.Item name="scenarioConstraints" label={text("constraints")}>
        <Input.TextArea rows={2} maxLength={2000} placeholder={text("constraintsPlaceholder")} />
      </Form.Item>
      <Form.Item name="outputRequirements" label={text("output")}>
        <Input.TextArea rows={2} maxLength={2000} placeholder={text("outputPlaceholder")} />
      </Form.Item>
    </>
  );
}
