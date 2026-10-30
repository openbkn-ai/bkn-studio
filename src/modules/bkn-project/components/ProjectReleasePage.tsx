/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
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
import { IndexReadiness } from "@/modules/bkn-project/components/release/IndexReadiness";
import { RegressionDrawer } from "@/modules/bkn-project/components/release/RegressionDrawer";
import { ReleasePublish } from "@/modules/bkn-project/components/release/ReleasePublish";
import { Section } from "@/modules/bkn-project/components/release/ReleaseSection";
import { ReleaseVersions } from "@/modules/bkn-project/components/release/ReleaseVersions";
import {
  CHECK_STATUS_TONE,
  CHECK_STATUSES,
  checkReasonText,
  refusalText,
} from "@/modules/bkn-project/components/publish/messages";
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { listReleases } from "@/modules/bkn-project/services/release.service";
import {
  CHECK_POLL_MS,
  getOntologyCheck,
  getProjectStatus,
  runOntologyCheck,
} from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { LineageRelease } from "@/modules/bkn-project/types/release";
import type {
  CheckCountState,
  CheckJoinResult,
  CheckKeyResult,
  OntologyCheck,
  ProjectStatus,
} from "@/modules/bkn-project/types/publish";

import styles from "./ProjectReleasePage.module.css";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

type JoinRow = CheckJoinResult & { key: string; relationType: string };

/**
 * The data check of the last confirmation: identities that repeat or are empty, and relations
 * that do not find their records. Counting runs in the background, so a running check is read
 * again until it ends.
 */
function CheckSection({
  canRun,
  names,
  outdated,
  projectId,
}: {
  canRun: boolean;
  names: Record<string, string>;
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
      issue ? (
        <span className={styles.issue}>{t("bknProject.release.check.result.issue")}</span>
      ) : (
        t("bknProject.release.check.result.ok")
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
      render: (fields: string[]) => fields.join(t("bknProject.listSeparator")),
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
  const joins: JoinRow[] =
    results?.relations.flatMap((relation) =>
      relation.joins.map((join, at) => ({
        ...join,
        key: `${relation.relationType}/${at}`,
        relationType: relation.relationType,
      })),
    ) ?? [];

  return (
    <Section
      actions={
        <>
          {/* A status this page does not know gets no tag rather than a raw value. */}
          {check && CHECK_STATUSES.includes(check.status) ? (
            <LightStatusTag tone={CHECK_STATUS_TONE[check.status]}>
              {t(`bknProject.release.check.status.${check.status}`)}
            </LightStatusTag>
          ) : null}
          {results ? (
            <span className={styles.muted}>
              {t("bknProject.release.check.coverage", results.coverage)}
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
              type="warning"
            />
          ) : null}
          {results ? (
            <>
              <h4 className={styles.subTitle}>{t("bknProject.release.check.keys.title")}</h4>
              <AppTable<CheckKeyResult>
                columns={keyColumns}
                dataSource={results.keys}
                pagination={false}
                rowKey="objectType"
                size="small"
              />
              {joins.length ? (
                <>
                  <h4 className={styles.subTitle}>
                    {t("bknProject.release.check.relations.title")}
                  </h4>
                  <AppTable<JoinRow>
                    columns={joinColumns}
                    dataSource={joins}
                    pagination={false}
                    rowKey="key"
                    size="small"
                  />
                  <p className={styles.muted}>{t("bknProject.release.check.orphansHint")}</p>
                </>
              ) : null}
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
  onGoToModel,
  ownerIsCaller,
  project,
}: {
  onGoToModel: () => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});

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

  // The release whose regression is open.
  const [regressionOf, setRegressionOf] = useState<{ networkId: string; version: string } | null>(
    null,
  );

  // The releases of the project's network; read again after publishing or switching.
  const [releases, setReleases] = useState<LineageRelease[] | "failed" | null>(null);
  const loadReleases = useCallback(async () => {
    setReleases(null);
    try {
      setReleases(await listReleases(project.knId));
    } catch {
      setReleases("failed");
    }
  }, [project.knId]);
  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

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
  return (
    <div className={styles.page}>
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
          type="warning"
        />
      ) : null}
      <ReleasePublish
        // The lineage is named after the network it started from.
        baseNetworkId={project.knId}
        canPublish={canRun}
        onChanged={() => {
          void load();
          void loadReleases();
        }}
        onOpenRegression={() =>
          status.release &&
          setRegressionOf({ networkId: status.release.networkId, version: status.release.version })
        }
        projectId={project.id}
        status={status}
        versionOf={(networkId) =>
          Array.isArray(releases)
            ? releases.find((release) => release.networkId === networkId)?.version
            : undefined
        }
      />
      <CheckSection
        canRun={canRun}
        names={names}
        outdated={status.stale.includes("check_outdated")}
        projectId={project.id}
      />
      <IndexReadiness canRun={canRun} projectId={project.id} />
      <ReleaseVersions
        inUseNetworkId={status.release?.inUse ? status.release.networkId : null}
        onOpenRegression={({ networkId, version }) => setRegressionOf({ networkId, version })}
        onRetry={() => void loadReleases()}
        projectId={project.id}
        releases={releases}
      />
      {regressionOf ? (
        <RegressionDrawer
          canRun={canRun}
          networkId={regressionOf.networkId}
          onClose={() => setRegressionOf(null)}
          projectId={project.id}
          version={regressionOf.version}
        />
      ) : null}
    </div>
  );
}
