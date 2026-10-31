/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

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
import { getDraft } from "@/modules/bkn-project/services/draft.service";
import { getRequirements } from "@/modules/bkn-project/services/requirements.service";
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

// The knowledge network workspace's layout: the project's pages sit as a network's do.
import kn from "@/modules/knowledge-network/scenes/KnowledgeNetworkWorkspaceScene.module.css";

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

  // What the navigation counts: scenario questions and object types, read again on each page so
  // a change made on one shows when moving on. A failed read leaves the count off.
  const [counts, setCounts] = useState<Partial<Record<ProjectSection, number>>>({});
  // Read once the project is, after the page's own reads: the counts only add to it.
  const loadedId = loaded?.project.id;
  useEffect(() => {
    if (!loadedId) {
      return undefined;
    }
    let active = true;
    void Promise.all([
      getRequirements(projectId).catch(() => null),
      getDraft(projectId).catch(() => null),
    ]).then(([requirements, draft]) => {
      if (active) {
        setCounts({
          ...(requirements?.status === "ready" && requirements.spec
            ? { requirements: requirements.spec.questions.length }
            : {}),
          ...(draft?.status === "ready" ? { model: draft.items.objectTypes.length } : {}),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [loadedId, projectId, section]);

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

  // No heading of its own: the navigation names the page, as in a network's workspace. The
  // overview lays panels on the page's grey; every other page is one white sheet.
  return (
    <section className={kn.workspace}>
      <div className={kn.workspaceLayout}>
        <ProjectWorkspaceNav active={section} counts={counts} projectId={project.id} />
        <main
          className={
            section === "overview"
              ? `${kn.workspaceContent} ${kn.workspaceContentOverview}`
              : kn.workspaceContent
          }
        >
          <div className={section === "overview" ? kn.overviewBox : kn.workspaceSectionPage}>
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
          </div>
        </main>
      </div>
    </section>
  );
}
