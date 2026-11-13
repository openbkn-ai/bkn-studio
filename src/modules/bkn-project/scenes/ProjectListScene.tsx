/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Input, Spin, Tooltip } from "antd";
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
import { ProjectCard } from "@/modules/bkn-project/components/ProjectCard";
import {
  listProjectNetworks,
  listProjects,
  setProjectArchived,
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
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const currentUserId = runtimeConfig.currentUser.id;
  // Only the local viewer scenario is read-only. Project creation has no independent
  // permission point; real deployments continue to rely on the backend's network checks.
  const canCreateProject = getMockUserRole() !== "viewer";

  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
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

  // Each load takes a number; only the latest one may write the list, so a slow answer to an
  // earlier filter or page never replaces the current one.
  const latestLoad = useRef(0);

  const loadProjects = useCallback(async () => {
    const load = ++latestLoad.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listProjects({
        archived: showArchived ? "all" : "false",
        limit: pageSize,
        name,
        offset: (page - 1) * pageSize,
      });
      if (load !== latestLoad.current) {
        return;
      }
      // A page emptied since, as by archiving its last project, moves to the last one left.
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
  }, [name, page, pageSize, showArchived, t]);

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

  const resetPaging = () => setPage(1);

  // Searches as the name is typed, as the knowledge network list does.
  const searchedName = useDebouncedValue(keyword).trim();
  useEffect(() => {
    if (searchedName !== name) {
      setName(searchedName);
      setPage(1);
    }
  }, [name, searchedName]);

  const handleShowArchived = (checked: boolean) => {
    setShowArchived(checked);
    resetPaging();
  };

  // Networks or catalogs that failed to load are read again when the dialog that needs them opens.
  const openCreate = () => {
    if (networksError || catalogsError) {
      void loadReferences();
    }
    setCreateOpen(true);
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

  const changeArchived = async (project: Project, archived: boolean) => {
    try {
      await setProjectArchived(project.id, archived);
      message.success(
        t(archived ? "bknProject.list.archiveSuccess" : "bknProject.list.unarchiveSuccess"),
      );
      await loadProjects();
    } catch {
      // The request layer shows bkn-project's localized message.
    }
  };

  const handleArchive = (project: Project) => {
    void modal.confirm({
      title: t("bknProject.list.archiveConfirm.title", { name: project.name }),
      content: t("bknProject.list.archiveConfirm.content"),
      okText: t("bknProject.list.archiveConfirm.ok"),
      cancelText: t("common.cancel"),
      onOk: () => changeArchived(project, true),
    });
  };

  const filtered = name !== "" || showArchived;

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
          <Checkbox
            checked={showArchived}
            onChange={(event) => handleShowArchived(event.target.checked)}
          >
            {t("bknProject.list.showArchived")}
          </Checkbox>
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
                    onArchive={handleArchive}
                    onOpen={openProject}
                    onUnarchive={(record) => void changeArchived(record, false)}
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
    </section>
  );
}
