/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Modal, Radio, Space } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  listText,
  refusalText,
  UNDERSTANDING_STATUS_TONE,
  understandingMinutesLeft,
} from "@/modules/bkn-project/components/publish/messages";
import {
  getProjectStatus,
  getUnderstanding,
  UNDERSTANDING_POLL_MS,
  understandCatalogs,
} from "@/modules/bkn-project/services/publish.service";
import type {
  ProjectNextAction,
  ProjectStatus,
  UnderstandApplyMode,
  UnderstandingCatalog,
} from "@/modules/bkn-project/types/publish";

import styles from "../ProjectModel.module.css";

/** Tables of the catalogs whose progress the caller can see. */
function tally(catalogs: UnderstandingCatalog[]) {
  const tables = catalogs.filter((catalog) => catalog.visible).flatMap((catalog) => catalog.tables);
  const count = (...statuses: string[]) =>
    tables.filter((table) => statuses.includes(table.status)).length;
  const done = count("completed");
  const remaining = count("pending", "running");
  return {
    done,
    /** No table was ever understood, nor tried. */
    neverRun: count("not_started") === tables.length,
    remaining,
    total: tables.length,
    // Failed, cancelled, and never understood, such as the tables of a catalog added since.
    unfinished: tables.length - done - remaining,
  };
}

/**
 * Semantic understanding of the project's catalogs: bkn-project asks vega to name and describe
 * their tables, which drafting then uses. Tables are understood one at a time, so the bar reads
 * the progress again while any waits or runs, and stops when none does or the page is left.
 */
export function UnderstandingBar({
  archived,
  catalogNames,
  hasDraft,
  onRedraft,
  ownerIsCaller,
  projectId,
  redraftDisabled,
}: {
  archived: boolean;
  catalogNames: Record<string, string>;
  /** Only a draft drafted before the names changed can be drafted again with them. */
  hasDraft: boolean;
  onRedraft: () => void;
  ownerIsCaller: boolean;
  projectId: string;
  /** True while drafting runs or starts, as for the page's own drafting button. */
  redraftDisabled: boolean;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [catalogs, setCatalogs] = useState<UnderstandingCatalog[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reads, setReads] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [applyMode, setApplyMode] = useState<UnderstandApplyMode>("fill_empty");
  const [all, setAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Set once tables waited or ran while the page was open: what finishes then renamed them.
  const sawRunning = useRef(false);
  const [renamed, setRenamed] = useState(false);
  // Advice from the project's state: most tables have no business name, so understand them first.
  const [unnamed, setUnnamed] = useState<ProjectStatus["hints"][number] | null>(null);
  const [understandAction, setUnderstandAction] = useState<ProjectNextAction | null>(null);
  const loadHint = useCallback(async () => {
    try {
      const status = await getProjectStatus(projectId);
      setUnnamed(status.hints.find((hint) => hint.code === "catalogs_unnamed") ?? null);
      setUnderstandAction(
        status.nextActions.find((action) => action.action === "understand_catalogs") ?? null,
      );
    } catch {
      // Advice only: without the state the bar shows what it has.
    }
  }, [projectId]);
  useEffect(() => {
    void loadHint();
  }, [loadHint]);

  const load = useCallback(async () => {
    try {
      const next = await getUnderstanding(projectId);
      setCatalogs(next);
      setLoadFailed(false);
      const { done, remaining } = tally(next);
      if (remaining) {
        sawRunning.current = true;
      } else if (sawRunning.current && done) {
        setRenamed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setReads((count) => count + 1);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = catalogs ? tally(catalogs) : null;
  const running = Boolean(counts?.remaining);
  // Once a run ends, the tables may have their names: the advice is read again, not kept from before.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      void loadHint();
    }
    wasRunning.current = running;
  }, [loadHint, running]);
  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), UNDERSTANDING_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [running, load, reads]);

  const catalogName = (id: string) => catalogNames[id] ?? id;

  const submit = async () => {
    setSubmitting(true);
    try {
      const submitted = await understandCatalogs(projectId, { all, applyMode });
      setAsking(false);
      const tables = submitted.reduce((sum, catalog) => sum + catalog.tables, 0);
      const skipped = submitted.filter((catalog) => !catalog.permitted);
      if (tables) {
        message.success(t("bknProject.understand.started", { count: tables }));
      } else if (!skipped.length) {
        message.info(t("bknProject.understand.nothingToDo"));
      }
      if (skipped.length) {
        message.warning(
          t("bknProject.understand.skipped", {
            names: listText(
              t,
              skipped.map((catalog) => catalogName(catalog.catalogId)),
            ),
          }),
        );
      }
      await load();
      void loadHint();
    } catch (error) {
      message.error(refusalText(t, error, "bknProject.understand.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadFailed && !catalogs) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void load()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        message={t("bknProject.understand.progress.loadFailed")}
        showIcon
        type="warning"
      />
    );
  }
  if (!catalogs || !counts) {
    return null;
  }

  const minutes = understandingMinutesLeft(counts.remaining);
  const summary = running
    ? t("bknProject.understand.progress.summary", { done: counts.done, total: counts.total })
    : counts.neverRun
      ? t("bknProject.understand.progress.notStarted")
      : counts.unfinished
        ? t("bknProject.understand.progress.unfinished", { count: counts.unfinished })
        : t("bknProject.understand.progress.done");
  const invisible = catalogs.filter((catalog) => !catalog.visible);
  const canRun = ownerIsCaller && !archived;

  return (
    <div className={styles.understanding}>
      {unnamed && !running ? (
        <Alert
          action={
            canRun && understandAction?.allowed !== false ? (
              <AppButton onClick={() => setAsking(true)} size="small" type="primary">
                {t("bknProject.understand.hint.run")}
              </AppButton>
            ) : null
          }
          description={
            understandAction?.reason === "not_owner"
              ? t("bknProject.understand.hint.ownerOnly")
              : undefined
          }
          message={
            unnamed.count !== undefined && unnamed.total !== undefined
              ? t("bknProject.understand.hint.unnamed", {
                  count: unnamed.count,
                  total: unnamed.total,
                })
              : t("bknProject.understand.hint.unnamedUncounted")
          }
          showIcon
          type="warning"
        />
      ) : null}
      <div className={styles.understandingHead}>
        <span>{summary}</span>
        {running && minutes !== null ? (
          <span className={styles.summary}>
            {t("bknProject.understand.progress.remaining", { count: minutes })}
          </span>
        ) : null}
        <span className={styles.spacer} />
        {counts.total ? (
          <AppButton onClick={() => setExpanded((open) => !open)} size="small" type="link">
            {t(
              expanded
                ? "bknProject.understand.progress.hide"
                : "bknProject.understand.progress.show",
            )}
          </AppButton>
        ) : null}
        {canRun ? (
          <AppButton disabled={running} onClick={() => setAsking(true)} size="small">
            {t("bknProject.understand.button")}
          </AppButton>
        ) : null}
      </div>
      {invisible.map((catalog) => (
        <div className={styles.summary} key={catalog.catalogId}>
          {t("bknProject.understand.progress.invisible", { name: catalogName(catalog.catalogId) })}
        </div>
      ))}
      {expanded ? (
        <div className={styles.understandingTables}>
          {catalogs
            .filter((catalog) => catalog.visible)
            .flatMap((catalog) => catalog.tables)
            .map((table) => (
              <div className={styles.understandingTable} key={table.resourceId}>
                <span>{table.name}</span>
                <LightStatusTag tone={UNDERSTANDING_STATUS_TONE[table.status] ?? "neutral"}>
                  {table.status === "completed" && !table.applied
                    ? t("bknProject.understand.progress.notApplied")
                    : t(`bknProject.understand.status.${table.status}`)}
                </LightStatusTag>
              </div>
            ))}
        </div>
      ) : null}
      {renamed && hasDraft && !running ? (
        <Alert
          action={
            canRun ? (
              <AppButton disabled={redraftDisabled} onClick={onRedraft} size="small">
                {t("bknProject.model.regenerate")}
              </AppButton>
            ) : null
          }
          message={t("bknProject.understand.progress.redraft")}
          showIcon
          type="info"
        />
      ) : null}
      <Modal
        cancelText={t("common.cancel")}
        confirmLoading={submitting}
        okText={t("bknProject.understand.dialog.ok")}
        onCancel={() => setAsking(false)}
        onOk={() => void submit()}
        open={asking}
        title={t("bknProject.understand.dialog.title")}
      >
        <Space direction="vertical" size={12}>
          <span>{t("bknProject.understand.dialog.intro")}</span>
          <Radio.Group
            onChange={(event) => setApplyMode(event.target.value as UnderstandApplyMode)}
            value={applyMode}
          >
            <Space direction="vertical">
              <Radio value="fill_empty">{t("bknProject.understand.dialog.fillEmpty")}</Radio>
              <Radio value="force">{t("bknProject.understand.dialog.force")}</Radio>
            </Space>
          </Radio.Group>
          {applyMode === "force" ? (
            <span className={styles.summary}>{t("bknProject.understand.dialog.forceHint")}</span>
          ) : null}
          <div>
            <Checkbox checked={all} onChange={(event) => setAll(event.target.checked)}>
              {t("bknProject.understand.dialog.all")}
            </Checkbox>
            <div className={styles.summary}>{t("bknProject.understand.dialog.allHint")}</div>
          </div>
          <span className={styles.summary}>{t("bknProject.understand.dialog.duration")}</span>
        </Space>
      </Modal>
    </div>
  );
}
