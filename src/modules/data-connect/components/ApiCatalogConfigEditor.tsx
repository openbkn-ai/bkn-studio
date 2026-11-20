/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Switch, Tabs } from "antd";
import BigNumber from "bignumber.js";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ApiLoginEditor,
  ApiVariableEditor,
  createApiLoginDefinition,
} from "@/shared/api-definition";
import { isCatalogVariable } from "@/shared/catalog/config-security";
import { isApiCatalogConfigEditable } from "@/modules/data-connect/lib/api-catalog-config";

import { ConnectorOptionsEditor } from "./ConnectorOptionsEditor";

import styles from "./ApiCatalogConfigEditor.module.css";
import formStyles from "./DataConnectConfigForm.module.css";

type Props = {
  value?: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  isEdit?: boolean;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  validationError?: string;
};

export function ApiCatalogConfigEditor({
  value = {},
  onChange,
  isEdit = false,
  onValidityChange,
  disabled = false,
  validationError,
}: Props) {
  const { t } = useTranslation();
  const fieldId = useId();
  const baseUrlError = validationError === "dataConnect.apiCatalog.errors.baseUrl";
  const optionsError = validationError === "dataConnect.apiCatalog.errors.options";
  const variablesError = [
    "dataConnect.apiCatalog.errors.variables",
    "dataConnect.apiCatalog.errors.sensitiveVariables",
    "dataConnect.apiCatalog.errors.missingSensitiveValue",
  ].includes(validationError ?? "");
  const loginError = !!validationError && !baseUrlError && !optionsError && !variablesError;
  const errorMessage = validationError ? (
    <span className={styles.error} id={`${fieldId}-error`} role="alert">
      {t(validationError)}
    </span>
  ) : null;
  const [variablesValid, setVariablesValid] = useState(true);
  const [loginValid, setLoginValid] = useState(true);
  const [optionsValid, setOptionsValid] = useState(true);
  const loginValidRef = useRef(true);
  const loginDraft = useRef<Record<string, unknown> | undefined>(undefined);
  const editable = isApiCatalogConfigEditable(value);
  const hasLogin = value.login_request !== undefined && value.login_request !== null;
  const loginDefinition = hasLogin
    ? (value.login_request as Record<string, unknown>)
    : loginDraft.current;
  useEffect(() => {
    onValidityChange?.(editable && variablesValid && optionsValid && (!hasLogin || loginValid));
  }, [editable, hasLogin, loginValid, onValidityChange, variablesValid, optionsValid]);

  if (!editable)
    return <Alert message={t("dataConnect.apiCatalog.readonly")} showIcon type="warning" />;

  return (
    <div className={styles.editor}>
      <Tabs
        items={[
          {
            key: "service",
            label: (
              <span className={baseUrlError || optionsError ? styles.error : undefined}>
                {t("dataConnect.apiCatalog.service")}
              </span>
            ),
            forceRender: true,
            children: (
              <div className={formStyles.groupStack}>
                <div
                  className={formStyles.group}
                  role="group"
                  aria-label={t("dataConnect.connectorTemplates.fieldGroups.connection")}
                >
                  <div className={formStyles.groupTitle}>
                    {t("dataConnect.connectorTemplates.fieldGroups.connection")}
                  </div>
                  <div className={formStyles.grid}>
                    <div className={`${formStyles.field} ${formStyles.spanFull}`}>
                      <label className={formStyles.fieldLabel} htmlFor={`${fieldId}-base-url`}>
                        <span className={formStyles.requiredMark} aria-hidden="true">
                          *
                        </span>
                        <span>{t("dataConnect.apiCatalog.baseUrl")}</span>
                      </label>
                      <div className={formStyles.fieldBody}>
                        <Form.Item
                          className={formStyles.fieldItem}
                          extra={
                            <span id={`${fieldId}-hint`}>
                              {t("dataConnect.apiCatalog.baseUrlHint")}
                            </span>
                          }
                          help={baseUrlError ? errorMessage : undefined}
                          validateStatus={baseUrlError ? "error" : ""}
                        >
                          <Input
                            id={`${fieldId}-base-url`}
                            disabled={disabled}
                            aria-label={t("dataConnect.apiCatalog.baseUrl")}
                            aria-required="true"
                            aria-invalid={baseUrlError}
                            aria-describedby={`${fieldId}-hint${baseUrlError ? ` ${fieldId}-error` : ""}`}
                            status={baseUrlError ? "error" : undefined}
                            value={typeof value.base_url === "string" ? value.base_url : ""}
                            placeholder="https://api.example.com/"
                            onChange={(event) =>
                              onChange?.({ ...value, base_url: event.target.value })
                            }
                          />
                        </Form.Item>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={formStyles.group}
                  role="group"
                  aria-label={t("dataConnect.connectorTemplates.fieldGroups.advanced")}
                >
                  <div className={formStyles.groupTitle}>
                    {t("dataConnect.connectorTemplates.fieldGroups.advanced")}
                  </div>
                  <div className={formStyles.grid}>
                    <div className={`${formStyles.field} ${formStyles.spanFull}`}>
                      <span className={formStyles.fieldLabel} id={`${fieldId}-options-label`}>
                        {t("dataConnect.connectorTemplates.fieldLabels.options")}
                      </span>
                      <div className={formStyles.fieldBody}>
                        <Form.Item className={formStyles.fieldItem} help={false} validateStatus="">
                          <ConnectorOptionsEditor
                            connectorType="http"
                            value={value.options}
                            disabled={disabled}
                            onChange={(options) => {
                              const next = { ...value };
                              if (options === null) delete next.options;
                              else next.options = options;
                              onChange?.(next);
                            }}
                            onValidityChange={(valid) => {
                              if (optionsValid && !valid) onChange?.({ ...value });
                              setOptionsValid(valid);
                            }}
                          />
                        </Form.Item>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "variables",
            label: (
              <span className={variablesError ? styles.error : undefined}>
                {t("dataConnect.apiCatalog.variables")}
              </span>
            ),
            forceRender: true,
            children: (
              <div className={styles.section}>
                <ApiVariableEditor
                  value={value.variables}
                  hint={t("dataConnect.apiCatalog.variablesHint")}
                  emptyDescription={t("dataConnect.apiCatalog.noVariables")}
                  storedValueHint={t("dataConnect.apiCatalog.storedValue")}
                  isEdit={isEdit}
                  onChange={(variables) => onChange?.({ ...value, variables })}
                  onInvalidDraft={() => onChange?.({ ...value })}
                  onValidityChange={setVariablesValid}
                  disabled={disabled}
                />
                {variablesError ? errorMessage : null}
              </div>
            ),
          },
          {
            key: "login",
            label: (
              <span className={loginError ? styles.error : undefined}>
                {t("dataConnect.apiCatalog.login")}
              </span>
            ),
            forceRender: true,
            children: (
              <div className={styles.section}>
                <div className={styles.loginToggle}>
                  <Switch
                    id={`${fieldId}-login`}
                    aria-describedby={`${fieldId}-login-hint`}
                    disabled={disabled}
                    checked={hasLogin}
                    onChange={(checked) => {
                      const next = { ...value };
                      if (checked)
                        next.login_request = loginDraft.current ?? createApiLoginDefinition();
                      else {
                        loginDraft.current = value.login_request as Record<string, unknown>;
                        delete next.login_request;
                      }
                      onChange?.(next);
                    }}
                  />
                  <label htmlFor={`${fieldId}-login`}>
                    {t("dataConnect.apiCatalog.enableLogin")}
                  </label>
                </div>
                <p id={`${fieldId}-login-hint`} className={styles.hint}>
                  {t("dataConnect.apiCatalog.loginHint")}
                </p>
                <div hidden={!hasLogin}>
                  {loginDefinition ? (
                    <ApiLoginEditor
                      disabled={disabled}
                      value={loginDefinition}
                      variableNames={Object.entries(
                        (value.variables ?? {}) as Record<string, unknown>,
                      )
                        .filter(
                          ([, variable]) =>
                            isCatalogVariable(variable) &&
                            (typeof variable.value === "string" ||
                              typeof variable.value === "number" ||
                              BigNumber.isBigNumber(variable.value) ||
                              typeof variable.value === "boolean" ||
                              variable.sensitive),
                        )
                        .map(([name]) => name)}
                      onValidityChange={(valid) => {
                        if (loginValidRef.current && !valid) onChange?.({ ...value });
                        loginValidRef.current = valid;
                        setLoginValid(valid);
                      }}
                      onChange={(login) => {
                        loginDraft.current = login;
                        if (hasLogin) onChange?.({ ...value, login_request: login });
                      }}
                    />
                  ) : null}
                </div>
                {loginError ? errorMessage : null}
                {!hasLogin ? (
                  <Alert message={t("dataConnect.apiCatalog.noLogin")} type="info" showIcon />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
