/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Form, Input, InputNumber, Select } from "antd";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  getConnectorOptionDefinitions,
  normalizeConnectorOptionKey,
  readConnectorOptions,
  validateConnectorOption,
  type ConnectorOptionDefinition,
} from "@/modules/data-connect/lib/connector-options";

import styles from "./DataConnectConfigForm.module.css";

type ConnectorOptionsEditorProps = {
  connectorType?: string;
  id?: string;
  value?: unknown;
  onChange?: (value: Record<string, unknown> | string | null) => void;
};

export function ConnectorOptionsEditor({
  connectorType,
  id,
  value,
  onChange,
}: ConnectorOptionsEditorProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const { errors } = Form.Item.useStatus();
  const detailsRef = useRef<HTMLDetailsElement>(null);
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
  const selected = new Set<string>();
  const duplicateKeys = new Set<string>();
  for (const [key] of entries) {
    const normalized = normalizeConnectorOptionKey(connectorType, key);
    if (selected.has(normalized)) duplicateKeys.add(key);
    selected.add(normalized);
  }
  const available = definitions.filter((definition) => !selected.has(definition.key));
  const remove = (key: string) => {
    const remaining = Object.fromEntries(entries.filter(([entryKey]) => entryKey !== key));
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
          : definition
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
                size="small"
                type="text"
                aria-label={t("dataConnect.optionEditor.remove", { key })}
                onClick={() => remove(key)}
              >
                {t("common.remove")}
              </Button>
            </div>
            {definition ? (
              <OptionInput
                id={inputId}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                definition={definition}
                value={entry}
                onChange={(next) => onChange?.({ ...options, [key]: next })}
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
        disabled={!available.length}
        placeholder={t("dataConnect.optionEditor.add")}
        value={null}
        options={available.map((definition) => ({
          label: `${t(`dataConnect.optionEditor.labels.${definition.label}`)} (${definition.key})`,
          value: definition.key,
        }))}
        onChange={(key) => {
          const definition = available.find((option) => option.key === key);
          if (!definition) return;
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
  ...accessibility
}: {
  definition: ConnectorOptionDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const { t } = useTranslation();
  const label = `${t(`dataConnect.optionEditor.labels.${definition.label}`)} (${definition.key})`;
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
