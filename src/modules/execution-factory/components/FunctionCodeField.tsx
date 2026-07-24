/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { CodeEditor } from "@/modules/execution-factory/components/CodeEditor";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { FunctionExecuteModal } from "@/modules/execution-factory/components/FunctionExecuteModal";
import { getPythonCodeTemplate } from "@/modules/execution-factory/services/template.service";
import type { FunctionAiApplyResult } from "@/modules/execution-factory/utils/function-ai-content";

const FALLBACK_TEMPLATE = "def handler(event):\n    return event\n";

type FunctionCodeFieldProps = {
  onChange?: (code: string) => void;
  /** 反推出来的名称/描述/参数落在兄弟字段上，本组件只管代码，交给上层写回表单。 */
  onMetadataApply?: (result: Extract<FunctionAiApplyResult, { type: "metadata" }>) => void;
  value?: string;
};

export function FunctionCodeField({
  onChange,
  onMetadataApply,
  value = "",
}: FunctionCodeFieldProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [executeOpen, setExecuteOpen] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  useEffect(() => {
    if (value.trim()) {
      return;
    }

    void (async () => {
      try {
        const template = await getPythonCodeTemplate();
        onChange?.(template.trim() ? template : FALLBACK_TEMPLATE);
      } catch {
        onChange?.(FALLBACK_TEMPLATE);
      }
    })();
  }, [onChange, value]);

  const handleInsertTemplate = async () => {
    try {
      const template = await getPythonCodeTemplate();
      onChange?.(template.trim() ? template : FALLBACK_TEMPLATE);
    } catch {
      onChange?.(FALLBACK_TEMPLATE);
    }

    void message.success(t("executionFactory.functionTemplateInserted"));
  };

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <AppButton onClick={() => void handleInsertTemplate()}>
          {t("executionFactory.functionInsertTemplate")}
        </AppButton>
        <AppButton onClick={() => setAiGenerateOpen(true)}>
          {t("executionFactory.functionAiGenerate")}
        </AppButton>
        <AppButton onClick={() => setExecuteOpen(true)}>
          {t("executionFactory.runFunction")}
        </AppButton>
      </div>
      <CodeEditor height={320} language="python" onChange={onChange} value={value} />
      <FunctionExecuteModal
        initialCode={value}
        onClose={() => setExecuteOpen(false)}
        open={executeOpen}
      />
      <FunctionAiGenerateModal
        initialCode={value}
        onApply={(result) => {
          if (result.type === "code") {
            onChange?.(result.code);
            return;
          }

          onMetadataApply?.(result);
        }}
        onClose={() => setAiGenerateOpen(false)}
        open={aiGenerateOpen}
      />
    </>
  );
}
