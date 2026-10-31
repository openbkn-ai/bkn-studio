/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  ProjectOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Spin, Tooltip } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import {
  describeDecision,
  itemNames,
  whoDecided,
} from "@/modules/bkn-project/components/draft/changes";
import { DataSourceHealth } from "@/modules/bkn-project/components/DataSourceHealth";
import { DraftConceptGraph } from "@/modules/bkn-project/components/draft/DraftConceptGraph";
import { draftGraph } from "@/modules/bkn-project/components/draft/graph";
import { relationsWithUnadoptedEnds } from "@/modules/bkn-project/components/draft/evidence";
import { DRAFT_POLL_MS, getDraft } from "@/modules/bkn-project/services/draft.service";
import { getNetworkInUse } from "@/modules/bkn-project/services/release.service";
import { getRequirements } from "@/modules/bkn-project/services/requirements.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project, ProjectRelease } from "@/modules/bkn-project/types/project";
import type { RollbackNetwork } from "@/modules/bkn-project/types/release";
import type { Requirements } from "@/modules/bkn-project/types/requirements";
import {
  networkWorkspacePath,
  projectSectionPath,
  type ProjectSection,
} from "@/modules/bkn-project/types/workspace";
import { useAccountDirectory } from "@/modules/knowledge-network/hooks/useAccountDirectory";
// The knowledge network's overview: the project's header card and stat cards are the same.
import kn from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene.module.css";

import styles from "./ProjectOverview.module.css";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

const PLACEHOLDER = "—";

/** How many decisions the overview lists; the changes tab has them all. */
const RECENT_CHANGES = 5;

type StatTile = {
  /** The link under the figure, to the page that holds it; none where no page does. */
  action?: { label: string; onClick: () => void };
  /** A short figure beside the link, under the main one: the card keeps its figure on one line. */
  note?: string;
  /** The icon block's colour: a theme token. */
  color: string;
  icon: ReactNode;
  key: string;
  label: string;
  /** What the figure stands for, as a tooltip. */
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
  onProjectChange,
  ownerIsCaller,
  project,
}: {
  /** undefined while unknown, null before the first release. */
  latestRelease: ProjectRelease | null | undefined;
  networkName: string;
  onProjectChange: (project: Project) => void;
  ownerIsCaller: boolean;
  project: Project;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, runtimeConfig } = useAppServices();
  const directory = useAccountDirectory();
  const go = (section: ProjectSection, tab?: string) =>
    void navigate(
      `${projectSectionPath(project.id, section)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
    );

  // The network consumers use, undefined while it is read.
  // undefined while it is read, null when it could not be: the page says so, never guesses.
  const [inUse, setInUse] = useState<RollbackNetwork | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    getNetworkInUse(project.id).then(
      (network) => {
        if (current) {
          setInUse(network);
        }
      },
      () => {
        if (current) {
          setInUse(null);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [project]);

  // undefined while loading, null before the first draft.
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reading, setReading] = useState(true);
  // Counts every read, failed or not, so a drafting draft is read again after a failure too.
  const [reads, setReads] = useState(0);
  const loadDraft = useCallback(async () => {
    setReading(true);
    try {
      setDraft(await getDraft(project.id));
      // Cleared only once a read succeeds, so a failing poll does not flash the warning away.
      setDraftError(null);
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

  // The drafted requirements, for the questions tile; undefined while reading or when unread.
  const [requirements, setRequirements] = useState<Requirements | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getRequirements(project.id)
      .then((next) => active && setRequirements(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

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

  // In the order a project is built: its inputs, the ontology, the scenarios that test it, then
  // the knowledge base.
  const tiles: StatTile[] = [
    {
      // A project starts from its catalogs: without one, the tile leads to choosing them.
      action: {
        label: t(
          project.catalogIds.length
            ? "bknProject.overview.tiles.sourcesAction"
            : "bknProject.overview.tiles.sourcesChoose",
        ),
        onClick: () => go("resources"),
      },
      color: "var(--color-info-text)",
      icon: <DatabaseOutlined />,
      key: "sources",
      label: t("bknProject.overview.tiles.sources"),
      sub: t("bknProject.overview.tiles.sourcesSub"),
      value: t("bknProject.overview.tiles.sourcesValue", { count: project.catalogIds.length }),
    },
    {
      // What waits is listed first on the changes tab, each with the action that settles it.
      action: pending
        ? {
            label: t("bknProject.overview.tiles.ontologyPendingSub", { count: pending }),
            onClick: () => go("model", "changes"),
          }
        : { label: t("bknProject.overview.tiles.ontologyAction"), onClick: () => go("model") },
      color: "var(--color-success-text)",
      icon: <ApartmentOutlined />,
      key: "ontology",
      label: t("bknProject.overview.tiles.ontology"),
      // The value counts adopted items only, unlike the modeling page's header, so the line says so.
      sub: t(
        graph
          ? "bknProject.overview.tiles.ontologyAdoptedSub"
          : "bknProject.overview.tiles.ontologySub",
      ),
      ...(graph
        ? { note: t("bknProject.overview.tiles.ontologyRelations", { count: graph.edges.length }) }
        : {}),
      value: graph
        ? t("bknProject.overview.tiles.ontologyValue", { count: graph.nodes.length })
        : draft && draft.status !== "ready"
          ? t(`bknProject.model.status.${draft.status}`)
          : PLACEHOLDER,
    },
    {
      action: {
        label: t("bknProject.overview.tiles.questionsAction"),
        onClick: () => go("scenarios"),
      },
      color: "var(--color-primary-600)",
      icon: <FileSearchOutlined />,
      key: "questions",
      label: t("bknProject.overview.tiles.questions"),
      // The scenario questions of the drafted requirements; their state while there are none.
      sub:
        requirements?.status === "ready"
          ? t("bknProject.overview.tiles.questionsReadySub", { version: requirements.version })
          : t("bknProject.overview.tiles.questionsSub"),
      value:
        requirements?.status === "ready"
          ? t("bknProject.overview.tiles.questionsValue", {
              count: requirements.spec?.questions.length ?? 0,
            })
          : requirements
            ? t(
                `bknProject.overview.tiles.questionsStatus.${requirements.status === "drafting" ? "drafting" : "failed"}`,
              )
            : PLACEHOLDER,
    },
    {
      color: "var(--color-warning-text)",
      icon: <ClusterOutlined />,
      key: "instances",
      label: t("bknProject.overview.tiles.instances"),
      // A project does not count records: the tile says so instead of showing a bare dash.
      sub: t("bknProject.overview.tiles.instancesSub"),
      value: t("bknProject.overview.tiles.instancesValue"),
    },
  ];

  const inUseVersion =
    inUse === undefined
      ? PLACEHOLDER
      : inUse === null
        ? t("bknProject.overview.versions.inUseUnknown")
        : inUse.base
          ? t("bknProject.overview.fields.baseNetwork")
          : `v${inUse.version}`;
  const latestVersion =
    latestRelease === undefined
      ? PLACEHOLDER
      : latestRelease
        ? `v${latestRelease.version}`
        : t("bknProject.overview.versions.unpublished");
  // A network of the lineage, opened in its knowledge network workspace.
  const networkLink = (networkId: string, label: string) => (
    <Link className={styles.headerLink} to={networkWorkspacePath(networkId)}>
      {label}
    </Link>
  );
  const owner = ownerIsCaller
    ? t("bknProject.list.ownerYou")
    : (directory.get(project.owner.id) ?? project.owner.id);
  // Through the shared adapter, which falls back where the Clipboard API is missing (plain HTTP).
  const copyId = () => {
    void writeTextToClipboard(project.id)
      .then(() => message.success(t("bknProject.overview.idCopied")))
      .catch(() => message.error(t("common.copyFailed")));
  };

  return (
    <div className={styles.overview}>
      {/* The project's card, as a network's on its overview: name, who and when, and its id. */}
      <section className={kn.overviewHeaderCard} data-region="info">
        <div className={kn.overviewHeaderTitle}>
          <div className={kn.overviewHeaderTitleLeft}>
            <span className={kn.overviewHeaderIcon} style={{ color: "var(--color-primary-600)" }}>
              <ProjectOutlined />
            </span>
            <div className={kn.overviewHeaderName}>{project.name}</div>
          </div>
        </div>
        <div className={kn.overviewHeaderFooter}>
          <DeploymentUnitOutlined />
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.overview.fields.baseNetwork")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>
            {networkLink(project.knId, networkName)}
          </span>
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.overview.fields.inUse")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>
            {inUse ? networkLink(inUse.networkId, inUseVersion) : inUseVersion}
          </span>
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.overview.fields.latestRelease")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>
            {latestRelease ? networkLink(latestRelease.networkId, latestVersion) : latestVersion}
          </span>
          <UserOutlined />
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.overview.fields.owner")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>{owner}</span>
          <ClockCircleOutlined />
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.overview.fields.updated")}:
          </span>
          <span>{formatTime(project.updateTime)}</span>
          <span className={kn.overviewHeaderFooterId}>
            <span className={kn.overviewHeaderFooterLabel}>
              {t("bknProject.overview.fields.id")}:
            </span>
            <code>{project.id}</code>
            <Tooltip title={t("bknProject.overview.copyId")}>
              <button
                aria-label={t("bknProject.overview.copyId")}
                className={kn.overviewHeaderFooterCopy}
                onClick={copyId}
                type="button"
              >
                <CopyOutlined />
              </button>
            </Tooltip>
          </span>
        </div>
      </section>

      <DataSourceHealth
        onGoToModel={() => go("model")}
        onGoToResources={() => go("resources")}
        onProjectChange={onProjectChange}
        project={project}
      />

      {/* The network's stat cards: an icon block, the name and figure, a link under them. */}
      <div className={kn.overviewStatRow} data-region="stats">
        {tiles.map((tile) => (
          <div className={kn.overviewStatCard} key={tile.key} title={tile.sub}>
            <dl className={kn.overviewStatDefinition}>
              <dt className={kn.overviewStatIcon} style={{ backgroundColor: tile.color }}>
                {tile.icon}
              </dt>
              <dd>
                <p>{tile.label}</p>
                <p>{tile.value}</p>
              </dd>
            </dl>
            {tile.action && tile.note ? (
              <div className={styles.statFooter}>
                <span className={styles.statFooterNote}>{tile.note}</span>
                <AppButton onClick={tile.action.onClick} size="small" type="link">
                  {tile.action.label}
                </AppButton>
              </div>
            ) : tile.action ? (
              <AppButton
                className={kn.overviewStatAction}
                onClick={tile.action.onClick}
                type="link"
              >
                {tile.action.label}
              </AppButton>
            ) : (
              <p className={styles.statNote}>{tile.sub}</p>
            )}
          </div>
        ))}
      </div>

      {ready ? (
        // The graph comes in the knowledge network's card, with the link in its header.
        <div className={styles.block} data-region="model">
          <DraftConceptGraph
            action={
              <button className={styles.link} onClick={() => go("model")} type="button">
                {t("bknProject.overview.model.open")}
              </button>
            }
            draft={ready}
            networkId={project.knId}
            // A type's details are on the modeling page.
            onOpen={() => go("model")}
            title={t("bknProject.overview.model.title")}
          />
        </div>
      ) : (
        <section className={styles.panel} data-region="model">
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
      )}

      <div className={styles.columns} data-region="columns">
        <section className={styles.panel}>
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
        <section className={styles.panel}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>{t("bknProject.overview.versions.title")}</span>
          </div>
          {/* Labels and values in a compact two-column grid, not a row stretched end to end. */}
          <dl className={styles.keyValues}>
            <dt>{t("bknProject.overview.versions.live")}</dt>
            <dd>{inUseVersion}</dd>
            <dt>{t("bknProject.overview.versions.draft")}</dt>
            <dd>
              {draft
                ? draft.status === "ready"
                  ? t("bknProject.overview.versions.draftUpdated", {
                      time: formatTime(draft.updateTime),
                    })
                  : t(`bknProject.model.status.${draft.status}`)
                : draft === null
                  ? t("bknProject.overview.versions.noDraft")
                  : PLACEHOLDER}
            </dd>
            <dt>{t("bknProject.overview.versions.latestRelease")}</dt>
            <dd>
              {latestRelease
                ? `v${latestRelease.version} · ${formatTime(latestRelease.createTime)}`
                : PLACEHOLDER}
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
