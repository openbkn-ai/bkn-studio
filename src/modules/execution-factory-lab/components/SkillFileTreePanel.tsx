/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SkillFileTreeView } from "@/modules/execution-factory/components/SkillFileTreeView";
import {
  getSkillContent,
  readSkillFile,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";
import type { SkillFileSummary } from "@/modules/execution-factory-lab/types/capability";

import styles from "./skill-file-tree-panel.module.css";

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
          setSelectedPath(
            content.files.find((item) => item.relPath === "SKILL.md")?.relPath ??
              content.files[0]?.relPath ??
              null,
          );
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
    <div className={styles.layout}>
      {files.length > 0 ? (
        <SkillFileTreeView
          className={styles.tree}
          files={files}
          onSelectFile={setSelectedPath}
          selectedPath={selectedPath}
        />
      ) : (
        <Alert message={t("executionFactoryLab.skillFilesEmpty")} showIcon type="info" />
      )}
      <pre className={styles.preview}>
        {preview || t("executionFactoryLab.skillFilePreviewEmpty")}
      </pre>
    </div>
  );
}
