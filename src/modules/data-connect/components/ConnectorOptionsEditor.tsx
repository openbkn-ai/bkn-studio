/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Form, Input, InputNumber, Select } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getConnectorOptionDefinitions,
  normalizeConnectorOptionKey,
  readConnectorOptions,
  validateConnectorOption,
  validateConnectorOptions,
  type ConnectorOptionDefinition,
} from "@/modules/data-connect/lib/connector-options";

import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";

import styles from "./DataConnectConfigForm.module.css";

type ConnectorOptionsEditorProps = {
  connectorType?: string;
  id?: string;
  value?: unknown;
  onChange?: (value: Record<string, unknown> | string | null) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
};

export function ConnectorOptionsEditor({
  connectorType,
  id,
  value,
  onChange,
  onValidityChange,
  disabled,
}: ConnectorOptionsEditorProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const { errors } = Form.Item.useStatus();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const [invalidInputs, setInvalidInputs] = useState<Set<string>>(() => new Set());
  const valid = !validateConnectorOptions(connectorType, value) && invalidInputs.size === 0;
  useEffect(() => onValidityChange?.(valid), [onValidityChange, valid]);
  useEffect(() => {
    if (errors.length && detailsRef.current) detailsRef.current.open = true;
  }, [errors]);
  const definitions = getConnectorOptionDefinitions(connectorType) ?? [];
  const options = readConnectorOptions(value);
  if (!options) {
    return (
      <div className={styles.optionsEditor} id={id ?? generatedId}>
        <Alert
          id={`${generatedId}-json-error`}
          type="error"
          showIcon
          message={t("dataConnect.jsonObjectInvalid")}
        />
        <Input.TextArea
          disabled={disabled || undefined}
          id={`${generatedId}-json`}
          aria-invalid
          aria-describedby={`${generatedId}-json-error`}
          aria-label={t("dataConnect.optionEditor.repairJSON")}
          value={typeof value === "string" ? value : JSON.stringify(value)}
          onChange={(event) => onChange?.(event.target.value)}
        />
      </div>
    );
  }
  const entries = Object.entries(options);
  for (const key of addedKeys) if (!Object.hasOwn(options, key)) entries.push([key, undefined]);
  const selected = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const [key] of entries) {
    const normalized = normalizeConnectorOptionKey(connectorType, key);
    if (selected.has(normalized)) duplicateKeys.add(key);
    selected.add(normalized);
  }
  const available = definitions.filter((definition) => !selected.has(definition.key));
  const remove = (key: string) => {
    setAddedKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setInvalidInputs((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    const remaining = Object.fromEntries(
      Object.entries(options).filter(([entryKey]) => entryKey !== key),
    );
    onChange?.(Object.keys(remaining).length ? remaining : null);
  };

  return (
    <details
      className={styles.optionsEditor}
      id={id ?? generatedId}
      open={entries.length > 0}
      ref={detailsRef}
    >
      <summary>{t("dataConnect.optionEditor.title", { count: entries.length })}</summary>
      <p className={styles.optionHint}>{t("dataConnect.optionEditor.defaultHint")}</p>
      {entries.map(([key, entry]) => {
        const definition = definitions.find(
          (option) => option.key === normalizeConnectorOptionKey(connectorType, key),
        );
        const label = definition ? t(`dataConnect.optionEditor.labels.${definition.label}`) : key;
        const error = duplicateKeys.has(key)
          ? "duplicate"
          : invalidInputs.has(key)
            ? "positiveInteger"
            : definition && Object.hasOwn(options, key)
              ? validateConnectorOption(definition, entry, options)
              : undefined;
        const inputId = `${generatedId}-${encodeURIComponent(key)}`;
        const hasDescription = Boolean(
          definition?.hint ||
          definition?.kind === "seconds" ||
          (definition?.kind === "text" && definition.allowEmpty),
        );
        const describedBy =
          [
            hasDescription ? `${inputId}-description` : undefined,
            error ? `${inputId}-error` : undefined,
          ]
            .filter(Boolean)
            .join(" ") || undefined;
        return (
          <div className={styles.optionRow} key={key}>
            <div className={styles.optionHeading}>
              <span>
                {label} <code>{key}</code>
              </span>
              <Button
                size="middle"
                type="text"
                danger
                disabled={disabled || undefined}
                aria-label={t("dataConnect.optionEditor.remove", { key })}
                onClick={() => remove(key)}
              >
                {t("common.remove")}
              </Button>
            </div>
            {definition ? (
              <OptionInput
                disabled={disabled || undefined}
                onValidityChange={(valid) =>
                  setInvalidInputs((current) => {
                    if (current.has(key) === !valid) return current;
                    const next = new Set(current);
                    if (valid) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                id={inputId}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                definition={definition}
                value={entry}
                onChange={(next) => {
                  const updated = { ...options };
                  if (definition.kind === "positiveInteger" && definition.omitWhenEmpty) {
                    setAddedKeys((current) => new Set([...current, key]));
                    if (next === undefined) delete updated[key];
                    else updated[key] = next;
                  } else updated[key] = next;
                  onChange?.(Object.keys(updated).length ? updated : null);
                }}
              />
            ) : (
              <>
                <Alert type="warning" showIcon message={t("dataConnect.optionEditor.unknown")} />
                <pre className={styles.optionUnknown}>{JSON.stringify(entry, null, 2)}</pre>
              </>
            )}
            {hasDescription ? (
              <div id={`${inputId}-description`}>
                {definition?.hint ? (
                  <p className={styles.optionHint}>
                    {t(`dataConnect.optionEditor.hints.${definition.hint}`)}
                  </p>
                ) : null}
                {definition?.kind === "seconds" ? (
                  <p className={styles.optionHint}>{t("dataConnect.optionEditor.hints.seconds")}</p>
                ) : null}
                {definition?.kind === "text" && definition.allowEmpty ? (
                  <p className={styles.optionHint}>
                    {t("dataConnect.optionEditor.hints.emptyString")}
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <div className={styles.optionError} id={`${inputId}-error`} role="alert">
                {t(`dataConnect.optionEditor.errors.${error}`)}
              </div>
            ) : null}
          </div>
        );
      })}
      <Select<string>
        aria-label={t("dataConnect.optionEditor.add")}
        disabled={disabled || !available.length || undefined}
        placeholder={t("dataConnect.optionEditor.add")}
        value={null}
        options={available.map((definition) => ({
          label: `${t(`dataConnect.optionEditor.labels.${definition.label}`)} (${definition.key})`,
          value: definition.key,
        }))}
        onChange={(key) => {
          const definition = available.find((option) => option.key === key);
          if (!definition) return;
          if (definition.kind === "positiveInteger" && definition.omitWhenEmpty) {
            setAddedKeys((current) => new Set([...current, key]));
            if (detailsRef.current) detailsRef.current.open = true;
            return;
          }
          const initialValue =
            definition.kind === "text" ||
            definition.kind === "duration" ||
            definition.kind === "sessionTimeout"
              ? ""
              : undefined;
          onChange?.({ ...options, [key]: initialValue });
        }}
      />
    </details>
  );
}

function OptionInput({
  definition,
  value,
  onChange,
  onValidityChange,
  disabled,
  ...accessibility
}: {
  disabled?: boolean;
  onValidityChange?: (valid: boolean) => void;
  definition: ConnectorOptionDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation();
  const label = `${t(`dataConnect.optionEditor.labels.${definition.label}`)} (${definition.key})`;
  if (definition.kind === "positiveInteger") {
    return (
      <PositiveIntegerOptionInput
        {...accessibility}
        definition={definition}
        value={value}
        onChange={onChange}
        onValidityChange={onValidityChange}
        disabled={disabled}
        label={label}
      />
    );
  }
  if (definition.kind === "boolean") {
    const selected =
      typeof value === "boolean"
        ? String(value)
        : definition.acceptsStrings && typeof value === "string"
          ? value.trim().toLowerCase()
          : undefined;
    return (
      <Select
        {...accessibility}
        disabled={disabled || undefined}
        aria-label={label}
        value={selected}
        placeholder={t("dataConnect.optionEditor.chooseValue")}
        options={[
          { label: t("dataConnect.switchOn"), value: "true" },
          { label: t("dataConnect.switchOff"), value: "false" },
        ]}
        onChange={(next) => onChange(next === "true")}
      />
    );
  }
  if (definition.kind === "enum") {
    return (
      <Select
        {...accessibility}
        disabled={disabled || undefined}
        aria-label={label}
        value={
          typeof value === "string"
            ? value.trim()
            : definition.acceptsBoolean && typeof value === "boolean"
              ? String(value)
              : undefined
        }
        placeholder={t("dataConnect.optionEditor.chooseValue")}
        options={definition.values.map((option) => ({
          label: option === "" ? t("dataConnect.optionEditor.emptyValue") : option,
          value: option,
        }))}
        onChange={onChange}
      />
    );
  }
  if (definition.kind === "seconds") {
    return (
      <InputNumber
        {...accessibility}
        disabled={disabled || undefined}
        aria-label={label}
        min={0}
        max={9223372036}
        controls={false}
        value={typeof value === "number" || typeof value === "string" ? value : null}
        onChange={onChange}
      />
    );
  }
  return (
    <Input
      {...accessibility}
      disabled={disabled || undefined}
      aria-label={label}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      placeholder={
        definition.kind === "duration"
          ? "30s"
          : definition.kind === "sessionTimeout"
            ? "1000 / 1s"
            : undefined
      }
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function PositiveIntegerOptionInput({
  definition,
  value,
  onChange,
  onValidityChange,
  disabled,
  label,
  ...accessibility
}: {
  definition: Extract<ConnectorOptionDefinition, { kind: "positiveInteger" }>;
  value: unknown;
  onChange: (value: unknown) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  label: string;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation();
  const current = value === undefined ? "" : precisionPreservingValueText(value);
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const parse = (input: string) => {
    if (!/^[1-9]\d*$/.test(input)) return undefined;
    try {
      const number = parsePrecisionPreservingJSON(input);
      return validateConnectorOption(definition, number, {}) ? undefined : number;
    } catch {
      return undefined;
    }
  };
  const valid = (text === "" && !!definition.omitWhenEmpty) || parse(text) !== undefined;
  useEffect(() => onValidityChange?.(valid), [onValidityChange, valid]);
  return (
    <Input
      {...accessibility}
      disabled={disabled || undefined}
      aria-label={label}
      inputMode="numeric"
      value={text}
      status={valid ? undefined : "error"}
      placeholder={
        definition.placeholder
          ? t(`dataConnect.optionEditor.placeholders.${definition.placeholder}`)
          : undefined
      }
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next === "" && definition.omitWhenEmpty) onChange(undefined);
        else {
          const number = parse(next);
          if (number !== undefined) onChange(number);
        }
      }}
    />
  );
}
