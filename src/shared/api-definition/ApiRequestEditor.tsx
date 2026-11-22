/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Input, Select, Switch } from "antd";
import { useId, type ReactNode } from "react";
import { ApiBodyEditor } from "./ApiBodyEditor";
import { ApiQueryParameterEditor } from "./ApiQueryParameterEditor";
import { ObjectValueEditor } from "./ApiValueEditor";
import { useTranslation } from "react-i18next";
import { EditorValidity } from "./EditorValidity";
import { objectValue, replaceMember } from "./model";
import type { ApiDefinitionEditorProps } from "./types";
import { useArrayEditorItems } from "./use-editor-items";
import styles from "./editor.module.css";

export function ApiRequestEditor({
  value = {},
  onChange,
  disabled,
  variableNames = [],
  enableJsonSerialization,
  onValidityChange,
}: ApiDefinitionEditorProps & { variableNames?: string[]; enableJsonSerialization?: boolean }) {
  const { t } = useTranslation();
  const bodyLabelId = useId();
  const request = value;
  const changeRequest = (key: string, next: unknown) => onChange(replaceMember(value, key, next));
  const parameters: unknown[] = Array.isArray(request.parameters) ? request.parameters : [];
  const parameterItems = useArrayEditorItems(parameters);
  const field = (title: string, node: ReactNode) => (
    <label className={styles.field}>
      <span className={styles.fieldTitle}>{title}</span>
      {node}
    </label>
  );
  return (
    <EditorValidity onValidityChange={onValidityChange}>
      <div className={styles.stack}>
        <div className={`${styles.grid} ${styles.requestTarget}`}>
          {field(
            t("dataConnect.apiEditor.method"),
            <Select
              aria-label={t("dataConnect.apiEditor.method")}
              disabled={disabled}
              value={typeof request.method === "string" ? request.method : undefined}
              options={["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
                (value) => ({ value, label: value }),
              )}
              onChange={(next) => changeRequest("method", next)}
            />,
          )}
          {field(
            t("dataConnect.apiEditor.path"),
            <Input
              aria-label={t("dataConnect.apiEditor.path")}
              disabled={disabled}
              value={typeof request.path === "string" ? request.path : ""}
              placeholder="auth/login"
              onChange={(event) => changeRequest("path", event.target.value)}
            />,
          )}
        </div>
        <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.headers")}</span>
        <ObjectValueEditor
          value={objectValue(request.headers)}
          label={t("dataConnect.apiEditor.headers")}
          nameLabel={t("dataConnect.apiEditor.headerName")}
          disabled={disabled}
          onChange={(next) => changeRequest("headers", next)}
          renderValue={(name, entry, next) => (
            <label className={styles.inlineField}>
              <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.headerValue")}</span>
              <Input
                aria-label={`${t("dataConnect.apiEditor.headerValue")} ${name}`}
                disabled={disabled}
                value={typeof entry === "string" ? entry : ""}
                onChange={(event) => next(event.target.value)}
              />
            </label>
          )}
        />
        <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.parameters")}</span>
        {parameters.map((entry, index) => (
          <ApiQueryParameterEditor
            key={parameterItems.keys[index]}
            value={objectValue(entry)}
            onChange={(next) => changeRequest("parameters", parameterItems.replace(index, next))}
            onRemove={() => changeRequest("parameters", parameterItems.remove(index))}
            disabled={disabled}
            variableNames={variableNames}
            label={`${t("dataConnect.apiEditor.parameters")} ${index + 1}`}
          />
        ))}
        <Button
          disabled={disabled}
          onClick={() =>
            changeRequest("parameters", parameterItems.append({ name: "", value: "" }))
          }
        >
          {t("dataConnect.apiEditor.addParameter")}
        </Button>
        <div className={styles.bodyToggle}>
          <span className={styles.fieldTitle} id={bodyLabelId}>
            {t("dataConnect.apiEditor.body")}
          </span>
          <Switch
            aria-labelledby={bodyLabelId}
            disabled={disabled}
            checked={Object.hasOwn(request, "body")}
            onChange={(checked) =>
              changeRequest("body", checked ? { type: "object", properties: {} } : undefined)
            }
          />
        </div>
        {Object.hasOwn(request, "body") ? (
          <ApiBodyEditor
            value={objectValue(request.body)}
            disabled={disabled}
            enableJsonSerialization={enableJsonSerialization}
            label={t("dataConnect.apiEditor.body")}
            onChange={(next) => changeRequest("body", next)}
          />
        ) : null}
      </div>
    </EditorValidity>
  );
}
