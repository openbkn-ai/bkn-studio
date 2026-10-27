/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import type { Project, ProjectRelease } from "@/modules/bkn-project/types/project";
import { projectSectionPath, type ProjectSection } from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectOverview.module.css";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

const PLACEHOLDER = "—";

type StatTile = {
  key: string;
  label: string;
  section: ProjectSection;
  sub: string;
  value: string;
};

/**
 * The project overview: info card, four stat tiles, the concept model and two columns of recent
 * changes and versions. Drafts, questions and instances come with later work, so their tiles show
 * a placeholder rather than made-up numbers.
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
  const go = (section: ProjectSection) => void navigate(projectSectionPath(project.id, section));

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
      sub: t("bknProject.overview.tiles.ontologySub"),
      value: PLACEHOLDER,
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
      section: "overview",
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
        <p className={styles.status}>{t("bknProject.overview.statusNotDrafted")}</p>
        <div className={styles.fields}>
          {field(t("bknProject.overview.fields.network"), networkName)}
          {field(
            t("bknProject.overview.fields.scenario"),
            t("bknProject.overview.scenarioStructured"),
          )}
          {field(
            t("bknProject.overview.fields.owner"),
            ownerIsCaller ? t("bknProject.list.ownerYou") : project.owner.id,
          )}
          {field(t("bknProject.overview.fields.updated"), formatTime(project.updateTime))}
          {field(t("bknProject.overview.fields.id"), <code>{project.id}</code>)}
        </div>
      </section>

      <div className={styles.tiles} data-region="stats">
        {tiles.map((tile) => (
          <button
            className={styles.tile}
            key={tile.key}
            onClick={() => go(tile.section)}
            type="button"
          >
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileSub}>{tile.sub}</span>
          </button>
        ))}
      </div>

      <section className={styles.card} data-region="model">
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>{t("bknProject.overview.model.title")}</span>
          <button className={styles.link} onClick={() => go("model")} type="button">
            {t("bknProject.overview.model.open")}
          </button>
        </div>
        <EmptyStatePanel
          description={t("bknProject.overview.model.emptyDescription")}
          title={t("bknProject.overview.model.empty")}
        />
      </section>

      <div className={styles.columns} data-region="columns">
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>{t("bknProject.overview.changes.title")}</span>
          </div>
          <p className={styles.muted}>{t("bknProject.overview.changes.empty")}</p>
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
              <span>{PLACEHOLDER}</span>
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
