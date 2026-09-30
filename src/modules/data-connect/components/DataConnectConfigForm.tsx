/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, InputNumber, Select, Switch } from "antd";
import type { Rule } from "antd/es/form";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { LimitedTagsSelect } from "@/framework/ui/common/LimitedTagsSelect";
import {
  normalizeVegaTag,
  validateVegaTag,
  validateVegaTags,
  VEGA_TAG_MAX_LENGTH,
  VEGA_TAGS_MAX_NUMBER,
  type VegaTagError,
} from "@/shared/catalog/vega-tags";

import {
  getConnectorFieldHint,
  getConnectorFieldPlaceholder,
  getConnectorTemplateMeta,
  groupConnectorFields,
  humanizeConnectorFieldLabel,
  isConnectorFieldRequired,
  isConnectorFieldVisible,
  isValidJSONObject,
  resolveConnectorFieldControl,
  type ConnectorFieldControl,
} from "@/modules/data-connect/lib/connector-template";
import type {
  DataConnectConnectorType,
  DataConnectHealthCheckScheduleMode,
} from "@/modules/data-connect/types/data-connect";
import { isHourlyCron } from "@/modules/data-connect/utils/health-check-cron";

import styles from "./DataConnectConfigForm.module.css";

type DataConnectConfigFormProps = {
  isEdit?: boolean;
  selectedConnectorType?: DataConnectConnectorType;
};

type SafeNamePath = string | number | Array<string | number>;

const NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;
const unicodeCount = (max: number) => ({
  max,
  strategy: (value: string) => Array.from(value).length,
  exceedFormatter: (value: string) => Array.from(value).slice(0, max).join(""),
});

export function DataConnectConfigForm({
  isEdit = false,
  selectedConnectorType,
}: DataConnectConfigFormProps) {
  const { t } = useTranslation();
  const healthCheckScheduleMode = Form.useWatch<DataConnectHealthCheckScheduleMode>([
    "healthCheckSchedule",
    "mode",
  ]);
  const connectorConfig = Form.useWatch<Record<string, unknown>>("connectorConfig");

  const groupedFields = groupConnectorFields(selectedConnectorType);

  const templateMeta = selectedConnectorType
    ? getConnectorTemplateMeta(selectedConnectorType)
    : null;

  const tagErrorMessage = (error: VegaTagError) => {
    switch (error) {
      case "count":
        return t("dataConnect.tagsMaxLength", { count: VEGA_TAGS_MAX_NUMBER });
      case "empty":
        return t("dataConnect.tagRequired");
      case "length":
        return t("dataConnect.tagLengthLimit", { count: VEGA_TAG_MAX_LENGTH });
      case "characters":
        return t("dataConnect.tagInvalidCharacters");
    }
  };

  const tagRules: Rule[] = [
    {
      validator: (_: unknown, value?: string[]) => {
        const tags = value ?? [];

        const error = validateVegaTags(tags);
        return error ? Promise.reject(new Error(tagErrorMessage(error))) : Promise.resolve();
      },
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h3 className={styles.title}>{t("dataConnect.configStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.configStepDescription")}</p>
        </div>
        {selectedConnectorType ? (
          <div className={styles.summary}>
            <span className={styles.summaryName}>{selectedConnectorType.name}</span>
            <span className={styles.summaryBadge}>{templateMeta?.label}</span>
          </div>
        ) : null}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t("dataConnect.basicInfoSection")}</div>
        <div className={styles.grid}>
          <InlineField
            label={t("dataConnect.name")}
            name="name"
            required
            rules={[
              { message: t("common.required"), required: true },
              {
                validator: (_, value?: string) =>
                  value && Array.from(value).length > NAME_MAX_LENGTH
                    ? Promise.reject(
                        new Error(t("dataConnect.nameLengthLimit", { count: NAME_MAX_LENGTH })),
                      )
                    : Promise.resolve(),
              },
            ]}
            span="half"
          >
            <Input
              count={unicodeCount(NAME_MAX_LENGTH)}
              placeholder={t("dataConnect.namePlaceholder")}
            />
          </InlineField>
          <InlineField
            label={t("common.status")}
            name="enabled"
            span="half"
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t("common.enabled")}
              disabled={isEdit}
              unCheckedChildren={t("common.disabled")}
            />
          </InlineField>
          <InlineField
            align="start"
            label={t("common.description")}
            name="description"
            rules={[
              {
                validator: (_, value?: string) =>
                  value && Array.from(value).length > DESCRIPTION_MAX_LENGTH
                    ? Promise.reject(
                        new Error(
                          t("dataConnect.descriptionLengthLimit", {
                            count: DESCRIPTION_MAX_LENGTH,
                          }),
                        ),
                      )
                    : Promise.resolve(),
              },
            ]}
            span="full"
          >
            <Input.TextArea
              count={unicodeCount(DESCRIPTION_MAX_LENGTH)}
              placeholder={t("dataConnect.descriptionPlaceholder")}
              rows={2}
            />
          </InlineField>
          <InlineField
            extra={t("dataConnect.tagsHint")}
            label={t("dataConnect.tags")}
            name="tags"
            rules={tagRules}
            span="full"
          >
            <LimitedTagsSelect
              limit={VEGA_TAGS_MAX_NUMBER}
              limitMessage={tagErrorMessage("count")}
              normalizeTag={normalizeVegaTag}
              open={false}
              placeholder={t("dataConnect.tagsPlaceholder")}
              validateTag={(tag) => {
                const error = validateVegaTag(tag);
                return error ? tagErrorMessage(error) : null;
              }}
            />
          </InlineField>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t("dataConnect.connectorConfigSection")}</div>
        <div className={styles.groupStack}>
          {groupedFields.map((group) => (
            <ConnectorFieldGroup
              connectorConfig={connectorConfig}
              connectorType={selectedConnectorType?.type}
              group={group}
              isEdit={isEdit}
              key={group.key}
            />
          ))}
        </div>
      </section>
      {!isEdit ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t("dataConnect.healthCheckSchedule.title")}</div>
          <div className={styles.grid}>
            <InlineField
              extra={t("dataConnect.healthCheckSchedule.modeHint")}
              label={t("dataConnect.healthCheckSchedule.mode")}
              name={["healthCheckSchedule", "mode"]}
              required
              rules={[{ message: t("common.required"), required: true }]}
              span="half"
            >
              <Select
                options={(["inherit", "enabled", "disabled"] as const).map((value) => ({
                  label: t(`dataConnect.healthCheckSchedule.modes.${value}`),
                  value,
                }))}
              />
            </InlineField>
            {healthCheckScheduleMode === "enabled" ? (
              <InlineField
                extra={t("dataConnect.healthCheckSchedule.cronHint")}
                label={t("dataConnect.healthCheckSchedule.cronExpr")}
                name={["healthCheckSchedule", "cronExpr"]}
                required
                rules={[
                  { message: t("common.required"), required: true },
                  {
                    validator: (_, value: unknown) => {
                      if (isHourlyCron(value)) {
                        return Promise.resolve();
                      }

                      return Promise.reject(
                        new Error(t("dataConnect.healthCheckSchedule.cronInvalid")),
                      );
                    },
                  },
                ]}
                span="half"
              >
                <Input placeholder={t("dataConnect.healthCheckSchedule.cronPlaceholder")} />
              </InlineField>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type ConnectorFieldGroupProps = {
  connectorConfig?: Record<string, unknown>;
  connectorType?: string;
  group: ReturnType<typeof groupConnectorFields>[number];
  isEdit: boolean;
};

function ConnectorFieldGroup({
  connectorConfig,
  connectorType,
  group,
  isEdit,
}: ConnectorFieldGroupProps) {
  const { t } = useTranslation();
  const visibleFields = group.fields.filter(([fieldName]) =>
    isConnectorFieldVisible(connectorType, fieldName, connectorConfig),
  );

  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div className={styles.group}>
      <div className={styles.groupTitle}>{group.title}</div>
      <div className={styles.grid}>
        {visibleFields.map(([fieldName, fieldConfig]) => {
          const control = resolveConnectorFieldControl(fieldName, fieldConfig.type, connectorType);
          const label = humanizeConnectorFieldLabel(fieldName, connectorType);
          const required = isConnectorFieldRequired(
            connectorType,
            fieldName,
            fieldConfig.required,
            connectorConfig,
          );
          const fieldHint = getConnectorFieldHint(fieldName, connectorType);

          return (
            <InlineField
              align={control.kind === "json" ? "start" : "center"}
              extra={
                isEdit && fieldConfig.encrypted
                  ? t("dataConnect.encryptedFieldEditHint")
                  : fieldHint
              }
              key={fieldName}
              label={label}
              name={["connectorConfig", fieldName]}
              required={required}
              rules={[
                { message: t("common.required"), required },
                ...(control.kind === "json"
                  ? [
                      {
                        validator: (_: unknown, value: unknown) =>
                          isValidJSONObject(value)
                            ? Promise.resolve()
                            : Promise.reject(new Error(t("dataConnect.jsonObjectInvalid"))),
                      },
                    ]
                  : []),
              ]}
              span={control.kind === "json" || control.kind === "tags" ? "full" : "half"}
              valuePropName={control.kind === "switch" ? "checked" : "value"}
            >
              {renderField({
                connectorType,
                control,
                encrypted: fieldConfig.encrypted,
                encryptedPlaceholder: t("dataConnect.encryptedFieldPlaceholder", {
                  field: label,
                }),
                fieldName,
                fieldType: fieldConfig.type,
                selectPlaceholder: t("dataConnect.selectFieldPlaceholder", {
                  field: label,
                }),
                switchOff: t("dataConnect.switchOff"),
                switchOn: t("dataConnect.switchOn"),
              })}
            </InlineField>
          );
        })}
      </div>
    </div>
  );
}

type InlineFieldProps = {
  align?: "center" | "start";
  children: ReactNode;
  extra?: string;
  label: string;
  name: SafeNamePath;
  required?: boolean;
  rules?: Rule[];
  span?: "full" | "half";
  valuePropName?: string;
};

function InlineField({
  align = "center",
  children,
  extra,
  label,
  name,
  required = false,
  rules,
  span = "half",
  valuePropName,
}: InlineFieldProps) {
  return (
    <div
      className={[
        styles.field,
        span === "full" ? styles.spanFull : styles.spanHalf,
        align === "start" ? styles.fieldStart : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label className={styles.fieldLabel}>
        {required ? <span className={styles.requiredMark}>*</span> : null}
        <span>{label}</span>
      </label>
      <div className={styles.fieldBody}>
        <Form.Item
          className={styles.fieldItem}
          extra={extra}
          name={name}
          rules={rules}
          valuePropName={valuePropName}
        >
          {children}
        </Form.Item>
      </div>
    </div>
  );
}

function renderField(options: {
  connectorType?: string;
  control: ConnectorFieldControl;
  encrypted: boolean;
  encryptedPlaceholder: string;
  fieldName: string;
  fieldType: string;
  selectPlaceholder: string;
  switchOff: string;
  switchOn: string;
}) {
  const {
    connectorType,
    control,
    encrypted,
    encryptedPlaceholder,
    fieldName,
    fieldType,
    selectPlaceholder,
    switchOff,
    switchOn,
  } = options;

  if (encrypted) {
    return <Input.Password placeholder={encryptedPlaceholder} />;
  }

  const placeholder = getConnectorFieldPlaceholder(fieldName, fieldType, connectorType);

  switch (control.kind) {
    case "number":
      return (
        <InputNumber className={styles.numberInput} controls={false} placeholder={placeholder} />
      );
    case "switch":
      return <Switch checkedChildren={switchOn} unCheckedChildren={switchOff} />;
    case "select":
      return <Select allowClear options={control.options} placeholder={selectPlaceholder} />;
    case "tags":
      return <Select mode="tags" open={false} placeholder={placeholder} />;
    case "json":
      return <Input.TextArea placeholder={placeholder} rows={3} />;
    default:
      return <Input placeholder={placeholder} />;
  }
}
