/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ApartmentOutlined,
  BuildOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  FileSearchOutlined,
  FunctionOutlined,
  GlobalOutlined,
  ProjectOutlined,
  RocketOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Spin, Tooltip } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { useBknProjectKbMode } from "@/framework/entitlement/bkn-project-kb-mode";
import { extensionProjectOverviewKnowledgeBase } from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import {
  describeDecision,
  itemNames,
  whoDecided,
} from "@/modules/bkn-project/components/draft/changes";
import { DataSourceHealth } from "@/modules/bkn-project/components/DataSourceHealth";
import { ProjectEditModal } from "@/modules/bkn-project/components/manage/ProjectEditModal";
import { namingLanguageLabelKey } from "@/modules/bkn-project/components/manage/projectLanguage";
import { ExistingLine } from "@/modules/bkn-project/components/existing/ExistingMark";
import { useNetworkExisting } from "@/modules/bkn-project/components/existing/useNetworkExisting";
import { DraftConceptGraph } from "@/modules/bkn-project/components/draft/DraftConceptGraph";
import { draftGraph } from "@/modules/bkn-project/components/draft/graph";
import { relationsWithUnadoptedEnds } from "@/modules/bkn-project/components/draft/evidence";
import { conceptsInModel } from "@/modules/bkn-project/components/concepts/inModel";
import { DRAFT_POLL_MS, getConcepts, getDraft } from "@/modules/bkn-project/services/draft.service";
import { getOntologyIndex } from "@/modules/bkn-project/services/publish.service";
import { versionNameIn } from "@/modules/bkn-project/components/release/releaseMessages";
import { getProjectVersions } from "@/modules/bkn-project/services/release.service";
import { needState } from "@/modules/bkn-project/components/kinetic/needs";
import { getLogicNeeds } from "@/modules/bkn-project/services/kinetic.service";
import { getRequirements } from "@/modules/bkn-project/services/requirements.service";
import type { Concepts } from "@/modules/bkn-project/types/concepts";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project, ProjectRelease } from "@/modules/bkn-project/types/project";
import type { ProjectIndex } from "@/modules/bkn-project/types/publish";
import type { ProjectVersions } from "@/modules/bkn-project/types/release";
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
  /** What the network already had of it, after a blue dot; only on an existing network. */
  existing?: string;
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
  const [editing, setEditing] = useState(false);
  const directory = useAccountDirectory();
  const go = (section: ProjectSection, tab?: string) =>
    void navigate(
      `${projectSectionPath(project.id, section)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
    );

  // The versions of the network, for the version it runs.
  // undefined while they are read, null when they could not be: the page says so, never guesses.
  const [versions, setVersions] = useState<ProjectVersions | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    getProjectVersions(project.id).then(
      (next) => {
        if (current) {
          setVersions(next);
        }
      },
      () => {
        if (current) {
          setVersions(null);
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
      setDraftError(requestFailureText(t, error));
    } finally {
      setReading(false);
      setReads((count) => count + 1);
    }
  }, [project.id, t]);
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
  // The structured index of the last confirmation; null before one, or while it cannot be read.
  const [index, setIndex] = useState<ProjectIndex | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getOntologyIndex(project.id)
      .then((next) => active && setIndex(next))
      .catch(() => active && setIndex(null));
    return () => {
      active = false;
    };
  }, [project.id]);
  const OverviewKnowledgeBase = extensionProjectOverviewKnowledgeBase();
  const kbMode = useBknProjectKbMode();

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

  // How far the kinetic needs are implemented in the live network; applications link to nothing.
  const [kinetic, setKinetic] = useState<{ linked: number; total: number } | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getLogicNeeds(project.id)
      .then((next) => {
        if (active) {
          const states = next.needs.map(needState).filter((state) => state !== "recordOnly");
          setKinetic({
            linked: states.filter((state) => state === "implemented").length,
            total: states.length,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  // The concepts, read again once drafting ends; undefined while unread or when unreadable.
  const [concepts, setConcepts] = useState<Concepts | undefined>(undefined);
  useEffect(() => {
    if (drafting) {
      return undefined;
    }
    let active = true;
    getConcepts(project.id)
      .then((next) => active && setConcepts(next))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [drafting, project.id]);

  // What the network already had: each tile counts it with what the project adds, and says how
  // much of it is the network's. null on a new network, whose tiles read as before.
  const existing = useNetworkExisting(project.id, project.knId);

  const ready = draft?.status === "ready" ? draft : null;
  const graph = useMemo(() => (ready ? draftGraph(ready) : null), [ready]);
  // The model's items the project adds, leaving out the network's own when the draft lists them.
  const added = useMemo(
    () =>
      existing && graph
        ? {
            objects: graph.nodes.filter((node) => !existing.objectTypeIds.has(node.id)).length,
            relations: graph.edges.filter((edge) => !existing.relationTypeIds.has(edge.id)).length,
          }
        : null,
    [existing, graph],
  );
  const existingConcepts =
    existing && concepts
      ? concepts.concepts.filter(
          (concept) =>
            concept.item &&
            (existing.objectTypeIds.has(concept.item.id) ||
              existing.relationTypeIds.has(concept.item.id)),
        ).length
      : 0;
  const existingIndexes = existing?.index?.objectTypes ?? [];
  const existingKinetic = existing?.statistics
    ? {
        actions: existing.statistics.actionTypesTotal,
        functions: existing.statistics.functionsTotal,
        skills: existing.statistics.skillsTotal,
      }
    : null;
  const runningVersionName =
    versions?.versioning.runningVersion && existing
      ? versionNameIn(t, versions.entries, versions.versioning.runningVersion)
      : null;
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
  const indexed = index?.objectTypes ?? [];
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
      ...(existing?.background ? { existing: t("bknProject.networkExisting.tiles.sources") } : {}),
      key: "sources",
      label: t("bknProject.workspace.sections.resources"),
      sub: t("bknProject.overview.tiles.sourcesSub"),
      value: t("bknProject.overview.tiles.sourcesValue", { count: project.catalogIds.length }),
    },
    {
      action: {
        label: t("bknProject.overview.tiles.conceptsAction"),
        onClick: () => go("concepts"),
      },
      color: "var(--color-primary-600)",
      icon: <BulbOutlined />,
      ...(existingConcepts
        ? { existing: t("bknProject.networkExisting.tiles.concepts", { count: existingConcepts }) }
        : {}),
      key: "concepts",
      label: t("bknProject.workspace.sections.concepts"),
      // The community image has no knowledge base to draw them from.
      sub: t(
        kbMode === "hidden"
          ? "bknProject.overview.tiles.conceptsSubCore"
          : "bknProject.overview.tiles.conceptsSub",
      ),
      ...(concepts?.concepts.length
        ? {
            note: t("bknProject.overview.tiles.conceptsInModel", {
              count: conceptsInModel(concepts.concepts).count,
            }),
          }
        : {}),
      value: concepts
        ? t("bknProject.overview.tiles.conceptsValue", { count: concepts.concepts.length })
        : PLACEHOLDER,
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
      label: t("bknProject.workspace.sections.model"),
      // The value counts adopted items only, unlike the modeling page's header, so the line says so.
      sub: t(
        graph
          ? "bknProject.overview.tiles.ontologyAdoptedSub"
          : "bknProject.overview.tiles.ontologySub",
      ),
      ...(existing
        ? {
            // New and existing together: the figure counts both, the line says how much is whose.
            existing: t("bknProject.networkExisting.tiles.ontology", {
              added: added?.objects ?? 0,
              existing: existing.objectTypeIds.size,
            }),
            note: t("bknProject.overview.tiles.ontologyRelations", {
              count: existing.relationTypeIds.size + (added?.relations ?? 0),
            }),
          }
        : graph
          ? {
              note: t("bknProject.overview.tiles.ontologyRelations", { count: graph.edges.length }),
            }
          : {}),
      value: existing
        ? t("bknProject.overview.tiles.ontologyValue", {
            count: existing.objectTypeIds.size + (added?.objects ?? 0),
          })
        : graph
          ? t("bknProject.overview.tiles.ontologyValue", { count: graph.nodes.length })
          : draft && draft.status !== "ready"
            ? t(`bknProject.model.status.${draft.status}`)
            : PLACEHOLDER,
    },
    {
      action: { label: t("bknProject.overview.tiles.kineticAction"), onClick: () => go("kinetic") },
      color: "var(--color-warning-text)",
      icon: <FunctionOutlined />,
      ...(existingKinetic
        ? { existing: t("bknProject.networkExisting.tiles.kinetic", existingKinetic) }
        : {}),
      key: "kinetic",
      label: t("bknProject.workspace.sections.kinetic"),
      ...(kinetic?.total
        ? {
            note:
              kinetic.linked === kinetic.total
                ? t("bknProject.overview.tiles.kineticDone")
                : t("bknProject.overview.tiles.kineticOpen", {
                    count: kinetic.total - kinetic.linked,
                  }),
          }
        : {}),
      sub: t("bknProject.overview.tiles.kineticSub"),
      value: kinetic?.total
        ? t("bknProject.overview.tiles.kineticValue", {
            linked: kinetic.linked,
            total: kinetic.total,
          })
        : existingKinetic
          ? t("bknProject.networkExisting.tiles.kineticValue", { count: existingKinetic.actions })
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
      label: t("bknProject.workspace.sections.scenarios"),
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
      action: { label: t("bknProject.overview.tiles.buildAction"), onClick: () => go("build") },
      color: "var(--color-info-text)",
      icon: <BuildOutlined />,
      ...(existingIndexes.length
        ? {
            existing: t("bknProject.networkExisting.tiles.build", {
              ready: existingIndexes.filter((item) => item.state === "ready").length,
              total: existingIndexes.length,
            }),
          }
        : {}),
      key: "build",
      label: t("bknProject.workspace.sections.build"),
      sub: t(
        kbMode === "hidden"
          ? "bknProject.overview.tiles.buildSubCore"
          : "bknProject.overview.tiles.buildSub",
      ),
      value: indexed.length
        ? t("bknProject.overview.tiles.buildValue", {
            ready: indexed.filter((item) => item.state === "ready").length,
            total: indexed.length,
          })
        : PLACEHOLDER,
    },
    {
      action: { label: t("bknProject.overview.tiles.releaseAction"), onClick: () => go("release") },
      color: "var(--color-success-text)",
      icon: <RocketOutlined />,
      ...(runningVersionName
        ? {
            existing: t("bknProject.networkExisting.tiles.release", {
              version: runningVersionName,
            }),
          }
        : {}),
      key: "release",
      label: t("bknProject.workspace.sections.release"),
      sub: t("bknProject.overview.tiles.releaseSub"),
      value:
        latestRelease === undefined
          ? PLACEHOLDER
          : latestRelease
            ? `v${latestRelease.version}`
            : t("bknProject.overview.versions.unpublished"),
    },
  ];

  const runningVersion =
    versions === undefined
      ? PLACEHOLDER
      : versions === null
        ? t("bknProject.overview.versions.runningUnknown")
        : versions.versioning.runningVersion
          ? versionNameIn(t, versions.entries, versions.versioning.runningVersion)
          : t("bknProject.overview.versions.unpublished");
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
    : project.ownerName || (directory.get(project.owner.id) ?? t("bknProject.list.ownerSomeone"));
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
          {project.canManage ? (
            <div className={kn.overviewHeaderTitleRight}>
              <AppButton icon={<EditOutlined />} onClick={() => setEditing(true)}>
                {t("common.edit")}
              </AppButton>
            </div>
          ) : null}
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
            {t("bknProject.overview.fields.running")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>
            {versions?.versioning.runningVersion
              ? networkLink(project.knId, runningVersion)
              : runningVersion}
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
          <GlobalOutlined />
          <span className={kn.overviewHeaderFooterLabel}>
            {t("bknProject.contentLanguage.label")}:
          </span>
          <span className={kn.overviewHeaderFooterValue}>
            {t(namingLanguageLabelKey(project.namingLanguage))}
          </span>
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

      <ProjectEditModal
        onCancel={() => setEditing(false)}
        onSaved={(next) => {
          setEditing(false);
          message.success(t("bknProject.manage.edit.success"));
          onProjectChange(next);
        }}
        project={editing ? project : null}
      />

      <DataSourceHealth
        draftVersion={draft ? `${draft.status}:${draft.updateTime}` : undefined}
        networkName={networkName}
        onGoToModel={() => go("model")}
        onGoToResources={() => go("resources", "catalogs")}
        project={project}
      />

      {/* The network's stat cards: an icon block, the name and figure, a link under them. */}
      {/* One card per step of the flow, in the order a project is built. */}
      <div className={styles.steps} data-region="stats">
        {tiles.map((tile) => (
          <div className={styles.statCard} key={tile.key} title={tile.sub}>
            <dl className={styles.statDefinition}>
              <dt className={kn.overviewStatIcon} style={{ backgroundColor: tile.color }}>
                {tile.icon}
              </dt>
              <dd>
                <p>{tile.label}</p>
                <p>{tile.value}</p>
                {tile.existing ? <ExistingLine>{tile.existing}</ExistingLine> : null}
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
              <AppButton className={styles.statAction} onClick={tile.action.onClick} type="link">
                {tile.action.label}
              </AppButton>
            ) : (
              <p className={styles.statNote}>{tile.sub}</p>
            )}
          </div>
        ))}
      </div>

      {OverviewKnowledgeBase && kbMode === "enabled" ? (
        <div className={styles.block} data-region="knowledge-base">
          <OverviewKnowledgeBase projectId={project.id} />
        </div>
      ) : null}

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
            <dd>{runningVersion}</dd>
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
