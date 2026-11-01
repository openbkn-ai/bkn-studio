/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Spin } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { joinCountPhrase, say } from "@/modules/bkn-project/components/draft/evidence";
import { draftTables } from "@/modules/bkn-project/components/relation-type/relation-values";
import {
  askRelationSuggestions,
  getRelationSuggestions,
  listIsolatedObjectTypes,
} from "@/modules/bkn-project/services/relation-suggestions.service";
import type {
  Draft,
  IsolatedObjectType,
  RelationSuggestion,
  RelationSuggestions,
} from "@/modules/bkn-project/types/draft";

import styles from "./RelationSuggestions.module.css";

const PREFIX = "bknProject.relationSuggestions";
/** Where a suggestion comes from, as the page names it; any other is named as `other`. */
const ORIGINS = new Set(["drafted", "foreign_key", "name_match", "stem_match", "ai"]);

/**
 * The adopted object types nothing connects yet, and the relation types that could connect each:
 * first what the draft and the tables' fields suggest, counted over the tables, then on asking
 * what AI adds, each with why. A suggestion drafting made is adopted as it is; any other opens in
 * the relation editor, filled in, for a person to check and save.
 */
export function RelationSuggestionsEntry({
  draft,
  editable,
  onAdopt,
  onCreate,
  projectId,
}: {
  draft: Draft;
  editable: boolean;
  /** Adopts a relation type drafting made. */
  onAdopt: (relationTypeId: string) => Promise<void>;
  /** Opens the relation editor on a suggestion, to save it as a new relation type. */
  onCreate: (suggestion: RelationSuggestion) => void;
  projectId: string;
}) {
  const { t } = useTranslation();
  const [isolated, setIsolated] = useState<IsolatedObjectType[] | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RelationSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askFailed, setAskFailed] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);
  // Only the newest read counts: choosing another object type while one is read.
  const latest = useRef(0);

  // Read again with each version of the draft: adopting or saving a relation connects objects.
  useEffect(() => {
    let active = true;
    listIsolatedObjectTypes(projectId)
      .then((items) => active && setIsolated(items))
      .catch(() => active && setIsolated(null));
    return () => {
      active = false;
    };
  }, [projectId, draft.updateTime]);

  const load = useCallback(
    async (objectTypeId: string) => {
      const read = ++latest.current;
      setLoading(true);
      setFailed(false);
      setAskFailed(false);
      // A newer read supersedes an answer AI is still writing: it is dropped when it comes.
      setAsking(false);
      try {
        const next = await getRelationSuggestions(projectId, objectTypeId);
        if (read === latest.current) {
          setSuggestions(next);
        }
      } catch {
        if (read === latest.current) {
          setSuggestions(null);
          setFailed(true);
        }
      } finally {
        if (read === latest.current) {
          setLoading(false);
        }
      }
    },
    [projectId],
  );

  // The chosen object type's suggestions, read again with each version of the draft.
  useEffect(() => {
    if (selected) {
      void load(selected);
    }
  }, [selected, draft.updateTime, load]);
  // An object type connected since is no longer offered: the choice starts over.
  useEffect(() => {
    if (selected && isolated && !isolated.some((item) => item.id === selected)) {
      setSelected(null);
      setSuggestions(null);
    }
  }, [isolated, selected]);

  const ask = async () => {
    if (!selected) {
      return;
    }
    const read = ++latest.current;
    setAsking(true);
    setAskFailed(false);
    try {
      const next = await askRelationSuggestions(projectId, selected);
      if (read === latest.current) {
        setSuggestions(next);
      }
    } catch {
      // What the fields suggest stays; AI could not add to it this time.
      if (read === latest.current) {
        setAskFailed(true);
      }
    } finally {
      if (read === latest.current) {
        setAsking(false);
      }
    }
  };

  const adopt = async (suggestion: RelationSuggestion) => {
    setAdopting(suggestion.relationTypeId);
    try {
      await onAdopt(suggestion.relationTypeId);
    } finally {
      setAdopting(null);
    }
  };

  // Names as people know them: object types, their properties by display name, and tables.
  const names = useMemo(() => {
    const objects = new Map(draft.items.objectTypes.map((item) => [item.id, item]));
    const tables = new Map(draftTables(draft).map((table) => [table.resourceId, table.name]));
    return {
      object: (id: string) => objects.get(id)?.name ?? id,
      property: (objectTypeId: string, name: string) =>
        objects.get(objectTypeId)?.properties.find((property) => property.name === name)
          ?.displayName || name,
      table: (resourceId: string) => tables.get(resourceId) ?? resourceId,
    };
  }, [draft]);

  const mappingText = ({ ends }: RelationSuggestion) => {
    const pair = (source: string, target: string) => t(`${PREFIX}.pair`, { source, target });
    const separator = t("bknProject.listSeparator");
    if (ends.link) {
      return t(`${PREFIX}.through`, {
        pairs: [
          ...ends.link.sourceMapping.map((item) =>
            pair(names.property(ends.source, item.sourceProperty), item.targetProperty),
          ),
          ...ends.link.targetMapping.map((item) =>
            pair(item.sourceProperty, names.property(ends.target, item.targetProperty)),
          ),
        ].join(separator),
        table: names.table(ends.link.resourceId),
      });
    }
    return ends.mapping
      .map((item) =>
        pair(
          names.property(ends.source, item.sourceProperty),
          names.property(ends.target, item.targetProperty),
        ),
      )
      .join(separator);
  };

  if (isolated === null) {
    return null;
  }
  if (!isolated.length) {
    return <span className={styles.muted}>{t(`${PREFIX}.allConnected`)}</span>;
  }
  return (
    <>
      <AppButton onClick={() => setOpen(true)}>
        {t(`${PREFIX}.entry`, { count: isolated.length })}
      </AppButton>
      <Drawer
        destroyOnHidden
        onClose={() => setOpen(false)}
        open={open}
        title={t(`${PREFIX}.title`)}
        width={640}
      >
        <div className={styles.stack}>
          <p className={styles.muted}>{t(`${PREFIX}.hint`)}</p>
          <div className={styles.chips}>
            {isolated.map((item) => (
              <AppButton
                aria-pressed={item.id === selected}
                key={item.id}
                onClick={() => setSelected(item.id)}
                size="small"
                type={item.id === selected ? "primary" : "default"}
              >
                {item.name}
              </AppButton>
            ))}
          </div>
          {selected === null ? (
            <p className={styles.muted}>{t(`${PREFIX}.choose`)}</p>
          ) : loading ? (
            <Spin />
          ) : failed ? (
            <Alert
              action={
                <AppButton onClick={() => void load(selected)} size="small">
                  {t("common.retry")}
                </AppButton>
              }
              message={t(`${PREFIX}.loadFailed`)}
              showIcon
              type="error"
            />
          ) : suggestions ? (
            <>
              <div className={styles.toolbar}>
                <span className={styles.muted}>
                  {t(`${PREFIX}.found`, {
                    count: suggestions.candidates.length,
                    name: suggestions.objectType.name,
                  })}
                </span>
                {editable ? (
                  <AppButton loading={asking} onClick={() => void ask()}>
                    {t(`${PREFIX}.${asking ? "asking" : "ask"}`)}
                  </AppButton>
                ) : null}
              </div>
              {askFailed ? (
                <Alert message={t(`${PREFIX}.askFailed`)} showIcon type="warning" />
              ) : null}
              {suggestions.candidates.length ? null : (
                <p className={styles.muted}>{t(`${PREFIX}.none`)}</p>
              )}
              {suggestions.candidates.map((suggestion, index) => (
                <section className={styles.card} key={`${suggestion.origin}-${index}`}>
                  <div className={styles.row}>
                    <strong>{suggestion.name}</strong>
                    <LightStatusTag tone={suggestion.origin === "ai" ? "info" : "neutral"}>
                      {t(
                        `${PREFIX}.origin.${ORIGINS.has(suggestion.origin) ? suggestion.origin : "other"}`,
                      )}
                    </LightStatusTag>
                    <span className={styles.spacer} />
                    {editable ? (
                      suggestion.origin === "drafted" && suggestion.relationTypeId ? (
                        <AppButton
                          loading={adopting === suggestion.relationTypeId}
                          onClick={() => void adopt(suggestion)}
                          size="small"
                          type="primary"
                        >
                          {t(`${PREFIX}.adopt`)}
                        </AppButton>
                      ) : (
                        <AppButton
                          onClick={() => {
                            setOpen(false);
                            onCreate(suggestion);
                          }}
                          size="small"
                          type="primary"
                        >
                          {t(`${PREFIX}.open`)}
                        </AppButton>
                      )
                    ) : null}
                  </div>
                  <span>
                    {t(`${PREFIX}.ends`, {
                      source: names.object(suggestion.ends.source),
                      target: names.object(suggestion.ends.target),
                    })}
                  </span>
                  <span className={styles.muted}>{mappingText(suggestion)}</span>
                  <span className={styles.muted}>
                    {say(t, joinCountPhrase(suggestion.evidence))}
                  </span>
                  {suggestion.reason ? (
                    <span className={styles.reason}>{suggestion.reason}</span>
                  ) : null}
                </section>
              ))}
            </>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
