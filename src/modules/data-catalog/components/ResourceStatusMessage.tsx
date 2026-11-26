/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./ResourceStatusMessage.module.css";

const PREVIEW_CHARACTER_LIMIT = 240;

export function ResourceStatusMessage({
  statusMessage,
  showLabel = false,
}: {
  statusMessage: string;
  showLabel?: boolean;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const previewRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const characters = Array.from(statusMessage);
  const shortened = characters.length > PREVIEW_CHARACTER_LIMIT;
  const preview = shortened
    ? `${characters.slice(0, PREVIEW_CHARACTER_LIMIT).join("")}…`
    : statusMessage;
  const previewText = showLabel
    ? t("dataCatalog.resourceWorkspace.statusMessageDetail", { message: preview })
    : preview;

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview || shortened) return;

    const measure = () => {
      setOverflows(preview.scrollHeight > preview.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    return () => observer.disconnect();
  }, [previewText, shortened]);

  const fullMessageLabel = t("dataCatalog.resourceWorkspace.showFullStatusMessage");

  return (
    <div className={styles.root}>
      <div className={styles.preview} ref={previewRef}>
        {previewText}
      </div>
      {shortened || overflows ? (
        <details className={styles.details}>
          <summary>{fullMessageLabel}</summary>
          <div className={styles.actions}>
            <AppButton
              size="small"
              type="text"
              onClick={() => {
                void writeTextToClipboard(statusMessage)
                  .then(() => message.success(t("common.copySuccess")))
                  .catch(() => message.error(t("common.copyFailed")));
              }}
            >
              {t("common.copy")}
            </AppButton>
          </div>
          <pre
            aria-label={fullMessageLabel}
            className={styles.fullMessage}
            role="region"
            tabIndex={0}
          >
            {statusMessage}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
