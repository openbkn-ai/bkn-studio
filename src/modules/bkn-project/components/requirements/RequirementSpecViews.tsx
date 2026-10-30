/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Collapse } from "antd";
import dayjs from "dayjs";
import { type ReactNode, useContext } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { Citations } from "@/modules/bkn-project/components/requirements/Citations";
import { Citing, Editing } from "@/modules/bkn-project/components/requirements/citing";
import {
  capabilityKindText,
  categoryText,
  compilesToText,
  conflictKindText,
  layerText,
  questionTypeText,
  rejectedKindText,
  rejectedReasonText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import type {
  RequirementChoice,
  RequirementConflict,
  RequirementItemKind,
  RequirementItemRef,
  RequirementSpec,
} from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements";

/** Names drafted items as the draft names them now; one no longer drafted shows its id. */
export type ItemName = (item: RequirementItemRef) => string;

function Field({ children, label }: { children: ReactNode; label: string }) {
  if (children === "" || children === null || children === undefined) {
    return null;
  }
  return (
    <>
      <span className={styles.fieldLabel}>{label}</span>
      <span>{children}</span>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className={styles.muted}>{text}</p>;
}

/** The owner's edit and remove, at the end of an item's heading. */
function ItemActions({
  itemId,
  kind,
  label,
}: {
  itemId: string;
  kind: RequirementItemKind;
  label: string;
}) {
  const { t } = useTranslation();
  const editing = useContext(Editing);
  if (!editing) {
    return null;
  }
  return (
    <>
      <span className={styles.spacer} />
      <AppButton
        aria-label={t(`${PREFIX}.editing.editItem`, { name: label })}
        onClick={() => editing.edit(kind, itemId)}
        size="small"
        type="link"
      >
        {t(`${PREFIX}.editing.edit`)}
      </AppButton>
      <AppButton
        aria-label={t(`${PREFIX}.editing.removeItem`, { name: label })}
        danger
        onClick={() => editing.remove(kind, itemId, label)}
        size="small"
        type="link"
      >
        {t(`${PREFIX}.editing.remove`)}
      </AppButton>
    </>
  );
}

/** The owner's "add" above a list of items. */
function AddItem({ kind }: { kind: RequirementItemKind }) {
  const { t } = useTranslation();
  const editing = useContext(Editing);
  return editing ? (
    <div className={styles.row}>
      <span className={styles.spacer} />
      <AppButton onClick={() => editing.add(kind)}>{t(`${PREFIX}.editing.add.${kind}`)}</AppButton>
    </div>
  ) : null;
}

function EditedTag({ edited }: { edited: boolean }) {
  const { t } = useTranslation();
  return edited ? <LightStatusTag tone="info">{t(`${PREFIX}.edited`)}</LightStatusTag> : null;
}

export function QuestionsView({ itemName, spec }: { itemName: ItemName; spec: RequirementSpec }) {
  const { t } = useTranslation();
  const scenarioName = (id: string) => spec.scenarios.find((item) => item.id === id)?.name ?? id;
  return (
    <div className={styles.stack}>
      <AddItem kind="questions" />
      {spec.questions.length ? null : <Empty text={t(`${PREFIX}.questions.none`)} />}
      {spec.questions.map((question) => (
        <section className={styles.card} key={question.id}>
          <div className={styles.row}>
            <h4 className={styles.cardTitle}>{question.text}</h4>
            <LightStatusTag tone={question.layer === "knowledge" ? "success" : "neutral"}>
              {layerText(t, question.layer)}
            </LightStatusTag>
            <EditedTag edited={question.edited} />
            <ItemActions itemId={question.id} kind="questions" label={question.text} />
          </div>
          <div className={styles.field}>
            <Field label={t(`${PREFIX}.questions.type`)}>
              {question.type ? questionTypeText(t, question.type) : ""}
            </Field>
            <Field label={t(`${PREFIX}.questions.scenarios`)}>
              {question.scenarioIds.map(scenarioName).join(t("bknProject.listSeparator"))}
            </Field>
            <Field label={t(`${PREFIX}.questions.template`)}>{question.template}</Field>
            <Field label={t(`${PREFIX}.questions.answerShape`)}>{question.answerShape}</Field>
            <Field label={t(`${PREFIX}.questions.needs`)}>
              {question.needs.length
                ? t(
                    `${PREFIX}.questions.needsBy.${question.needsSource === "person" ? "person" : "concepts"}`,
                    {
                      names: question.needs.map(itemName).join(t("bknProject.listSeparator")),
                    },
                  )
                : ""}
            </Field>
          </div>
          <Citations citations={question.citations} supplementReason={question.supplementReason} />
        </section>
      ))}
    </div>
  );
}

export function ScenariosView({ spec }: { spec: RequirementSpec }) {
  const { t } = useTranslation();
  return (
    <div className={styles.stack}>
      <AddItem kind="scenarios" />
      {spec.scenarios.length ? null : <Empty text={t(`${PREFIX}.scenarios.none`)} />}
      {spec.scenarios.map((scenario) => (
        <section className={styles.card} key={scenario.id}>
          <div className={styles.row}>
            <h4 className={styles.cardTitle}>{scenario.name}</h4>
            <EditedTag edited={scenario.edited} />
            <ItemActions itemId={scenario.id} kind="scenarios" label={scenario.name} />
          </div>
          <div className={styles.field}>
            <Field label={t(`${PREFIX}.scenarios.actor`)}>{scenario.actor}</Field>
            <Field label={t(`${PREFIX}.scenarios.trigger`)}>{scenario.trigger}</Field>
            <Field label={t(`${PREFIX}.scenarios.decision`)}>{scenario.decision}</Field>
            <Field label={t(`${PREFIX}.scenarios.knowledge`)}>
              {scenario.knowledge.join(t("bknProject.listSeparator"))}
            </Field>
            <Field label={t(`${PREFIX}.scenarios.capabilities`)}>
              {scenario.capabilities
                .map((capability) =>
                  t(`${PREFIX}.scenarios.capability`, {
                    kind: capabilityKindText(t, capability.kind),
                    name: capability.name,
                  }),
                )
                .join(t("bknProject.listSeparator"))}
            </Field>
          </div>
          <Citations citations={scenario.citations} supplementReason={scenario.supplementReason} />
        </section>
      ))}
    </div>
  );
}

export function ConceptsView({ itemName, spec }: { itemName: ItemName; spec: RequirementSpec }) {
  const { t } = useTranslation();
  const editing = useContext(Editing);
  return (
    <div className={styles.stack}>
      <AddItem kind="concepts" />
      {spec.concepts.length ? null : <Empty text={t(`${PREFIX}.concepts.none`)} />}
      {spec.concepts.map((concept) => (
        <section className={styles.card} key={concept.id}>
          <div className={styles.row}>
            <h4 className={styles.cardTitle}>{concept.term}</h4>
            <LightStatusTag tone={concept.category === "not_ontology" ? "neutral" : "info"}>
              {categoryText(t, concept.category)}
            </LightStatusTag>
            <EditedTag edited={concept.edited} />
            <ItemActions itemId={concept.id} kind="concepts" label={concept.term} />
          </div>
          <div className={styles.field}>
            <Field label={t(`${PREFIX}.concepts.definition`)}>{concept.definition}</Field>
            <Field label={t(`${PREFIX}.concepts.mapsTo`)}>
              {concept.category === "not_ontology"
                ? concept.notOntologyReason
                : concept.mapsTo
                  ? itemName(concept.mapsTo)
                  : t(`${PREFIX}.concepts.notMapped`)}
              {editing && concept.category !== "not_ontology" ? (
                <AppButton onClick={() => editing.map(concept)} size="small" type="link">
                  {t(`${PREFIX}.editing.mapping.change`)}
                </AppButton>
              ) : null}
            </Field>
          </div>
          <Citations citations={concept.citations} supplementReason={concept.supplementReason} />
        </section>
      ))}
    </div>
  );
}

/** Conflicts and modelling choices first, as they wait for the owner, then the rules. */
export function RulesView({ spec }: { spec: RequirementSpec }) {
  const { t } = useTranslation();
  return (
    <div className={styles.stack}>
      {spec.conflicts.map((conflict) => (
        <ConflictCard conflict={conflict} key={conflict.id} />
      ))}
      {spec.choices.map((choice) => (
        <ChoiceCard choice={choice} key={choice.id} />
      ))}
      <AddItem kind="rules" />
      {spec.rules.length ? (
        spec.rules.map((rule) => (
          <section className={styles.card} key={rule.id}>
            <div className={styles.row}>
              <span>{rule.statement}</span>
              <LightStatusTag tone="neutral">{compilesToText(t, rule.compilesTo)}</LightStatusTag>
              <EditedTag edited={rule.edited} />
              <ItemActions itemId={rule.id} kind="rules" label={rule.statement} />
            </div>
            <Citations citations={rule.citations} />
          </section>
        ))
      ) : (
        <Empty text={t(`${PREFIX}.rules.none`)} />
      )}
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: RequirementConflict }) {
  const { t } = useTranslation();
  const { documentName } = useContext(Citing);
  const editing = useContext(Editing);
  const resolution = conflict.resolution;
  const state = resolution ? "resolved" : conflict.deferred ? "deferred" : "open";
  return (
    <section className={styles.card}>
      <div className={styles.row}>
        <h4 className={styles.cardTitle}>
          {t(`${PREFIX}.conflicts.title`, { topic: conflict.topic })}
        </h4>
        <LightStatusTag tone={state === "resolved" ? "success" : "warning"}>
          {t(`${PREFIX}.conflicts.state.${state}`)}
        </LightStatusTag>
        <span className={styles.muted}>{conflictKindText(t, conflict.kind)}</span>
        {editing ? (
          <>
            <span className={styles.spacer} />
            <AppButton
              onClick={() => editing.resolve(conflict)}
              size="small"
              type={state === "open" ? "primary" : "default"}
            >
              {t(`${PREFIX}.editing.conflict.${state === "open" ? "open" : "change"}`)}
            </AppButton>
          </>
        ) : null}
      </div>
      <div className={styles.sides}>
        {conflict.sides.map((side, index) => (
          <div className={styles.side} key={`${side.documentId}-${index}`}>
            <strong>{side.position}</strong>
            <Citations citations={[side]} />
            {conflict.suggestedDocumentId === side.documentId ? (
              <span className={styles.warning}>{t(`${PREFIX}.conflicts.suggested`)}</span>
            ) : null}
          </div>
        ))}
      </div>
      {resolution ? (
        <p className={styles.muted}>
          {resolution.documentId
            ? t(`${PREFIX}.conflicts.resolvedBySide`, {
                name: documentName(resolution.documentId),
                reason: resolution.reason,
                time: dayjs(resolution.time).format("YYYY/MM/DD HH:mm"),
              })
            : t(`${PREFIX}.conflicts.resolvedByText`, {
                reason: resolution.reason,
                text: resolution.text,
                time: dayjs(resolution.time).format("YYYY/MM/DD HH:mm"),
              })}
        </p>
      ) : null}
    </section>
  );
}

function ChoiceCard({ choice }: { choice: RequirementChoice }) {
  const { t } = useTranslation();
  const editing = useContext(Editing);
  const chosen = choice.decision?.optionId ?? choice.recommendedOptionId;
  return (
    <section className={styles.card}>
      <div className={styles.row}>
        <h4 className={styles.cardTitle}>
          {t(`${PREFIX}.choices.title`, { question: choice.question })}
        </h4>
        <LightStatusTag tone={choice.decision ? "success" : "neutral"}>
          {t(`${PREFIX}.choices.state.${choice.decision ? "decided" : "recommended"}`)}
        </LightStatusTag>
        {editing ? (
          <>
            <span className={styles.spacer} />
            <AppButton onClick={() => editing.decide(choice)} size="small">
              {t(`${PREFIX}.editing.choice.open`)}
            </AppButton>
          </>
        ) : null}
      </div>
      <ul className={styles.list}>
        {choice.options.map((option) => (
          <li className={styles.side} key={option.id}>
            <span className={styles.row}>
              <strong>{option.label}</strong>
              {option.id === choice.recommendedOptionId ? (
                <LightStatusTag tone="info">{t(`${PREFIX}.choices.recommended`)}</LightStatusTag>
              ) : null}
              {option.id === chosen ? (
                <LightStatusTag tone="success">{t(`${PREFIX}.choices.holds`)}</LightStatusTag>
              ) : null}
            </span>
            <span className={styles.muted}>{option.consequence}</span>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{choice.decision?.basis || choice.reason}</p>
    </section>
  );
}

/** What drafting dropped and why, so nothing is dropped unseen. */
export function RejectedNote({ spec }: { spec: RequirementSpec }) {
  const { t } = useTranslation();
  if (!spec.rejected.length) {
    return null;
  }
  return (
    <Collapse
      ghost
      items={[
        {
          children: (
            <ul className={styles.list}>
              {spec.rejected.map((item, index) => (
                <li className={styles.row} key={`${item.kind}-${index}`}>
                  <LightStatusTag tone="neutral">{rejectedKindText(t, item.kind)}</LightStatusTag>
                  <span>{item.text}</span>
                  <span className={styles.muted}>{rejectedReasonText(t, item.reason)}</span>
                </li>
              ))}
            </ul>
          ),
          key: "rejected",
          label: t(`${PREFIX}.rejected`, { count: spec.rejected.length }),
        },
      ]}
      size="small"
    />
  );
}
