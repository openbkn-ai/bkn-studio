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
import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { getMockUserRole } from "@/framework/runtime/mock-user";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
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

/** Fills whole rows of the card grid at its common widths. */
export const PROJECT_PAGE_SIZE = 24;

/** bkn-project answers a cursor it did not issue, or one gone stale, with this code. */
const INVALID_CURSOR_CODE = "BknProject.InvalidParameter.Cursor";

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
  // cursors[i] opens page i; the first page has none.
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const page = cursors.length - 1;

  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [networks, setNetworks] = useState<ProjectNetwork[]>([]);
  const [networksError, setNetworksError] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<ProjectCatalog[]>([]);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  // The cards name their catalogs once the list is read, whether or not it could be.
  const [catalogsRead, setCatalogsRead] = useState(false);
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
        cursor: cursors[cursors.length - 1],
        limit: PROJECT_PAGE_SIZE,
        name,
      });
      if (load !== latestLoad.current) {
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (load !== latestLoad.current) {
        return;
      }
      if (cursors.length > 1 && extractRequestErrorDetails(error).code === INVALID_CURSOR_CODE) {
        setCursors([undefined]);
        return;
      }
      setItems([]);
      setTotal(0);
      setNextCursor(null);
      setLoadError(requestFailureText(t, error));
    } finally {
      if (load === latestLoad.current) {
        setLoading(false);
      }
    }
  }, [cursors, name, showArchived, t]);

  const loadReferences = useCallback(async () => {
    setNetworksError(null);
    try {
      setNetworks(await listProjectNetworks());
    } catch (error) {
      setNetworks([]);
      setNetworksError(requestFailureText(t, error));
    }
    // One read serves the catalog names of the list and the picker of the new-project dialog.
    setCatalogsError(null);
    try {
      const result = await listCatalogs(catalogListAllQuery({ pageSize: 500 }), {
        skipErrorToast: true,
      });
      setCatalogs(result.items.map(({ id, name }) => ({ id, name })));
    } catch (error) {
      // The cards count the catalogs they cannot name; the dialog shows the failure.
      setCatalogs([]);
      setCatalogsError(requestFailureText(t, error));
    }
    setCatalogsRead(true);
  }, [t]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const networkNames = Object.fromEntries(networks.map((network) => [network.id, network.name]));
  const catalogNames = Object.fromEntries(catalogs.map((catalog) => [catalog.id, catalog.name]));

  const resetPaging = () => setCursors([undefined]);

  // Searches as the name is typed, as the knowledge network list does.
  const searchedName = useDebouncedValue(keyword).trim();
  useEffect(() => {
    if (searchedName !== name) {
      setName(searchedName);
      setCursors([undefined]);
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
                onClick={() => void loadProjects()}
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
                    catalogNames={catalogsRead ? catalogNames : null}
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

        <div className={styles.pager}>
          <span className={styles.total}>{t("bknProject.list.total", { count: total })}</span>
          {page > 0 || nextCursor ? (
            <>
              <AppButton disabled={page === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
                {t("bknProject.list.prevPage")}
              </AppButton>
              <AppButton
                disabled={!nextCursor}
                onClick={() => nextCursor && setCursors([...cursors, nextCursor])}
              >
                {t("bknProject.list.nextPage")}
              </AppButton>
            </>
          ) : null}
        </div>
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
