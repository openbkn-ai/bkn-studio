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
  /** 二进制文件的下载直链；给了就渲染下载态。 */
  downloadUrl?: string;
  errorMessage?: string | null;
  loading?: boolean;
  relPath?: string;
  /** 文本正文。undefined = 还没选文件 / 拿不到正文。 */
  text?: string;
};

/**
 * 技能包单个文件的预览面板（标题栏 + 正文）。以前是一块裸 `<pre>`：没有语法高亮、
 * 没有行号，Markdown 也只能看源码，跟函数工作台那侧的编辑器完全不是一套东西。
 *
 * 现在按文件类型分流：Markdown 默认渲染、可切原文；其余文本按后缀高亮（复用全站
 * 同一个 Monaco 只读编辑器）；二进制退回下载。模式开关只在 Markdown 出现——其它
 * 类型没有第二种看法，摆个只有一个选项的开关是噪音。
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

  // 换文件时回到默认视图：在 A.md 里切到「原文」，不该让接着点开的 B.md 也是原文。
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
