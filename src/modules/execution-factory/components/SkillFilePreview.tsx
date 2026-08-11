/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Empty, Segmented, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import { CodeEditor } from "@/modules/execution-factory/components/CodeEditor";
import {
  isMarkdownSkillFile,
  resolveSkillFileLanguage,
} from "@/modules/execution-factory/utils/skill-file-preview";

import styles from "./skill-file-preview.module.css";

type SkillFilePreviewMode = "rendered" | "source";

type SkillFilePreviewProps = {
  /** Direct download URL for a binary file; when present, render the download state. */
  downloadUrl?: string;
  errorMessage?: string | null;
  loading?: boolean;
  relPath?: string;
  /** Text body. undefined means no file is selected or the body is unavailable. */
  text?: string;
};

/**
 * Preview panel for a skill-package file with header and body. It previously used a bare `<pre>`
 * with no syntax highlighting or line numbers, and Markdown could only show source unlike the function-workbench editor.
 *
 * Views now branch by file type: Markdown renders by default with source available, other text
 * uses extension-based highlighting through the shared read-only Monaco editor, and binaries use
 * downloads. Show the mode toggle only for Markdown because a one-option toggle for other types is noise.
 */
export function SkillFilePreview({
  downloadUrl,
  errorMessage,
  loading = false,
  relPath,
  text,
}: SkillFilePreviewProps) {
  const { t } = useTranslation();
  const isMarkdown = isMarkdownSkillFile(relPath);
  const [mode, setMode] = useState<SkillFilePreviewMode>("rendered");

  // Reset to the default view when switching files so viewing A.md source does not force B.md source too.
  useEffect(() => {
    setMode("rendered");
  }, [relPath]);

  const showModeSwitch = isMarkdown && !loading && !errorMessage && text !== undefined;
  const body = renderBody();

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <span className={styles.title}>{t("executionFactory.skillFilePreviewTitle")}</span>
          {relPath ? <span className={styles.path}>{relPath}</span> : null}
        </div>
        {showModeSwitch ? (
          <Segmented<SkillFilePreviewMode>
            onChange={setMode}
            options={[
              { label: t("executionFactory.skillFilePreviewRendered"), value: "rendered" },
              { label: t("executionFactory.skillFilePreviewSource"), value: "source" },
            ]}
            size="small"
            value={mode}
          />
        ) : null}
      </div>
      <div className={styles.body}>{body}</div>
    </div>
  );

  function renderBody() {
    if (loading) {
      return (
        <div className={styles.placeholder}>
          <Spin />
        </div>
      );
    }

    if (errorMessage) {
      return <Alert message={errorMessage} showIcon type="error" />;
    }

    if (downloadUrl) {
      return (
        <div className={styles.placeholder}>
          <Empty description={t("executionFactory.skillFilePreviewBinaryHint")}>
            <AppButton href={downloadUrl} rel="noreferrer" target="_blank" type="link">
              {t("executionFactory.skillFilePreviewDownloadLink")}
            </AppButton>
          </Empty>
        </div>
      );
    }

    if (text === undefined) {
      return (
        <div className={styles.placeholder}>
          <Empty description={t("executionFactory.skillFilePreviewSelectHint")} />
        </div>
      );
    }

    if (isMarkdown && mode === "rendered") {
      return (
        <div className={styles.markdown}>
          <MarkdownText text={text} variant="document" />
        </div>
      );
    }

    return (
      <div className={styles.code}>
        <CodeEditor
          height="fill"
          language={resolveSkillFileLanguage(relPath)}
          readOnly
          value={text}
        />
      </div>
    );
  }
}
