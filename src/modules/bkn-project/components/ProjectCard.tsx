/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  ClockCircleOutlined,
  EllipsisOutlined,
  ProjectOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Dropdown, Tag, Tooltip, type MenuProps } from "antd";
import type { TFunction } from "i18next";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LightStatusTag, type LightStatusTone } from "@/framework/ui/common/LightStatusTag";
import { versionName } from "@/modules/bkn-project/components/release/releaseMessages";
import { getProjectStatus } from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { ProjectStage, ProjectStatus } from "@/modules/bkn-project/types/publish";
import { networkWorkspacePath } from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectCard.module.css";

const STAGE_TONES: Record<ProjectStage, LightStatusTone> = {
  archived: "neutral",
  check_needs_attention: "warning",
  check_not_started: "info",
  checking: "info",
  confirmed: "info",
  deciding: "info",
  draft_failed: "error",
  drafting: "info",
  no_draft: "neutral",
  published: "success",
  ready_to_confirm: "info",
};

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

type ProjectCardProps = {
  catalogNames: Record<string, string>;
  /** The caller owns the project and may archive or restore it. */
  isOwner: boolean;
  networkName?: string;
  onArchive: (project: Project) => void;
  onOpen: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  project: Project;
};

/** What the project's release says on the card: one tag, or a tag and a line beside it. */
function releaseView(t: TFunction, status: ProjectStatus) {
  const { release, stage } = status;
  if (!release) {
    return null;
  }
  if (release.rolledBack && release.running) {
    return {
      text: t("bknProject.release.publish.rolledBack", {
        version: versionName(t, release.running.knVersion, release.running.label),
      }),
      tone: "warning" as const,
    };
  }
  // A published project says it in its stage tag; one that went on after it names the release.
  return stage === "published"
    ? null
    : { text: t("bknProject.list.card.lastRelease", { version: release.version }), tone: null };
}

/** A project in the list, as the knowledge network list shows a network. */
export function ProjectCard({
  catalogNames,
  isOwner,
  networkName,
  onArchive,
  onOpen,
  onUnarchive,
  project,
}: ProjectCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  // An archived project's stage is "archived"; the card says so without asking.
  useEffect(() => {
    if (project.archived) {
      return;
    }
    let active = true;
    getProjectStatus(project.id)
      .then((next) => active && setStatus(next))
      // Without its status the card still opens the project; the workspace shows the failure.
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, [project.archived, project.id, project.updateTime]);

  const stage: ProjectStage | null = project.archived ? "archived" : (status?.stage ?? null);
  // A card archived while shown keeps its last status; archived cards say only that they are.
  const release = status && !project.archived ? releaseView(t, status) : null;
  const publishedVersion = stage === "published" ? status?.release?.version : undefined;

  const menuItems: MenuProps["items"] = [
    { key: "open", label: t("bknProject.list.card.open") },
    ...(isOwner
      ? [
          project.archived
            ? { key: "unarchive", label: t("bknProject.list.unarchive") }
            : { key: "archive", label: t("bknProject.list.archive") },
        ]
      : []),
  ];

  const catalogs = project.catalogIds.map((id) => catalogNames[id] ?? id);

  return (
    <article
      className={`${styles.card} ${project.archived ? styles.archived : ""}`}
      onClick={() => onOpen(project)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(project);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.iconBox}>
            <ProjectOutlined />
          </span>
          <div className={styles.titleContent}>
            <Tooltip title={project.name}>
              <div className={styles.titleText}>{project.name}</div>
            </Tooltip>
            <div className={styles.statusRow}>
              {stage ? (
                <LightStatusTag tone={STAGE_TONES[stage]}>
                  {publishedVersion
                    ? t("bknProject.release.publish.publishedTag", { version: publishedVersion })
                    : t(`bknProject.list.card.stages.${stage}`)}
                </LightStatusTag>
              ) : null}
              {release?.tone ? (
                <LightStatusTag tone={release.tone}>{release.text}</LightStatusTag>
              ) : release ? (
                <span className={styles.muted}>{release.text}</span>
              ) : null}
            </div>
          </div>
        </div>
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "archive") {
                onArchive(project);
              } else if (key === "unarchive") {
                onUnarchive(project);
              } else {
                onOpen(project);
              }
            },
          }}
          overlayClassName={styles.cardMenu}
          // The menu popup is a React child of the card: clicks inside it must not open the project.
          popupRender={(menu) => <div onClick={(event) => event.stopPropagation()}>{menu}</div>}
          trigger={["click"]}
        >
          <button
            aria-label={t("bknProject.list.card.more")}
            className={styles.moreButton}
            onClick={(event) => event.stopPropagation()}
            type="button"
          >
            <EllipsisOutlined />
          </button>
        </Dropdown>
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t("bknProject.list.card.network")}</dt>
          <dd>
            {/* The project's network keeps its versions under one id: the link opens it. */}
            <Link
              className={styles.ellipsis}
              onClick={(event) => event.stopPropagation()}
              to={networkWorkspacePath(project.knId)}
            >
              {networkName ?? project.knId}
            </Link>
            {project.otherProjects > 0 ? (
              <Tooltip title={t("bknProject.list.sameNetworkTip")}>
                <Tag className={styles.sameNetwork} color="warning">
                  {t("bknProject.list.sameNetwork", { count: project.otherProjects })}
                </Tag>
              </Tooltip>
            ) : null}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("bknProject.list.card.catalogs")}</dt>
          <dd>
            {catalogs.length > 0 ? (
              <Tooltip title={catalogs.join(t("bknProject.list.card.separator"))}>
                <span className={styles.ellipsis}>
                  {catalogs.join(t("bknProject.list.card.separator"))}
                </span>
              </Tooltip>
            ) : (
              <span className={styles.muted}>—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className={styles.footer}>
        <Tooltip title={t("bknProject.list.card.owner")}>
          <span className={`${styles.metaItem} ${styles.footerLeft}`}>
            <UserOutlined />
            <span>
              {isOwner
                ? t("bknProject.list.ownerYou")
                : project.ownerName || t("bknProject.list.ownerSomeone")}
            </span>
          </span>
        </Tooltip>
        <Tooltip title={t("bknProject.list.card.updated")}>
          <span className={styles.metaItem}>
            <ClockCircleOutlined />
            <span>{formatTime(project.updateTime)}</span>
          </span>
        </Tooltip>
      </div>
    </article>
  );
}
