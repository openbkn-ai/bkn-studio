/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InboxOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Input, Tabs, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { OpenApiOperationsIoPreview } from "@/modules/execution-factory/components/OpenApiOperationsIoPreview";
import { OpenApiEndpointReview } from "@/modules/execution-factory/components/OpenApiEndpointReview";
import {
  OPENAPI_OPERATOR_TEMPLATE,
  OPENAPI_TOOLBOX_TEMPLATE,
} from "@/modules/execution-factory/constants/import-templates";
import {
  analyzeOpenApiDocumentText,
  extractOpenApiMetadataHints,
  type OpenApiSpecSource,
  validateOpenApiDocumentText,
} from "@/modules/execution-factory/utils/metadata-content";
import { triggerBrowserDownload } from "@/modules/execution-factory/utils/download-file";

import styles from "./OpenApiSpecInput.module.css";

type OpenApiSpecInputProps = {
  onMetadataHints?: (hints: { title?: string; description?: string }) => void;
  onValidationChange?: (valid: boolean) => void;
  registrationTarget?: "operator" | "toolbox" | "default";
  rows?: number;
  showEndpointReview?: boolean;
  value?: string;
  onChange?: (value: string, source?: OpenApiSpecSource) => void;
};

type InputMode = "paste" | "file" | "url";

export function OpenApiSpecInput({
  onMetadataHints,
  onValidationChange,
  registrationTarget = "default",
  rows = 10,
  showEndpointReview = false,
  value = "",
  onChange,
}: OpenApiSpecInputProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>("paste");
  const [urlValue, setUrlValue] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeOpenApiDocumentText(value), [value]);
  const validation = useMemo(() => validateOpenApiDocumentText(value), [value]);

  useEffect(() => {
    onValidationChange?.(validation.ok);

    if (validation.ok) {
      onMetadataHints?.(extractOpenApiMetadataHints(value));
    }
  }, [onMetadataHints, onValidationChange, validation.ok, value]);

  const handlePasteChange = (nextValue: string) => {
    onChange?.(nextValue, { kind: "paste" });
  };

  const readFileText = async (file: File) => {
    const text = await file.text();
    setFetchError(null);
    onChange?.(text, { kind: "file", fileName: file.name });
  };

  const uploadProps: UploadProps = {
    accept: ".json,.yaml,.yml",
    beforeUpload: (file) => {
      void readFileText(file);
      return false;
    },
    maxCount: 1,
    showUploadList: false,
  };

  const handleFetchUrl = async () => {
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setFetchError(t("executionFactory.openapiUrlRequired"));
      return;
    }

    setFetching(true);
    setFetchError(null);

    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(t("executionFactory.openapiUrlFetchFailed"));
      }

      const text = await response.text();
      onChange?.(text, { kind: "url", url: trimmed });
      setMode("paste");
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : String(error));
    } finally {
      setFetching(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template =
      registrationTarget === "toolbox" ? OPENAPI_TOOLBOX_TEMPLATE : OPENAPI_OPERATOR_TEMPLATE;
    const filename =
      registrationTarget === "toolbox"
        ? "toolbox-openapi-template.yaml"
        : "operator-openapi-template.yaml";
    const blob = new Blob([template], { type: "text/yaml" });
    triggerBrowserDownload(blob, filename);
  };

  const showMultiOperationWarning =
    registrationTarget === "operator" &&
    analysis.ok &&
    validation.ok &&
    analysis.operationCount > 1;

  const showOpenApi31Hint =
    analysis.ok && analysis.openApiVersion.startsWith("3.1");

  return (
    <div className={styles.root}>
      {registrationTarget === "operator" || registrationTarget === "toolbox" ? (
        <div className={styles.toolbar}>
          <span className={styles.toolbarHint}>
            {registrationTarget === "operator"
              ? t("executionFactory.openapiOperatorHint")
              : t("executionFactory.openapiToolboxHint")}
          </span>
          <button className={styles.templateButton} onClick={handleDownloadTemplate} type="button">
            {t("executionFactory.downloadImportTemplate")}
          </button>
        </div>
      ) : null}
      <Tabs
        activeKey={mode}
        items={[
          {
            key: "paste",
            label: t("executionFactory.openapiInputPaste"),
            children: (
              <Input.TextArea
                onChange={(event) => handlePasteChange(event.target.value)}
                placeholder={t("executionFactory.openapiInputPastePlaceholder")}
                rows={rows}
                value={value}
              />
            ),
          },
          {
            key: "file",
            label: t("executionFactory.openapiInputFile"),
            children: (
              <Upload.Dragger {...uploadProps}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">{t("executionFactory.openapiInputFileHint")}</p>
              </Upload.Dragger>
            ),
          },
          {
            key: "url",
            label: t("executionFactory.openapiInputUrl"),
            children: (
              <div className={styles.urlRow}>
                <Input
                  addonBefore={<LinkOutlined />}
                  onChange={(event) => setUrlValue(event.target.value)}
                  placeholder="https://example.com/openapi.json"
                  value={urlValue}
                />
                <button
                  className={styles.urlFetchButton}
                  disabled={fetching}
                  onClick={() => {
                    void handleFetchUrl();
                  }}
                  type="button"
                >
                  {fetching
                    ? t("executionFactory.openapiUrlFetching")
                    : t("executionFactory.openapiUrlFetch")}
                </button>
              </div>
            ),
          },
        ]}
        onChange={(key) => setMode(key as InputMode)}
        size="small"
      />
      {fetchError ? <Alert message={fetchError} showIcon style={{ marginTop: 8 }} type="error" /> : null}
      {value.trim() && !validation.ok ? (
        <Alert message={validation.reason} showIcon style={{ marginTop: 8 }} type="error" />
      ) : null}
      {validation.ok && analysis.ok ? (
        <>
          <Alert
            className={styles.validationSuccess}
            message={t("executionFactory.openapiValidationOkWithCount", {
              count: analysis.operationCount,
            })}
            showIcon
            type="success"
          />
          <div className={styles.previewPanel}>
            <div className={styles.previewMeta}>
              <span>
                {t("executionFactory.openapiPreviewServer")}: {analysis.serverUrl}
              </span>
              <span>
                {t("executionFactory.openapiPreviewVersion")}: {analysis.openApiVersion}
              </span>
            </div>
            <OpenApiOperationsIoPreview openapiSpec={value} />
            {showEndpointReview ? <OpenApiEndpointReview openapiSpec={value} /> : null}
          </div>
        </>
      ) : null}
      {showMultiOperationWarning ? (
        <Alert
          message={t("executionFactory.openapiMultiOperationWarning", {
            count: analysis.operationCount,
          })}
          showIcon
          style={{ marginTop: 8 }}
          type="warning"
        />
      ) : null}
      {showOpenApi31Hint ? (
        <Alert
          message={t("executionFactory.openapiVersion31Hint")}
          showIcon
          style={{ marginTop: 8 }}
          type="info"
        />
      ) : null}
    </div>
  );
}
