/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The experience card beside a page: one sample question at a time. "Try it" hands the question
 * to the page's own input; once the page has answered, the reference answer shows and the reader
 * marks whether the page agreed. The answer is only ever shown here, never sent with the question.
 */

import {
  CheckOutlined,
  CloseOutlined,
  LeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  casesFor,
  type ExperienceSurface,
  type SampleExperience,
} from "@/modules/knowledge-network/experience/sample-experience";

import styles from "./ExperienceCasePanel.module.css";

type Verdict = "match" | "mismatch";
type Progress = { index: number; verdicts: Record<string, Verdict> };
type Phase = "idle" | "trying" | "answered";

const COLLAPSED_KEY = "bkn-studio.sample-experience.collapsed";

function progressKey(experience: SampleExperience, surface: ExperienceSurface): string {
  // Keyed by network too: reinstalling the same version creates a new network to try afresh.
  return `bkn-studio.sample-experience.${experience.knowledgeNetwork}.${experience.sample}.${experience.version}.${surface}`;
}

function readProgress(key: string): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null") as Progress | null;
    if (raw && typeof raw.index === "number" && typeof raw.verdicts === "object" && raw.verdicts) {
      return raw;
    }
  } catch {
    // Unreadable or blocked storage starts from the first case.
  }
  return { index: 0, verdicts: {} };
}

function writeProgress(key: string, progress: Progress): void {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Progress is a convenience; the card works without storage.
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function ExperienceCasePanel({
  experience,
  surface,
  running,
  onTry,
  onRunReference,
}: {
  experience: SampleExperience;
  surface: ExperienceSurface;
  /** Whether the page is still working on what it was last asked. */
  running: boolean;
  /** Puts the question into the page's input and starts it. */
  onTry: (question: string) => void;
  /** Data query and graph exploration: runs the case's reference query (or graph) in the page. */
  onRunReference?: (query: string) => void;
}) {
  const { t } = useTranslation();
  const cases = useMemo(() => casesFor(experience, surface), [experience, surface]);
  const storageKey = progressKey(experience, surface);
  const [progress, setProgress] = useState<Progress>(() => readProgress(storageKey));
  const [phase, setPhase] = useState<Phase>("idle");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const sawRunning = useRef(false);

  useEffect(() => {
    setProgress(readProgress(storageKey));
    setPhase("idle");
  }, [storageKey]);

  // The answer shows once the page has started and then finished the question it was handed.
  useEffect(() => {
    if (phase !== "trying") return;
    if (running) sawRunning.current = true;
    else if (sawRunning.current) setPhase("answered");
  }, [phase, running]);

  if (cases.length === 0) return null;

  const index = Math.min(Math.max(progress.index, 0), cases.length - 1);
  const current = cases[index];
  const verdicts = progress.verdicts;
  const done = cases.filter((item) => verdicts[item.id]).length;
  const matched = cases.filter((item) => verdicts[item.id] === "match").length;
  const finished = done === cases.length;

  const save = (next: Progress) => {
    setProgress(next);
    writeProgress(storageKey, next);
  };
  const goTo = (next: number) => {
    save({ ...progress, index: (next + cases.length) % cases.length });
    setPhase("idle");
  };
  const judge = (verdict: Verdict) => {
    const nextVerdicts = { ...verdicts, [current.id]: verdict };
    // Continue with the next case not yet judged, wrapping around; stay put when all are judged.
    const order = cases.map((_, offset) => (index + 1 + offset) % cases.length);
    const next = order.find((position) => !nextVerdicts[cases[position].id]) ?? index;
    save({ index: next, verdicts: nextVerdicts });
    setPhase("idle");
  };
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      } catch {
        // Remembering the fold is optional.
      }
      return !value;
    });
  };

  if (collapsed) {
    return (
      <aside className={`${styles.panel} ${styles.collapsed}`} data-testid="experience-panel">
        <Tooltip placement="left" title={t("knowledgeNetwork.sampleExperience.expand")}>
          <Button
            aria-label={t("knowledgeNetwork.sampleExperience.expand")}
            icon={<MenuFoldOutlined />}
            onClick={toggleCollapsed}
            size="small"
            type="text"
          />
        </Tooltip>
        <span className={styles.railLabel}>{t("knowledgeNetwork.sampleExperience.title")}</span>
      </aside>
    );
  }

  const verdict = verdicts[current.id];
  // Data query compares against the reference query, graph exploration against the reference graph.
  const reference =
    surface === "query" ? current.cypher.query : surface === "graph" ? current.cypher.graph : null;

  return (
    <aside className={styles.panel} data-testid="experience-panel">
      <header className={styles.header}>
        <div className={styles.heading}>
          <strong>{t("knowledgeNetwork.sampleExperience.title")}</strong>
          <span className={styles.muted}>
            {t("knowledgeNetwork.sampleExperience.progress", { done, total: cases.length })}
          </span>
        </div>
        <Tooltip title={t("knowledgeNetwork.sampleExperience.collapse")}>
          <Button
            aria-label={t("knowledgeNetwork.sampleExperience.collapse")}
            icon={<MenuUnfoldOutlined />}
            onClick={toggleCollapsed}
            size="small"
            type="text"
          />
        </Tooltip>
      </header>
      {experience.businessDate ? (
        <p className={styles.note}>
          {t("knowledgeNetwork.sampleExperience.businessDate", { date: experience.businessDate })}
        </p>
      ) : null}

      {finished ? (
        <div className={styles.summary} data-testid="experience-summary">
          {t("knowledgeNetwork.sampleExperience.summary", {
            total: cases.length,
            matched,
            mismatched: cases.length - matched,
          })}
          <Button
            onClick={() => {
              save({ index: 0, verdicts: {} });
              setPhase("idle");
            }}
            size="small"
          >
            {t("knowledgeNetwork.sampleExperience.restart")}
          </Button>
        </div>
      ) : null}

      <section className={styles.case}>
        <div className={styles.caseNav}>
          <Button
            aria-label={t("knowledgeNetwork.sampleExperience.previous")}
            icon={<LeftOutlined />}
            onClick={() => goTo(index - 1)}
            size="small"
            type="text"
          />
          <span className={styles.muted}>
            {t("knowledgeNetwork.sampleExperience.position", {
              current: index + 1,
              total: cases.length,
            })}
          </span>
          <Button
            aria-label={t("knowledgeNetwork.sampleExperience.next")}
            icon={<RightOutlined />}
            onClick={() => goTo(index + 1)}
            size="small"
            type="text"
          />
        </div>
        <h4 className={styles.caseTitle}>{current.title}</h4>
        <p className={styles.explanation}>{current.explanation}</p>
        <blockquote className={styles.question} data-testid="experience-question">
          {current.question}
        </blockquote>
        {verdict ? (
          <p className={verdict === "match" ? styles.verdictMatch : styles.verdictMismatch}>
            {verdict === "match"
              ? t("knowledgeNetwork.sampleExperience.judgedMatch")
              : t("knowledgeNetwork.sampleExperience.judgedMismatch")}
          </p>
        ) : null}

        {phase === "answered" ? (
          <div className={styles.answer} data-testid="experience-answer">
            <span className={styles.answerLabel}>
              {t("knowledgeNetwork.sampleExperience.referenceAnswer")}
            </span>
            <p>{current.answer}</p>
            {reference ? (
              <>
                <span className={styles.answerLabel}>
                  {t("knowledgeNetwork.sampleExperience.referenceQuery")}
                </span>
                <pre className={styles.code}>{reference}</pre>
                {onRunReference ? (
                  <Button disabled={running} onClick={() => onRunReference(reference)} size="small">
                    {surface === "graph"
                      ? t("knowledgeNetwork.sampleExperience.drawReference")
                      : t("knowledgeNetwork.sampleExperience.runReference")}
                  </Button>
                ) : null}
              </>
            ) : null}
            <p className={styles.muted}>{t("knowledgeNetwork.sampleExperience.compareHint")}</p>
            <div className={styles.actions}>
              <Button icon={<CheckOutlined />} onClick={() => judge("match")} type="primary">
                {t("knowledgeNetwork.sampleExperience.match")}
              </Button>
              <Button icon={<CloseOutlined />} onClick={() => judge("mismatch")}>
                {t("knowledgeNetwork.sampleExperience.mismatch")}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button
              data-testid="experience-try"
              disabled={running}
              loading={phase === "trying" && running}
              onClick={() => {
                sawRunning.current = false;
                setPhase("trying");
                onTry(current.question);
              }}
              type="primary"
            >
              {t("knowledgeNetwork.sampleExperience.try")}
            </Button>
            {phase === "trying" ? (
              <Button onClick={() => setPhase("answered")} type="link">
                {t("knowledgeNetwork.sampleExperience.showAnswer")}
              </Button>
            ) : (
              <Button onClick={() => goTo(index + 1)} type="link">
                {t("knowledgeNetwork.sampleExperience.skip")}
              </Button>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
