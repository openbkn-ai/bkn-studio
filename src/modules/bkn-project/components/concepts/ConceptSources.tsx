/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Progress } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectKnowledgeBaseModelStatus } from "@/framework/extension/registry";
import { formatDateTime } from "@/framework/i18n/format";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";

import styles from "./ProjectConcepts.module.css";
import type { ConceptRun, ConceptSourceKey } from "./useConceptRun";

const PREFIX = "bknProject.concepts.sources";

/** The steps each source's turn goes through, as its row shows them. */
const STEPS: Record<ConceptSourceKey, readonly string[]> = {
  document: ["extract", "match"],
  knowledgeBase: ["reading", "analyzing", "writing"],
  table: ["understand", "candidates"],
};

/** What the page knows of a source: how much it holds and what extracting it made. */
export type SourceFacts = {
  /** How many tables, documents or debug files it holds; null while unknown. */
  count: number | null;
  /** When it was last extracted from; null when unknown or never. */
  extractedAt: number | null;
  /** Whether it was extracted from. */
  extracted: boolean;
  /** Whether its extraction runs, started here or elsewhere. */
  running: boolean;
  /** The concepts it made. */
  produced: number;
  /** Why its last extraction failed, as words; empty when it did not. */
  failed: string;
};

/**
 * The sources card: what the project's concepts are extracted from, each source with how much it
 * holds, whether it was extracted and what it made, its progress while a run goes on, and a way
 * to extract from it alone. The knowledge-base files are there where the edition has them.
 */
export function ConceptSources({
  canRun,
  catalogs,
  documents,
  knowledgeBase,
  knowledgeBasePanel,
  knowledgeBaseStatus,
  network,
  notUnderstood,
  onGoToResources,
  onRun,
  onView,
  run,
  tables,
  unmatched,
}: {
  /** Whether a source may be extracted from now. */
  canRun: boolean;
  catalogs: number;
  documents: SourceFacts;
  /** The knowledge-base files; null where the edition has none. */
  knowledgeBase: SourceFacts | null;
  /** The edition's panel, which says what needs the person, such as a problem. */
  knowledgeBasePanel: ReactNode;
  knowledgeBaseStatus: ProjectKnowledgeBaseModelStatus | null;
  network: { structured: number; total: number; unstructured: number };
  notUnderstood: number;
  onGoToResources: () => void;
  onRun: (key: ConceptSourceKey) => void;
  onView: (key: ConceptSourceKey) => void;
  run: ConceptRun | null;
  tables: SourceFacts;
  /** The requirement concepts nothing in the data is yet. */
  unmatched: number;
}) {
  const { t } = useTranslation();

  const progress = (key: ConceptSourceKey) => {
    const turn = run?.sources[key];
    if (!turn || turn.state === "done" || turn.state === "failed" || turn.state === "skipped") {
      return null;
    }
    const steps = STEPS[key];
    const step =
      key === "knowledgeBase" && knowledgeBaseStatus?.phase
        ? Math.max(0, steps.indexOf(knowledgeBaseStatus.phase))
        : turn.step;
    const waiting = turn.state === "waiting";
    return (
      <div className={styles.progress}>
        <ol className={styles.steps}>
          {steps.map((name, index) => (
            <li
              className={
                waiting
                  ? undefined
                  : index < step
                    ? styles.stepDone
                    : index === step
                      ? styles.stepCurrent
                      : undefined
              }
              key={name}
            >
              {t(`${PREFIX}.steps.${key}.${name}`)}
            </li>
          ))}
        </ol>
        <Progress
          percent={waiting ? 0 : Math.round(((step + 0.5) / steps.length) * 100)}
          showInfo={false}
          size="small"
        />
        <span className={styles.muted}>{t(`${PREFIX}.${waiting ? "waiting" : "running"}`)}</span>
      </div>
    );
  };

  const outcome = (key: ConceptSourceKey, facts: SourceFacts) => {
    if (facts.running && !run) {
      return <span className={styles.muted}>{t(`${PREFIX}.running`)}</span>;
    }
    const turn = run?.sources[key];
    if (turn && turn.state !== "done" && turn.state !== "failed" && turn.state !== "skipped") {
      return progress(key);
    }
    if (facts.failed) {
      return <span className={styles.warning}>{facts.failed}</span>;
    }
    if (!facts.extracted) {
      return (
        <span className={styles.cell}>
          <span className={styles.muted}>{t(`${PREFIX}.notExtracted`)}</span>
          {key === "table" && notUnderstood ? (
            <span className={styles.warning}>
              {t(`${PREFIX}.notUnderstood`, { count: notUnderstood })}
            </span>
          ) : null}
        </span>
      );
    }
    const at = facts.extractedAt ? formatDateTime(facts.extractedAt) : "";
    return (
      <span>
        {t(`${PREFIX}.${at ? "extractedAt" : "extracted"}`, { time: at })}
        {t(`${PREFIX}.produced.${key}`, { count: facts.produced })}
        {key === "document" && unmatched ? (
          <span className={styles.warning}>{t(`${PREFIX}.unmatched`, { count: unmatched })}</span>
        ) : null}
      </span>
    );
  };

  const row = (key: ConceptSourceKey, facts: SourceFacts, detail: string, extra?: ReactNode) => (
    <div className={styles.source} data-source={key} key={key}>
      <div className={styles.sourceName}>
        <strong>
          {t(`${PREFIX}.name.${key}`, { count: facts.count ?? 0 })}
          {facts.count === null ? t(`${PREFIX}.countUnknown`) : null}
        </strong>
        {key === "knowledgeBase" ? (
          <LightStatusTag tone="info">{t(`${PREFIX}.professional`)}</LightStatusTag>
        ) : null}
      </div>
      <div className={styles.sourceState}>
        <span className={styles.muted}>{detail}</span>
        {outcome(key, facts)}
        {extra}
      </div>
      <div className={styles.sourceActions}>
        {facts.extracted ? (
          <AppButton onClick={() => onView(key)} size="small" type="link">
            {t(`${PREFIX}.view`)}
          </AppButton>
        ) : null}
        {canRun ? (
          <AppButton
            aria-label={t(`${PREFIX}.runOne.${facts.extracted ? "again" : "first"}Of`, {
              name: t(`${PREFIX}.kind.${key}`),
            })}
            disabled={run !== null || facts.running}
            onClick={() => onRun(key)}
            size="small"
            type="link"
          >
            {t(`${PREFIX}.runOne.${facts.extracted ? "again" : "first"}`)}
          </AppButton>
        ) : null}
      </div>
    </div>
  );

  return (
    <section aria-label={t(`${PREFIX}.title`)} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t(`${PREFIX}.title`)}</h3>
        <span className={styles.muted}>{t(`${PREFIX}.description`)}</span>
        <AppButton className={styles.push} onClick={onGoToResources} size="small" type="link">
          {t(`${PREFIX}.manage`)}
        </AppButton>
      </div>
      {row("table", tables, t(`${PREFIX}.detail.table`, { count: catalogs }))}
      {row("document", documents, t(`${PREFIX}.detail.document`))}
      {knowledgeBase
        ? row(
            "knowledgeBase",
            knowledgeBase,
            t(`${PREFIX}.detail.knowledgeBase`),
            knowledgeBasePanel,
          )
        : null}
      {network.total ? (
        <p className={styles.note}>
          <ExistingMark />
          {t(`${PREFIX}.network`, {
            count: network.total,
            structured: network.structured,
            unstructured: network.unstructured,
          })}
        </p>
      ) : null}
    </section>
  );
}
