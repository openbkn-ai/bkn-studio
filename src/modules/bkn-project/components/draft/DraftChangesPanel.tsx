/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo } from "react";
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
import type { Draft, DraftRelationType } from "@/modules/bkn-project/types/draft";

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
  unadoptedEnds,
}: {
  actions: DraftItemActions;
  currentUserId: string | undefined;
  /** Names of people, when the caller may read them. */
  directory: ReadonlyMap<string, string>;
  draft: Draft;
  unadoptedEnds: DraftRelationType[];
}) {
  const { t } = useTranslation();
  const names = useMemo(() => itemNames(draft), [draft]);
  const waiting = draft.items.objectTypes.filter((item) => item.needsIdentity);
  const decisions = [...draft.items.decisions].sort((a, b) => b.time - a.time);
  const disabled = actions.archived || actions.busy;

  if (!waiting.length && !unadoptedEnds.length && !decisions.length) {
    return <EmptyStatePanel description={t("bknProject.model.changes.none")} />;
  }

  return (
    <div className={styles.stack}>
      {waiting.length || unadoptedEnds.length ? (
        <section>
          <h3 className={styles.sectionTitle}>{t("bknProject.model.changes.waitingTitle")}</h3>
          <ul className={styles.changes}>
            {waiting.map((objectType) => (
              <li className={styles.change} key={`identity-${objectType.id}`}>
                <span>
                  {t("bknProject.model.changes.needsIdentity", { name: objectType.name })}
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
                <span>{t("bknProject.model.changes.unadoptedEnd", { name: relation.name })}</span>
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
