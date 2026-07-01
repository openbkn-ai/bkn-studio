/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Input, Radio, Upload } from "antd";

import { useState } from "react";

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { CategorySelect } from "@/modules/execution-factory-lab/components/CategorySelect";
import { registerSkillCapability } from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { CapabilityRecord } from "@/modules/execution-factory-lab/types/capability";

type ImportSkillDrawerProps = {
  open: boolean;
  onClose: () => void;
  onImported?: (capability: CapabilityRecord) => void;
};

type ImportMode = "zip" | "content";

export function ImportSkillDrawer({ open, onClose, onImported }: ImportSkillDrawerProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ImportMode>("zip");
  const [file, setFile] = useState<File | undefined>();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other_category");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (mode === "zip" && !file) {
      setError(t("executionFactoryLab.importSkillFileRequired"));
      return;
    }
    if (mode === "content" && !content.trim()) {
      setError(t("executionFactoryLab.importSkillContentPlaceholder"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const capability = await registerSkillCapability(
        mode === "zip"
          ? { file, fileType: "zip", category }
          : { content: content.trim(), fileType: "content", category },
      );
      setFile(undefined);
      setContent("");
      setCategory("other_category");
      onImported?.(capability);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      onClose={onClose}
      open={open}
      title={t("executionFactoryLab.importSkillTitle")}
      width={520}
    >
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}
      <Radio.Group
        onChange={(event) => setMode(event.target.value as ImportMode)}
        style={{ marginBottom: 16 }}
        value={mode}
      >
        <Radio.Button value="zip">{t("executionFactoryLab.importSkillModeZip")}</Radio.Button>
        <Radio.Button value="content">{t("executionFactoryLab.importSkillModeContent")}</Radio.Button>
      </Radio.Group>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>{t("executionFactoryLab.categoryLabel")}</div>
        <CategorySelect onChange={setCategory} value={category} />
      </div>
      {mode === "zip" ? (
        <Upload.Dragger
          beforeUpload={(uploadFile) => {
            setFile(uploadFile);
            return false;
          }}
          fileList={file ? [{ uid: "1", name: file.name, status: "done" }] : []}
          maxCount={1}
          onRemove={() => setFile(undefined)}
        >
          <p>{t("executionFactoryLab.importSkillHint")}</p>
        </Upload.Dragger>
      ) : (
        <Input.TextArea
          autoSize={{ minRows: 10, maxRows: 20 }}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("executionFactoryLab.importSkillContentPlaceholder")}
          value={content}
        />
      )}
      <AppButton
        loading={submitting}
        onClick={() => void handleSubmit()}
        style={{ marginTop: 16 }}
        type="primary"
      >
        {t("executionFactoryLab.importSkillSubmit")}
      </AppButton>
    </Drawer>
  );
}
