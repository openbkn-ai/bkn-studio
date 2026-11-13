/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Input, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useDebouncedValue } from "@/framework/hooks/use-debounced-value";
import { getMockUserRole } from "@/framework/runtime/mock-user";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { requestFailureText } from "@/modules/bkn-project/components/publish/messages";
import { NewProjectModal } from "@/modules/bkn-project/components/NewProjectModal";
import { ProjectDeleteModal } from "@/modules/bkn-project/components/manage/ProjectDeleteModal";
import { ProjectEditModal } from "@/modules/bkn-project/components/manage/ProjectEditModal";
import { ProjectImport } from "@/modules/bkn-project/components/manage/ProjectImport";
import { ProjectCard } from "@/modules/bkn-project/components/ProjectCard";
import {
  exportProject,
  listProjectNetworks,
  listProjects,
} from "@/modules/bkn-project/services/project.service";
import type { Project, ProjectCatalog, ProjectNetwork } from "@/modules/bkn-project/types/project";
import { projectSectionPath } from "@/modules/bkn-project/types/workspace";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectListScene.module.css";

/** The page sizes of the knowledge network list, so both card lists page alike. */
const PROJECT_PAGE_SIZE_OPTIONS = ["12", "24", "36"];
export const PROJECT_PAGE_SIZE = 12;

export function ProjectListScene() {
  const { t } = useTranslation();
  const { message, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const currentUserId = runtimeConfig.currentUser.id;
  // Only the local viewer scenario is read-only. Project creation has no independent
  // permission point; real deployments continue to rely on the backend's network checks.
  const canCreateProject = getMockUserRole() !== "viewer";

  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PROJECT_PAGE_SIZE);

  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [networks, setNetworks] = useState<ProjectNetwork[]>([]);
  const [networksError, setNetworksError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<ProjectCatalog[]>([]);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  // Each load takes a number; only the latest one may write the list, so a slow answer to an
  // earlier filter or page never replaces the current one.
  const latestLoad = useRef(0);

  const loadProjects = useCallback(async () => {
    const load = ++latestLoad.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listProjects({
        limit: pageSize,
        name,
        offset: (page - 1) * pageSize,
      });
      if (load !== latestLoad.current) {
        return;
      }
      // A page emptied since, as by deleting its last project, moves to the last one left.
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (result.items.length === 0 && page > lastPage) {
        setPage(lastPage);
        return;
      }
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      if (load !== latestLoad.current) {
        return;
      }
      setItems([]);
      setTotal(0);
      setLoadError(requestFailureText(t, error));
    } finally {
      if (load === latestLoad.current) {
        setLoading(false);
      }
    }
  }, [name, page, pageSize, t]);

  const loadReferences = useCallback(async () => {
    setNetworksError(null);
    try {
      setNetworks(await listProjectNetworks());
    } catch (error) {
      setNetworks([]);
      setNetworksError(requestFailureText(t, error));
    }
    // The catalogs the new-project dialog offers.
    setCatalogsError(null);
    try {
      const result = await listCatalogs(catalogListAllQuery({ pageSize: 500 }), {
        skipErrorToast: true,
      });
      setCatalogs(result.items.map(({ id, name }) => ({ id, name })));
    } catch (error) {
      // The dialog shows the failure.
      setCatalogs([]);
      setCatalogsError(requestFailureText(t, error));
    }
  }, [t]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const networkNames = Object.fromEntries(networks.map((network) => [network.id, network.name]));

  // Searches as the name is typed, as the knowledge network list does.
  const searchedName = useDebouncedValue(keyword).trim();
  useEffect(() => {
    if (searchedName !== name) {
      setName(searchedName);
      setPage(1);
    }
  }, [name, searchedName]);

  // Networks or catalogs that failed to load are read again when the dialog that needs them opens.
  const reloadFailedReferences = () => {
    if (networksError || catalogsError) {
      void loadReferences();
    }
  };

  const openCreate = () => {
    reloadFailedReferences();
    setCreateOpen(true);
  };

  const handleImported = (project: Project) => {
    message.success(t("bknProject.import.success"));
    void navigate(projectSectionPath(project.id, "overview"));
  };

  const handleCreated = (project: Project) => {
    setCreateOpen(false);
    message.success(t("bknProject.create.success"));
    void navigate(projectSectionPath(project.id, "overview"));
  };

  // Refreshing starts again from the first page; on it, the list is read again.
  const refresh = () => {
    if (page === 1) {
      void loadProjects();
    } else {
      setPage(1);
    }
  };

  const handleExport = (project: Project) => {
    exportProject(project).catch(() =>
      message.error(t("bknProject.manage.export.failed", { name: project.name })),
    );
  };

  const handleSaved = (project: Project) => {
    setEditing(null);
    message.success(t("bknProject.manage.edit.success"));
    setItems((current) => current.map((item) => (item.id === project.id ? project : item)));
  };

  const handleDeleted = (project: Project) => {
    setDeleting(null);
    message.success(t("bknProject.manage.delete.success", { name: project.name }));
    void loadProjects();
  };

  const filtered = name !== "";

  const openProject = (project: Project) => {
    void navigate(projectSectionPath(project.id, "overview"));
  };

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {canCreateProject ? (
            <AppButton
              className={styles.toolbarButton}
              icon={<PlusOutlined />}
              onClick={openCreate}
              type="primary"
            >
              {t("bknProject.list.create")}
            </AppButton>
          ) : null}
          {canCreateProject ? (
            <ProjectImport
              catalogs={catalogs}
              catalogsError={catalogsError}
              className={styles.toolbarButton}
              networks={networks}
              networksError={networksError}
              onImported={handleImported}
              onOpen={reloadFailedReferences}
            />
          ) : null}
        </div>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("bknProject.list.searchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
            value={keyword}
          />
          <div className={styles.toolbarActions}>
            <Tooltip title={t("bknProject.list.refresh")}>
              <button
                aria-label={t("bknProject.list.refresh")}
                className={styles.iconButton}
                disabled={loading}
                onClick={refresh}
                type="button"
              >
                <ReloadOutlined />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton onClick={() => void loadProjects()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          className={styles.alert}
          description={loadError}
          message={t("bknProject.list.loadFailed")}
          showIcon
          type="error"
        />
      ) : null}

      <div className={styles.contentArea}>
        <Spin spinning={loading} wrapperClassName={styles.loadingWrapper}>
          <div className={styles.listContent}>
            {!loadError && !loading && items.length === 0 ? (
              filtered ? (
                <EmptyStatePanel title={t("bknProject.list.emptyFiltered")} />
              ) : (
                <EmptyStatePanel
                  description={t("bknProject.list.emptyDescription")}
                  title={t("bknProject.list.emptyTitle")}
                />
              )
            ) : (
              <div className={styles.grid}>
                {items.map((project) => (
                  <ProjectCard
                    isOwner={project.owner.id === currentUserId}
                    key={project.id}
                    networkName={networkNames[project.knId]}
                    onDelete={setDeleting}
                    onEdit={setEditing}
                    onExport={handleExport}
                    onOpen={openProject}
                    project={project}
                  />
                ))}
              </div>
            )}
          </div>
        </Spin>

        {items.length > 0 ? (
          <div className={styles.paginationBar}>
            <TablePaginationBar
              current={page}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
              pageSize={pageSize}
              pageSizeOptions={PROJECT_PAGE_SIZE_OPTIONS}
              showSizeChanger
              showTotal={(nextTotal) => t("common.total", { total: nextTotal })}
              total={total}
            />
          </div>
        ) : null}
      </div>

      {canCreateProject ? (
        <NewProjectModal
          catalogs={catalogs}
          catalogsError={catalogsError}
          networks={networks}
          networksError={networksError}
          onCancel={() => setCreateOpen(false)}
          onCreated={handleCreated}
          open={createOpen}
        />
      ) : null}
      <ProjectEditModal onCancel={() => setEditing(null)} onSaved={handleSaved} project={editing} />
      <ProjectDeleteModal
        onCancel={() => setDeleting(null)}
        onDeleted={handleDeleted}
        project={deleting}
      />
    </section>
  );
}
