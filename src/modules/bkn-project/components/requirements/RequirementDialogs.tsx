/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Checkbox, Form, Input, Modal, Radio, Select } from "antd";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { Citing } from "@/modules/bkn-project/components/requirements/citing";
import { InputsEditor } from "@/modules/bkn-project/components/requirements/InputsEditor";
import { useUnsavedChanges } from "@/modules/bkn-project/components/unsaved/unsaved";
import {
  categoryText,
  layerText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import type { RequirementItemFields } from "@/modules/bkn-project/services/requirements.service";
import type {
  QuestionInput,
  RequirementChoice,
  RequirementConcept,
  RequirementConflict,
  RequirementItemKind,
  RequirementItemRef,
  RequirementSpec,
} from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements.editing";

/** A drafted object type or relation type a concept or question may point at. */
export type DraftedItem = RequirementItemRef & {
  name: string;
  /** An object type's properties; none for a relation type. */
  properties: { displayName: string; name: string; type: string }[];
};

const CATEGORIES = ["object", "event", "property", "relation", "evidence", "not_ontology"];
const LAYERS = ["knowledge", "capability"];
const refKey = (item: RequirementItemRef) => `${item.kind}/${item.id}`;
const fromKey = (key: string): RequirementItemRef => {
  const [kind, ...id] = key.split("/");
  return { id: id.join("/"), kind };
};

type Saving = { onCancel: () => void; saving: boolean };

/**
 * Adds or edits an item of the specification: its kind decides the fields. A question's needs set
 * here become the person's; "follow the concepts" gives them back.
 */
export function ItemDialog({
  drafted,
  inputErrors = {},
  itemId,
  kind,
  onCancel,
  onSave,
  saving,
  spec,
}: Saving & {
  drafted: DraftedItem[];
  /** The server's reasons for the inputs a save was refused for, by input name. */
  inputErrors?: Record<string, string>;
  itemId: string | null;
  kind: RequirementItemKind;
  /** Saves the item; true once it is saved. */
  onSave: (fields: RequirementItemFields) => Promise<boolean>;
  spec: RequirementSpec;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  // Typed in since the dialog opened: leaving the page then asks first.
  const [typed, setTyped] = useState(false);
  const current = itemId
    ? (spec[kind] as { id: string }[]).find((item) => item.id === itemId)
    : undefined;
  const question = kind === "questions" ? (current as RequirementSpec["questions"][number]) : null;
  const [followConcepts, setFollowConcepts] = useState(false);
  // Inputs are sent only when the person changed them, as needs are.
  const [inputs, setInputs] = useState<QuestionInput[]>(() => question?.inputs ?? []);
  const [relativeWindow, setRelativeWindow] = useState(question?.relativeWindow ?? false);
  const inputsChanged = JSON.stringify(inputs) !== JSON.stringify(question?.inputs ?? []);
  const inputsComplete = inputs.every((input) => input.name.trim() && input.conceptId);

  const initial = (() => {
    if (!current) {
      return kind === "concepts"
        ? { category: "object" }
        : kind === "questions"
          ? { layer: "knowledge" }
          : {};
    }
    if (kind === "scenarios") {
      const scenario = current as RequirementSpec["scenarios"][number];
      return { ...scenario, knowledge: scenario.knowledge.join("\n") };
    }
    if (question) {
      return { ...question, needs: question.needs.map(refKey) };
    }
    return current;
  })();

  const fieldsOf = (values: Record<string, unknown>): RequirementItemFields => {
    const text = (name: string) => {
      const value = values[name];
      return typeof value === "string" ? value.trim() : "";
    };
    const fields: RequirementItemFields =
      kind === "scenarios"
        ? {
            actor: text("actor"),
            decision: text("decision"),
            knowledge: text("knowledge")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            name: text("name"),
            trigger: text("trigger"),
          }
        : kind === "concepts"
          ? { category: text("category"), definition: text("definition"), term: text("term") }
          : kind === "rules"
            ? { statement: text("statement") }
            : {
                answerShape: text("answerShape"),
                layer: text("layer"),
                scenarioIds: (values.scenarioIds as string[] | undefined) ?? [],
                template: text("template"),
                text: text("text"),
                ...(inputsChanged
                  ? { inputs: inputs.map((input) => ({ ...input, name: input.name.trim() })) }
                  : {}),
                ...(relativeWindow === (question?.relativeWindow ?? false)
                  ? {}
                  : { relativeWindow }),
                ...(followConcepts
                  ? { followConcepts: true }
                  : neededChanged(values.needs as string[] | undefined)
                    ? { needs: ((values.needs as string[] | undefined) ?? []).map(fromKey) }
                    : {}),
              };
    return fields;
  };
  const save = (values: Record<string, unknown>) => void onSave(fieldsOf(values));
  useUnsavedChanges(
    typed ||
      inputsChanged ||
      followConcepts ||
      relativeWindow !== (question?.relativeWindow ?? false),
    async () => {
      const values = (await form.validateFields().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      return values !== null && onSave(fieldsOf(values));
    },
  );

  // Needs are sent only when the person changed them: sending them makes them the person's.
  const neededChanged = (needs: string[] | undefined) => {
    const before = question ? question.needs.map(refKey) : [];
    const after = needs ?? [];
    return before.length !== after.length || before.some((key) => !after.includes(key));
  };

  const required = { message: t(`${PREFIX}.required`), required: true, whitespace: true };
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: kind === "questions" && !inputsComplete }}
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => form.submit()}
      open
      title={t(`${PREFIX}.${itemId ? "editTitle" : "addTitle"}.${kind}`)}
      // A question's inputs take a row each: its dialog is wider.
      width={kind === "questions" ? 820 : 640}
    >
      <Form
        form={form}
        initialValues={initial}
        layout="vertical"
        onFinish={save}
        onValuesChange={() => setTyped(true)}
      >
        {kind === "scenarios" ? (
          <>
            <Form.Item label={t(`${PREFIX}.fields.name`)} name="name" rules={[required]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.actor`)} name="actor">
              <Input maxLength={2000} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.trigger`)} name="trigger">
              <Input maxLength={2000} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.decision`)} name="decision">
              <Input maxLength={2000} />
            </Form.Item>
            <Form.Item
              extra={t(`${PREFIX}.fields.knowledgeHint`)}
              label={t(`${PREFIX}.fields.knowledge`)}
              name="knowledge"
            >
              <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} />
            </Form.Item>
          </>
        ) : kind === "concepts" ? (
          <>
            <Form.Item label={t(`${PREFIX}.fields.term`)} name="term" rules={[required]}>
              <Input maxLength={255} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.category`)} name="category">
              <Select
                options={CATEGORIES.map((value) => ({ label: categoryText(t, value), value }))}
              />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.definition`)} name="definition">
              <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} maxLength={2000} />
            </Form.Item>
          </>
        ) : kind === "rules" ? (
          <Form.Item label={t(`${PREFIX}.fields.statement`)} name="statement" rules={[required]}>
            <Input.TextArea autoSize={{ maxRows: 6, minRows: 2 }} maxLength={2000} />
          </Form.Item>
        ) : (
          <>
            <Form.Item label={t(`${PREFIX}.fields.text`)} name="text" rules={[required]}>
              <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} maxLength={2000} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.layer`)} name="layer">
              <Select options={LAYERS.map((value) => ({ label: layerText(t, value), value }))} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.scenarios`)} name="scenarioIds">
              <Select
                mode="multiple"
                options={spec.scenarios.map((scenario) => ({
                  label: scenario.name,
                  value: scenario.id,
                }))}
              />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.template`)} name="template">
              <Input maxLength={2000} />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.answerShape`)} name="answerShape">
              <Input maxLength={2000} />
            </Form.Item>
            <Form.Item
              extra={t(`${PREFIX}.fields.${drafted.length ? "needsHint" : "nothingDrafted"}`)}
              label={t(`${PREFIX}.fields.needs`)}
              name="needs"
            >
              <Select
                disabled={followConcepts || !drafted.length}
                mode="multiple"
                optionFilterProp="label"
                options={drafted.map((item) => ({ label: item.name, value: refKey(item) }))}
              />
            </Form.Item>
            <Form.Item label={t(`${PREFIX}.fields.inputs`)}>
              <InputsEditor
                drafted={drafted}
                errors={inputErrors}
                inputs={inputs}
                onChange={setInputs}
                onWindowChange={setRelativeWindow}
                relativeWindow={relativeWindow}
                spec={spec}
              />
            </Form.Item>
            {question?.needsSource === "person" ? (
              <Checkbox
                checked={followConcepts}
                onChange={(event) => setFollowConcepts(event.target.checked)}
              >
                {t(`${PREFIX}.fields.followConcepts`)}
              </Checkbox>
            ) : null}
          </>
        )}
      </Form>
    </Modal>
  );
}

/** Rules on a conflict by a side, by a conclusion of one's own, or hands it to the business. */
export function ConflictDialog({
  conflict,
  onCancel,
  onSave,
  saving,
}: Saving & {
  conflict: RequirementConflict;
  onSave: (ruling: { deferred: boolean; documentId: string; reason: string; text: string }) => void;
}) {
  const { t } = useTranslation();
  const { documentName } = useContext(Citing);
  const resolution = conflict.resolution;
  // Sides are told apart by position: two sides may quote one document.
  const sideOf = (documentId: string) => {
    const index = conflict.sides.findIndex((side) => side.documentId === documentId);
    return index < 0 ? "" : `side:${index}`;
  };
  const [choice, setChoice] = useState<string>(
    conflict.deferred
      ? "defer"
      : resolution
        ? resolution.documentId
          ? sideOf(resolution.documentId)
          : "own"
        : conflict.suggestedDocumentId
          ? sideOf(conflict.suggestedDocumentId)
          : "",
  );
  const [text, setText] = useState(resolution?.text ?? "");
  const [reason, setReason] = useState(resolution?.reason ?? "");
  const ready =
    Boolean(choice) && Boolean(reason.trim()) && (choice !== "own" || Boolean(text.trim()));

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: !ready }}
      okText={t(`${PREFIX}.conflict.save`)}
      onCancel={onCancel}
      onOk={() =>
        onSave({
          deferred: choice === "defer",
          documentId: choice.startsWith("side:")
            ? (conflict.sides[Number(choice.slice("side:".length))]?.documentId ?? "")
            : "",
          reason: reason.trim(),
          text: choice === "own" ? text.trim() : "",
        })
      }
      open
      title={t(`${PREFIX}.conflict.title`, { topic: conflict.topic })}
    >
      <div className={styles.stack}>
        <Radio.Group onChange={(event) => setChoice(String(event.target.value))} value={choice}>
          <div className={styles.stack}>
            {conflict.sides.map((side, index) => (
              <Radio key={index} value={`side:${index}`}>
                {t(`${PREFIX}.conflict.side`, {
                  name: documentName(side.documentId),
                  position: side.position,
                })}
              </Radio>
            ))}
            <Radio value="own">{t(`${PREFIX}.conflict.own`)}</Radio>
            <Radio value="defer">{t(`${PREFIX}.conflict.defer`)}</Radio>
          </div>
        </Radio.Group>
        {choice === "own" ? (
          <Input.TextArea
            aria-label={t(`${PREFIX}.conflict.ownText`)}
            autoSize={{ maxRows: 4, minRows: 2 }}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            placeholder={t(`${PREFIX}.conflict.ownText`)}
            value={text}
          />
        ) : null}
        <Input.TextArea
          aria-label={t(`${PREFIX}.conflict.reason`)}
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t(`${PREFIX}.conflict.reason`)}
          value={reason}
        />
      </div>
    </Modal>
  );
}

/** Chooses one option of a modelling choice, with what the choice rests on. */
export function ChoiceDialog({
  choice,
  onCancel,
  onSave,
  saving,
}: Saving & {
  choice: RequirementChoice;
  onSave: (decision: { basis: string; optionId: string }) => void;
}) {
  const { t } = useTranslation();
  const [optionId, setOptionId] = useState(choice.decision?.optionId ?? choice.recommendedOptionId);
  const [basis, setBasis] = useState(choice.decision?.basis ?? "");
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: !optionId }}
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => onSave({ basis: basis.trim(), optionId })}
      open
      title={t(`${PREFIX}.choice.title`, { question: choice.question })}
    >
      <div className={styles.stack}>
        <Radio.Group onChange={(event) => setOptionId(String(event.target.value))} value={optionId}>
          <div className={styles.stack}>
            {choice.options.map((option) => (
              <Radio key={option.id} value={option.id}>
                <span className={styles.stack}>
                  <span>
                    {option.label}
                    {option.id === choice.recommendedOptionId
                      ? t(`${PREFIX}.choice.recommendedMark`)
                      : ""}
                  </span>
                  <span className={styles.muted}>{option.consequence}</span>
                </span>
              </Radio>
            ))}
          </div>
        </Radio.Group>
        <Input.TextArea
          aria-label={t(`${PREFIX}.choice.basis`)}
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={2000}
          onChange={(event) => setBasis(event.target.value)}
          placeholder={t(`${PREFIX}.choice.basis`)}
          value={basis}
        />
      </div>
    </Modal>
  );
}

/** Points a concept at the drafted item it is, or at none. */
export function MappingDialog({
  concept,
  drafted,
  onCancel,
  onSave,
  saving,
}: Saving & {
  concept: RequirementConcept;
  drafted: DraftedItem[];
  onSave: (mapsTo: RequirementItemRef | null) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState<string | undefined>(
    concept.mapsTo ? refKey(concept.mapsTo) : undefined,
  );
  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => onSave(value ? fromKey(value) : null)}
      open
      title={t(`${PREFIX}.mapping.title`, { term: concept.term })}
    >
      <div className={styles.stack}>
        <p className={styles.muted}>
          {t(`${PREFIX}.${drafted.length ? "mapping.hint" : "fields.nothingDrafted"}`)}
        </p>
        <Select
          allowClear
          disabled={!drafted.length}
          aria-label={t(`${PREFIX}.mapping.label`)}
          onChange={(next?: string) => setValue(next)}
          optionFilterProp="label"
          options={drafted.map((item) => ({
            label: t(
              `${PREFIX}.mapping.option.${item.kind === "relation_type" ? "relation" : "object"}`,
              {
                name: item.name,
              },
            ),
            value: refKey(item),
          }))}
          placeholder={t(`${PREFIX}.mapping.none`)}
          showSearch
          value={value}
        />
      </div>
    </Modal>
  );
}
