import { Input } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { FunctionAiGenerateModal } from "@/modules/execution-factory/components/FunctionAiGenerateModal";
import { FunctionExecuteModal } from "@/modules/execution-factory/components/FunctionExecuteModal";
import { getPythonCodeTemplate } from "@/modules/execution-factory/services/template.service";

type FunctionCodeFieldProps = {
  onChange?: (code: string) => void;
  value?: string;
};

export function FunctionCodeField({ onChange, value = "" }: FunctionCodeFieldProps) {
  const { t } = useTranslation();
  const [executeOpen, setExecuteOpen] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

  useEffect(() => {
    if (value.trim()) {
      return;
    }

    void (async () => {
      try {
        const template = await getPythonCodeTemplate();
        if (template.trim()) {
          onChange?.(template);
        }
      } catch {
        onChange?.("def handler(event):\n    return event\n");
      }
    })();
  }, [onChange, value]);

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <AppButton onClick={() => setAiGenerateOpen(true)}>
          {t("executionFactory.functionAiGenerate")}
        </AppButton>
        <AppButton onClick={() => setExecuteOpen(true)}>
          {t("executionFactory.runFunction")}
        </AppButton>
      </div>
      <Input.TextArea
        onChange={(event) => onChange?.(event.target.value)}
        rows={12}
        value={value}
      />
      <FunctionExecuteModal
        initialCode={value}
        onClose={() => setExecuteOpen(false)}
        open={executeOpen}
      />
      <FunctionAiGenerateModal
        initialCode={value}
        onApply={(content) => {
          if (typeof content === "string") {
            onChange?.(content);
          }
        }}
        onClose={() => setAiGenerateOpen(false)}
        open={aiGenerateOpen}
      />
    </>
  );
}
