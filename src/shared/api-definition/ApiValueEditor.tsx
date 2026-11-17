/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Input, Select, Typography } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import { EditorValidity } from "./EditorValidity";
import { useEditorValidity } from "./validity";
import {
  defaultValue,
  nextMemberName,
  objectValue,
  valueType,
  type DefinitionObject,
} from "./model";
import { useArrayEditorItems, useObjectEditorItems } from "./use-editor-items";
import styles from "./editor.module.css";

export type ValueEditorProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  label: string;
  onValidityChange?: (valid: boolean) => void;
  allowedTypes?: string[];
  showTypeSelector?: boolean;
};

function NumberValue({ value, onChange, disabled, label }: ValueEditorProps) {
  const { t } = useTranslation();
  const current = precisionPreservingValueText(value);
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  let valid = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text);
  if (valid) {
    try {
      parsePrecisionPreservingJSON(text);
    } catch {
      valid = false;
    }
  }
  useEditorValidity(valid || !!disabled);
  return (
    <div className={styles.scalar}>
      <Input
        aria-label={label}
        disabled={disabled}
        value={text}
        status={valid ? undefined : "error"}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(next)) {
            try {
              onChange(parsePrecisionPreservingJSON(next));
            } catch {
              /* The error stays local and prevents saving through the validity boundary. */
            }
          }
        }}
      />
      {!valid ? (
        <Typography.Text type="danger">{t("dataConnect.apiEditor.errors.number")}</Typography.Text>
      ) : null}
    </div>
  );
}

export function ObjectMemberName({
  name,
  entries,
  onRename,
  disabled,
  label,
  visibleLabel,
  autoFocus,
}: {
  name: string;
  entries: DefinitionObject;
  onRename: (name: string) => void;
  disabled?: boolean;
  label: string;
  visibleLabel?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const valid = draft.length > 0 && (draft === name || !Object.hasOwn(entries, draft));
  useEditorValidity(valid || !!disabled);
  return (
    <label className={visibleLabel ? styles.inlineField : styles.scalar}>
      {visibleLabel ? <span className={styles.fieldTitle}>{visibleLabel}</span> : null}
      <Input
        aria-label={label}
        autoFocus={autoFocus}
        value={draft}
        disabled={disabled}
        status={valid ? undefined : "error"}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (valid && draft !== name) onRename(draft);
        }}
      />
      {!valid ? (
        <Typography.Text type="danger">{t("dataConnect.apiEditor.errors.member")}</Typography.Text>
      ) : null}
    </label>
  );
}

export function ObjectValueEditor({
  value,
  onChange,
  disabled,
  label,
  renderValue,
  newValue = "",
  nameLabel,
}: {
  value: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
  label: string;
  renderValue?: (key: string, value: unknown, onChange: (value: unknown) => void) => ReactNode;
  newValue?: unknown;
  nameLabel?: string;
}) {
  const { t } = useTranslation();
  const items = useObjectEditorItems(value);
  return (
    <div className={styles.stack}>
      {Object.entries(value).map(([key, entry]) => (
        <div className={styles.member} key={items.keys.get(key)}>
          <div
            className={
              nameLabel
                ? `${styles.memberHeader} ${styles.inlineMemberHeader}`
                : styles.memberHeader
            }
          >
            <ObjectMemberName
              name={key}
              entries={value}
              disabled={disabled}
              label={`${label} ${nameLabel ?? t("dataConnect.apiEditor.name")} ${key}`}
              visibleLabel={nameLabel}
              onRename={(name) => onChange(items.rename(key, name))}
            />
            <Button
              disabled={disabled}
              type="text"
              size="middle"
              danger
              onClick={() => onChange(items.replace(key, undefined))}
            >
              {t("dataConnect.apiEditor.remove")}
            </Button>
          </div>
          {renderValue ? (
            renderValue(key, entry, (next) => onChange(items.replace(key, next)))
          ) : (
            <ApiValueEditor
              value={entry}
              onChange={(next) => onChange(items.replace(key, next))}
              label={`${label}.${key}`}
              disabled={disabled}
            />
          )}
        </div>
      ))}
      <Button
        disabled={disabled}
        onClick={() => onChange(items.replace(nextMemberName(value), newValue))}
      >
        {t("dataConnect.apiEditor.addProperty")}
      </Button>
    </div>
  );
}

export function ApiValueEditor(props: ValueEditorProps) {
  return (
    <EditorValidity onValidityChange={props.onValidityChange}>
      <ValueTreeEditor {...props} />
    </EditorValidity>
  );
}

export function ApiValueTypeSelect({
  value,
  onChange,
  disabled,
  label,
  id,
  allowedTypes = ["string", "number", "boolean", "null", "object", "array"],
}: Pick<ValueEditorProps, "value" | "onChange" | "disabled" | "label" | "allowedTypes"> & {
  id?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select
      id={id}
      aria-label={`${label} ${t("dataConnect.apiEditor.valueType")}`}
      disabled={disabled}
      value={valueType(value)}
      options={allowedTypes.map((value) => ({
        value,
        label: t(`dataConnect.apiEditor.types.${value}`),
      }))}
      onChange={(next) => onChange(defaultValue(next))}
    />
  );
}

function ValueTreeEditor({
  value,
  onChange,
  disabled,
  label,
  allowedTypes,
  showTypeSelector = true,
}: ValueEditorProps) {
  const { t } = useTranslation();
  const type = valueType(value);
  return (
    <div className={styles.stack}>
      {showTypeSelector ? (
        <ApiValueTypeSelect
          value={value}
          onChange={onChange}
          disabled={disabled}
          label={label}
          allowedTypes={allowedTypes}
        />
      ) : null}
      {type === "number" ? (
        <NumberValue value={value} onChange={onChange} disabled={disabled} label={label} />
      ) : type === "boolean" ? (
        <Select
          aria-label={label}
          disabled={disabled}
          value={value as boolean}
          options={[
            { value: true, label: t("dataConnect.apiEditor.true") },
            { value: false, label: t("dataConnect.apiEditor.false") },
          ]}
          onChange={onChange}
        />
      ) : type === "null" ? (
        <Typography.Text type="secondary">null</Typography.Text>
      ) : type === "object" ? (
        <ObjectValueEditor
          value={objectValue(value)}
          onChange={onChange}
          disabled={disabled}
          label={label}
        />
      ) : type === "array" ? (
        <ArrayValueEditor
          value={value as unknown[]}
          onChange={onChange}
          disabled={disabled}
          label={label}
        />
      ) : (
        <Input
          aria-label={label}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export function ArrayValueEditor({
  value,
  onChange,
  disabled,
  label,
  renderValue,
  newValue = "",
}: {
  value: unknown[];
  onChange: (value: unknown[]) => void;
  disabled?: boolean;
  label: string;
  renderValue?: (value: unknown, onChange: (value: unknown) => void, index: number) => ReactNode;
  newValue?: unknown;
}) {
  const { t } = useTranslation();
  const items = useArrayEditorItems(value);
  return (
    <div className={styles.stack}>
      {value.map((entry, index) => (
        <div key={items.keys[index]} className={styles.member}>
          <div className={styles.memberHeader}>
            <span>{t("dataConnect.apiEditor.item", { index: index + 1 })}</span>
            <Button
              disabled={disabled || index === 0}
              onClick={() => {
                onChange(items.moveUp(index));
              }}
            >
              {t("dataConnect.apiEditor.moveUp")}
            </Button>
            <Button
              disabled={disabled}
              type="text"
              size="middle"
              danger
              onClick={() => onChange(items.remove(index))}
            >
              {t("dataConnect.apiEditor.remove")}
            </Button>
          </div>
          {renderValue ? (
            renderValue(entry, (next) => onChange(items.replace(index, next)), index)
          ) : (
            <ApiValueEditor
              value={entry}
              onChange={(next) => onChange(items.replace(index, next))}
              disabled={disabled}
              label={`${label}[${index}]`}
            />
          )}
        </div>
      ))}
      <Button disabled={disabled} onClick={() => onChange(items.append(newValue))}>
        {t("dataConnect.apiEditor.addItem")}
      </Button>
    </div>
  );
}
