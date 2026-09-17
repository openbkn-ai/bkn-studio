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
import { useFunctionCodeAccess } from "@/modules/execution-factory/utils/use-function-code-access";

const FALLBACK_TEMPLATE = "def handler(event):\n    return event\n";

type FunctionCodeFieldProps = {
  onChange?: (code: string) => void;
  /** Inferred names, descriptions, and parameters belong to sibling fields; this component owns only code and lets the parent update the form. */
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
  // Hosts such as the legacy operator form gate the page by their own resource, but generation
  // and ad-hoc runs are authorized on Function; hide what the backend would reject with 403.
  const { canExecuteAdhoc, canGenerate } = useFunctionCodeAccess();
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
        {canGenerate ? (
          <AppButton onClick={() => setAiGenerateOpen(true)}>
            {t("executionFactory.functionAiGenerate")}
          </AppButton>
        ) : null}
        {canExecuteAdhoc ? (
          <AppButton onClick={() => setExecuteOpen(true)}>
            {t("executionFactory.runFunction")}
          </AppButton>
        ) : null}
      </div>
      <CodeEditor height={320} language="python" onChange={onChange} value={value} />
      <FunctionExecuteModal
        canGenerate={canGenerate}
        initialCode={value}
        onClose={() => setExecuteOpen(false)}
        open={canExecuteAdhoc && executeOpen}
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
        open={canGenerate && aiGenerateOpen}
      />
    </>
  );
}
