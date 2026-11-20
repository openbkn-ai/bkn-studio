/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Popover, Select, Switch, Tabs } from "antd";
import { Fragment, useId, useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import {
  parsePrecisionPreservingJSON,
  precisionPreservingValueText,
} from "@/framework/request/precision-safe-json";
import {
  ApiRequestEditor,
  ApiResponseEditor,
  ApiSuccessRuleEditor,
  ApiVariableEditor,
} from "@/shared/api-definition";
import { objectValue, replaceMember, type DefinitionObject } from "@/shared/api-definition/model";
import { EditorValidity } from "@/shared/api-definition/EditorValidity";
import apiEditorStyles from "@/shared/api-definition/editor.module.css";
import type { ApiResourceInput, ApiResourceField } from "../types/api-resource";
import viewStyles from "../scenes/ViewEditorScene.module.css";
import styles from "./ApiResourceEditor.module.css";
import { OutputFieldActions } from "./OutputFieldActions";

type Props = {
  value: ApiResourceInput;
  onChange: (value: ApiResourceInput) => void;
  disabled?: boolean;
  onValidityChange: (valid: boolean) => void;
  catalogVariableNames?: string[];
};

function DecimalFieldSettings({
  attributes,
  onChange,
  disabled,
}: {
  attributes: ApiResourceField["attributes"];
  onChange: (attributes: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const trigger = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const precisionInput = useRef<ComponentRef<typeof InputNumber>>(null);
  const [open, setOpen] = useState(false);
  const visible = open && !disabled;
  const title = t("dataCatalog.apiResource.decimalSettings");
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <Popover
      trigger="click"
      placement="bottom"
      open={visible}
      onOpenChange={(next) => setOpen(next && !disabled)}
      afterOpenChange={(next) => {
        if (next) precisionInput.current?.focus({ preventScroll: true });
      }}
      destroyOnHidden
      content={
        <div
          id={id}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className={styles.decimalSettings}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className={styles.decimalSettingsHeader}>
            <strong id={`${id}-title`}>{title}</strong>
            <Button
              aria-label={t("dataCatalog.apiResource.decimalSettingsClose")}
              icon={<CloseOutlined />}
              onClick={close}
              size="small"
              type="text"
            />
          </div>
          {(["precision", "scale"] as const).map((key) => (
            <Fragment key={key}>
              <label htmlFor={`${id}-${key}`}>{t(`dataCatalog.apiResource.${key}`)}</label>
              <InputNumber<string>
                id={`${id}-${key}`}
                ref={key === "precision" ? precisionInput : undefined}
                stringMode
                disabled={disabled}
                value={
                  attributes?.[key] == null ? null : precisionPreservingValueText(attributes[key])
                }
                onChange={(next) =>
                  onChange({
                    ...attributes,
                    [key]: next === null ? null : parsePrecisionPreservingJSON(next),
                  })
                }
              />
            </Fragment>
          ))}
        </div>
      }
    >
      <span>
        <Button
          ref={trigger}
          aria-label={title}
          aria-haspopup="dialog"
          aria-expanded={visible}
          aria-controls={visible ? id : undefined}
          title={title}
          disabled={disabled}
          icon={<SettingOutlined />}
          size="small"
        />
      </span>
    </Popover>
  );
}

function ResponseExtractionFields({
  value,
  onChange,
  disabled,
}: {
  value: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const hintId = useId();
  return (
    <div className={styles.stack}>
      <p className={styles.cardHint} id={hintId}>
        {t("dataCatalog.apiResource.extractionHint")}
      </p>
      {(["result_rows", "result_total"] as const).map((key) => {
        const enabled = Object.hasOwn(value, key);
        const labelId = `${hintId}-${key}`;
        return (
          <div className={styles.field} key={key}>
            <div className={`${styles.field} ${styles.inlineToggle}`}>
              <span id={labelId}>{t(`dataCatalog.apiResource.${key}`)}</span>
              <Switch
                aria-labelledby={labelId}
                disabled={disabled}
                checked={enabled}
                onChange={(checked) =>
                  onChange(replaceMember(value, key, checked ? "" : undefined))
                }
              />
            </div>
            {enabled ? (
              <Input
                aria-labelledby={labelId}
                aria-describedby={hintId}
                disabled={disabled}
                value={typeof value[key] === "string" ? value[key] : ""}
                onChange={(event) => onChange(replaceMember(value, key, event.target.value))}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ApiResourceDefinitionEditor({
  value,
  onChange,
  disabled,
  onValidityChange,
  catalogVariableNames = [],
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const outputTitleId = useId();
  const pagingParametersId = useId();
  const pagingModeId = `${pagingParametersId}-mode`;
  const definition = value.api_definition;
  const change = (key: string, next: unknown) =>
    onChange({ ...value, api_definition: replaceMember(definition, key, next) });
  const variables = objectValue(definition.variables);
  const changeField = (index: number, patch: Partial<ApiResourceField>) =>
    onChange({
      ...value,
      schema_definition: value.schema_definition.map((field, position) =>
        position === index ? { ...field, ...patch } : field,
      ),
    });
  const paging = objectValue(definition.paging_rule);
  const pagingEnabled = Object.hasOwn(definition, "paging_rule");
  const pagingVariables =
    paging.mode === "offset" || paging.mode === "page"
      ? [`__paging.${paging.mode}`, "__paging.limit"]
      : [];
  const pagingField = (key: string, next: unknown) =>
    change("paging_rule", { ...paging, [key]: next });
  const fields = value.schema_definition;
  const replaceFields = (schema_definition: ApiResourceField[]) =>
    onChange({ ...value, schema_definition });
  const moveField = (index: number, next: number) => {
    const reordered = [...fields];
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    replaceFields(reordered);
  };
  const columns = ["originalName", "fieldName", "displayName", "fieldType", "filterable"];
  const types = [
    "string",
    "text",
    "integer",
    "unsigned integer",
    "large_integer",
    "float",
    "decimal",
    "boolean",
    "date",
    "time",
    "datetime",
    "timestamp",
    "json",
  ].map((type) => ({ value: type, label: type }));
  const apiInfo = (
    <section
      className={`${viewStyles.configSection} ${viewStyles.configGroup} ${styles.apiInfo}`}
      aria-labelledby={titleId}
    >
      <h3 id={titleId}>{t("dataCatalog.apiResource.definition")}</h3>
      <Tabs
        renderTabBar={(props, DefaultTabBar) => (
          <div
            ref={(node) => {
              node?.querySelector('[role="tablist"]')?.setAttribute("aria-labelledby", titleId);
            }}
          >
            <DefaultTabBar {...props} />
          </div>
        )}
        items={[
          {
            key: "variables",
            label: t("dataCatalog.apiResource.variables"),
            forceRender: true,
            children: (
              <ApiVariableEditor
                value={definition.variables}
                onChange={(next) => change("variables", next)}
                disabled={disabled}
                isEdit
                hint={t("dataCatalog.apiResource.variablesHint")}
                emptyDescription={t("dataCatalog.apiResource.notConfigured")}
                storedValueHint={t("dataCatalog.apiResource.storedVariable")}
              />
            ),
          },
          {
            key: "request",
            label: t("dataCatalog.apiResource.request"),
            forceRender: true,
            children: (
              <div className={styles.stack}>
                <p>{t("dataCatalog.apiResource.requestHint")}</p>
                <ApiRequestEditor
                  value={objectValue(definition.request)}
                  onChange={(next) => change("request", next)}
                  disabled={disabled}
                  enableJsonSerialization
                  variableNames={[
                    ...new Set([...catalogVariableNames, ...Object.keys(variables)]),
                    ...[...catalogVariableNames, ...Object.keys(variables)].map(
                      (name) => `__variables.${name}`,
                    ),
                    ...pagingVariables,
                  ]}
                />
              </div>
            ),
          },
          {
            key: "response",
            label: t("dataCatalog.apiResource.response"),
            forceRender: true,
            children: (
              <ApiResponseEditor
                value={objectValue(definition.response)}
                onChange={(next) => change("response", next)}
                disabled={disabled}
                enableOneOf
                renderResponseFields={(response, next) => (
                  <ResponseExtractionFields value={response} onChange={next} disabled={disabled} />
                )}
              />
            ),
          },
          {
            key: "success",
            label: t("dataCatalog.apiResource.success"),
            forceRender: true,
            children: (
              <ApiSuccessRuleEditor
                value={objectValue(definition.success_rule)}
                onChange={(next) => change("success_rule", next)}
                disabled={disabled}
              />
            ),
          },
          {
            key: "paging",
            label: t("dataCatalog.apiResource.paging"),
            forceRender: true,
            children: (
              <div className={styles.stack}>
                <label className={`${styles.field} ${styles.inlineToggle}`}>
                  <span>{t("dataCatalog.apiResource.paging")}</span>
                  <Switch
                    aria-controls={pagingEnabled ? pagingParametersId : undefined}
                    disabled={disabled}
                    checked={pagingEnabled}
                    onChange={(checked) =>
                      change(
                        "paging_rule",
                        checked ? { mode: "offset", default_limit: 20, max_limit: 100 } : undefined,
                      )
                    }
                  />
                </label>
                {pagingEnabled ? (
                  <div
                    id={pagingParametersId}
                    className={`${apiEditorStyles.member} ${styles.pagingCard}`}
                    role="group"
                    aria-label={t("dataCatalog.apiResource.paging")}
                  >
                    <div className={styles.pagingParameters}>
                      <label htmlFor={pagingModeId}>
                        {t("dataCatalog.apiResource.pagingMode")}
                      </label>
                      <Select
                        id={pagingModeId}
                        className={styles.pagingModeSelect}
                        disabled={disabled}
                        value={paging.mode as string}
                        options={["offset", "page"].map((value) => ({ value, label: value }))}
                        onChange={(mode) =>
                          change(
                            "paging_rule",
                            mode === "page"
                              ? { ...paging, mode, page_base: paging.page_base ?? 1 }
                              : replaceMember({ ...paging, mode }, "page_base", undefined),
                          )
                        }
                      />
                      {[
                        "default_limit",
                        "max_limit",
                        ...(paging.mode === "page" ? ["page_base"] : []),
                      ].map((key) => {
                        const id = `${pagingParametersId}-${key}`;
                        return (
                          <Fragment key={key}>
                            <label htmlFor={id}>{t(`dataCatalog.apiResource.${key}`)}</label>
                            <InputNumber
                              id={id}
                              disabled={disabled}
                              value={paging[key] as number}
                              onChange={(next) => pagingField(key, next)}
                            />
                          </Fragment>
                        );
                      })}
                    </div>
                    <p className={apiEditorStyles.hint}>
                      {t("dataCatalog.apiResource.pagingHint")}
                    </p>
                  </div>
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </section>
  );
  return (
    <EditorValidity onValidityChange={onValidityChange}>
      {apiInfo}
      <section
        className={`${viewStyles.configSection} ${viewStyles.configGroup}`}
        aria-labelledby={outputTitleId}
      >
        <h3 id={outputTitleId}>{t("dataCatalog.apiResource.outputFields")}</h3>
        <p className={styles.cardHint}>{t("dataCatalog.apiResource.mappingHint")}</p>
        {fields.length > 0 ? (
          <div className={viewStyles.tableScroll}>
            <table
              className={`${viewStyles.fieldTable} ${styles.outputTable}`}
              aria-labelledby={outputTitleId}
            >
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column} scope="col">
                      {t(`dataCatalog.apiResource.${column}`)}
                    </th>
                  ))}
                  <th scope="col">{t("common.description")}</th>
                  <th scope="col">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={index}>
                    <td>
                      <Input
                        disabled={disabled}
                        aria-label={t("dataCatalog.apiResource.originalName")}
                        value={field.original_name}
                        onChange={(event) =>
                          changeField(index, { original_name: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        disabled={disabled}
                        aria-label={t("dataCatalog.apiResource.fieldName")}
                        value={field.name}
                        onChange={(event) => changeField(index, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <Input
                        disabled={disabled}
                        aria-label={t("dataCatalog.apiResource.displayName")}
                        value={field.display_name ?? ""}
                        onChange={(event) =>
                          changeField(index, { display_name: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <div className={styles.outputFieldType}>
                        <Select
                          disabled={disabled}
                          aria-label={t("dataCatalog.apiResource.fieldType")}
                          value={field.type}
                          options={types}
                          onChange={(type) =>
                            changeField(index, {
                              type,
                              ...(type === "decimal" && field.type !== "decimal"
                                ? {
                                    attributes: {
                                      ...field.attributes,
                                      precision: field.attributes?.precision ?? 18,
                                      scale: field.attributes?.scale ?? 2,
                                    },
                                  }
                                : {}),
                            })
                          }
                        />
                        {field.type === "decimal" ? (
                          <DecimalFieldSettings
                            attributes={field.attributes}
                            disabled={disabled}
                            onChange={(attributes) => changeField(index, { attributes })}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <Switch
                        aria-label={
                          field.name
                            ? t("dataCatalog.resource.fieldFilterableLabel", { name: field.name })
                            : t("dataCatalog.apiResource.filterable")
                        }
                        size="small"
                        disabled={disabled}
                        checked={field.filterable === true}
                        onChange={(filterable) => changeField(index, { filterable })}
                      />
                    </td>
                    <td>
                      <Input
                        disabled={disabled}
                        aria-label={t("common.description")}
                        value={field.description ?? ""}
                        onChange={(event) =>
                          changeField(index, { description: event.target.value })
                        }
                      />
                    </td>
                    <td className={viewStyles.fieldActions}>
                      <OutputFieldActions
                        canMoveUp={index > 0}
                        canMoveDown={index < fields.length - 1}
                        disabled={disabled}
                        onMove={(direction) => moveField(index, index + direction)}
                        onRemove={() =>
                          replaceFields(fields.filter((_, position) => position !== index))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div>
          <Button
            disabled={disabled}
            onClick={() =>
              replaceFields([
                ...fields,
                { name: "", original_name: "", type: "string", filterable: false },
              ])
            }
          >
            {t("dataCatalog.apiResource.addField")}
          </Button>
        </div>
      </section>
    </EditorValidity>
  );
}
