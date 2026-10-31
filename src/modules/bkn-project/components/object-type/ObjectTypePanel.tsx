/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import {
  draftSave,
  editorDataSource,
  editorProperties,
} from "@/modules/bkn-project/components/object-type/editor-values";
import {
  listDraftTableFields,
  saveDraftObjectType,
} from "@/modules/bkn-project/services/draft.service";
import { projectErrorDetails } from "@/modules/bkn-project/services/publish.service";
import type { Draft, DraftObjectType } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import {
  ObjectTypeDataAttributeEditor,
  type ObjectTypeDataAttributeEditorHandle,
} from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeEditor";
import { DEFAULT_RESOURCE_COLOR } from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectTypePanel.module.css";

const PREFIX = "bknProject.objectEditor";
const DESCRIPTION_MAX_LENGTH = 1000;

type BasicValues = { description: string; name: string };

/** Why saving did not go, as the page says it: on a field, over the properties, or the draft moved. */
type SaveProblem =
  { kind: "stale" } | { kind: "properties"; text: string } | { kind: "other"; text: string };

/** A property a relation joins by, as bkn-project names it when removing it is refused. */
type PropertyUse = {
  property: string;
  relation?: { name: string };
  source?: { name: string };
  target?: { name: string };
};

/** Why bkn-project refused a property or field; the property, the field or the title it names. */
type InvalidProperty = { display_key?: string; field?: string; property?: string; reason?: string };

const INVALID_PROPERTY_REASONS = new Set([
  "no_mapped_field",
  "field_mapped_twice",
  "mapping_changed",
  "field_not_mappable",
  "invalid_name",
  "too_long",
]);

/** What the panel edits, from the draft it was opened or last saved on. */
type Base = { draft: Draft; objectType: DraftObjectType };

/**
 * An object type of a project's draft, edited on one page in a panel over the modeling page: its
 * name and description on two compact lines, then its properties on the knowledge network's
 * mapping canvas against its table's columns. Saving keeps the panel open; closing with changes
 * not saved asks first. The page under it stays as it was.
 */
export function ObjectTypePanel({
  draft,
  objectTypeId,
  onAsk,
  onClose,
  onReload,
  onSaved,
  project,
}: {
  /** The draft the panel opens on; later reads of it do not reset what is being edited. */
  draft: Draft;
  objectTypeId: string;
  /** Opens the object type's details, where AI can be asked about it. */
  onAsk?: () => void;
  onClose: () => void;
  /** Reads the draft again, replying it, or null when it cannot be read. */
  onReload: () => Promise<Draft | null>;
  onSaved: (draft: Draft) => void;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [basicForm] = Form.useForm<BasicValues>();
  const editorRef = useRef<ObjectTypeDataAttributeEditorHandle>(null);

  const startOf = (from: Draft) => {
    const objectType = from.items.objectTypes.find((item) => item.id === objectTypeId);
    return objectType ? { draft: from, objectType } : null;
  };
  const [base, setBase] = useState<Base | null>(() => startOf(draft));
  const [basic, setBasic] = useState<BasicValues>(() => ({
    description: base?.objectType.description ?? "",
    name: base?.objectType.name ?? "",
  }));
  const [properties, setProperties] = useState<ObjectTypeDataProperty[]>(() =>
    base ? editorProperties(base.objectType) : [],
  );
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  // Starts over from a draft: the one just saved, or the one read again after it moved.
  const reset = (from: Draft) => {
    const next = startOf(from);
    setBase(next);
    setProblem(null);
    if (next) {
      const values = { description: next.objectType.description, name: next.objectType.name };
      setBasic(values);
      basicForm.setFieldsValue(values);
      setProperties(editorProperties(next.objectType));
    }
  };

  const dataSource = useMemo(() => (base ? editorDataSource(base.objectType) : undefined), [base]);
  // The table's columns, read as the draft and its data catalog give them.
  const readResourceFields = useMemo(
    () => (resourceId: string) => listDraftTableFields(project, objectTypeId, resourceId),
    [objectTypeId, project],
  );

  // What saving would send now against what was loaded: anything else is a change not saved.
  const changed =
    base !== null &&
    JSON.stringify(draftSave(base.objectType, basic, properties)) !==
      JSON.stringify(
        draftSave(
          base.objectType,
          { description: base.objectType.description, name: base.objectType.name },
          editorProperties(base.objectType),
        ),
      );

  const close = () => {
    if (!changed) {
      onClose();
      return;
    }
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.leaveDescription`),
      okText: t(`${PREFIX}.leave`),
      onOk: onClose,
      title: t(`${PREFIX}.leaveTitle`),
    });
  };

  // Properties by name, shown by their display names: a property removed in the editor, as one a
  // relation still joins by, is named as it was loaded; a name found nowhere is shown as it is.
  const shown = (name: string) =>
    properties.find((property) => property.name === name)?.displayName ||
    base?.objectType.properties.find((property) => property.name === name)?.displayName ||
    name;
  const separator = t(`${PREFIX}.listSeparator`);

  // What was wrong with a property or field, by the reason bkn-project gives.
  const invalidPropertyText = (details: unknown) => {
    const { display_key: title, field, property, reason } = (details ?? {}) as InvalidProperty;
    if (title) {
      return t(`${PREFIX}.invalidProperty.display_key`, { name: shown(title) });
    }
    const name = property ? shown(property) : field;
    return name && reason && INVALID_PROPERTY_REASONS.has(reason)
      ? t(`${PREFIX}.invalidProperty.${reason}`, { name })
      : t(`${PREFIX}.errors.InvalidPropertyUnnamed`);
  };

  // A refusal names what is wrong where it is: the name or description on their fields, the rest
  // over the properties.
  const explain = (error: unknown): SaveProblem | null => {
    const code = draftErrorCode(error);
    const details = projectErrorDetails(error);
    switch (code) {
      case "Stale":
        return { kind: "stale" };
      case "InvalidName":
      case "InvalidDescription":
        basicForm.setFields([
          {
            errors: [t(`${PREFIX}.errors.${code}`)],
            name: code === "InvalidName" ? "name" : "description",
          },
        ]);
        return null;
      case "PropertyInUse": {
        // By property, the relations that join by it, each with its two ends.
        const byProperty = new Map<string, string[]>();
        for (const use of Array.isArray(details) ? (details as PropertyUse[]) : []) {
          const relation = t(`${PREFIX}.relationUse`, {
            relation: use.relation?.name ?? "",
            source: use.source?.name ?? "",
            target: use.target?.name ?? "",
          });
          byProperty.set(use.property, [...(byProperty.get(use.property) ?? []), relation]);
        }
        return {
          kind: "properties",
          text: t(`${PREFIX}.errors.PropertyInUse`, {
            uses: [...byProperty]
              .map(([property, relations]) =>
                t(`${PREFIX}.propertyUse`, {
                  property: shown(property),
                  relations: relations.join(separator),
                }),
              )
              .join(t(`${PREFIX}.groupSeparator`)),
          }),
        };
      }
      case "InvalidProperty":
        return { kind: "properties", text: invalidPropertyText(details) };
      case "InvalidIdentity":
      case "NeedsIdentity":
      case "InvalidIncrementalKey":
      case "FieldNotFound":
        return { kind: "properties", text: t(`${PREFIX}.errors.${code}`) };
      default:
        return { kind: "other", text: extractRequestErrorMessage(error) };
    }
  };

  const save = async () => {
    if (!base) {
      return;
    }
    let values: BasicValues;
    let checked: ObjectTypeDataProperty[];
    try {
      values = await basicForm.validateFields();
      checked = (await editorRef.current!.validateFields()).dataProperties;
    } catch {
      // The form marks its fields; the editor says what is missing above its canvas.
      return;
    }
    // Every property of a draft maps a column of its table: say which do not before sending.
    const unmapped = checked.filter((property) => !property.mappedField);
    if (unmapped.length) {
      setProblem({
        kind: "properties",
        text: t(`${PREFIX}.unmapped`, {
          names: unmapped.map((property) => property.displayName || property.name).join(separator),
        }),
      });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const next = await saveDraftObjectType(
        project.id,
        objectTypeId,
        base.draft.updateTime,
        draftSave(base.objectType, values, checked),
      );
      message.success(t(`${PREFIX}.saved`, { name: values.name.trim() }));
      onSaved(next);
      reset(next);
    } catch (error) {
      setProblem(explain(error));
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    const next = await onReload();
    if (next) {
      reset(next);
    }
  };

  return (
    <section aria-label={t(`${PREFIX}.title`)} className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>{base?.objectType.name ?? t(`${PREFIX}.title`)}</span>
        {changed ? <span className={styles.unsaved}>{t(`${PREFIX}.unsaved`)}</span> : null}
        <span className={styles.actions}>
          {onAsk ? <AppButton onClick={onAsk}>{t(`${PREFIX}.ask`)}</AppButton> : null}
          <AppButton disabled={!base} loading={saving} onClick={() => void save()} type="primary">
            {t(`${PREFIX}.save`)}
          </AppButton>
          <AppButton
            aria-label={t(`${PREFIX}.close`)}
            icon={<CloseOutlined />}
            onClick={close}
            type="text"
          />
        </span>
      </header>
      {base ? (
        <div className={styles.body}>
          {problem ? (
            <Alert
              action={
                problem.kind === "stale" ? (
                  <AppButton onClick={() => void reload()} size="small">
                    {t(`${PREFIX}.reload`)}
                  </AppButton>
                ) : undefined
              }
              message={problem.kind === "stale" ? t(`${PREFIX}.errors.Stale`) : problem.text}
              showIcon
              type={problem.kind === "stale" ? "warning" : "error"}
            />
          ) : null}
          <Form
            className={styles.basic}
            colon={false}
            form={basicForm}
            initialValues={basic}
            labelCol={{ flex: "72px" }}
            onValuesChange={(_, values) => setBasic(values)}
            wrapperCol={{ flex: "auto" }}
          >
            <Form.Item
              label={t(`${PREFIX}.name`)}
              name="name"
              rules={[
                { message: t(`${PREFIX}.nameRequired`), required: true, whitespace: true },
                { max: RESOURCE_NAME_MAX_LENGTH, message: t(`${PREFIX}.nameTooLong`) },
              ]}
            >
              <Input count={RESOURCE_NAME_COUNT} showCount />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.description`)} name="description">
              <Input.TextArea
                autoSize={{ maxRows: 3, minRows: 1 }}
                maxLength={DESCRIPTION_MAX_LENGTH}
                showCount
              />
            </Form.Item>
          </Form>
          <div className={styles.canvas}>
            <ObjectTypeDataAttributeEditor
              basicValue={{ color: DEFAULT_RESOURCE_COLOR, name: basic.name }}
              dataProperties={properties}
              dataSource={dataSource}
              networkId={project.knId}
              onChange={({ dataProperties }) => setProperties(dataProperties)}
              readResourceFields={readResourceFields}
              ref={editorRef}
              resourceFixed
            />
          </div>
        </div>
      ) : (
        <Alert className={styles.missing} message={t(`${PREFIX}.notFound`)} showIcon type="error" />
      )}
    </section>
  );
}
