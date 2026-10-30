/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { LeftOutlined } from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { BknProjectKbSlot } from "@/framework/entitlement/BknProjectKbSlot";
import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage, isRequestNotFound } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { ProjectModel } from "@/modules/bkn-project/components/ProjectModel";
import { ProjectOverview } from "@/modules/bkn-project/components/ProjectOverview";
import { ProjectRequirements } from "@/modules/bkn-project/components/requirements/ProjectRequirements";
import { ProjectReleasePage } from "@/modules/bkn-project/components/ProjectReleasePage";
import { ProjectWorkspaceNav } from "@/modules/bkn-project/components/ProjectWorkspaceNav";
import {
  getLatestRelease,
  getProject,
  getProjectNetwork,
} from "@/modules/bkn-project/services/project.service";
import type { Project, ProjectRelease } from "@/modules/bkn-project/types/project";
import {
  KNOWLEDGE_BASE_SECTIONS,
  projectSectionPath,
  type ProjectSection,
} from "@/modules/bkn-project/types/workspace";

import styles from "./ProjectWorkspaceScene.module.css";

type Loaded = {
  /** undefined when the releases could not be read, null before the first release. */
  latestRelease: ProjectRelease | null | undefined;
  networkName: string;
  project: Project;
};

export function ProjectWorkspaceScene({
  projectId,
  section,
}: {
  projectId: string;
  section: ProjectSection;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { runtimeConfig } = useAppServices();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setNotFound(false);
    try {
      const project = await getProject(projectId);
      const [network, latestRelease] = await Promise.all([
        getProjectNetwork(project.knId),
        getLatestRelease(project.knId).catch(() => undefined),
      ]);
      setLoaded({ latestRelease, networkName: network?.name ?? project.knId, project });
    } catch (error) {
      setLoaded(null);
      // bkn-project answers 404 for a project of a network the caller cannot see, as for a missing one.
      if (isRequestNotFound(error)) {
        setNotFound(true);
      } else {
        setLoadError(extractRequestErrorMessage(error));
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const backToList = () => void navigate("/bkn-project");

  if (notFound) {
    return (
      <div className={styles.center}>
        <EmptyStatePanel
          action={
            <AppButton onClick={backToList}>{t("bknProject.workspace.backToList")}</AppButton>
          }
          description={t("bknProject.workspace.notFoundDescription")}
          title={t("bknProject.workspace.notFound")}
        />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={styles.center}>
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          description={loadError}
          message={t("bknProject.workspace.loadFailed")}
          showIcon
          type="error"
        />
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  const { latestRelease, networkName, project } = loaded;
  const live = latestRelease
    ? t("bknProject.workspace.live", { version: latestRelease.version })
    : latestRelease === null
      ? t("bknProject.workspace.unpublished")
      : null;
  const sectionTitle = t(`bknProject.workspace.sections.${section}`);

  return (
    <div className={styles.workspace}>
      <header className={styles.head}>
        <button
          aria-label={t("bknProject.workspace.backToList")}
          className={styles.back}
          onClick={backToList}
          title={t("bknProject.workspace.backToList")}
          type="button"
        >
          <LeftOutlined />
        </button>
        <span className={styles.name}>{project.name}</span>
        <code className={styles.id}>{project.id}</code>
        <span className={styles.meta}>
          {t("bknProject.workspace.targetNetwork", { name: networkName })}
        </span>
        {live ? <span className={styles.meta}>{live}</span> : null}
      </header>
      <div className={styles.body}>
        <aside className={styles.side}>
          <ProjectWorkspaceNav active={section} projectId={project.id} />
        </aside>
        <main className={styles.content}>
          <h2 className={styles.title}>{sectionTitle}</h2>
          {section === "overview" ? (
            <ProjectOverview
              latestRelease={latestRelease}
              networkName={networkName}
              onProjectChange={(next) =>
                setLoaded((current) => (current ? { ...current, project: next } : current))
              }
              ownerIsCaller={project.owner.id === runtimeConfig.currentUser.id}
              project={project}
            />
          ) : section === "model" ? (
            <ProjectModel
              initialTab={searchParams.get("tab")}
              // The check and the local indexes of a confirmation show on the release page.
              onConfirmed={() => void navigate(projectSectionPath(project.id, "release"))}
              onProjectChange={(next) =>
                setLoaded((current) => (current ? { ...current, project: next } : current))
              }
              ownerIsCaller={project.owner.id === runtimeConfig.currentUser.id}
              project={project}
            />
          ) : section === "requirements" ? (
            <ProjectRequirements
              ownerIsCaller={project.owner.id === runtimeConfig.currentUser.id}
              project={project}
            />
          ) : section === "release" ? (
            <ProjectReleasePage
              onGoToModel={() => void navigate(projectSectionPath(project.id, "model"))}
              onReleaseChanged={() => void load()}
              ownerIsCaller={project.owner.id === runtimeConfig.currentUser.id}
              project={project}
            />
          ) : KNOWLEDGE_BASE_SECTIONS.includes(section) ? (
            <BknProjectKbSlot>
              <EmptyStatePanel title={t("bknProject.workspace.comingSoon")} />
            </BknProjectKbSlot>
          ) : (
            <EmptyStatePanel
              description={t("bknProject.workspace.comingSoonDescription")}
              title={t("bknProject.workspace.comingSoon")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
