/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeploymentUnitOutlined, FolderOpenOutlined, TableOutlined } from "@ant-design/icons";
import { Alert } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import { useCollapsedList } from "@/modules/bkn-project/components/useCollapsedList";
import { setProjectArchived } from "@/modules/bkn-project/services/project.service";
import { getProjectStatus } from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type {
  DataSourceCount,
  DataSourceState,
  ProjectStatus,
} from "@/modules/bkn-project/types/publish";

import styles from "./ProjectOverview.module.css";

const PREFIX = "bknProject.overview.dataSources";

/** How soon a source that could not be checked is asked about again. */
export const DATA_SOURCES_RETRY_MS = 30_000;

/** The platform's status tag by state. */
const TONE: Record<DataSourceState, LightStatusTone> = {
  missing: "error",
  not_bound: "neutral",
  ok: "success",
  unreachable: "warning",
};

const ICONS = {
  catalogs: <FolderOpenOutlined />,
  network: <DeploymentUnitOutlined />,
  tables: <TableOutlined />,
};

const SOURCES = ["network", "catalogs", "tables"] as const;

/**
 * Whether what the project reads still exists: its knowledge network, the data catalogs it
 * chose and the tables behind the items it adopted. A source that is gone says what it holds
 * back and what the owner can do about it.
 */
export function DataSourceHealth({
  onGoToModel,
  onProjectChange,
  project,
}: {
  onGoToModel: () => void;
  onProjectChange: (project: Project) => void;
  project: Project;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [reads, setReads] = useState(0);

  const load = useCallback(async () => {
    try {
      setStatus(await getProjectStatus(project.id));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setReads((count) => count + 1);
    }
  }, [project.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const sources = status?.dataSources ?? null;
  // The items whose tables are gone: a few at first, all on asking.
  const affected = useCollapsedList(sources?.tables.affected ?? []);
  const unreachable = sources
    ? SOURCES.filter((source) => sources[source].state === "unreachable")
    : [];
  useEffect(() => {
    if (!unreachable.length) {
      return undefined;
    }
    const timer = window.setTimeout(() => void load(), DATA_SOURCES_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [unreachable.length, load, reads]);

  if (failed && !status) {
    return (
      <section className={styles.panel} data-region="data-sources">
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="warning"
        />
      </section>
    );
  }
  // Nothing is checked while the first draft is being made.
  if (!status || !sources) {
    return null;
  }

  const action = (name: string) => status.nextActions.find((item) => item.action === name);
  const archive = action("archive");
  const setCatalogs = action("set_catalogs");
  const archiveProject = () =>
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t("bknProject.list.archiveConfirm.content"),
      okText: t("bknProject.list.archiveConfirm.ok"),
      onOk: async () => {
        try {
          onProjectChange(await setProjectArchived(project.id, true));
          message.success(t("bknProject.list.archiveSuccess"));
        } catch {
          // The request layer shows bkn-project's localized message.
        }
      },
      title: t("bknProject.list.archiveConfirm.title", { name: project.name }),
    });
  // The owner of an archived project unarchives it first; others ask the owner.
  const hint = project.archived
    ? t(`${PREFIX}.archived`)
    : setCatalogs && !setCatalogs.allowed && setCatalogs.reason === "not_owner"
      ? t("bknProject.model.notice.askOwner")
      : undefined;
  const canChange = !project.archived && setCatalogs?.allowed !== false;
  const { catalogs, network, tables } = sources;

  const value = (source: (typeof SOURCES)[number], count: DataSourceCount) =>
    t(`${PREFIX}.${source}.${count.state}`, {
      count: count.total,
      missing: count.missing,
      total: count.total,
    });

  // A source that is gone blocks confirming and publishing: its notice is an error, as its tag.
  return (
    <section className={styles.panel} data-region="data-sources">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t(`${PREFIX}.title`)}</span>
      </div>
      {/* Three sources side by side: icon, name and state, then what it means in a line. */}
      <div className={styles.sources}>
        {SOURCES.map((source) => {
          const state = sources[source].state;
          return (
            <div
              className={state === "missing" ? styles.sourceMissing : styles.source}
              key={source}
            >
              <div className={styles.sourceHead}>
                <span className={styles.sourceIcon}>{ICONS[source]}</span>
                <span className={styles.sourceName}>{t(`${PREFIX}.${source}.label`)}</span>
                <LightStatusTag tone={TONE[state] ?? "neutral"}>
                  {t(`${PREFIX}.state.${state}`)}
                </LightStatusTag>
              </div>
              <span className={styles.sourceNote}>{value(source, sources[source])}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.notices}>
        {network.state === "missing" ? (
          <Alert
            action={
              archive?.allowed && !project.archived ? (
                <AppButton danger onClick={archiveProject} size="small">
                  {t(`${PREFIX}.archive`)}
                </AppButton>
              ) : null
            }
            message={t(`${PREFIX}.networkMissing`)}
            showIcon
            type="error"
          />
        ) : null}
        {catalogs.state === "missing" ? (
          <Alert
            action={
              setCatalogs?.allowed && !project.archived ? (
                <AppButton onClick={onGoToModel} size="small">
                  {t(`${PREFIX}.chooseCatalogs`)}
                </AppButton>
              ) : null
            }
            description={hint}
            message={t(`${PREFIX}.catalogsMissing`, { count: catalogs.missing })}
            showIcon
            type="error"
          />
        ) : null}
        {tables.state === "missing" ? (
          <Alert
            action={
              canChange ? (
                <AppButton onClick={onGoToModel} size="small">
                  {t(`${PREFIX}.redraft`)}
                </AppButton>
              ) : null
            }
            description={
              <>
                {tables.affected.length ? (
                  <ul className={styles.affected}>
                    {affected.visible.map((item) => (
                      <li key={`${item.kind}:${item.id}`}>
                        {t(
                          `${PREFIX}.affected.${item.kind === "relation_types" ? "relation" : "object"}`,
                          { name: item.name, table: item.table },
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {affected.toggle}
                {catalogs.state === "missing" ? null : hint}
              </>
            }
            message={t(`${PREFIX}.tablesMissing`, { count: tables.missing })}
            showIcon
            type="error"
          />
        ) : null}
        {unreachable.length ? (
          <p className={styles.muted}>
            {t(`${PREFIX}.unreachable`, {
              what: unreachable
                .map((source) => t(`${PREFIX}.${source}.noun`))
                .join(t("bknProject.listSeparator")),
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
