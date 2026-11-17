/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Empty, Form, Input, Switch, Tabs, Tooltip } from "antd";
import BigNumber from "bignumber.js";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  ApiLoginEditor,
  ApiValueEditor,
  ApiValueTypeSelect,
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
                <ApiCatalogVariables
                  config={value}
                  isEdit={isEdit}
                  onChange={(next) => onChange?.(next)}
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

type VariableRow = {
  id: number;
  name: string;
  value: unknown;
  sensitive: boolean;
  stored: boolean;
};
let variableRowId = 0;

function variableRows(config: Record<string, unknown>, isEdit: boolean): VariableRow[] {
  const variables = (config.variables ?? {}) as Record<string, unknown>;
  return Object.entries(variables).map(([name, entry]) => {
    const variable = entry as { value?: unknown; sensitive?: boolean };
    return {
      id: ++variableRowId,
      name,
      value: variable.value ?? undefined,
      sensitive: variable.sensitive === true,
      stored:
        isEdit &&
        variable.sensitive === true &&
        (variable.value === undefined || variable.value === null),
    };
  });
}

function ApiCatalogVariables({
  config,
  onChange,
  isEdit,
  onValidityChange,
  disabled,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  isEdit: boolean;
  onValidityChange: (valid: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => variableRows(config, isEdit));
  const [sensitiveHintRow, setSensitiveHintRow] = useState<number | null>(null);
  const [invalidValues, setInvalidValues] = useState<Set<number>>(() => new Set());
  const lastEmitted = useRef(config.variables);
  useEffect(() => {
    if (lastEmitted.current !== config.variables) {
      setRows(variableRows(config, isEdit));
      setInvalidValues(new Set());
      lastEmitted.current = config.variables;
    }
  }, [config, isEdit]);
  const validNames =
    rows.every((row) => /^[A-Za-z][A-Za-z0-9_]*$/.test(row.name)) &&
    new Set(rows.map((row) => row.name)).size === rows.length;
  useEffect(() => {
    onValidityChange(validNames && invalidValues.size === 0);
  }, [validNames, invalidValues, onValidityChange]);

  const changeRows = (next: VariableRow[]) => {
    setRows(next);
    const names = next.map((row) => row.name);
    if (
      !next.every((row) => /^[A-Za-z][A-Za-z0-9_]*$/.test(row.name)) ||
      new Set(names).size !== names.length
    ) {
      onChange({ ...config });
      return;
    }
    const variables = Object.fromEntries(
      next.map((row) => [
        row.name,
        {
          ...(row.value !== undefined && row.value !== null ? { value: row.value } : {}),
          sensitive: row.sensitive,
        },
      ]),
    );
    lastEmitted.current = variables;
    onChange({ ...config, variables });
  };
  const changeRow = (index: number, patch: Partial<VariableRow>) =>
    changeRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className={styles.variables}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {t("dataConnect.apiCatalog.variablesHint")} <code>{"{{ name }}"}</code>
        </p>
        <AppButton
          disabled={disabled}
          onClick={() => {
            let index = rows.length + 1;
            while (rows.some((row) => row.name === `variable${index}`)) index++;
            changeRows([
              ...rows,
              {
                id: ++variableRowId,
                name: `variable${index}`,
                value: "",
                sensitive: false,
                stored: false,
              },
            ]);
          }}
        >
          {t("dataConnect.apiCatalog.addVariable")}
        </AppButton>
      </div>
      {!validNames ? (
        <Alert message={t("dataConnect.apiCatalog.errors.variables")} showIcon type="error" />
      ) : null}
      {!rows.length ? (
        <Empty
          description={t("dataConnect.apiCatalog.noVariables")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : null}
      {rows.map((row, index) => (
        <div
          className={styles.variable}
          key={row.id}
          role="group"
          aria-label={`${t("dataConnect.apiCatalog.variableName")}: ${row.name}`}
        >
          <div className={styles.variableHeader}>
            <label className={`${styles.field} ${styles.variableName}`}>
              <span className={styles.label}>{t("dataConnect.apiCatalog.variableName")}</span>
              <Input
                disabled={disabled}
                aria-label={`${t("dataConnect.apiCatalog.variableName")} ${index + 1}`}
                value={row.name}
                onChange={(event) => changeRow(index, { name: event.target.value })}
              />
            </label>
            <div className={styles.variableType}>
              <label className={styles.label} htmlFor={`api-variable-${row.id}-type`}>
                {t("dataConnect.apiEditor.valueType")}
              </label>
              <ApiValueTypeSelect
                id={`api-variable-${row.id}-type`}
                value={row.sensitive ? "" : row.value}
                onChange={(value) => changeRow(index, { value })}
                disabled={disabled || row.sensitive}
                label={`${t("dataConnect.apiCatalog.variableValue")} ${row.name}`}
                allowedTypes={
                  row.sensitive ? ["string"] : ["string", "number", "boolean", "object", "array"]
                }
              />
            </div>
            <div className={styles.variableActions}>
              <Tooltip
                id={`api-variable-${row.id}-sensitive-tip`}
                title={t("dataConnect.apiCatalog.sensitiveHint")}
                trigger={["hover", "focus"]}
                open={sensitiveHintRow === row.id}
                onOpenChange={(open) =>
                  setSensitiveHintRow((current) =>
                    open ? row.id : current === row.id ? null : current,
                  )
                }
              >
                <Checkbox
                  disabled={disabled}
                  checked={row.sensitive}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSensitiveHintRow(null);
                  }}
                  onChange={(event) => {
                    setInvalidValues((current) => {
                      const next = new Set(current);
                      next.delete(row.id);
                      return next;
                    });
                    changeRow(index, {
                      sensitive: event.target.checked,
                      ...((event.target.checked && typeof row.value !== "string") ||
                      row.value === undefined
                        ? { value: "" }
                        : {}),
                    });
                  }}
                >
                  <span className={styles.sensitiveLabel}>
                    {t("dataConnect.apiCatalog.sensitive")}
                  </span>
                </Checkbox>
              </Tooltip>
              <AppButton
                disabled={disabled}
                type="text"
                size="middle"
                danger
                aria-label={`${t("dataConnect.apiCatalog.removeVariable")} ${row.name}`}
                onClick={() => {
                  setInvalidValues((current) => {
                    const next = new Set(current);
                    next.delete(row.id);
                    return next;
                  });
                  changeRows(rows.filter((_, i) => index !== i));
                }}
              >
                {t("common.remove")}
              </AppButton>
            </div>
          </div>
          <div className={styles.variableValue}>
            <span className={styles.label}>{t("dataConnect.apiCatalog.variableValue")}</span>
            {row.sensitive ? (
              <div className={styles.field}>
                <Input.Password
                  disabled={disabled}
                  aria-label={`${t("dataConnect.apiCatalog.sensitiveValue")} ${row.name}`}
                  autoComplete="new-password"
                  value={typeof row.value === "string" ? row.value : ""}
                  onChange={(event) => changeRow(index, { value: event.target.value })}
                />
                {row.stored && !row.value ? (
                  <span className={styles.hint}>{t("dataConnect.apiCatalog.storedValue")}</span>
                ) : null}
              </div>
            ) : (
              <ApiValueEditor
                showTypeSelector={false}
                disabled={disabled}
                label={`${t("dataConnect.apiCatalog.variableValue")} ${row.name}`}
                value={row.value}
                onChange={(value) => changeRow(index, { value })}
                onValidityChange={(valid) => {
                  if (invalidValues.has(row.id) === !valid) return;
                  if (!valid) onChange({ ...config });
                  const next = new Set(invalidValues);
                  if (valid) next.delete(row.id);
                  else next.add(row.id);
                  setInvalidValues(next);
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
