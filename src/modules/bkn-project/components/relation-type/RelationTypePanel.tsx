/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AskAiSidebar } from "@/modules/bkn-project/components/ai/AskAiSidebar";
import {
  applyRelationRevisions,
  relationPreview,
  type EndNames,
} from "@/modules/bkn-project/components/ai/revisions";
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import { draftGraphRecords } from "@/modules/bkn-project/components/draft/graph";
// The object type panel's frame: both editors open the same way.
import styles from "@/modules/bkn-project/components/object-type/ObjectTypePanel.module.css";
import {
  ReviewActions,
  type CandidateReview,
} from "@/modules/bkn-project/components/object-type/ReviewActions";
import {
  relationEditorValues,
  relationSave,
} from "@/modules/bkn-project/components/relation-type/relation-values";
import {
  createDraftRelationType,
  deleteDraftRelationType,
  listDraftResourceFields,
  saveDraftRelationType,
} from "@/modules/bkn-project/services/draft.service";
import { projectErrorDetails } from "@/modules/bkn-project/services/publish.service";
import type {
  AskRevision,
  Draft,
  DraftRelationType,
  DraftTable,
} from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";
import {
  RelationTypeMappingEditor,
  validateRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
  type RelationTypeMappingReaders,
} from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";
import {
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "@/modules/knowledge-network/lib/resource-constraints";

const PREFIX = "bknProject.relationEditor";
const DESCRIPTION_MAX_LENGTH = 1000;

type BasicValues = { description: string; name: string };

type SaveProblem = { kind: "stale" } | { kind: "other"; text: string };

/** Why bkn-project refused a relation, and what it names. */
type InvalidRelation = {
  field?: string;
  object_type?: string;
  property?: string;
  reason?: string;
  relation?: { name?: string } | string;
  source?: string;
  target?: string;
};

const INVALID_RELATION_REASONS = new Set([
  "unknown_end",
  "unknown_property",
  "type_mismatch",
  "unknown_field",
  "no_mapping",
  "duplicate",
  "not_manual",
]);

/** What the panel edits, from the draft it was opened or last saved on; no relation for a new one. */
type Base = { draft: Draft; relation: DraftRelationType | null };

/**
 * A relation type of a project's draft, made or edited on one page in a panel over the modeling
 * page: its name and description, then its ends and how they join, directly or through a link
 * table, with the knowledge network's relation mapping. A relation a person made can be deleted;
 * one drafting found is left out instead, on the page.
 */
export function RelationTypePanel({
  draft,
  onClose,
  onReload,
  onSaved,
  project,
  relationTypeId,
  review,
}: {
  /** The draft the panel opens on; later reads of it do not reset what is being edited. */
  draft: Draft;
  onClose: () => void;
  /** Reads the draft again, replying it, or null when it cannot be read. */
  onReload: () => Promise<Draft | null>;
  onSaved: (draft: Draft) => void;
  project: Project;
  /** The relation type to edit; null makes a new one. */
  relationTypeId: string | null;
  /** Going through the candidates: confirming this one, then the next. */
  review?: CandidateReview;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [basicForm] = Form.useForm<BasicValues>();

  const startOf = (from: Draft, id: string | null): Base | null => {
    if (id === null) {
      return { draft: from, relation: null };
    }
    const relation = from.items.relationTypes.find((item) => item.id === id);
    return relation ? { draft: from, relation } : null;
  };
  const [base, setBase] = useState<Base | null>(() => startOf(draft, relationTypeId));
  const [basic, setBasic] = useState<BasicValues>(() => ({
    description: base?.relation?.description ?? "",
    name: base?.relation?.name ?? "",
  }));
  const [values, setValues] = useState<RelationTypeMappingFormValues>(() =>
    relationEditorValues(base?.relation ?? undefined),
  );
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [asking, setAsking] = useState(false);

  // Starts over from a draft: the one just saved, or the one read again after it moved.
  const reset = (from: Draft, id: string | null) => {
    const next = startOf(from, id);
    setBase(next);
    setProblem(null);
    if (next) {
      const start = {
        description: next.relation?.description ?? "",
        name: next.relation?.name ?? "",
      };
      setBasic(start);
      basicForm.setFieldsValue(start);
      setValues(relationEditorValues(next.relation ?? undefined));
    }
  };

  const current = base?.draft ?? draft;
  // Every drafted object type is an end to choose, adopted or not.
  const objectTypes = useMemo(() => draftGraphRecords(current).objectTypes, [current]);
  // The ends' properties from the draft; a link table's fields from its data resource.
  const readers = useMemo<RelationTypeMappingReaders>(
    () => ({
      readObjectTypeProperties: (objectTypeId) =>
        Promise.resolve(
          (
            current.items.objectTypes.find((item) => item.id === objectTypeId)?.properties ?? []
          ).map((property) => ({
            comment: property.description,
            displayName: property.displayName,
            name: property.name,
            type: property.type,
          })),
        ),
      readResourceFields: (resourceId) => listDraftResourceFields(project, resourceId),
    }),
    [current, project],
  );

  const relation = base?.relation ?? null;
  const changed =
    base !== null &&
    JSON.stringify(relationSave(basic, values)) !==
      JSON.stringify(
        relationSave(
          { description: relation?.description ?? "", name: relation?.name ?? "" },
          relationEditorValues(relation ?? undefined),
        ),
      );

  const close = () => {
    if (!changed) {
      onClose();
      return;
    }
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("bknProject.objectEditor.leaveDescription"),
      okText: t("bknProject.objectEditor.leave"),
      onOk: onClose,
      title: t("bknProject.objectEditor.leaveTitle"),
    });
  };

  // Names as people know them: object types and their properties by their display names.
  const objectName = (id?: string) =>
    current.items.objectTypes.find((item) => item.id === id)?.name ?? id ?? "";
  const propertyName = (name?: string) =>
    current.items.objectTypes
      .flatMap((item) => item.properties)
      .find((property) => property.name === name)?.displayName ||
    name ||
    "";

  // What was wrong with the relation, by the reason bkn-project gives; never the reason itself.
  const invalidRelationText = (details: unknown) => {
    const refused = (details ?? {}) as InvalidRelation;
    const reason = refused.reason ?? "";
    if (!INVALID_RELATION_REASONS.has(reason)) {
      return t(`${PREFIX}.invalid.other`);
    }
    return t(`${PREFIX}.invalid.${reason}`, {
      field: refused.field ?? "",
      objectType: objectName(refused.object_type),
      property: propertyName(refused.property),
      relation:
        typeof refused.relation === "object" ? (refused.relation.name ?? "") : refused.relation,
      source: propertyName(refused.source),
      target: propertyName(refused.target),
    });
  };

  const explain = (error: unknown): SaveProblem | null => {
    const code = draftErrorCode(error);
    switch (code) {
      case "Stale":
        return { kind: "stale" };
      case "InvalidName":
      case "InvalidDescription":
        basicForm.setFields([
          {
            errors: [t(`bknProject.objectEditor.errors.${code}`)],
            name: code === "InvalidName" ? "name" : "description",
          },
        ]);
        return null;
      case "InvalidRelation":
        return { kind: "other", text: invalidRelationText(projectErrorDetails(error)) };
      case "FieldNotFound":
        return { kind: "other", text: t(`${PREFIX}.invalid.link_unreadable`) };
      default:
        return { kind: "other", text: extractRequestErrorMessage(error) };
    }
  };

  // Replies the draft saved, or null when nothing was.
  const save = async (): Promise<Draft | null> => {
    if (!base) {
      return null;
    }
    let named: BasicValues;
    try {
      named = await basicForm.validateFields();
    } catch {
      // The form marks its fields.
      return null;
    }
    // The mapping says what it misses, as on the knowledge network.
    const missing = validateRelationTypeMappingValues(t, values);
    if (missing) {
      setProblem({ kind: "other", text: missing });
      return null;
    }
    setSaving(true);
    setProblem(null);
    try {
      const value = relationSave(named, values);
      const next = relation
        ? await saveDraftRelationType(project.id, relation.id, base.draft.updateTime, value)
        : await createDraftRelationType(project.id, base.draft.updateTime, value);
      // A relation made is the one the draft did not have; the panel goes on editing it.
      const known = new Set(base.draft.items.relationTypes.map((item) => item.id));
      const saved = relation
        ? next.items.relationTypes.find((item) => item.id === relation.id)
        : next.items.relationTypes.find((item) => !known.has(item.id));
      if (saved && !relation && !saved.adopted) {
        message.info(t(`${PREFIX}.createdNotAdopted`, { name: saved.name }));
      } else {
        message.success(t(`${PREFIX}.saved`, { name: value.name }));
      }
      onSaved(next);
      reset(next, saved?.id ?? relation?.id ?? null);
      return next;
    } catch (error) {
      setProblem(explain(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!base || !relation) {
      return;
    }
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.deleteDescription`),
      okButtonProps: { danger: true },
      okText: t(`${PREFIX}.delete`),
      onOk: async () => {
        try {
          onSaved(await deleteDraftRelationType(project.id, relation.id, base.draft.updateTime));
          message.success(t(`${PREFIX}.deleted`, { name: relation.name }));
          onClose();
        } catch (error) {
          setProblem(explain(error));
        }
      },
      title: t(`${PREFIX}.deleteTitle`, { name: relation.name }),
    });
  };

  // Before deciding on the candidate, what was changed here is saved; the decision follows it.
  const prepare = async () => {
    if (!base) {
      return null;
    }
    if (!changed) {
      return base.draft.updateTime;
    }
    return (await save())?.updateTime ?? null;
  };

  const reload = async () => {
    const next = await onReload();
    if (next) {
      reset(next, relation?.id ?? null);
    }
  };

  // The draft's tables, to name a link table Ask AI proposes.
  const tables = useMemo(() => {
    const found = new Map<string, DraftTable>();
    for (const item of current.items.objectTypes) {
      found.set(item.table.resourceId, item.table);
    }
    for (const item of current.items.relationTypes) {
      if (item.linkTable) {
        found.set(item.linkTable.resourceId, item.linkTable);
      }
    }
    return [...found.values()];
  }, [current]);
  const endNames: EndNames = {
    object: objectName,
    property: (objectTypeId, name) =>
      current.items.objectTypes
        .find((item) => item.id === objectTypeId)
        ?.properties.find((property) => property.name === name)?.displayName || name,
    table: (resourceId) =>
      tables.find((table) => table.resourceId === resourceId)?.name || resourceId,
  };

  // Ask AI's changes go into the editor as if made by hand; saving writes them.
  const adopt = (revisions: AskRevision[]) => {
    const next = applyRelationRevisions({ basic, values }, revisions, tables);
    setBasic(next.basic);
    basicForm.setFieldsValue(next.basic);
    setValues(next.values);
  };

  return (
    <section aria-label={t(`${PREFIX}.title`)} className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>{relation ? relation.name : t(`${PREFIX}.newTitle`)}</span>
        {changed ? (
          <span className={styles.unsaved}>{t("bknProject.objectEditor.unsaved")}</span>
        ) : null}
        <span className={styles.actions}>
          {review && relation ? <ReviewActions prepare={prepare} review={review} /> : null}
          {/* Only a relation a person made is deleted; one drafting found is left out instead. */}
          {relation?.origin === "manual" ? (
            <AppButton danger onClick={remove}>
              {t(`${PREFIX}.delete`)}
            </AppButton>
          ) : null}
          {relation ? (
            <AppButton aria-pressed={asking} onClick={() => setAsking(!asking)}>
              {t("bknProject.objectEditor.ask")}
            </AppButton>
          ) : null}
          <AppButton disabled={!base} loading={saving} onClick={() => void save()} type="primary">
            {t("bknProject.objectEditor.save")}
          </AppButton>
          <AppButton
            aria-label={t("bknProject.objectEditor.close")}
            icon={<CloseOutlined />}
            onClick={close}
            type="text"
          />
        </span>
      </header>
      {base ? (
        <div className={styles.workspace}>
          <div className={styles.body}>
            {problem ? (
              <Alert
                action={
                  problem.kind === "stale" ? (
                    <AppButton onClick={() => void reload()} size="small">
                      {t("bknProject.objectEditor.reload")}
                    </AppButton>
                  ) : undefined
                }
                message={
                  problem.kind === "stale"
                    ? t("bknProject.objectEditor.errors.Stale")
                    : problem.text
                }
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
              onValuesChange={(_, next) => setBasic(next)}
              wrapperCol={{ flex: "auto" }}
            >
              <Form.Item
                label={t("bknProject.objectEditor.name")}
                name="name"
                rules={[
                  { message: t(`${PREFIX}.nameRequired`), required: true, whitespace: true },
                  {
                    max: RESOURCE_NAME_MAX_LENGTH,
                    message: t("bknProject.objectEditor.nameTooLong"),
                  },
                ]}
              >
                <Input count={RESOURCE_NAME_COUNT} showCount />
              </Form.Item>
              <Form.Item label={t("bknProject.objectEditor.description")} name="description">
                <Input.TextArea
                  autoSize={{ maxRows: 3, minRows: 1 }}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  showCount
                />
              </Form.Item>
            </Form>
            <div className={styles.mapping}>
              <RelationTypeMappingEditor
                networkId={project.knId}
                objectTypes={objectTypes}
                onChange={setValues}
                readers={readers}
                value={values}
              />
            </div>
          </div>
          {asking && relation ? (
            <AskAiSidebar
              canAdopt
              itemId={relation.id}
              kind="relation_types"
              onAdopt={adopt}
              onClose={() => setAsking(false)}
              preview={(revision) =>
                relationPreview(t, endNames, basic, relationSave(basic, values), revision)
              }
              projectId={project.id}
              working={() => relationSave(basic, values)}
            />
          ) : null}
        </div>
      ) : (
        <Alert className={styles.missing} message={t(`${PREFIX}.notFound`)} showIcon type="error" />
      )}
    </section>
  );
}
