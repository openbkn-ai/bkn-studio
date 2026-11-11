/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined } from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Checkbox,
  Collapse,
  Form,
  Input,
  Select,
  Tag,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  LengthInputs,
  RangeInputs,
} from "@/modules/knowledge-network/components/value-type/RangeInputs";
import { describeValueTypeRules } from "@/modules/knowledge-network/components/value-type/value-type-text";
import type {
  ObjectTypeDataProperty,
  PropertyConstraints,
  PropertySemantic,
  ValueType,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  ALIAS_SEPARATORS,
  aliasProblem,
  constraintFieldsForType,
  crsApplies,
  hasDeclarations,
  isTimezoneName,
  knownTimezoneNames,
  MAX_ALIAS_LENGTH,
  MAX_PROPERTY_ALIASES,
  normalizeConstraints,
  PROPERTY_CRS_VALUES,
  semanticHolders,
  semanticsForType,
  valueTypesForPropertyType,
  withValueType,
  type ClearedDeclarationName,
} from "@/modules/knowledge-network/utils/property-declarations";

import styles from "./PropertyDeclarationsSection.module.css";

const PREFIX = "knowledgeNetwork.propertyDeclarations";
const PANEL_KEY = "declarations";
const CONSTRAINTS: ["declarations", "constraints"] = ["declarations", "constraints"];
const TIMEZONE_OPTION_LIMIT = 40;
/** The inline rules a value type holds instead, which naming one clears. */
const HELD_BY_VALUE_TYPE = ["range", "length", "pattern", "unit"] as const;

/** What the declarations of one data property are edited against. */
export type PropertyDeclarationContext = {
  /** The user may create and edit value types, as well as pick them. */
  canModifyValueTypes: boolean;
  networkId: string;
  /** The other data properties of the object type: their semantics and names are taken. */
  otherProperties: readonly ObjectTypeDataProperty[];
  /** Reads the value types again after one was saved here; resolves with the new list. */
  reloadValueTypes: () => Promise<ValueType[]>;
  valueTypes: readonly ValueType[];
  /** The value types could not be read, so none is offered. */
  valueTypesFailed?: boolean;
};

/** What a type change cleared, which the section says until the drawer closes. */
export type ClearedByTypeChange = { names: ClearedDeclarationName[]; type: string };

/**
 * A value type to create, edit or view from the declarations. The data property drawer shows its
 * form in place of the property's, so no second drawer opens over it.
 */
export type ValueTypeFormRequest = {
  /** The base type a new value type starts with. */
  defaultBaseType?: string;
  /** Called with the value type's ID once it is saved. */
  onSaved: (valueTypeId: string) => void;
  readOnly: boolean;
  /** The value type to edit or view; absent, a new one is made. */
  valueType?: ValueType;
};

/** The property's own rules that naming a value type cleared, said until the drawer closes. */
type ClearedByValueType = { names: ClearedDeclarationName[]; valueType: string };

/**
 * The BKN spec 3.0 declarations of a data property, folded under one heading in the data property
 * drawer. Its fields sit in the drawer's form under `declarations`. Inputs appear only for what the
 * property's type takes, and naming a value type hides the inline value rules it now holds.
 */
export function PropertyDeclarationsSection({
  cleared,
  context,
  form,
  onOpenChange,
  onOpenValueType,
  open,
  primaryKey,
  propertyType,
}: {
  cleared: ClearedByTypeChange | null;
  context: PropertyDeclarationContext;
  form: FormInstance<ObjectTypeDataProperty>;
  onOpenChange: (open: boolean) => void;
  /** Shows the form of a value type in the drawer, in place of the property's. */
  onOpenValueType: (request: ValueTypeFormRequest) => void;
  open: boolean;
  primaryKey: boolean;
  propertyType?: string;
}) {
  const { t } = useTranslation();
  const declarations = Form.useWatch("declarations", { form, preserve: true });
  const name = Form.useWatch("name", { form, preserve: true });
  const displayName = Form.useWatch("displayName", { form, preserve: true });
  const [clearedByValueType, setClearedByValueType] = useState<ClearedByValueType | null>(null);
  const [timezoneSearch, setTimezoneSearch] = useState("");

  const fields = constraintFieldsForType(propertyType);
  const semantic = declarations?.semantic;
  const valueTypeId = declarations?.constraints?.valueType;
  const selectedValueType = context.valueTypes.find((item) => item.id === valueTypeId);
  const holders = useMemo(
    () => semanticHolders(context.otherProperties),
    [context.otherProperties],
  );
  const semantics = semanticsForType(propertyType);
  const candidates = valueTypesForPropertyType(context.valueTypes, propertyType);
  const timezones = useMemo(() => knownTimezoneNames(), []);
  const declared = hasDeclarations(declarations);

  const semanticLabel = (value: PropertySemantic) => t(`${PREFIX}.semanticValue.${value}`);

  const setConstraints = (next: PropertyConstraints | undefined) => {
    form.setFieldValue(CONSTRAINTS, next);
  };

  const handleSemanticChange = (next?: PropertySemantic) => {
    if (!crsApplies(next) && declarations?.constraints?.crs) {
      form.setFieldValue(["declarations", "constraints", "crs"], undefined);
    }
  };

  const handleValueTypeChange = (next?: string, nextName?: string) => {
    const current = form.getFieldValue(CONSTRAINTS) as PropertyConstraints | undefined;
    const own = normalizeConstraints(current);
    const names = next ? HELD_BY_VALUE_TYPE.filter((name) => own?.[name] !== undefined) : [];
    // Kept when nothing more is cleared, so taking the value type off still says where they went.
    if (names.length) {
      setClearedByValueType({
        names,
        valueType: nextName ?? context.valueTypes.find((item) => item.id === next)?.name ?? next!,
      });
    }
    setConstraints(withValueType(current, next));
  };

  const handleValueTypeSaved = async (savedId: string, isNew: boolean) => {
    const list = await context.reloadValueTypes();
    const saved = list.find((item) => item.id === savedId);
    // A new value type made from here is the one the property meant to name.
    if (isNew && saved && valueTypesForPropertyType([saved], propertyType).length) {
      handleValueTypeChange(saved.id, saved.name);
    }
  };

  const openValueTypeForm = (readOnly: boolean, valueType?: ValueType) => {
    onOpenValueType({
      defaultBaseType: propertyType,
      onSaved: (savedId) => void handleValueTypeSaved(savedId, !valueType),
      readOnly,
      valueType,
    });
  };

  const ownNames = [name ?? "", displayName ?? ""].filter(Boolean);
  const timezoneOptions = timezones
    .filter((zone) => zone.toLowerCase().includes(timezoneSearch.trim().toLowerCase()))
    .slice(0, TIMEZONE_OPTION_LIMIT)
    .map((zone) => ({ value: zone }));

  const valueTypeExtra = selectedValueType ? (
    <span className={styles.summary}>
      {describeValueTypeRules(selectedValueType, t).join(
        t("knowledgeNetwork.valueTypes.summary.separator"),
      )}
      <Typography.Link
        className={styles.summaryLink}
        onClick={() => openValueTypeForm(!context.canModifyValueTypes, selectedValueType)}
      >
        {t(`${PREFIX}.valueTypeView`)}
      </Typography.Link>
    </span>
  ) : valueTypeId && !context.valueTypesFailed ? (
    <span className={styles.warning}>{t(`${PREFIX}.valueTypeMissing`, { id: valueTypeId })}</span>
  ) : context.valueTypesFailed ? (
    <span className={styles.warning}>{t(`${PREFIX}.valueTypesLoadFailed`)}</span>
  ) : !candidates.length && propertyType ? (
    t(`${PREFIX}.valueTypeNoneForType`, { type: propertyType })
  ) : undefined;

  const body = (
    <div className={styles.body}>
      {cleared ? (
        <Alert
          className={styles.cleared}
          message={t(`${PREFIX}.cleared`, {
            names: cleared.names
              .map((item) => t(`${PREFIX}.clearedName.${item}`))
              .join(t("knowledgeNetwork.declarations.listSeparator")),
            type: cleared.type,
          })}
          showIcon
          type="info"
        />
      ) : null}
      <div className={styles.row}>
        <Form.Item
          extra={
            semantics.length
              ? t(`${PREFIX}.semanticHint`, {
                  type: propertyType,
                  values: semantics
                    .map(semanticLabel)
                    .join(t("knowledgeNetwork.declarations.listSeparator")),
                })
              : t(`${PREFIX}.semanticNoneForType`, { type: propertyType ?? "" })
          }
          label={t(`${PREFIX}.semantic`)}
          name={["declarations", "semantic"]}
        >
          <Select<PropertySemantic>
            allowClear
            disabled={!semantics.length && !semantic}
            onChange={handleSemanticChange}
            options={semantics.map((value) => {
              const holder = holders.get(value);
              return {
                disabled: Boolean(holder),
                label: holder
                  ? t(`${PREFIX}.semanticTaken`, {
                      property: holder.name,
                      semantic: semanticLabel(value),
                    })
                  : semanticLabel(value),
                value,
              };
            })}
            placeholder={t(`${PREFIX}.semanticNone`)}
          />
        </Form.Item>
        <Form.Item label={t(`${PREFIX}.required`)}>
          {primaryKey ? (
            <Checkbox checked disabled>
              {t(`${PREFIX}.requiredPrimaryKey`)}
            </Checkbox>
          ) : (
            <Form.Item name={["declarations", "required"]} noStyle valuePropName="checked">
              <Checkbox>{t(`${PREFIX}.requiredLabel`)}</Checkbox>
            </Form.Item>
          )}
        </Form.Item>
      </div>
      <Form.Item
        dependencies={["name", "displayName"]}
        extra={t(`${PREFIX}.aliasesHint`, { length: MAX_ALIAS_LENGTH, max: MAX_PROPERTY_ALIASES })}
        label={t(`${PREFIX}.aliases`)}
        name={["declarations", "aliases"]}
        rules={[
          {
            validator: (_rule, value?: string[]) => {
              const problem = aliasProblem(value ?? [], ownNames, context.otherProperties);
              return problem
                ? Promise.reject(
                    new Error(t(`${PREFIX}.aliasProblem.${problem.key}`, problem.params)),
                  )
                : Promise.resolve();
            },
          },
        ]}
      >
        <Select
          aria-label={t(`${PREFIX}.aliases`)}
          mode="tags"
          open={false}
          placeholder={t(`${PREFIX}.aliasesPlaceholder`)}
          suffixIcon={null}
          tokenSeparators={[...ALIAS_SEPARATORS]}
        />
      </Form.Item>
      <Form.Item
        extra={valueTypeExtra}
        label={
          <span className={styles.labelRow}>
            <span>{t(`${PREFIX}.valueType`)}</span>
            {context.canModifyValueTypes ? (
              <Typography.Link
                className={styles.labelLink}
                onClick={(event) => {
                  event.preventDefault();
                  openValueTypeForm(false);
                }}
              >
                <PlusOutlined /> {t(`${PREFIX}.valueTypeCreate`)}
              </Typography.Link>
            ) : null}
          </span>
        }
        name={[...CONSTRAINTS, "valueType"]}
      >
        <Select
          allowClear
          disabled={context.valueTypesFailed && !valueTypeId}
          onChange={(next?: string) => handleValueTypeChange(next)}
          optionFilterProp="label"
          options={candidates.map((item) => ({ label: item.name, value: item.id }))}
          placeholder={t(`${PREFIX}.valueTypeNone`)}
          showSearch
        />
      </Form.Item>
      {clearedByValueType ? (
        <Alert
          className={styles.cleared}
          closable
          message={t(`${PREFIX}.clearedByValueType`, {
            names: clearedByValueType.names
              .map((item) => t(`${PREFIX}.clearedName.${item}`))
              .join(t("knowledgeNetwork.declarations.listSeparator")),
            valueType: clearedByValueType.valueType,
          })}
          onClose={() => setClearedByValueType(null)}
          showIcon
          type="info"
        />
      ) : null}
      {!valueTypeId && fields.range ? (
        <RangeInputs kind={fields.range} name={[...CONSTRAINTS, "range"]} />
      ) : null}
      {!valueTypeId && fields.length ? <LengthInputs name={[...CONSTRAINTS, "length"]} /> : null}
      {!valueTypeId && fields.pattern ? (
        <Form.Item
          extra={t("knowledgeNetwork.valueTypes.rules.patternHint")}
          label={t("knowledgeNetwork.valueTypes.rules.pattern")}
          name={[...CONSTRAINTS, "pattern"]}
        >
          <Input className={styles.mono} />
        </Form.Item>
      ) : null}
      <div className={styles.row}>
        {!valueTypeId && fields.unit ? (
          <Form.Item
            label={t("knowledgeNetwork.valueTypes.rules.unit")}
            name={[...CONSTRAINTS, "unit"]}
          >
            <Input />
          </Form.Item>
        ) : null}
        {fields.unique ? (
          <Form.Item label={t(`${PREFIX}.unique`)}>
            <Form.Item name={[...CONSTRAINTS, "unique"]} noStyle valuePropName="checked">
              <Checkbox>{t(`${PREFIX}.uniqueLabel`)}</Checkbox>
            </Form.Item>
          </Form.Item>
        ) : null}
        {crsApplies(semantic) ? (
          <Form.Item label={t(`${PREFIX}.crs`)} name={[...CONSTRAINTS, "crs"]}>
            <Select
              allowClear
              options={PROPERTY_CRS_VALUES.map((value) => ({ label: value, value }))}
              placeholder={t(`${PREFIX}.crsNone`)}
            />
          </Form.Item>
        ) : null}
        {fields.timezone ? (
          <Form.Item
            label={t(`${PREFIX}.timezone`)}
            name={[...CONSTRAINTS, "timezone"]}
            rules={[
              {
                validator: (_rule, value?: string) =>
                  !value?.trim() || isTimezoneName(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t(`${PREFIX}.timezoneInvalid`, { value }))),
              },
            ]}
          >
            <AutoComplete
              allowClear
              onSearch={setTimezoneSearch}
              options={timezoneOptions}
              placeholder={t(`${PREFIX}.timezonePlaceholder`)}
            />
          </Form.Item>
        ) : null}
      </div>
    </div>
  );

  return (
    <Collapse
      activeKey={open ? [PANEL_KEY] : []}
      className={styles.section}
      items={[
        {
          children: body,
          extra: <span className={styles.note}>{t(`${PREFIX}.note`)}</span>,
          forceRender: true,
          key: PANEL_KEY,
          label: (
            <span className={styles.title}>
              {t(`${PREFIX}.title`)}
              {declared ? null : (
                <Tag className={styles.undeclared}>{t(`${PREFIX}.undeclared`)}</Tag>
              )}
            </span>
          ),
        },
      ]}
      onChange={(keys) => onOpenChange((Array.isArray(keys) ? keys : [keys]).includes(PANEL_KEY))}
    />
  );
}
