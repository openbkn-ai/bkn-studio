/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tabs } from "antd";
import { useTranslation } from "react-i18next";
import { ApiRequestEditor } from "./ApiRequestEditor";
import { ApiResponseEditor } from "./ApiResponseEditor";
import { ApiSuccessRuleEditor } from "./ApiSuccessRuleEditor";
import { EditorValidity } from "./EditorValidity";
import { objectValue, replaceMember } from "./model";
import type { ApiDefinitionEditorProps } from "./types";
import styles from "./editor.module.css";

export type ApiLoginEditorProps = ApiDefinitionEditorProps & { variableNames?: string[] };

export function ApiLoginEditor({
  value = {},
  onChange,
  disabled = false,
  variableNames = [],
  onValidityChange,
}: ApiLoginEditorProps) {
  const { t } = useTranslation();
  const change = (key: string, next: unknown) => onChange(replaceMember(value, key, next));
  return (
    <EditorValidity onValidityChange={onValidityChange}>
      <div className={styles.stack}>
        <p className={styles.hint}>{t("dataConnect.apiEditor.loginHint")}</p>
        <Tabs
          items={[
            {
              key: "request",
              label: t("dataConnect.apiEditor.request"),
              children: (
                <div
                  className={`${styles.member} ${styles.sectionCard}`}
                  role="group"
                  aria-label={t("dataConnect.apiEditor.request")}
                >
                  <ApiRequestEditor
                    value={objectValue(value.request)}
                    onChange={(next) => change("request", next)}
                    disabled={disabled}
                    variableNames={variableNames}
                  />
                </div>
              ),
            },
            {
              key: "response",
              label: t("dataConnect.apiEditor.response"),
              children: (
                <div
                  className={`${styles.member} ${styles.sectionCard}`}
                  role="group"
                  aria-label={t("dataConnect.apiEditor.response")}
                >
                  <ApiResponseEditor
                    value={objectValue(value.response)}
                    onChange={(next) => change("response", next)}
                    disabled={disabled}
                  />
                </div>
              ),
            },
            {
              key: "success",
              label: t("dataConnect.apiEditor.success"),
              children: (
                <div
                  className={`${styles.member} ${styles.sectionCard}`}
                  role="group"
                  aria-label={t("dataConnect.apiEditor.success")}
                >
                  <ApiSuccessRuleEditor
                    value={objectValue(value.success_rule)}
                    onChange={(next) => change("success_rule", next)}
                    disabled={disabled}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>
    </EditorValidity>
  );
}
