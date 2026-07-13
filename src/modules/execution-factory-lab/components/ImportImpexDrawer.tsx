/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Select, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";

import { useState } from "react";

import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  importCapabilityPackage,
  type ImpexImportMode,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";

type ImportImpexDrawerProps = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
};

export function ImportImpexDrawer({ open, onClose, onImported }: ImportImpexDrawerProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ImpexImportMode>("create");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      setError(t("executionFactoryLab.importImpexFileRequired"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await importCapabilityPackage(file, mode);
      setFileList([]);
      onImported?.();
      onClose();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      onClose={() => {
        setFileList([]);
        setError(null);
        onClose();
      }}
      open={open}
      title={t("executionFactoryLab.importImpexTitle")}
      width={480}
    >
      {error ? <Alert message={error} showIcon style={{ marginBottom: 12 }} type="error" /> : null}

      <p style={{ marginBottom: 16, color: "rgba(0,0,0,0.65)" }}>
        {t("executionFactoryLab.importImpexHint")}
      </p>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>{t("executionFactoryLab.importImpexMode")}</div>
        <Select
          onChange={(value) => setMode(value)}
          options={[
            { value: "create", label: t("executionFactoryLab.importImpexModeCreate") },
            { value: "upsert", label: t("executionFactoryLab.importImpexModeUpsert") },
          ]}
          style={{ width: "100%" }}
          value={mode}
        />
      </div>

      <Upload
        accept=".json,.adp"
        beforeUpload={(file) => {
          setFileList([{ uid: file.uid, name: file.name, originFileObj: file }]);
          return false;
        }}
        fileList={fileList}
        maxCount={1}
        onRemove={() => setFileList([])}
      >
        <AppButton>{t("executionFactoryLab.importImpexChooseFile")}</AppButton>
      </Upload>

      <div style={{ marginTop: 24 }}>
        <AppButton loading={loading} onClick={() => void handleSubmit()} type="primary">
          {t("executionFactoryLab.importImpexSubmit")}
        </AppButton>
      </div>
    </Drawer>
  );
}
