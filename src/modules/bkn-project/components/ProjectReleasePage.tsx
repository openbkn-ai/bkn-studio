/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { formatRate } from "@/modules/bkn-project/components/draft/evidence";
import { RegressionDrawer } from "@/modules/bkn-project/components/release/RegressionDrawer";
import { ReleasePublish } from "@/modules/bkn-project/components/release/ReleasePublish";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { useOnSettled } from "@/modules/bkn-project/components/release/useOnSettled";
import { ReleaseVersions } from "@/modules/bkn-project/components/release/ReleaseVersions";
import {
  CHECK_STATUS_TONE,
  CHECK_STATUSES,
  checkReasonText,
  refusalText,
} from "@/modules/bkn-project/components/publish/messages";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getProjectVersions } from "@/modules/bkn-project/services/release.service";
import {
  CHECK_POLL_MS,
  getOntologyCheck,
  getProjectStatus,
  runOntologyCheck,
} from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { ProjectVersions } from "@/modules/bkn-project/types/release";
import type {
  CheckCountState,
  CheckJoinResult,
  CheckKeyResult,
  OntologyCheck,
  ProjectStatus,
} from "@/modules/bkn-project/types/publish";
import type { BuildTab } from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectReleasePage.module.css";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

type JoinRow = CheckJoinResult & { key: string; relationType: string };

const PAGE_SIZE = 10;

/** A count that could not be read, or identities that repeat or are empty. */
const keyHasProblem = (item: CheckKeyResult) =>
  item.state === "failed" || (item.state === "counted" && Boolean(item.duplicates || item.nulls));
// Records without a match are only reported, so a counted join has no problem.
const joinHasProblem = (item: CheckJoinResult) => item.state === "failed";

/**
 * Rows with a problem first, rows another check covers last; the rest keep the check's order.
 */
function byAttention<T extends CheckCountState>(rows: T[], hasProblem: (row: T) => boolean): T[] {
  const rank = (row: T) => (hasProblem(row) ? 0 : row.reason === "knowledge_base_build" ? 2 : 1);
  return rows
    .map((row, at) => ({ at, rank: rank(row), row }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map(({ row }) => row);
}

/**
 * The data check of the last confirmation: identities that repeat or are empty, and relations
 * that do not find their records. Counting runs in the background, so a running check is read
 * again until it ends.
 */
function CheckSection({
  canRun,
  fieldNames,
  names,
  onSettled,
  outdated,
  projectId,
}: {
  canRun: boolean;
  /** Each object type's fields by the names people know. */
  fieldNames: Record<string, Record<string, string>>;
  names: Record<string, string>;
  /** The check ended: what may be done next has changed. */
  onSettled?: () => void;
  /** The draft changed after the confirmation this check counted. */
  outdated: boolean;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  // undefined while loading, null before the first check.
  const [check, setCheck] = useState<OntologyCheck | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reads, setReads] = useState(0);
  const [running, setRunning] = useState(false);
  // The warning stays up while reading again, so the retry button alone shows it is reading.
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      setCheck(await getOntologyCheck(projectId));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setReads((count) => count + 1);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const counting = check?.status === "running";
  useEffect(() => {
    if (!counting) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), CHECK_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [counting, load, reads]);
  useOnSettled(counting, onSettled);

  const run = async () => {
    setRunning(true);
    try {
      setCheck(await runOntologyCheck(projectId));
      message.success(t("bknProject.release.check.started"));
    } catch (error) {
      message.error(refusalText(t, error, "bknProject.release.check.failed"));
    } finally {
      setRunning(false);
    }
  };

  const name = (id: string) => names[id] ?? id;
  const result = (item: CheckCountState, issue: boolean) =>
    item.state === "counted" ? (
      // The platform's tag, as on every panel: a result is read at a glance.
      issue ? (
        <LightStatusTag tone="error">{t("bknProject.release.check.result.issue")}</LightStatusTag>
      ) : (
        <LightStatusTag tone="success">{t("bknProject.release.check.result.ok")}</LightStatusTag>
      )
    ) : (
      <span className={styles.muted}>{checkReasonText(t, item.reason)}</span>
    );
  const counted = (item: CheckCountState, value: number | string) =>
    item.state === "counted" ? value : "-";

  const keyColumns: ColumnsType<CheckKeyResult> = [
    {
      dataIndex: "objectType",
      render: (id: string) => name(id),
      title: t("bknProject.release.check.keys.objectType"),
    },
    {
      dataIndex: "fields",
      render: (fields: string[], item) =>
        fields
          .map((field) => fieldNames[item.objectType]?.[field] ?? field)
          .join(t("bknProject.listSeparator")),
      title: t("bknProject.release.check.keys.fields"),
    },
    {
      render: (_value, item) => counted(item, item.rows),
      title: t("bknProject.release.check.keys.rows"),
      // Counts and short results read on one line; the names take the room left.
      className: styles.nowrap,
    },
    {
      render: (_value, item) => counted(item, item.duplicates),
      title: t("bknProject.release.check.keys.duplicates"),
      className: styles.nowrap,
    },
    {
      render: (_value, item) => counted(item, item.nulls),
      title: t("bknProject.release.check.keys.nulls"),
      className: styles.nowrap,
    },
    {
      render: (_value, item) => result(item, Boolean(item.duplicates || item.nulls)),
      title: t("bknProject.release.check.keys.result"),
      // The header stays on one line; a reason a count was not made is a sentence and wraps.
      onHeaderCell: () => ({ className: styles.nowrap }),
    },
  ];
  const joinColumns: ColumnsType<JoinRow> = [
    {
      dataIndex: "relationType",
      render: (id: string) => name(id),
      title: t("bknProject.release.check.relations.relation"),
    },
    {
      dataIndex: "objectType",
      render: (id: string) => name(id),
      title: t("bknProject.release.check.relations.end"),
    },
    {
      render: (_value, item) => counted(item, item.rows),
      title: t("bknProject.release.check.relations.rows"),
      className: styles.nowrap,
    },
    {
      render: (_value, item) => counted(item, item.nulls),
      title: t("bknProject.release.check.relations.nulls"),
      className: styles.nowrap,
    },
    {
      render: (_value, item) => counted(item, item.orphans),
      title: t("bknProject.release.check.relations.orphans"),
      className: styles.nowrap,
    },
    {
      render: (_value, item) => counted(item, formatRate(item.hitRate)),
      title: t("bknProject.release.check.relations.hitRate"),
      className: styles.nowrap,
    },
    {
      // Records without a match are only reported, so a counted join has no issue.
      render: (_value, item) => result(item, false),
      title: t("bknProject.release.check.relations.result"),
      onHeaderCell: () => ({ className: styles.nowrap }),
    },
  ];

  const results = check?.results ?? null;
  const keys = byAttention(results?.keys ?? [], keyHasProblem);
  const joins: JoinRow[] = byAttention(
    results?.relations.flatMap((relation) =>
      relation.joins.map((join, at) => ({
        ...join,
        key: `${relation.relationType}/${at}`,
        relationType: relation.relationType,
      })),
    ) ?? [],
    joinHasProblem,
  );
  // Data read from files is checked by the knowledge-base build: a check partial only for that
  // reads as passed, and those rows are not counted against it.
  const handedOver = [...keys, ...joins].filter(
    (row) => row.state !== "counted" && row.reason === "knowledge_base_build",
  ).length;
  const onlyHandedOver =
    check?.status === "partial" &&
    handedOver > 0 &&
    [...keys, ...joins].every(
      (row) => row.state === "counted" || row.reason === "knowledge_base_build",
    );
  const shownStatus = onlyHandedOver ? "passed" : check?.status;
  const keyProblems = keys.filter(keyHasProblem).length;
  const joinProblems = joins.filter(joinHasProblem).length;
  const tabLabel = (title: string, count: number, problems: number) => (
    <span className={styles.tabLabel}>
      {t("bknProject.release.check.tab", { count, title })}
      {problems ? (
        <span className={styles.issue}>
          {t("bknProject.release.check.tabProblems", { count: problems })}
        </span>
      ) : null}
    </span>
  );

  return (
    <Section
      actions={
        <>
          {/* A status this page does not know gets no tag rather than a raw value. */}
          {shownStatus && CHECK_STATUSES.includes(shownStatus) ? (
            <LightStatusTag tone={CHECK_STATUS_TONE[shownStatus]}>
              {t(`bknProject.release.check.status.${shownStatus}`)}
            </LightStatusTag>
          ) : null}
          {results ? (
            <span className={styles.muted}>
              {onlyHandedOver
                ? t("bknProject.release.check.coverageHandedOver", {
                    counted: results.coverage.counted,
                    total: results.coverage.total - handedOver,
                  })
                : t("bknProject.release.check.coverage", results.coverage)}
            </span>
          ) : null}
          {canRun ? (
            <AppButton
              disabled={counting}
              loading={running}
              onClick={() => void run()}
              size="small"
            >
              {t("bknProject.release.check.run")}
            </AppButton>
          ) : null}
        </>
      }
      description={t("bknProject.release.check.description")}
      title={t("bknProject.release.check.title")}
    >
      {loadFailed ? (
        <Alert
          action={
            <AppButton loading={retrying} onClick={() => void retry()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t("bknProject.release.check.loadFailed")}
          showIcon
          type="warning"
        />
      ) : null}
      {check === undefined ? (
        loadFailed ? null : (
          <Spin />
        )
      ) : check === null ? (
        <p className={styles.muted}>{t("bknProject.release.check.notStarted")}</p>
      ) : (
        <>
          {outdated ? (
            <p className={styles.muted}>{t("bknProject.release.check.outdated")}</p>
          ) : null}
          {check.status === "failed" ? (
            <Alert
              message={t(
                check.error === "interrupted"
                  ? "bknProject.release.check.interrupted"
                  : "bknProject.release.check.failedHint",
              )}
              showIcon
              type="error"
            />
          ) : null}
          {results ? (
            <>
              <Tabs
                items={[
                  {
                    key: "keys",
                    label: tabLabel(
                      t("bknProject.release.check.keys.title"),
                      keys.length,
                      keyProblems,
                    ),
                    children: (
                      <AppTable<CheckKeyResult>
                        columns={keyColumns}
                        dataSource={keys}
                        pagination={{ defaultPageSize: PAGE_SIZE }}
                        rowKey="objectType"
                        size="small"
                      />
                    ),
                  },
                  ...(joins.length
                    ? [
                        {
                          key: "relations",
                          label: tabLabel(
                            t("bknProject.release.check.relations.title"),
                            joins.length,
                            joinProblems,
                          ),
                          children: (
                            <div className={styles.tabBody}>
                              <AppTable<JoinRow>
                                columns={joinColumns}
                                dataSource={joins}
                                pagination={{ defaultPageSize: PAGE_SIZE }}
                                rowKey="key"
                                size="small"
                              />
                              <p className={styles.muted}>
                                {t("bknProject.release.check.orphansHint")}
                              </p>
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
                size="small"
              />
              {results.excludedMapped.length ? (
                <>
                  <h4 className={styles.subTitle}>
                    {t("bknProject.release.check.excluded.title")}
                  </h4>
                  {results.excludedMapped.map((item) => (
                    <p className={styles.issue} key={`${item.objectType}/${item.property}`}>
                      {t("bknProject.release.check.excluded.item", {
                        field: item.field,
                        objectType: name(item.objectType),
                        property: item.property,
                      })}
                    </p>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Section>
  );
}

/**
 * Confirm and release: what the last confirmation of the draft wrote is checked against the
 * tables' data and indexed in the background; the page shows when it was confirmed, what the
 * check found and whether each table's local index is ready.
 */
export function ProjectReleasePage({
  onGoToBuild,
  onGoToKinetic,
  onGoToModel,
  onReleaseChanged,
  ownerIsCaller,
  project,
}: {
  /** Opens the build page, where the local indexes are built. */
  onGoToBuild?: (tab?: BuildTab) => void;
  /** Opens kinetic modeling, where needs not implemented yet are implemented. */
  onGoToKinetic?: () => void;
  onGoToModel: () => void;
  /** Something was published or the running version switched: the workspace reads it again. */
  onReleaseChanged?: () => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  // Each object type's fields by the names people know: the check counts the stored columns.
  const [fieldNames, setFieldNames] = useState<Record<string, Record<string, string>>>({});

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setStatus(await getProjectStatus(project.id));
    } catch {
      setLoadFailed(true);
    }
  }, [project.id]);
  useEffect(() => {
    void load();
  }, [load]);

  // The release whose regression is open: by its version, and whether it is only prepared.
  const [regressionOf, setRegressionOf] = useState<{ prepared: boolean; version: string } | null>(
    null,
  );

  // The versions of the project's network; read again after preparing, publishing or switching.
  const [versions, setVersions] = useState<ProjectVersions | "failed" | null>(null);
  const loadVersions = useCallback(async () => {
    setVersions(null);
    try {
      setVersions(await getProjectVersions(project.id));
    } catch {
      setVersions("failed");
    }
  }, [project.id]);
  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  // The check names items by id; the draft gives the names people know. Ids are shown without it.
  useEffect(() => {
    let active = true;
    getDraft(project.id)
      .then((draft) => {
        if (active && draft) {
          setNames(
            Object.fromEntries(
              [...draft.items.objectTypes, ...draft.items.relationTypes].map((item) => [
                item.id,
                item.name,
              ]),
            ),
          );
          setFieldNames(
            Object.fromEntries(
              draft.items.objectTypes.map((objectType) => [
                objectType.id,
                Object.fromEntries(
                  objectType.properties.flatMap((property) => {
                    const shown = property.displayName || property.name;
                    return [
                      [property.name, shown],
                      ...(property.mappedField ? [[property.mappedField, shown]] : []),
                    ];
                  }),
                ),
              ]),
            ),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  if (loadFailed) {
    return (
      <Alert
        action={
          <AppButton onClick={() => void load()} size="small">
            {t("common.retry")}
          </AppButton>
        }
        message={t("bknProject.release.loadFailed")}
        showIcon
        type="error"
      />
    );
  }
  if (!status) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }
  if (!status.confirmation) {
    return (
      <EmptyStatePanel
        action={
          <AppButton onClick={onGoToModel} type="primary">
            {t("bknProject.release.empty.action")}
          </AppButton>
        }
        description={t("bknProject.release.empty.description")}
        title={t("bknProject.release.empty.title")}
      />
    );
  }

  const canRun = ownerIsCaller && !project.archived;
  const changed = () => {
    void load();
    void loadVersions();
    onReleaseChanged?.();
  };
  return (
    <div className={styles.page}>
      <p className={styles.muted}>{t("bknProject.release.description")}</p>
      <div className={styles.head}>
        <LightStatusTag tone="success">
          {t("bknProject.release.confirmed", { time: formatTime(status.confirmation.time) })}
        </LightStatusTag>
        {ownerIsCaller ? null : (
          <span className={styles.muted}>{t("bknProject.release.ownerOnly")}</span>
        )}
      </div>
      {status.stale.includes("confirmation_outdated") ? (
        <Alert
          action={
            <AppButton onClick={onGoToModel} size="small">
              {t("bknProject.release.outdatedAction")}
            </AppButton>
          }
          message={t("bknProject.release.outdated")}
          showIcon
          type="error"
        />
      ) : null}
      <ReleasePublish
        canPublish={canRun}
        onGoToBuild={onGoToBuild}
        onGoToKinetic={onGoToKinetic}
        onChanged={changed}
        onOpenRegression={(version, prepared) => setRegressionOf({ prepared, version })}
        projectId={project.id}
        status={status}
        versions={versions && versions !== "failed" ? versions : null}
      />
      <CheckSection
        canRun={canRun}
        fieldNames={fieldNames}
        names={names}
        onSettled={() => void load()}
        outdated={status.stale.includes("check_outdated")}
        projectId={project.id}
      />
      <ReleaseVersions
        canManage={canRun}
        onChanged={changed}
        onOpenRegression={(version) => setRegressionOf({ prepared: false, version })}
        onRetry={() => void loadVersions()}
        projectId={project.id}
        versions={versions}
      />
      {regressionOf ? (
        <RegressionDrawer
          canRun={canRun}
          onClose={() => setRegressionOf(null)}
          prepared={regressionOf.prepared}
          projectId={project.id}
          version={regressionOf.version}
        />
      ) : null}
    </div>
  );
}
