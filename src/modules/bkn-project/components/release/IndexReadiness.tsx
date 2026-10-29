/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  buildOutcomeText,
  INDEX_STATE_TONE,
  indexStateText,
  missingFieldsText,
  refusalText,
} from "@/modules/bkn-project/components/publish/messages";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import {
  buildOntologyIndex,
  getOntologyIndex,
  INDEX_POLL_MS,
} from "@/modules/bkn-project/services/publish.service";
import type { IndexItem, ProjectIndex } from "@/modules/bkn-project/types/publish";

import styles from "../ProjectReleasePage.module.css";

/** States a build again starts from; a missing build setting is added first, as on confirming. */
const BUILDABLE = new Set<IndexItem["state"]>(["not_built", "not_configured", "stale"]);
/** Build outcomes under which a table is building. */
const STARTED = new Set(["created", "existing"]);

/**
 * The local index of each adopted object type's table, which full-text and vector search need.
 * Confirming starts the builds as the person who confirmed; the owner can start them again once
 * what stopped them is solved. A build in progress is read again until it ends.
 */
export function IndexReadiness({ canRun, projectId }: { canRun: boolean; projectId: string }) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  // undefined while loading, null before the first draft.
  const [index, setIndex] = useState<ProjectIndex | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reads, setReads] = useState(0);
  const [building, setBuilding] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Reads and builds answer with the whole readiness; only the newest request's answer counts,
  // so a poll that answers after a build cannot put back what the table looked like before it.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await getOntologyIndex(projectId);
      if (request === latest.current) {
        setIndex(next);
        setLoadFailed(false);
      }
    } catch {
      if (request === latest.current) {
        setLoadFailed(true);
      }
    } finally {
      setReads((count) => count + 1);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  // The warning stays up while reading again, so the retry button alone shows it is reading.
  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const items = index?.objectTypes ?? [];
  const inProgress = items.some((item) => item.state === "building" || item.task);
  useEffect(() => {
    if (!inProgress) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), INDEX_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [inProgress, load, reads]);

  const build = async () => {
    setBuilding(true);
    const request = ++latest.current;
    try {
      const next = await buildOntologyIndex(projectId);
      if (request === latest.current) {
        setIndex(next);
      }
      // A 200 reply records each table's outcome; only a table not yet ready that started counts:
      // a ready table still carries the outcome of an earlier build.
      const started = next.objectTypes.some(
        (item) => item.state !== "ready" && item.build !== null && STARTED.has(item.build.outcome),
      );
      if (started) {
        message.success(t("bknProject.release.index.started"));
      } else {
        message.warning(t("bknProject.release.index.noneStarted"));
      }
    } catch (error) {
      message.error(refusalText(t, error, "bknProject.release.index.failed"));
    } finally {
      setBuilding(false);
    }
  };

  const columns: ColumnsType<IndexItem> = [
    { dataIndex: "name", title: t("bknProject.release.index.objectType") },
    {
      render: (_value, item) => item.table.name,
      title: t("bknProject.release.index.table"),
    },
    {
      render: (_value, item) => (
        <div>
          <LightStatusTag tone={INDEX_STATE_TONE[item.state] ?? "neutral"}>
            {indexStateText(t, item)}
          </LightStatusTag>
          {item.state === "stale" ? (
            <div className={styles.muted}>{t("bknProject.release.index.staleHint")}</div>
          ) : null}
          {item.state === "not_configured" && item.missing.length ? (
            <div className={styles.muted}>{missingFieldsText(t, item.missing)}</div>
          ) : null}
        </div>
      ),
      title: t("bknProject.release.index.stateColumn"),
    },
    {
      render: (_value, item) =>
        item.build ? (
          <span
            className={
              item.build.outcome === "created" || item.build.outcome === "existing"
                ? styles.muted
                : styles.issue
            }
          >
            {buildOutcomeText(t, item.build)}
          </span>
        ) : (
          "-"
        ),
      title: t("bknProject.release.index.buildColumn"),
    },
  ];

  const ready = items.filter((item) => item.state === "ready").length;
  return (
    <Section
      actions={
        <>
          {items.length ? (
            <span className={styles.muted}>
              {t("bknProject.release.index.summary", { ready, total: items.length })}
            </span>
          ) : null}
          {canRun && index ? (
            <AppButton
              disabled={!items.some((item) => BUILDABLE.has(item.state))}
              loading={building}
              onClick={() => void build()}
              size="small"
            >
              {t("bknProject.release.index.build")}
            </AppButton>
          ) : null}
        </>
      }
      description={t("bknProject.release.index.description")}
      title={t("bknProject.release.index.title")}
    >
      {loadFailed ? (
        <Alert
          action={
            <AppButton loading={retrying} onClick={() => void retry()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t("bknProject.release.index.loadFailed")}
          showIcon
          type="warning"
        />
      ) : null}
      {index === undefined ? (
        loadFailed ? null : (
          <Spin />
        )
      ) : !items.length ? (
        <p className={styles.muted}>{t("bknProject.release.index.empty")}</p>
      ) : (
        <>
          {index?.tasksVisible === false ? (
            <Alert message={t("bknProject.release.index.tasksInvisible")} showIcon type="info" />
          ) : null}
          <AppTable<IndexItem>
            columns={columns}
            dataSource={items}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </>
      )}
    </Section>
  );
}
