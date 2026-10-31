/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDateTime } from "@/framework/i18n/format";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  describeDecision,
  itemNames,
  whoDecided,
} from "@/modules/bkn-project/components/draft/changes";
import type { DraftItemActions } from "@/modules/bkn-project/components/draft/DraftTables";
import type { Draft, DraftObjectType, DraftRelationType } from "@/modules/bkn-project/types/draft";
import type { PendingItem, PendingQuestion } from "@/modules/bkn-project/types/publish";

import styles from "./DraftTables.module.css";

/**
 * What changed on the draft. What still waits for people comes first, each with the action that
 * settles it; then the decisions, newest first. Nothing here undoes a decision: making the
 * opposite change records it too.
 */
export function DraftChangesPanel({
  actions,
  currentUserId,
  directory,
  draft,
  neededBy,
  onSetUpdateField,
  unadoptedEnds,
  updateFields = [],
}: {
  actions: DraftItemActions;
  currentUserId: string | null | undefined;
  /** Names of people, when the caller may read them. */
  directory: ReadonlyMap<string, string>;
  draft: Draft;
  /** The scenario questions that need a waiting item, by `kind/item_id`. */
  neededBy: ReadonlyMap<string, PendingQuestion[]>;
  /** Sets an object type's update field; true once the draft has it. */
  onSetUpdateField?: (objectTypeId: string, property: string) => Promise<boolean>;
  unadoptedEnds: DraftRelationType[];
  /** Object types without an update field, suggested after what blocks and what is undecided. */
  updateFields?: PendingItem[];
}) {
  const { t } = useTranslation();
  const names = useMemo(() => itemNames(draft), [draft]);
  const waiting = draft.items.objectTypes.filter((item) => item.needsIdentity);
  const decisions = [...draft.items.decisions].sort((a, b) => b.time - a.time);
  const disabled = actions.archived || actions.busy;

  const objectTypes = new Map(draft.items.objectTypes.map((item) => [item.id, item]));
  // Only those the draft still has without one: a suggestion read before the draft moved drops out.
  const suggested = updateFields.filter((item) => {
    const objectType = objectTypes.get(item.itemId);
    return objectType && !objectType.incrementalKey;
  });

  if (!waiting.length && !unadoptedEnds.length && !suggested.length && !decisions.length) {
    return (
      <EmptyStatePanel
        description={t("bknProject.model.changes.none")}
        title={t("bknProject.model.changes.noneTitle")}
      />
    );
  }

  return (
    <div className={styles.stack}>
      {waiting.length || unadoptedEnds.length || suggested.length ? (
        <section>
          <h3 className={styles.sectionTitle}>{t("bknProject.model.changes.waitingTitle")}</h3>
          <ul className={styles.changes}>
            {waiting.map((objectType) => (
              <li className={styles.change} key={`identity-${objectType.id}`}>
                <span className={styles.changeText}>
                  {t("bknProject.model.changes.needsIdentity", { name: objectType.name })}
                  <NeededBy questions={neededBy.get(`object_types/${objectType.id}`)} />
                </span>
                <AppButton
                  aria-label={t("bknProject.model.identity.choose", { name: objectType.name })}
                  disabled={disabled}
                  onClick={() => actions.onChooseIdentity(objectType)}
                  size="small"
                  type="primary"
                >
                  {t("bknProject.model.identity.chooseLabel")}
                </AppButton>
              </li>
            ))}
            {unadoptedEnds.map((relation) => (
              <li className={styles.change} key={`ends-${relation.id}`}>
                <span className={styles.changeText}>
                  {t("bknProject.model.changes.unadoptedEnd", { name: relation.name })}
                  <NeededBy questions={neededBy.get(`relation_types/${relation.id}`)} />
                </span>
                <AppButton
                  aria-label={t("bknProject.model.changes.unadoptItem", { name: relation.name })}
                  disabled={disabled}
                  onClick={() => actions.onAdopt("relation_types", relation, false)}
                  size="small"
                >
                  {t("bknProject.model.changes.unadopt")}
                </AppButton>
              </li>
            ))}
            {suggested.map((item) => (
              <UpdateFieldRow
                disabled={disabled}
                item={item}
                key={`update-field-${item.itemId}`}
                objectType={objectTypes.get(item.itemId)!}
                onSet={onSetUpdateField}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {decisions.length ? (
        <section>
          <h3 className={styles.sectionTitle}>{t("bknProject.model.changes.doneTitle")}</h3>
          <ul className={styles.changes}>
            {decisions.map((decision) => {
              const described = describeDecision(t, decision, names);
              return (
                <li
                  className={styles.change}
                  data-testid="draft-change"
                  key={`${decision.time}-${decision.kind}-${decision.itemId}-${decision.action}`}
                >
                  <div className={styles.evidence}>
                    <span>{described.text}</span>
                    {described.before !== undefined ? (
                      <span className={styles.muted}>
                        {t("bknProject.model.changes.beforeAfter", {
                          after: described.after,
                          before: described.before,
                        })}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.muted}>
                    {t("bknProject.model.changes.byAt", {
                      time: formatDateTime(decision.time),
                      who: whoDecided(t, decision.by, currentUserId, directory),
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * An object type whose local index could refresh only the records that changed, once it has an
 * update field: one of its time properties, named as people know them, is chosen and set.
 */
function UpdateFieldRow({
  disabled,
  item,
  objectType,
  onSet,
}: {
  disabled: boolean;
  item: PendingItem;
  objectType: DraftObjectType;
  onSet?: (objectTypeId: string, property: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const values = item.updateField?.values ?? [];
  const [value, setValue] = useState<string | undefined>(values[0]);
  const [saving, setSaving] = useState(false);
  const allowed = Boolean(onSet) && item.updateField?.allowed !== false;
  const label = (name: string) =>
    objectType.properties.find((property) => property.name === name)?.displayName || name;

  return (
    <li className={styles.change}>
      <span className={styles.changeText}>
        <strong>{t("bknProject.model.changes.updateField.title")}</strong>
        {t("bknProject.model.changes.updateField.description", { name: objectType.name })}
      </span>
      {values.length ? (
        <span className={styles.row}>
          <Select
            aria-label={t("bknProject.model.changes.updateField.title")}
            disabled={disabled || !allowed}
            onChange={setValue}
            options={values.map((name) => ({ label: label(name), value: name }))}
            size="small"
            value={value}
          />
          <AppButton
            disabled={disabled || !allowed || !value}
            loading={saving}
            onClick={() => {
              if (!value || !onSet) {
                return;
              }
              setSaving(true);
              void onSet(objectType.id, value).finally(() => setSaving(false));
            }}
            size="small"
            type="primary"
          >
            {t("bknProject.model.changes.updateField.set")}
          </AppButton>
        </span>
      ) : (
        <span className={styles.muted}>{t("bknProject.model.changes.updateField.none")}</span>
      )}
    </li>
  );
}

/** The scenario questions an item is needed by, one per line; nothing when none. */
function NeededBy({ questions }: { questions: PendingQuestion[] | undefined }) {
  const { t } = useTranslation();
  if (!questions?.length) {
    return null;
  }
  return (
    <span className={styles.neededBy}>
      {t("bknProject.model.changes.neededBy")}
      {questions.map((question) => (
        <span key={question.id}>{question.text}</span>
      ))}
    </span>
  );
}
