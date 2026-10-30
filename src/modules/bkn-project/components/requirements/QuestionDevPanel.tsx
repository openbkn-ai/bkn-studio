/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Select, Spin } from "antd";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { MarkdownText } from "@/framework/ui/common/MarkdownText";
import { Editing } from "@/modules/bkn-project/components/requirements/citing";
import {
  draftErrorText,
  requirementErrorText,
  testCheckReasonText,
  testExpectText,
  testKindText,
  testOutcomeText,
} from "@/modules/bkn-project/components/requirements/requirementMessages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import {
  deleteTest,
  editTest,
  generateQuestionDev,
  getQuestionDev,
  GUIDANCE_POLL_MS,
} from "@/modules/bkn-project/services/requirements.service";
import type { QuestionDev, QuestionTest } from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements.dev";
const EXPECTS = ["exists", "not_exists", "same_record"];

/**
 * A scenario question's test questions, each checked against the data, and the guidance for
 * whoever builds what answers it. Only test questions whose check passed are asked after a release.
 */
export function QuestionDevPanel({
  projectId,
  questionId,
}: {
  projectId: string;
  questionId: string;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  // The owner of an unarchived project edits; the editing context says so.
  const canEdit = useContext(Editing) !== null;
  // undefined while loading, null before the first generation.
  const [dev, setDev] = useState<QuestionDev | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingTest, setEditingTest] = useState<string | null>(null);
  const [reads, setReads] = useState(0);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const read = ++latest.current;
    try {
      const next = await getQuestionDev(projectId, questionId);
      if (read === latest.current) {
        setDev(next);
        setFailed(false);
      }
    } catch {
      if (read === latest.current) {
        setFailed(true);
      }
    } finally {
      setReads((count) => count + 1);
    }
  }, [projectId, questionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generating = dev?.status === "generating";
  useEffect(() => {
    if (!generating) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), GUIDANCE_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [generating, load, reads]);

  /** Sends a change made on the guidance as read; a stale one is read again, never overwritten. */
  const send = async (change: (updateTime: number) => Promise<QuestionDev>) => {
    setBusy(true);
    try {
      latest.current += 1;
      setDev(await change(dev?.updateTime ?? 0));
      setEditingTest(null);
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Requirement.Stale") {
        message.warning(t(`${PREFIX}.stale`));
        // The edit row closes: the change is made again on what was read, never sent over it.
        setEditingTest(null);
        void load();
      } else {
        message.error(
          code === "Requirement.Generating"
            ? t(`${PREFIX}.generatingNow`)
            : requirementErrorText(t, code),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (failed && dev === undefined) {
    return (
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
    );
  }
  if (dev === undefined) {
    return <Spin size="small" />;
  }

  const generate = canEdit ? (
    <AppButton
      disabled={generating}
      loading={busy && !editingTest}
      onClick={() => void send(() => generateQuestionDev(projectId, questionId))}
      size="small"
    >
      {t(`${PREFIX}.${dev ? "regenerate" : "generate"}`)}
    </AppButton>
  ) : null;

  if (!dev) {
    return (
      <div className={styles.row}>
        <span className={styles.muted}>{t(`${PREFIX}.none`)}</span>
        {generate}
      </div>
    );
  }

  const asked = dev.tests.filter((test) => test.check.outcome === "passed").length;
  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <span className={styles.cardTitle}>{t(`${PREFIX}.title`)}</span>
        {dev.status === "ready" ? (
          <span className={styles.muted}>
            {t(`${PREFIX}.counts`, { asked, count: dev.tests.length })}
          </span>
        ) : null}
        <span className={styles.spacer} />
        {generate}
      </div>
      {generating ? <Alert message={t(`${PREFIX}.generating`)} showIcon type="info" /> : null}
      {dev.status === "failed" ? (
        <Alert message={draftErrorText(t, dev.error)} showIcon type="error" />
      ) : null}
      {dev.status === "ready" && !dev.current ? (
        <Alert message={t(`${PREFIX}.notCurrent`)} showIcon type="warning" />
      ) : dev.status === "ready" && dev.ontologyChanged ? (
        <Alert message={t(`${PREFIX}.ontologyChanged`)} showIcon type="warning" />
      ) : null}
      {dev.status === "ready" && !dev.tests.length && dev.noTestsReason ? (
        <p className={styles.muted}>{t(`${PREFIX}.noTests`, { reason: dev.noTestsReason })}</p>
      ) : null}
      {dev.tests.length ? (
        <ul className={styles.list}>
          {dev.tests.map((test) => (
            <TestRow
              busy={busy}
              canEdit={canEdit}
              editing={editingTest === test.id}
              // A row is rebuilt with each version read, so an edit always starts from the
              // text as it now is, never from a draft made on an older one.
              key={`${test.id}@${dev.updateTime}`}
              onCancel={() => setEditingTest(null)}
              onDelete={() =>
                void modal.confirm({
                  cancelText: t("common.cancel"),
                  content: t(`${PREFIX}.deleteConfirm`),
                  okButtonProps: { danger: true },
                  okText: t(`${PREFIX}.delete`),
                  onOk: () => send((time) => deleteTest(projectId, questionId, test.id, time)),
                  title: t(`${PREFIX}.deleteTitle`, { text: test.text }),
                })
              }
              onEdit={() => setEditingTest(test.id)}
              onSave={(change) =>
                void send((time) => editTest(projectId, questionId, test.id, change, time))
              }
              test={test}
            />
          ))}
        </ul>
      ) : null}
      {dev.leftOutTests || dev.deletedTests ? (
        <p className={styles.muted}>
          {[
            dev.leftOutTests ? t(`${PREFIX}.leftOut`, { count: dev.leftOutTests }) : "",
            dev.deletedTests ? t(`${PREFIX}.deleted`, { count: dev.deletedTests }) : "",
          ]
            .filter(Boolean)
            .join(t("bknProject.listSeparator"))}
        </p>
      ) : null}
      {dev.outOfScope.length ? (
        <div className={styles.stack}>
          <span className={styles.fieldLabel}>{t(`${PREFIX}.outOfScope`)}</span>
          <ul className={styles.list}>
            {dev.outOfScope.map((question) => (
              <li className={styles.muted} key={question}>
                {question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {dev.guidance ? (
        <div className={styles.stack}>
          <span className={styles.fieldLabel}>{t(`${PREFIX}.guidance`)}</span>
          <MarkdownText text={dev.guidance} />
        </div>
      ) : null}
    </div>
  );
}

function TestRow({
  busy,
  canEdit,
  editing,
  onCancel,
  onDelete,
  onEdit,
  onSave,
  test,
}: {
  busy: boolean;
  canEdit: boolean;
  editing: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onSave: (change: { expect?: string; text?: string }) => void;
  test: QuestionTest;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(test.text);
  const [expect, setExpect] = useState(test.expect);
  const outcome = test.check.outcome;

  if (editing) {
    return (
      <li className={styles.side}>
        <Input.TextArea
          aria-label={t(`${PREFIX}.text`)}
          autoSize={{ maxRows: 4, minRows: 1 }}
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
        <div className={styles.row}>
          <Select
            aria-label={t(`${PREFIX}.expect`)}
            onChange={setExpect}
            options={EXPECTS.map((value) => ({ label: testExpectText(t, value), value }))}
            size="small"
            value={expect}
          />
          <span className={styles.spacer} />
          <AppButton onClick={onCancel} size="small">
            {t("common.cancel")}
          </AppButton>
          <AppButton
            disabled={!text.trim() || (text.trim() === test.text && expect === test.expect)}
            loading={busy}
            onClick={() =>
              onSave({
                ...(text.trim() === test.text ? {} : { text: text.trim() }),
                ...(expect === test.expect ? {} : { expect }),
              })
            }
            size="small"
            type="primary"
          >
            {t("common.save")}
          </AppButton>
        </div>
      </li>
    );
  }
  return (
    <li className={styles.side}>
      <span className={styles.row}>
        {test.kind ? (
          <LightStatusTag tone="neutral">{testKindText(t, test.kind)}</LightStatusTag>
        ) : null}
        <span>{test.text}</span>
        {test.edited ? <LightStatusTag tone="info">{t(`${PREFIX}.edited`)}</LightStatusTag> : null}
        {canEdit ? (
          <>
            <span className={styles.spacer} />
            <AppButton disabled={busy} onClick={onEdit} size="small" type="link">
              {t(`${PREFIX}.edit`)}
            </AppButton>
            <AppButton danger disabled={busy} onClick={onDelete} size="small" type="link">
              {t(`${PREFIX}.delete`)}
            </AppButton>
          </>
        ) : null}
      </span>
      <span className={styles.row}>
        <span className={styles.muted}>{testExpectText(t, test.expect)}</span>
        <LightStatusTag
          tone={outcome === "passed" ? "success" : outcome === "failed" ? "error" : "neutral"}
        >
          {testOutcomeText(t, outcome)}
        </LightStatusTag>
        {test.check.reason ? (
          <span className={styles.muted}>{testCheckReasonText(t, test.check.reason)}</span>
        ) : null}
      </span>
    </li>
  );
}
