/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Collapse, Drawer, Spin } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import {
  answerErrorText,
  expectText,
  outcomeTone,
  outcomeText,
  passedCount,
  regressionErrorText,
  regressionStatusText,
  regressionTone,
} from "@/modules/bkn-project/components/release/releaseMessages";
import {
  getRegression,
  REGRESSION_POLL_MS,
  runRegression,
} from "@/modules/bkn-project/services/release.service";
import type {
  Regression,
  RegressionQuestion,
  RegressionResult,
} from "@/modules/bkn-project/types/release";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.regression";

/**
 * How the project's scenario questions did on a release: each question, or the tests asked in
 * its place, with the judge's verdict and the answer. The owner may run it again.
 */
export function RegressionDrawer({
  canRun,
  networkId,
  onClose,
  projectId,
  version,
}: {
  canRun: boolean;
  networkId: string;
  onClose: () => void;
  projectId: string;
  version: string;
}) {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  // undefined while loading, null before the first run.
  const [regression, setRegression] = useState<Regression | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  // Counts every read, so a running regression is read again after a failed read too.
  const [reads, setReads] = useState(0);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const read = ++latest.current;
    try {
      const next = await getRegression(projectId, networkId);
      if (read === latest.current) {
        setRegression(next);
        setFailed(false);
      }
    } catch {
      if (read === latest.current) {
        setFailed(true);
      }
    } finally {
      setReads((count) => count + 1);
    }
  }, [networkId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = regression?.status === "running";
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), REGRESSION_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [load, reads, running]);

  const run = async () => {
    setStarting(true);
    try {
      // What the run replies wins over a read sent before it.
      latest.current += 1;
      setRegression(await runRegression(projectId, networkId));
      setFailed(false);
      message.success(t(`${PREFIX}.started`));
    } catch {
      message.error(t(`${PREFIX}.startFailed`));
    } finally {
      setStarting(false);
    }
  };

  const who = (id: string) =>
    id === runtimeConfig.currentUser.id
      ? t(`${PREFIX}.you`)
      : (directory.get(id) ?? t(`${PREFIX}.someone`));

  return (
    <Drawer
      destroyOnHidden
      extra={
        canRun && regression !== undefined ? (
          <AppButton disabled={running} loading={starting} onClick={() => void run()}>
            {t(`${PREFIX}.run`)}
          </AppButton>
        ) : null
      }
      onClose={onClose}
      open
      title={t(`${PREFIX}.title`, { version })}
      width={760}
    >
      {failed && regression === undefined ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="error"
        />
      ) : regression === undefined ? (
        <Spin />
      ) : regression === null ? (
        <p className={styles.muted}>{t(`${PREFIX}.none`)}</p>
      ) : (
        <div className={styles.stack}>
          <div className={styles.row}>
            <LightStatusTag tone={regressionTone(regression.status)}>
              {regressionStatusText(t, regression.status)}
            </LightStatusTag>
            {regression.results.length ? (
              <span className={styles.muted}>
                {t(`${PREFIX}.summary`, passedCount(regression))}
              </span>
            ) : null}
          </div>
          <p className={styles.muted}>
            {/* A run started on its own has no runner: only its start is said. */}
            {regression.runnerId
              ? t(`${PREFIX}.runBy`, {
                  time: dayjs(regression.startTime).format("YYYY/MM/DD HH:mm"),
                  who: who(regression.runnerId),
                })
              : t(`${PREFIX}.startedAt`, {
                  time: dayjs(regression.startTime).format("YYYY/MM/DD HH:mm"),
                })}
          </p>
          {regression.status === "failed" && regression.error ? (
            <Alert message={regressionErrorText(t, regression.error)} showIcon type="error" />
          ) : null}
          {regression.questions.map((question) => (
            <QuestionResults
              key={question.id}
              question={question}
              results={regression.results.filter((result) => result.questionId === question.id)}
              running={running}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

function QuestionResults({
  question,
  results,
  running,
}: {
  question: RegressionQuestion;
  results: RegressionResult[];
  running: boolean;
}) {
  const { t } = useTranslation();
  // A question with tests is asked by them; one without is asked itself.
  const asked = question.tests.length
    ? question.tests.map((test) => ({
        expect: test.expect,
        key: test.id,
        result: results.find((result) => result.testId === test.id),
        text: test.text,
      }))
    : [{ expect: "", key: question.id, result: results[0], text: "" }];
  return (
    <section className={styles.card}>
      <h4 className={styles.blockTitle}>{question.text}</h4>
      <ul className={styles.list}>
        {asked.map((entry) => (
          <li className={styles.listItem} key={entry.key}>
            <span className={styles.row}>
              {entry.result ? (
                <LightStatusTag tone={outcomeTone(entry.result.outcome)}>
                  {outcomeText(t, entry.result.outcome)}
                </LightStatusTag>
              ) : (
                <LightStatusTag tone="neutral">
                  {t(`${PREFIX}.${running ? "asking" : "noResult"}`)}
                </LightStatusTag>
              )}
              <span>{entry.text || t(`${PREFIX}.asItself`)}</span>
              {entry.expect ? (
                <span className={styles.questionMeta}>{expectText(t, entry.expect)}</span>
              ) : null}
            </span>
            {entry.result ? <ResultDetail result={entry.result} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultDetail({ result }: { result: RegressionResult }) {
  const { t } = useTranslation();
  const failedCalls = result.toolStatuses.filter((status) => status && status !== "succeeded");
  return (
    <>
      {result.missing.length ? (
        <span className={styles.detail}>
          {t(`${PREFIX}.missing`, {
            names: result.missing
              .map((item) => item.name || item.id)
              .join(t("bknProject.listSeparator")),
          })}
        </span>
      ) : null}
      {result.outcome === "error" ? (
        <span className={styles.detail}>{answerErrorText(t, result.errorCode)}</span>
      ) : null}
      {result.reason ? <span className={styles.detail}>{result.reason}</span> : null}
      {result.answer ? (
        <Collapse
          className={styles.indent}
          ghost
          items={[
            {
              children: (
                <div className={styles.stack}>
                  <MarkdownText text={result.answer} />
                  {result.toolStatuses.length ? (
                    <span className={styles.questionMeta}>
                      {failedCalls.length
                        ? t(`${PREFIX}.callsFailed`, {
                            count: result.toolStatuses.length,
                            failed: failedCalls.length,
                          })
                        : t(`${PREFIX}.calls`, { count: result.toolStatuses.length })}
                    </span>
                  ) : null}
                </div>
              ),
              key: "answer",
              label: t(`${PREFIX}.answer`),
            },
          ]}
          size="small"
        />
      ) : null}
    </>
  );
}
