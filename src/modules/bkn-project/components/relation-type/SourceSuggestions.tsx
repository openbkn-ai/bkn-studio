/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { joinCountPhrase, say } from "@/modules/bkn-project/components/draft/evidence";
import { getRelationSuggestions } from "@/modules/bkn-project/services/relation-suggestions.service";
import type { RelationSuggestion } from "@/modules/bkn-project/types/draft";

import styles from "./SourceSuggestions.module.css";

const PREFIX = "bknProject.relationEditor.sourceSuggestions";

/**
 * Where a new relation type could start from: once its source is chosen, the relations its
 * tables' fields suggest for that object type, each filled into the editor on a click. Ones the
 * draft already has are adopted from the relations list instead, so they are left out here. Shown
 * only when there is something to offer.
 */
export function SourceSuggestions({
  objectName,
  onPick,
  projectId,
  sourceId,
}: {
  objectName: (id: string) => string;
  onPick: (suggestion: RelationSuggestion) => void;
  projectId: string;
  sourceId: string;
}) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<RelationSuggestion[]>([]);

  useEffect(() => {
    setSuggestions([]);
    if (!sourceId) {
      return undefined;
    }
    let active = true;
    getRelationSuggestions(projectId, sourceId)
      .then((reply) => {
        if (active) {
          setSuggestions(reply.candidates.filter((item) => item.origin !== "drafted"));
        }
      })
      // An object type not adopted has none to offer: nothing shows.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId, sourceId]);

  if (!suggestions.length) {
    return null;
  }
  return (
    <div className={styles.box}>
      <span className={styles.title}>{t(`${PREFIX}.title`, { name: objectName(sourceId) })}</span>
      {suggestions.map((suggestion, index) => (
        <div className={styles.item} key={`${suggestion.name}-${index}`}>
          <div className={styles.text}>
            <span>{suggestion.name}</span>
            <span className={styles.muted}>
              {t(`${PREFIX}.ends`, {
                source: objectName(suggestion.ends.source),
                target: objectName(suggestion.ends.target),
              })}
            </span>
            <span className={styles.muted}>{say(t, joinCountPhrase(suggestion.evidence))}</span>
          </div>
          <AppButton onClick={() => onPick(suggestion)} size="small">
            {t(`${PREFIX}.use`)}
          </AppButton>
        </div>
      ))}
    </div>
  );
}
