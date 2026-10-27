/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { InfoCircleOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Checkbox, Input, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  extractRequestErrorDetails,
  extractRequestErrorMessage,
} from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { NewProjectModal } from "@/modules/bkn-project/components/NewProjectModal";
import {
  listProjectNetworks,
  listProjects,
  setProjectArchived,
} from "@/modules/bkn-project/services/project.service";
import type { Project, ProjectCatalog, ProjectNetwork } from "@/modules/bkn-project/types/project";
import { projectSectionPath } from "@/modules/bkn-project/types/workspace";
import { catalogListAllQuery, listCatalogs } from "@/shared/catalog";

import styles from "./ProjectListScene.module.css";

export const PROJECT_PAGE_SIZE = 20;

/** bkn-project answers a cursor it did not issue, or one gone stale, with this code. */
const INVALID_CURSOR_CODE = "BknProject.InvalidParameter.Cursor";

const formatTime = (value: number) => dayjs(value).format("YYYY/MM/DD HH:mm");

export function ProjectListScene() {
  const { t } = useTranslation();
  const { message, modal, runtimeConfig } = useAppServices();
  const navigate = useNavigate();
  const currentUserId = runtimeConfig.currentUser.id;

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
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      if (load === latestLoad.current) {
        setLoading(false);
      }
    }
  }, [cursors, name, showArchived]);

  const loadReferences = useCallback(async () => {
    setNetworksError(null);
    try {
      setNetworks(await listProjectNetworks());
    } catch (error) {
      setNetworks([]);
      setNetworksError(extractRequestErrorMessage(error));
    }
    // One read serves the catalog names of the list and the picker of the new-project dialog.
    setCatalogsError(null);
    try {
      const result = await listCatalogs(catalogListAllQuery({ pageSize: 500 }), {
        skipErrorToast: true,
      });
      setCatalogs(result.items.map(({ id, name }) => ({ id, name })));
    } catch (error) {
      // The list falls back to catalog ids; the dialog shows the failure.
      setCatalogs([]);
      setCatalogsError(extractRequestErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const networkNames = Object.fromEntries(networks.map((network) => [network.id, network.name]));
  const catalogNames = Object.fromEntries(catalogs.map((catalog) => [catalog.id, catalog.name]));

  const resetPaging = () => setCursors([undefined]);

  const handleSearch = (value: string) => {
    setName(value.trim());
    resetPaging();
  };

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

  const columns: ColumnsType<Project> = [
    {
      title: t("bknProject.list.columns.project"),
      dataIndex: "name",
      width: 260,
      render: (value: string, record) => (
        <div className={styles.stack}>
          <Link className={styles.name} to={projectSectionPath(record.id, "overview")}>
            {value}
          </Link>
          <code className={styles.id}>{record.id}</code>
          {record.archived ? <Tag>{t("bknProject.list.archivedTag")}</Tag> : null}
        </div>
      ),
    },
    {
      title: t("bknProject.list.columns.network"),
      dataIndex: "knId",
      width: 260,
      render: (value: string, record) => (
        <div className={styles.stack}>
          <span>{networkNames[value] ?? value}</span>
          <code className={styles.id}>{value}</code>
          {record.otherProjects > 0 ? (
            <Tag color="warning">
              {t("bknProject.list.sameNetwork", { count: record.otherProjects })}
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: t("bknProject.list.columns.catalogs"),
      dataIndex: "catalogIds",
      width: 200,
      render: (value: string[]) =>
        value.length > 0 ? (
          <div className={styles.stack}>
            {value.map((id) => (
              <span key={id}>{catalogNames[id] ?? id}</span>
            ))}
          </div>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t("bknProject.list.columns.owner"),
      dataIndex: "owner",
      width: 140,
      render: (_value, record) =>
        record.owner.id === currentUserId ? (
          t("bknProject.list.ownerYou")
        ) : (
          <code className={styles.id}>{record.owner.id}</code>
        ),
    },
    {
      title: t("bknProject.list.columns.updated"),
      dataIndex: "updateTime",
      width: 160,
      render: (value: number) => formatTime(value),
    },
    {
      title: t("bknProject.list.columns.actions"),
      key: "actions",
      width: 100,
      render: (_value, record) => {
        if (record.owner.id !== currentUserId) {
          return null;
        }
        return record.archived ? (
          <AppButton type="link" onClick={() => void changeArchived(record, false)}>
            {t("bknProject.list.unarchive")}
          </AppButton>
        ) : (
          <AppButton type="link" onClick={() => handleArchive(record)}>
            {t("bknProject.list.archive")}
          </AppButton>
        );
      },
    },
  ];

  const filtered = name !== "" || showArchived;

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{t("bknProject.title")}</h2>
          <p className={styles.intro}>{t("bknProject.description")}</p>
        </div>
        <AppButton icon={<PlusOutlined />} type="primary" onClick={openCreate}>
          {t("bknProject.list.create")}
        </AppButton>
      </div>

      <div className={styles.toolbar}>
        <Input.Search
          allowClear
          className={styles.search}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={handleSearch}
          placeholder={t("bknProject.list.searchPlaceholder")}
          value={keyword}
        />
        <Checkbox
          checked={showArchived}
          onChange={(event) => handleShowArchived(event.target.checked)}
        >
          {t("bknProject.list.showArchived")}
        </Checkbox>
        <AppButton icon={<ReloadOutlined />} loading={loading} onClick={() => void loadProjects()}>
          {t("bknProject.list.refresh")}
        </AppButton>
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

      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{t("bknProject.list.cardTitle")}</span>
        <Tooltip title={t("bknProject.list.cardTip")}>
          <InfoCircleOutlined className={styles.muted} />
        </Tooltip>
        <span className={styles.muted}>{t("bknProject.list.total", { count: total })}</span>
      </div>

      <AppTable<Project>
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{
          emptyText: filtered ? (
            <EmptyStatePanel title={t("bknProject.list.emptyFiltered")} />
          ) : (
            <EmptyStatePanel
              description={t("bknProject.list.emptyDescription")}
              title={t("bknProject.list.emptyTitle")}
            />
          ),
        }}
        pagination={false}
        rowClassName={(record) => (record.archived ? styles.archivedRow : "")}
        rowKey="id"
        scroll={{ x: 1100 }}
      />

      {page > 0 || nextCursor ? (
        <div className={styles.pager}>
          <AppButton disabled={page === 0} onClick={() => setCursors(cursors.slice(0, -1))}>
            {t("bknProject.list.prevPage")}
          </AppButton>
          <AppButton
            disabled={!nextCursor}
            onClick={() => nextCursor && setCursors([...cursors, nextCursor])}
          >
            {t("bknProject.list.nextPage")}
          </AppButton>
        </div>
      ) : null}

      <NewProjectModal
        catalogs={catalogs}
        catalogsError={catalogsError}
        networks={networks}
        networksError={networksError}
        onCancel={() => setCreateOpen(false)}
        onCreated={handleCreated}
        open={createOpen}
      />
    </section>
  );
}
