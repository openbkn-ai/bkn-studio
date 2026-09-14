/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { FormInstance } from "antd";
import { useEffect } from "react";

import type { CreateSemanticUnderstandingTaskPayload } from "@/modules/data-catalog/services/semantic-understanding-task.service";

export const semanticUnderstandingTaskFormDefaults = {
  applyMode: "fill_empty" as const,
  confidenceThreshold: 0.75,
  includeSampleRows: false,
  sampleMaxRows: 10,
};

export function useSemanticUnderstandingTaskFormDefaults(
  form: Pick<FormInstance<CreateSemanticUnderstandingTaskPayload>, "setFieldsValue">,
  open: boolean,
) {
  useEffect(() => {
    if (open) form.setFieldsValue(semanticUnderstandingTaskFormDefaults);
  }, [form, open]);
}
