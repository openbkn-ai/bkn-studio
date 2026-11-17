/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Input, Select, Typography } from "antd";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ApiValueEditor, ApiValueTypeSelect } from "./ApiValueEditor";
import { objectValue, replaceMember, type DefinitionObject } from "./model";
import { useArrayEditorItems } from "./use-editor-items";
import styles from "./editor.module.css";

export function ApiConditionEditor({
  value,
  onChange,
  disabled,
  label,
  onRemove,
}: {
  value: unknown;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
  label: string;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const fieldId = useId();
  const comparisonId = useId();
  const condition = objectValue(value);
  const operation = typeof condition.operation === "string" ? condition.operation : "and";
  const group = operation === "and" || operation === "or";
  const children: unknown[] = Array.isArray(condition.sub_conditions)
    ? condition.sub_conditions
    : [];
  const childItems = useArrayEditorItems(children);
  const update = (key: string, next: unknown) => onChange(replaceMember(condition, key, next));
  return (
    <div className={styles.member}>
      <div className={styles.conditionHeader}>
        <Select
          aria-label={`${label} ${t("dataConnect.apiEditor.operation")}`}
          disabled={disabled}
          value={operation}
          options={["and", "or", "eq", "empty", "null", "not_exist"].map((value) => ({
            value,
            label: t(`dataConnect.apiEditor.operations.${value}`),
          }))}
          onChange={(next) => {
            if (next === "and" || next === "or")
              onChange({ operation: next, sub_conditions: group ? children : [] });
            else
              onChange({
                field: typeof condition.field === "string" ? condition.field : "",
                operation: next,
                ...(next === "eq"
                  ? { value: Object.hasOwn(condition, "value") ? condition.value : "" }
                  : {}),
              });
          }}
        />
        {onRemove ? (
          <Button
            disabled={disabled}
            htmlType="button"
            type="text"
            size="middle"
            danger
            onClick={onRemove}
          >
            {t("dataConnect.apiEditor.remove")}
          </Button>
        ) : null}
      </div>
      {group ? (
        <div className={styles.stack}>
          {children.map((child, index) => (
            <div className={styles.nested} key={childItems.keys[index]}>
              <ApiConditionEditor
                value={child}
                disabled={disabled}
                label={`${label}[${index}]`}
                onChange={(next) => update("sub_conditions", childItems.replace(index, next))}
                onRemove={() => update("sub_conditions", childItems.remove(index))}
              />
            </div>
          ))}
          <div className={styles.memberHeader}>
            <Button
              disabled={disabled}
              onClick={() =>
                update(
                  "sub_conditions",
                  childItems.append({ field: "", operation: "eq", value: "" }),
                )
              }
            >
              {t("dataConnect.apiEditor.addCondition")}
            </Button>
            <Button
              disabled={disabled}
              onClick={() =>
                update(
                  "sub_conditions",
                  childItems.append({ operation: "and", sub_conditions: [] }),
                )
              }
            >
              {t("dataConnect.apiEditor.addGroup")}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.conditionFields}>
          <div className={styles.inlineField}>
            <label className={styles.fieldTitle} htmlFor={fieldId}>
              {t("dataConnect.apiEditor.relativeField")}
            </label>
            <Input
              id={fieldId}
              aria-label={`${label} ${t("dataConnect.apiEditor.relativeField")}`}
              disabled={disabled}
              value={typeof condition.field === "string" ? condition.field : ""}
              onChange={(event) => update("field", event.target.value)}
            />
          </div>
          {operation === "eq" ? (
            <div className={styles.inlineField}>
              <label className={styles.fieldTitle} htmlFor={comparisonId}>
                {t("dataConnect.apiEditor.comparison")}
              </label>
              <div className={styles.conditionValue}>
                <ApiValueTypeSelect
                  id={comparisonId}
                  label={`${label} ${t("dataConnect.apiEditor.comparison")}`}
                  allowedTypes={["string", "number", "boolean", "null"]}
                  value={condition.value}
                  disabled={disabled}
                  onChange={(next) => update("value", next)}
                />
                {condition.value !== null ? (
                  <ApiValueEditor
                    label={`${label} ${t("dataConnect.apiEditor.comparison")}`}
                    showTypeSelector={false}
                    value={condition.value}
                    disabled={disabled}
                    onChange={(next) => update("value", next)}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <Typography.Text className={styles.full} type="secondary">
              {t("dataConnect.apiEditor.unaryHint")}
            </Typography.Text>
          )}
        </div>
      )}
    </div>
  );
}
