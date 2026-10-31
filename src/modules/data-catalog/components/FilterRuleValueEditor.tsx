/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Input, Select, Space, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";
import { FieldIdentity } from "./FieldIdentity";
import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";
import {
  compatibleFilterFields,
  FILTER_TIME_UNITS,
  filterSupportsFieldValue,
  filterValueKind,
  type FilterQueryPath,
  type FilterRule,
} from "@/modules/data-catalog/lib/filter-tree";
import styles from "./FilterTreeEditor.module.css";

type Props = {
  rule: FilterRule;
  field?: ResourceSchemaField;
  fields: ResourceSchemaField[];
  queryPath: FilterQueryPath;
  onChange: (rule: FilterRule) => void;
};

export function FilterRuleValueEditor({ rule, field, fields, queryPath, onChange }: Props) {
  const { t } = useTranslation();
  const kind = filterValueKind(rule.operation);
  const type = field?.type.trim().toLowerCase();
  const values = Array.isArray(rule.value) ? rule.value : [];
  const updateValue = (value: FilterRule["value"]) => onChange({ ...rule, value });
  const timeHelp = (hint: "datetimeHint" | "relativeTimeHint") => (
    <Tooltip title={t(`dataCatalog.filter.${hint}`)} trigger={["hover", "focus", "click"]}>
      <button
        className={styles.hintTrigger}
        type="button"
        aria-label={t("dataCatalog.filter.timeHelp")}
      >
        <QuestionCircleOutlined />
      </button>
    </Tooltip>
  );
  const stringInput =
    ["string", "text"].includes(type ?? "") ||
    (type === "large_integer" && queryPath === "local_index");
  const input = (value: string | undefined, label: string, update: (value: string) => void) =>
    type === "boolean" ? (
      <Select
        aria-label={label}
        value={value || undefined}
        placeholder={label}
        onChange={update}
        options={[
          { label: "true", value: "true" },
          { label: "false", value: "false" },
        ]}
      />
    ) : (
      <Input
        aria-label={label}
        type={type === "date" ? "date" : "text"}
        value={value ?? ""}
        onChange={(event) => update(event.target.value)}
        placeholder={
          type === "datetime"
            ? t("dataCatalog.filter.datetimePlaceholder")
            : stringInput && value === ""
              ? t("dataCatalog.filter.emptyString")
              : label
        }
        suffix={
          type === "datetime" ? (
            timeHelp("datetimeHint")
          ) : stringInput ? (
            <Tooltip title={t("dataCatalog.filter.useEmptyString")}>
              <button
                type="button"
                className={styles.hintTrigger}
                aria-label={t("dataCatalog.filter.useEmptyString")}
                onClick={() => update("")}
              >
                {'""'}
              </button>
            </Tooltip>
          ) : undefined
        }
      />
    );
  const unitOptions = FILTER_TIME_UNITS.map((unit) => ({
    label: t(`dataCatalog.filter.units.${unit}`),
    value: unit,
  }));
  const rightFields = field ? compatibleFilterFields(field, fields, rule.operation, queryPath) : [];
  return (
    <div className={styles.valueEditor}>
      {filterSupportsFieldValue(rule.operation) ? (
        <Space.Compact block className={styles.combinedValue}>
          <Select
            aria-label={t("dataCatalog.filter.valueSource")}
            className={styles.valueSourceSelect}
            popupMatchSelectWidth={false}
            value={rule.valueFrom ?? "const"}
            onChange={(valueFrom: "const" | "field") =>
              onChange({ ...rule, valueFrom, value: undefined })
            }
            options={[
              { label: t("dataCatalog.filter.constant"), value: "const" },
              { label: t("dataCatalog.filter.field"), value: "field" },
            ]}
          />
          {rule.valueFrom === "field" ? (
            <Select
              aria-label={t("dataCatalog.filter.rightField")}
              className={styles.fieldSelect}
              value={typeof rule.value === "string" ? rule.value || undefined : undefined}
              showSearch
              optionFilterProp="searchText"
              placeholder={t("dataCatalog.filter.rightField")}
              onChange={(value: string) => updateValue(value)}
              options={rightFields.map((candidate) => ({
                label: (
                  <FieldIdentity
                    field={candidate}
                    name={candidate.name}
                    layout="inline"
                    showNameWhenSame
                  />
                ),
                searchText: `${candidate.displayName ?? ""} ${candidate.name} ${candidate.type}`,
                value: candidate.name,
              }))}
            />
          ) : (
            input(
              typeof rule.value === "string" ? rule.value : undefined,
              t("dataCatalog.filter.value"),
              updateValue,
            )
          )}
        </Space.Compact>
      ) : kind === "none" ? (
        <span className={styles.noValueHint}>{t("dataCatalog.filter.noValue")}</span>
      ) : kind === "before" ? (
        <div className={styles.valueRow}>
          <Input
            aria-label={t("dataCatalog.filter.interval")}
            inputMode="numeric"
            value={values[0] ?? ""}
            onChange={(event) => updateValue([event.target.value, values[1] ?? ""])}
          />
          <Select
            aria-label={t("dataCatalog.filter.timeUnit")}
            value={values[1] || undefined}
            options={unitOptions}
            onChange={(unit: string) => updateValue([values[0] ?? "", unit])}
          />
          {timeHelp("relativeTimeHint")}
        </div>
      ) : kind === "current" ? (
        <div className={styles.valueRow}>
          <Select
            aria-label={t("dataCatalog.filter.timeUnit")}
            value={typeof rule.value === "string" ? rule.value || undefined : undefined}
            options={unitOptions}
            onChange={(unit: string) => updateValue(unit)}
          />
          {timeHelp("relativeTimeHint")}
        </div>
      ) : kind === "set" || kind === "range" ? (
        <div className={styles.valueList}>
          {(kind === "range" ? [values[0], values[1]] : values).map((value, index) => (
            <div className={styles.valueRow} key={index}>
              {input(
                value,
                kind === "range"
                  ? t(`dataCatalog.filter.${index === 0 ? "lowerBound" : "upperBound"}`)
                  : `${t("dataCatalog.filter.value")} ${index + 1}`,
                (next) => {
                  const updated = [...values];
                  updated[index] = next;
                  updateValue(updated);
                },
              )}
              {kind === "set" ? (
                <AppButton
                  type="link"
                  aria-label={`${t("dataCatalog.filter.removeValue")} ${index + 1}`}
                  onClick={() => updateValue(values.filter((_, position) => position !== index))}
                >
                  {t("dataCatalog.filter.removeValue")}
                </AppButton>
              ) : null}
            </div>
          ))}
          {kind === "set" ? (
            <AppButton type="link" onClick={() => updateValue([...values, undefined])}>
              {t("dataCatalog.filter.addValue")}
            </AppButton>
          ) : (
            <span className={styles.valueHint}>
              {t(
                rule.operation === "out_range"
                  ? "dataCatalog.filter.outRangeHint"
                  : "dataCatalog.filter.rangeHint",
              )}
            </span>
          )}
        </div>
      ) : (
        input(
          typeof rule.value === "string" ? rule.value : undefined,
          t("dataCatalog.filter.value"),
          updateValue,
        )
      )}
      {["contain", "not_contain"].includes(rule.operation) ? (
        <span className={styles.valueHint}>
          {t(
            queryPath === "source"
              ? "dataCatalog.filter.containSourceHint"
              : "dataCatalog.filter.containIndexHint",
          )}
        </span>
      ) : null}
      {["like", "not_like"].includes(rule.operation) ? (
        <span className={styles.valueHint}>{t("dataCatalog.filter.substringHint")}</span>
      ) : null}
    </div>
  );
}
