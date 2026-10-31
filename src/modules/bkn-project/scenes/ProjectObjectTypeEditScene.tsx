/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import {
  draftSave,
  editorDataSource,
  editorProperties,
} from "@/modules/bkn-project/components/object-type/editor-values";
import { projectErrorDetails } from "@/modules/bkn-project/services/publish.service";
import {
  getDraft,
  listDraftTableFields,
  saveDraftObjectType,
} from "@/modules/bkn-project/services/draft.service";
import { getProject } from "@/modules/bkn-project/services/project.service";
import type { Draft, DraftObjectType } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import { projectSectionPath } from "@/modules/bkn-project/types/workspace";
import {
  ObjectTypeDataAttributeEditor,
  type ObjectTypeDataAttributeEditorHandle,
} from "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeDataAttributeEditor";
import { DEFAULT_RESOURCE_COLOR } from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import { ResourceFormStepsShell } from "@/modules/knowledge-network/components/shared/ResourceFormStepsShell";
import {
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";
// The knowledge network's object type form: the project's editor looks the same.
import kn from "@/modules/knowledge-network/scenes/ObjectTypeFormScene.module.css";
import type {
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
} from "@/modules/knowledge-network/types/object-type";

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

type Loaded = { draft: Draft; objectType: DraftObjectType; project: Project };

/**
 * An object type of a project's draft, in the knowledge network's object type editor: its name
 * and description, then its properties mapped to its table's columns, saved whole. The table
 * stays the one the draft gives it.
 */
export function ProjectObjectTypeEditScene({
  itemId,
  projectId,
}: {
  itemId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [basicForm] = Form.useForm<BasicValues>();
  const editorRef = useRef<ObjectTypeDataAttributeEditorHandle>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [basic, setBasic] = useState<BasicValues>({ description: "", name: "" });
  const [properties, setProperties] = useState<ObjectTypeDataProperty[]>([]);
  const [dataSource, setDataSource] = useState<ObjectTypeDataSource | undefined>();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  const modelPath = `${projectSectionPath(projectId, "model")}?tab=objects`;

  const load = useCallback(async () => {
    setLoadError(null);
    setProblem(null);
    try {
      const [project, draft] = await Promise.all([getProject(projectId), getDraft(projectId)]);
      const objectType = draft?.items.objectTypes.find((item) => item.id === itemId);
      if (!draft || draft.status !== "ready" || !objectType) {
        setLoadError(t(`${PREFIX}.notFound`));
        return;
      }
      const values = { description: objectType.description, name: objectType.name };
      setLoaded({ draft, objectType, project });
      setBasic(values);
      basicForm.setFieldsValue(values);
      setProperties(editorProperties(objectType));
      setDataSource(editorDataSource(objectType));
    } catch (error) {
      setLoadError(extractRequestErrorMessage(error));
    }
  }, [basicForm, itemId, projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // The table's columns, read as the draft and its data catalog give them.
  const readResourceFields = useMemo(
    () =>
      loaded
        ? (resourceId: string) => listDraftTableFields(loaded.project, itemId, resourceId)
        : undefined,
    [itemId, loaded],
  );

  const leave = () => {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.leaveDescription`),
      okText: t(`${PREFIX}.leave`),
      onOk: () => {
        void navigate(modelPath);
      },
      title: t(`${PREFIX}.leaveTitle`),
    });
  };

  const toProperties = async () => {
    try {
      const values = await basicForm.validateFields();
      setBasic(values);
      setStep(1);
    } catch {
      // The form marks the fields that need attention.
    }
  };

  // A refusal names what is wrong where it is: the name or description on their fields, the rest
  // over the properties.
  // Properties by name, shown by their display names; a name not among them is shown as it is.
  const shown = (name: string) =>
    properties.find((property) => property.name === name)?.displayName || name;
  const separator = t(`${PREFIX}.listSeparator`);

  const explain = (error: unknown): SaveProblem | null => {
    const code = draftErrorCode(error);
    const details = projectErrorDetails(error);
    switch (code) {
      case "Stale":
        return { kind: "stale" };
      case "InvalidName":
      case "InvalidDescription":
        setStep(0);
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

  const save = async () => {
    if (!loaded) {
      return;
    }
    let checked: ObjectTypeDataProperty[];
    try {
      checked = (await editorRef.current!.validateFields()).dataProperties;
    } catch {
      // The editor says what is missing above its canvas.
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
      await saveDraftObjectType(
        projectId,
        itemId,
        loaded.draft.updateTime,
        draftSave(loaded.objectType, basic, checked),
      );
      message.success(t(`${PREFIX}.saved`, { name: basic.name.trim() }));
      void navigate(modelPath);
    } catch (error) {
      setProblem(explain(error));
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { title: t("common.basicInfo") },
    { title: t("knowledgeNetwork.objectTypeDataProperty") },
  ];
  const title = loaded?.objectType.name ?? t(`${PREFIX}.title`);

  if (!loaded) {
    return (
      <ResourceFormStepsShell
        currentStep={0}
        doneStep={0}
        onBack={() => void navigate(modelPath)}
        steps={steps}
        title={title}
      >
        {loadError ? (
          <Alert className={kn.loadError} message={loadError} showIcon type="error" />
        ) : (
          <div className={kn.loadingState}>
            <Spin />
          </div>
        )}
      </ResourceFormStepsShell>
    );
  }

  return (
    <ResourceFormStepsShell
      actions={
        step === 0
          ? { next: { onClick: () => void toProperties(), text: t("common.next") } }
          : {
              prev: { onClick: () => setStep(0), text: t("common.previous") },
              save: { loading: saving, onClick: () => void save(), text: t(`${PREFIX}.save`) },
            }
      }
      currentStep={step}
      doneStep={1}
      onBack={leave}
      onStepChange={(next) => (next === 1 ? void toProperties() : setStep(next))}
      steps={steps}
      title={title}
    >
      {problem ? (
        <Alert
          action={
            problem.kind === "stale" ? (
              <AppButton onClick={() => void load().then(() => setStep(0))} size="small">
                {t(`${PREFIX}.reload`)}
              </AppButton>
            ) : undefined
          }
          className={kn.loadError}
          message={problem.kind === "stale" ? t(`${PREFIX}.errors.Stale`) : problem.text}
          showIcon
          type={problem.kind === "stale" ? "warning" : "error"}
        />
      ) : null}
      {/* Kept mounted on the properties step, so the values stay for saving. */}
      <div className={kn.basicForm} hidden={step !== 0}>
        <Form
          colon={false}
          form={basicForm}
          labelAlign="left"
          labelCol={{ flex: "160px" }}
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
              autoSize={{ maxRows: 10, minRows: 6 }}
              maxLength={DESCRIPTION_MAX_LENGTH}
              showCount
            />
          </Form.Item>
        </Form>
      </div>
      {step === 1 ? (
        <div className={kn.dataAttributePanel}>
          <ObjectTypeDataAttributeEditor
            basicValue={{ color: DEFAULT_RESOURCE_COLOR, name: basic.name }}
            dataProperties={properties}
            dataSource={dataSource}
            networkId={loaded.project.knId}
            onChange={({ dataProperties }) => setProperties(dataProperties)}
            readResourceFields={readResourceFields}
            ref={editorRef}
            resourceFixed
          />
        </div>
      ) : null}
    </ResourceFormStepsShell>
  );
}
