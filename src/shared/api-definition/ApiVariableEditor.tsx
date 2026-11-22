/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Empty, Input, Tooltip } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ApiValueEditor, ApiValueTypeSelect } from "./ApiValueEditor";
import { objectValue } from "./model";
import { useEditorValidity } from "./validity";
import styles from "./ApiVariableEditor.module.css";

type VariableRow = {
  id: number;
  name: string;
  value: unknown;
  sensitive?: boolean;
  attributes: Record<string, unknown>;
  stored: boolean;
};
let variableRowId = 0;

function variableRows(value: unknown, isEdit: boolean): VariableRow[] {
  return Object.entries(objectValue(value)).map(([name, entry]) => {
    const { value, sensitive, ...attributes } = objectValue(entry);
    return {
      id: ++variableRowId,
      name,
      value: value ?? undefined,
      sensitive: sensitive === undefined ? undefined : sensitive === true,
      attributes,
      stored: isEdit && sensitive === true && (value === undefined || value === null),
    };
  });
}

function validVariableNames(rows: VariableRow[]) {
  const names = rows.map((row) => row.name);
  return (
    names.every((name) => /^[A-Za-z][A-Za-z0-9_]*$/.test(name)) &&
    new Set(names).size === names.length
  );
}

export function ApiVariableEditor({
  value,
  onChange,
  onInvalidDraft,
  isEdit = false,
  onValidityChange,
  disabled = false,
  hint,
  emptyDescription,
  storedValueHint,
}: {
  value: unknown;
  onChange: (variables: Record<string, unknown>) => void;
  onInvalidDraft?: () => void;
  isEdit?: boolean;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  hint: string;
  emptyDescription: string;
  storedValueHint: string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => variableRows(value, isEdit));
  const [sensitiveHintRow, setSensitiveHintRow] = useState<number | null>(null);
  const [invalidValues, setInvalidValues] = useState<Set<number>>(() => new Set());
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (lastEmitted.current !== value) {
      setRows(variableRows(value, isEdit));
      setInvalidValues(new Set());
      lastEmitted.current = value;
    }
  }, [value, isEdit]);
  const validNames = validVariableNames(rows);
  const valid = validNames && invalidValues.size === 0;
  useEditorValidity(valid || disabled);
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  const changeRows = (next: VariableRow[]) => {
    setRows(next);
    if (!validVariableNames(next)) {
      onInvalidDraft?.();
      return;
    }
    const variables = Object.fromEntries(
      next.map((row) => [
        row.name,
        {
          ...row.attributes,
          ...(row.value !== undefined && row.value !== null ? { value: row.value } : {}),
          ...(row.sensitive !== undefined ? { sensitive: row.sensitive } : {}),
        },
      ]),
    );
    lastEmitted.current = variables;
    onChange(variables);
  };
  const changeRow = (index: number, patch: Partial<VariableRow>) =>
    changeRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className={styles.variables}>
      <div className={styles.toolbar}>
        <p className={styles.hint}>
          {hint} <code>{"{{ name }}"}</code>
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
                attributes: {},
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
        <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                  checked={row.sensitive === true}
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
                  <span className={styles.hint}>{storedValueHint}</span>
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
                  if (!valid) onInvalidDraft?.();
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
