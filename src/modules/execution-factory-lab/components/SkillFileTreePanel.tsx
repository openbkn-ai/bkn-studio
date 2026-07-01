/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, List, Spin } from "antd";

import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";

import {
  getSkillContent,
  readSkillFile,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { SkillFileSummary } from "@/modules/execution-factory-lab/types/capability";

type SkillFileTreePanelProps = {
  capabilityId: string;
};

export function SkillFileTreePanel({ capabilityId }: SkillFileTreePanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SkillFileSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    void getSkillContent(capabilityId)
      .then((content) => {
        setFiles(content.files);
        if (content.files.length > 0) {
          setSelectedPath(content.files[0].relPath);
        } else if (content.content) {
          setPreview(content.content);
        }
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => setLoading(false));
  }, [capabilityId]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    void readSkillFile(capabilityId, selectedPath)
      .then((file) => setPreview(file.content ?? ""))
      .catch((readError) => {
        setPreview(readError instanceof Error ? readError.message : String(readError));
      });
  }, [capabilityId, selectedPath]);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <Alert message={error} showIcon type="error" />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
      <List
        bordered
        dataSource={files}
        locale={{ emptyText: t("executionFactoryLab.skillFilesEmpty") }}
        renderItem={(item) => (
          <List.Item
            onClick={() => setSelectedPath(item.relPath)}
            style={{
              cursor: "pointer",
              background: selectedPath === item.relPath ? "#f0f7ff" : undefined,
            }}
          >
            {item.relPath}
          </List.Item>
        )}
        size="small"
      />
      <pre
        style={{
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          minHeight: 240,
          padding: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        {preview || t("executionFactoryLab.skillFilePreviewEmpty")}
      </pre>
    </div>
  );
}
