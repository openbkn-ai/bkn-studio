/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Space } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { RequestErrorDetails } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./RequestErrorAlert.module.css";

export type RequestErrorAlertProps = {
  autoDismissMs?: number;
  error: RequestErrorDetails;
  onDismiss: () => void;
};

export function RequestErrorAlert({
  autoDismissMs = 10000,
  error,
  onDismiss,
}: RequestErrorAlertProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(error.code || error.details || error.solution || error.errorLink);
  const copyText = useMemo(
    () =>
      [
        error.description,
        error.code ? t("common.error.code", { value: error.code }) : "",
        error.details ? t("common.error.details", { value: error.details }) : "",
        error.solution ? t("common.error.solution", { value: error.solution }) : "",
        error.errorLink ? t("common.error.link", { value: error.errorLink }) : "",
      ]
        .filter(Boolean)
        .join("\n"),
    [error.code, error.description, error.details, error.errorLink, error.solution, t],
  );

  useEffect(() => {
    setExpanded(false);
  }, [error]);

  useEffect(() => {
    if (expanded || autoDismissMs <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, expanded, onDismiss]);

  const copyDetails = () => {
    void navigator.clipboard?.writeText(copyText);
  };

  return (
    <Alert
      action={
        hasDetails ? (
          <Space size={4}>
            <AppButton onClick={() => setExpanded((value) => !value)} size="small" type="link">
              {t(expanded ? "common.hideDetails" : "common.viewDetails")}
            </AppButton>
            {expanded ? (
              <AppButton onClick={copyDetails} size="small" type="link">
                {t("common.copy")}
              </AppButton>
            ) : null}
          </Space>
        ) : null
      }
      closable
      description={
        expanded ? (
          <div className={styles.details}>
            {error.code ? <div>{t("common.error.code", { value: error.code })}</div> : null}
            {error.details ? (
              <pre className={styles.detailValue}>
                {t("common.error.details", { value: error.details })}
              </pre>
            ) : null}
            {error.solution ? <div>{t("common.error.solution", { value: error.solution })}</div> : null}
            {error.errorLink ? <div>{t("common.error.link", { value: error.errorLink })}</div> : null}
          </div>
        ) : undefined
      }
      message={error.description}
      onClose={onDismiss}
      showIcon
      type="error"
    />
  );
}
