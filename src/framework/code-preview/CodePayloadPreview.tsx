/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined, ExpandOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";
import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { countSourceLines } from "./code-payload";
import { ReadOnlyCode } from "./ReadOnlyCode";
import styles from "./CodePayloadPreview.module.css";

type Props = { code: string; language: string; rawText: string };

// 仅展示传入文本；工具名识别和请求参数组装由调用页面负责。
export const CodePayloadPreview = memo(function CodePayloadPreview({
  code,
  language,
  rawText,
}: Props) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [tab, setTab] = useState<"code" | "raw">("code");
  const [wrap, setWrap] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const raw = tab === "raw";
  const label = t(raw ? "common.codePreview.raw" : "common.codePreview.code");
  const copy = () => {
    void writeTextToClipboard(raw ? rawText : code)
      .then(() => message.success(t("common.copySuccess")))
      .catch(() => message.error(t("common.copyFailed")));
  };
  const copyButton = (
    <Button
      size="small"
      type="text"
      icon={<CopyOutlined aria-hidden="true" />}
      disabled={!raw && code === ""}
      onClick={copy}
    >
      {t(raw ? "common.codePreview.copyParameters" : "common.codePreview.copyCode")}
    </Button>
  );
  const wrapButton = !raw ? (
    <Button size="small" type="text" aria-pressed={wrap} onClick={() => setWrap((value) => !value)}>
      {t("common.codePreview.wrap")}
    </Button>
  ) : null;
  const content = (inModal: boolean) =>
    raw ? (
      <pre aria-label={label} className={styles.raw}>
        {rawText}
      </pre>
    ) : code === "" ? (
      <div className={styles.empty}>{t("common.codePreview.empty")}</div>
    ) : (
      <ReadOnlyCode code={code} language={language} wrap={wrap} expanded={inModal} label={label} />
    );
  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label={t("common.codePreview.views")}>
          {(["code", "raw"] as const).map((value) => (
            <button
              key={value}
              id={id + value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={id + "panel"}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "code"
                    : event.key === "End"
                      ? "raw"
                      : value === "code"
                        ? "raw"
                        : "code";
                setTab(next);
                document.getElementById(id + next)?.focus();
              }}
            >
              {t("common.codePreview." + value)}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <span className={styles.language} title={raw ? "JSON" : language}>
            {raw ? "JSON" : language}
          </span>
          {wrapButton}
          {copyButton}
          <Button
            size="small"
            type="text"
            icon={<ExpandOutlined aria-hidden="true" />}
            disabled={!raw && code === ""}
            onClick={() => setExpanded(true)}
          >
            {t("common.codePreview.expand")}
          </Button>
        </div>
      </div>
      <div id={id + "panel"} role="tabpanel" aria-labelledby={id + tab}>
        {content(false)}
      </div>
      <div className={styles.meta}>
        <span>
          {raw
            ? t("common.codePreview.completeParameters")
            : t("common.codePreview.lines", { count: countSourceLines(code) })}
        </span>
        <span>{t("common.codePreview.readOnly")}</span>
      </div>
      <Modal
        title={label}
        open={expanded}
        onCancel={() => setExpanded(false)}
        destroyOnHidden
        width={960}
        footer={
          <div className={styles.modalActions}>
            {wrapButton}
            {copyButton}
          </div>
        }
      >
        <div className={styles.modalContent}>{expanded ? content(true) : null}</div>
      </Modal>
    </div>
  );
});
