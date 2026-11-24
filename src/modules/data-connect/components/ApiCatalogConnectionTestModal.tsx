/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./ApiCatalogConfigEditor.module.css";

export type ApiCatalogTestScope = "draft" | "saved";
export type ApiCatalogTestResult = {
  scope: ApiCatalogTestScope;
  revision: number;
  type: "success" | "error";
  message: string;
};

type Props = {
  saved: boolean;
  draftLogin?: boolean;
  savedLogin?: boolean;
  defaultScope: ApiCatalogTestScope;
  canTestDraft: boolean;
  canTestSaved: boolean;
  loading: boolean;
  result: ApiCatalogTestResult | null;
  revision: number;
  onRun: (scope: ApiCatalogTestScope) => void;
  onClose: () => void;
};

export function ApiCatalogTestResultNotice({
  result,
  revision,
}: {
  result: ApiCatalogTestResult;
  revision: number;
}) {
  const { t } = useTranslation();
  const stale = result.scope === "draft" && result.revision !== revision;
  return (
    <div className={styles.section}>
      <Alert
        role="status"
        showIcon
        type={stale ? "warning" : result.type}
        message={stale ? t("dataConnect.apiCatalog.staleResult") : result.message}
        description={t(
          `dataConnect.apiCatalog.${result.scope === "saved" ? "savedResult" : "draftResult"}`,
        )}
      />
    </div>
  );
}

export function ApiCatalogConnectionTestModal(props: Props) {
  const { t } = useTranslation();
  const [scope, setScope] = useState(props.defaultScope);
  const hasLogin = scope === "saved" ? props.savedLogin : props.draftLogin;
  const permitted = scope === "draft" ? props.canTestDraft : props.canTestSaved;
  return (
    <Modal
      open
      title={t("dataConnect.apiCatalog.testTitle")}
      onCancel={props.onClose}
      onOk={() => props.onRun(scope)}
      okText={t("dataConnect.apiCatalog.startTest")}
      cancelText={t("common.close")}
      okButtonProps={{ disabled: !permitted || props.loading, loading: props.loading }}
    >
      <div className={styles.section}>
        <label className={styles.field}>
          <span className={styles.label}>{t("dataConnect.apiCatalog.testScope")}</span>
          <Select<ApiCatalogTestScope>
            aria-label={t("dataConnect.apiCatalog.testScope")}
            value={scope}
            onChange={setScope}
            options={[
              {
                value: "draft",
                label: t("dataConnect.apiCatalog.draft"),
                disabled: !props.canTestDraft,
              },
              ...(props.saved
                ? [
                    {
                      value: "saved" as const,
                      label: t("dataConnect.apiCatalog.saved"),
                      disabled: !props.canTestSaved,
                    },
                  ]
                : []),
            ]}
          />
        </label>
        <Alert
          message={t(`dataConnect.apiCatalog.${hasLogin ? "loginTestHint" : "transportTestHint"}`)}
          showIcon
          type="info"
        />
        <p className={styles.hint}>{t("dataConnect.apiCatalog.resourceTestHint")}</p>
        {scope === "saved" ? (
          <Alert message={t("dataConnect.apiCatalog.savedResult")} showIcon type="warning" />
        ) : null}
        {!props.canTestDraft && scope === "draft" ? (
          <Alert message={t("dataConnect.apiCatalog.cannotTestDraft")} showIcon type="warning" />
        ) : null}
        {props.result ? (
          <ApiCatalogTestResultNotice result={props.result} revision={props.revision} />
        ) : null}
      </div>
    </Modal>
  );
}
