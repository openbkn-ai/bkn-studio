/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  describeDecision,
  itemNames,
  whoDecided,
} from "@/modules/bkn-project/components/draft/changes";
import { DraftConceptGraph } from "@/modules/bkn-project/components/draft/DraftConceptGraph";
import { draftGraph } from "@/modules/bkn-project/components/draft/graph";
import { relationsWithUnadoptedEnds } from "@/modules/bkn-project/components/draft/evidence";
import { DRAFT_POLL_MS, getDraft } from "@/modules/bkn-project/services/draft.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project, ProjectRelease } from "@/modules/bkn-project/types/project";
import { projectSectionPath, type ProjectSection } from "@/modules/bkn-project/types/workspace";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";

import styles from "./ProjectOverview.module.css";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

const PLACEHOLDER = "—";

/** How many decisions the overview lists; the changes tab has them all. */
const RECENT_CHANGES = 5;

type StatTile = {
  key: string;
  label: string;
  /** The page the tile opens; a tile without one is not clickable. */
  section?: ProjectSection;
  /** The modeling tab the tile opens, when it opens the modeling page. */
  tab?: string;
  sub: string;
  value: string;
};

/**
 * The project overview: info card, four stat tiles, the concept model and two columns of recent
 * changes and versions. The ontology tile, the model and the changes come from the draft;
 * questions and instances come with later work, so their tiles show a placeholder rather than
 * made-up numbers.
 */
export function ProjectOverview({
  latestRelease,
  networkName,
  ownerIsCaller,
  project,
}: {
  /** undefined while unknown, null before the first release. */
  latestRelease: ProjectRelease | null | undefined;
  networkName: string;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  const go = (section: ProjectSection, tab?: string) =>
    void navigate(
      `${projectSectionPath(project.id, section)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
    );

  // undefined while loading, null before the first draft.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reading, setReading] = useState(true);
  // Counts every read, failed or not, so a drafting draft is read again after a failure too.
  const [reads, setReads] = useState(0);
  const loadDraft = useCallback(async () => {
    setReading(true);
    setDraftError(null);
    try {
      setDraft(await getDraft(project.id));
    } catch (error) {
      setDraftError(extractRequestErrorMessage(error));
    } finally {
      setReading(false);
      setReads((count) => count + 1);
    }
  }, [project.id]);
  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);
  // A drafting draft is read again until it is done, as on the modeling page.
  const drafting = draft?.status === "drafting";
  useEffect(() => {
    if (!drafting) {
      return undefined;
    }
    const timer = window.setTimeout(() => void loadDraft(), DRAFT_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [drafting, loadDraft, reads]);

  const ready = draft?.status === "ready" ? draft : null;
  const graph = useMemo(() => (ready ? draftGraph(ready) : null), [ready]);
  const pending = ready
    ? ready.items.objectTypes.filter((item) => item.needsIdentity).length +
      relationsWithUnadoptedEnds(ready).length
    : 0;
  const recent = useMemo(
    () =>
      ready
        ? [...ready.items.decisions].sort((a, b) => b.time - a.time).slice(0, RECENT_CHANGES)
        : [],
    [ready],
  );
  const names = useMemo(() => (ready ? itemNames(ready) : {}), [ready]);

  const tiles: StatTile[] = [
    {
      key: "questions",
      label: t("bknProject.overview.tiles.questions"),
      section: "requirements",
      sub: t("bknProject.overview.tiles.questionsSub"),
      value: PLACEHOLDER,
    },
    {
      key: "ontology",
      label: t("bknProject.overview.tiles.ontology"),
      section: "model",
      // The value counts adopted items only, unlike the modeling page's header, so the line says so.
      sub: pending
        ? t("bknProject.overview.tiles.ontologyPendingSub", { count: pending })
        : t(
            graph
              ? "bknProject.overview.tiles.ontologyAdoptedSub"
              : "bknProject.overview.tiles.ontologySub",
          ),
      // What waits is listed first on the changes tab, each with the action that settles it.
      tab: pending ? "changes" : undefined,
      value: graph
        ? t("bknProject.overview.tiles.ontologyValue", {
            objects: graph.nodes.length,
            relations: graph.edges.length,
          })
        : draft && draft.status !== "ready"
          ? t(`bknProject.model.status.${draft.status}`)
          : PLACEHOLDER,
    },
    {
      key: "sources",
      label: t("bknProject.overview.tiles.sources"),
      section: "requirements",
      sub: t("bknProject.overview.tiles.sourcesSub"),
      value: t("bknProject.overview.tiles.sourcesValue", { count: project.catalogIds.length }),
    },
    {
      key: "instances",
      label: t("bknProject.overview.tiles.instances"),
      sub: t("bknProject.overview.tiles.instancesSub"),
      value: PLACEHOLDER,
    },
  ];

  const releaseVersion =
    latestRelease === undefined
      ? PLACEHOLDER
      : latestRelease
        ? `v${latestRelease.version}`
        : t("bknProject.overview.versions.unpublished");

  const field = (label: string, value: ReactNode) => (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );

  return (
    <div className={styles.overview}>
      <section className={styles.card} data-region="info">
        <div className={styles.fields}>
          {field(t("bknProject.overview.fields.network"), networkName)}
          {field(
            t("bknProject.overview.fields.owner"),
            ownerIsCaller ? t("bknProject.list.ownerYou") : project.owner.id,
          )}
          {field(t("bknProject.overview.fields.updated"), formatTime(project.updateTime))}
          {field(t("bknProject.overview.fields.id"), <code>{project.id}</code>)}
        </div>
      </section>

      <div className={styles.tiles} data-region="stats">
        {tiles.map((tile) => {
          const body = (
            <>
              <span className={styles.tileLabel}>{tile.label}</span>
              <span className={styles.tileValue}>{tile.value}</span>
              <span className={styles.tileSub}>{tile.sub}</span>
            </>
          );
          const { section, tab } = tile;
          return section ? (
            <button
              className={styles.tileLink}
              key={tile.key}
              onClick={() => go(section, tab)}
              type="button"
            >
              {body}
            </button>
          ) : (
            <div className={styles.tile} key={tile.key}>
              {body}
            </div>
          );
        })}
      </div>

      <section className={styles.card} data-region="model">
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>{t("bknProject.overview.model.title")}</span>
          <button className={styles.link} onClick={() => go("model")} type="button">
            {t("bknProject.overview.model.open")}
          </button>
        </div>
        {reading && draft === undefined ? (
          <Spin />
        ) : draftError ? (
          <Alert
            action={
              <AppButton onClick={() => void loadDraft()} size="small">
                {t("common.retry")}
              </AppButton>
            }
            description={draftError}
            message={t("bknProject.overview.model.loadFailed")}
            showIcon
            type="warning"
          />
        ) : ready ? (
          <DraftConceptGraph draft={ready} />
        ) : draft ? (
          <EmptyStatePanel
            description={t(`bknProject.overview.model.${draft.status}Description`)}
            title={t(`bknProject.model.status.${draft.status}`)}
          />
        ) : draft === null ? (
          <EmptyStatePanel
            description={t("bknProject.overview.model.emptyDescription")}
            title={t("bknProject.overview.model.empty")}
          />
        ) : null}
      </section>

      <div className={styles.columns} data-region="columns">
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>{t("bknProject.overview.changes.title")}</span>
            {recent.length ? (
              <button className={styles.link} onClick={() => go("model", "changes")} type="button">
                {t("bknProject.overview.changes.all")}
              </button>
            ) : null}
          </div>
          {recent.length ? (
            <ul className={styles.changes}>
              {recent.map((decision) => (
                <li
                  className={styles.change}
                  data-testid="overview-change"
                  key={`${decision.time}-${decision.kind}-${decision.itemId}-${decision.action}`}
                >
                  <span>{describeDecision(t, decision, names).text}</span>
                  <span className={styles.muted}>
                    {t("bknProject.model.changes.byAt", {
                      time: formatTime(decision.time),
                      who: whoDecided(t, decision.by, runtimeConfig.currentUser.id, directory),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{t("bknProject.overview.changes.empty")}</p>
          )}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>{t("bknProject.overview.versions.title")}</span>
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span>{t("bknProject.overview.versions.live")}</span>
              <span>{releaseVersion}</span>
            </div>
            <div className={styles.row}>
              <span>{t("bknProject.overview.versions.draft")}</span>
              <span>
                {draft
                  ? draft.status === "ready"
                    ? t("bknProject.overview.versions.draftUpdated", {
                        time: formatTime(draft.updateTime),
                      })
                    : t(`bknProject.model.status.${draft.status}`)
                  : draft === null
                    ? t("bknProject.overview.versions.noDraft")
                    : PLACEHOLDER}
              </span>
            </div>
            <div className={styles.row}>
              <span>{t("bknProject.overview.versions.latestRelease")}</span>
              <span>
                {latestRelease
                  ? `v${latestRelease.version} · ${formatTime(latestRelease.createTime)}`
                  : PLACEHOLDER}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
