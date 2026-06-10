import { InboxOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Input, Tabs, Upload } from "antd";
import type { UploadProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  extractOpenApiMetadataHints,
  validateOpenApiDocumentText,
} from "@/modules/execution-factory/utils/metadata-content";

import styles from "./OpenApiSpecInput.module.css";

type OpenApiSpecInputProps = {
  onMetadataHints?: (hints: { title?: string; description?: string }) => void;
  onValidationChange?: (valid: boolean) => void;
  rows?: number;
  value?: string;
  onChange?: (value: string) => void;
};

type InputMode = "paste" | "file" | "url";

export function OpenApiSpecInput({
  onMetadataHints,
  onValidationChange,
  rows = 10,
  value = "",
  onChange,
}: OpenApiSpecInputProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>("paste");
  const [urlValue, setUrlValue] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const validation = useMemo(() => validateOpenApiDocumentText(value), [value]);

  useEffect(() => {
    onValidationChange?.(validation.ok);

    if (validation.ok) {
      onMetadataHints?.(extractOpenApiMetadataHints(value));
    }
  }, [onMetadataHints, onValidationChange, validation.ok, value]);

  const handlePasteChange = (nextValue: string) => {
    onChange?.(nextValue);
  };

  const readFileText = async (file: File) => {
    const text = await file.text();
    onChange?.(text);
  };

  const uploadProps: UploadProps = {
    accept: ".json,.yaml,.yml",
    beforeUpload: (file) => {
      void readFileText(file as File);
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
      onChange?.(text);
      setMode("paste");
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : String(error));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className={styles.root}>
      <Tabs
        activeKey={mode}
        items={[
          {
            key: "paste",
            label: t("executionFactory.openapiInputPaste"),
            children: (
              <Input.TextArea
                onChange={(event) => handlePasteChange(event.target.value)}
                placeholder="{...}"
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
      {validation.ok ? (
        <Alert
          message={t("executionFactory.openapiValidationOk")}
          showIcon
          style={{ marginTop: 8 }}
          type="success"
        />
      ) : null}
    </div>
  );
}
