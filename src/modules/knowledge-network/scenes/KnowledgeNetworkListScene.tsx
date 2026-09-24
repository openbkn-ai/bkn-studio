/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { Alert, Checkbox, Dropdown, Empty, Form, Input, Modal, Select, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { useEntitlement } from "@/framework/entitlement/use-entitlement";
import { isCommunityBuild } from "@/framework/entitlement/types";
import { usePageState } from "@/framework/hooks/use-page-state";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getRuntimeConfig } from "@/framework/runtime/config";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import type { KnowledgeNetworkListSceneProps } from "@/modules/knowledge-network/contracts/scenes";
import { KnowledgeNetworkCard } from "@/modules/knowledge-network/components/network/KnowledgeNetworkCard";
import { getMissingKnowledgeNetworkBusinessOperations } from "@/modules/knowledge-network/components/network/knowledge-network-card";
import { KnowledgeNetworkFormModal } from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";
import { KnowledgeNetworkImportButton } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkImportButton";
import {
  createKnowledgeNetwork,
  deleteKnowledgeNetwork,
  exportKnowledgeNetwork,
  listKnowledgeNetworks,
  listKnowledgeNetworkTags,
  updateKnowledgeNetwork,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { logServiceFallback } from "@/modules/knowledge-network/services/shared/runtime";
import {
  createPermissionRequest,
  listPermissionRequests,
} from "@/modules/account/services/permission-requests.service";
import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkListScene.module.css";

const CARD_GRID_PAGE_SIZE = 12;
const CARD_GRID_PAGE_SIZE_OPTIONS = ["12", "24", "36"];
type PermissionRequestForm = { operations: string[]; reason: string };

export function KnowledgeNetworkListScene({ onOpenWorkspace }: KnowledgeNetworkListSceneProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const entitlement = useEntitlement();
  const communityBuild = isCommunityBuild(entitlement);
  const canRequestPermission = !communityBuild && !getRuntimeConfig().currentUser.isSuperAdmin;
  const { pageState, query, setKeyword, setPagination } = usePageState({
    pageSize: CARD_GRID_PAGE_SIZE,
  });
  const [items, setItems] = useState<KnowledgeNetworkRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRecord, setEditingRecord] = useState<KnowledgeNetworkRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "updateTime">("updateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [authorizingRecord, setAuthorizingRecord] = useState<KnowledgeNetworkRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<KnowledgeNetworkRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [permissionRequestRecord, setPermissionRequestRecord] =
    useState<KnowledgeNetworkRecord | null>(null);
  const [pendingPermissionOperations, setPendingPermissionOperations] = useState<string[]>([]);
  const [permissionRequestLoading, setPermissionRequestLoading] = useState(false);
  const [permissionRequestSubmitting, setPermissionRequestSubmitting] = useState(false);
  const [permissionRequestForm] = Form.useForm<PermissionRequestForm>();

  const hasActiveFilter = useMemo(
    () => Boolean(pageState.keyword.trim()) || selectedTag !== "all",
    [pageState.keyword, selectedTag],
  );

  const listQuery = useMemo(
    () => ({
      ...query,
      direction: sortDirection,
      sortBy,
      tag: selectedTag === "all" ? undefined : selectedTag,
    }),
    [query, selectedTag, sortBy, sortDirection],
  );

  const loadListData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const listResult = await listKnowledgeNetworks(listQuery);

      setItems(listResult.items);
      setTotal(listResult.total);
    } catch (error) {
      setItems([]);
      setTotal(0);
      setLoadError(extractRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [listQuery]);

  const loadTags = useCallback(async () => {
    try {
      const tagResult = await listKnowledgeNetworkTags();
      setTags(tagResult);
    } catch (error) {
      logServiceFallback("KnowledgeNetworkListScene.loadTags", error);
      setTags([]);
    }
  }, []);

  const reloadData = useCallback(async () => {
    await Promise.all([loadListData(), loadTags()]);
  }, [loadListData, loadTags]);

  useEffect(() => {
    void loadListData();
  }, [loadListData]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const openCreate = () => {
    setModalMode("create");
    setEditingRecord(null);
    setFormOpen(true);
  };

  const openEdit = (record: KnowledgeNetworkRecord) => {
    setModalMode("edit");
    setEditingRecord(record);
    setFormOpen(true);
  };

  const openWorkspace = (record: KnowledgeNetworkRecord) => {
    if (onOpenWorkspace) {
      onOpenWorkspace(record.id);
      return;
    }

    void navigate(`/knowledge-network/workspace/${record.id}/overview`);
  };

  const openDelete = (record: KnowledgeNetworkRecord) => {
    setDeletingRecord(record);
  };

  const openPermissionRequest = async (record: KnowledgeNetworkRecord) => {
    const missingOperations = getMissingKnowledgeNetworkBusinessOperations(record);
    if (missingOperations.length === 0) {
      message.info(t("knowledgeNetwork.permissionRequestNoOperations"));
      return;
    }
    setPermissionRequestRecord(record);
    setPermissionRequestLoading(true);
    permissionRequestForm.resetFields();
    try {
      const page = await listPermissionRequests("mine", 200, 0);
      const pendingOperations = page.entries
        .filter(
          (request) =>
            request.status === "pending" &&
            request.resource_type === "knowledge_network" &&
            request.resource_id === record.id,
        )
        .flatMap((request) =>
          request.operations?.length ? request.operations : [request.operation],
        );
      setPendingPermissionOperations(pendingOperations);
    } catch (error) {
      setPermissionRequestRecord(null);
      message.error(extractRequestErrorMessage(error));
    } finally {
      setPermissionRequestLoading(false);
    }
  };

  const closePermissionRequest = (force = false) => {
    if (force || !permissionRequestSubmitting) {
      setPermissionRequestRecord(null);
      setPendingPermissionOperations([]);
      permissionRequestForm.resetFields();
    }
  };

  const submitPermissionRequest = async (values: PermissionRequestForm) => {
    if (!permissionRequestRecord) return;
    const missingOperations = getMissingKnowledgeNetworkBusinessOperations(permissionRequestRecord);
    const operations = communityBuild ? ["full_business_access"] : values.operations;
    if (operations.length === 0 || missingOperations.length === 0) return;
    setPermissionRequestSubmitting(true);
    try {
      await createPermissionRequest({
        resourceType: "knowledge_network",
        resourceID: permissionRequestRecord.id,
        resourceName: permissionRequestRecord.name,
        operations,
        reason: values.reason,
      });
      message.success(t("knowledgeNetwork.permissionRequestSuccess"));
      closePermissionRequest(true);
    } catch (error) {
      message.error(extractRequestErrorMessage(error));
    } finally {
      setPermissionRequestSubmitting(false);
    }
  };

  const missingPermissionOperations = permissionRequestRecord
    ? getMissingKnowledgeNetworkBusinessOperations(permissionRequestRecord)
    : [];
  const hasPendingFullBusinessAccess = pendingPermissionOperations.includes("full_business_access");
  const selectablePermissionOperations = communityBuild
    ? hasPendingFullBusinessAccess
      ? []
      : ["full_business_access"]
    : missingPermissionOperations.filter(
        (operation) => !pendingPermissionOperations.includes(operation),
      );

  const closeDelete = () => {
    if (deleting) {
      return;
    }

    setDeletingRecord(null);
  };

  const confirmDelete = async () => {
    if (!deletingRecord) {
      return;
    }

    setDeleting(true);

    try {
      await deleteKnowledgeNetwork(deletingRecord.id);
      void message.success(t("common.success"));
      setDeletingRecord(null);
      await reloadData();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const submitForm = async (values: KnowledgeNetworkMutationPayload) => {
    if (modalMode === "create") {
      const nextRecord = await createKnowledgeNetwork(values);
      setFormOpen(false);
      void message.success(t("common.success"));

      if (nextRecord) {
        openWorkspace(nextRecord);
        return;
      }
    } else if (editingRecord) {
      await updateKnowledgeNetwork(editingRecord.id, values);
      setFormOpen(false);
      void message.success(t("common.success"));
    }

    await reloadData();
  };

  const renderEmptyContent = () => {
    if (hasActiveFilter) {
      return (
        <Empty
          className={styles.emptyPanel}
          description={t("knowledgeNetwork.emptyNoSearchResult")}
        />
      );
    }

    return (
      <Empty
        className={styles.emptyPanel}
        description={
          <PermissionGate
            fallback={<span>{t("knowledgeNetwork.emptyTitle")}</span>}
            permissions="knowledge-network:create"
          >
            <span>
              {t("knowledgeNetwork.emptyCreateHint")}
              <AppButton onClick={openCreate} type="link">
                {t("knowledgeNetwork.emptyCreateAction")}
              </AppButton>
              {t("knowledgeNetwork.emptyCreateSuffix")}
            </span>
          </PermissionGate>
        }
      />
    );
  };

  return (
    <section className={styles.page}>
      {/* 页面标题与顶栏面包屑「领域业务知识网络」重复，去掉避免冗余 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <PermissionGate permissions="knowledge-network:create">
            <AppButton
              className={styles.toolbarButton}
              icon={<PlusOutlined />}
              onClick={openCreate}
              type="primary"
            >
              {t("common.create")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="knowledge-network:create">
            <KnowledgeNetworkImportButton
              className={styles.toolbarButton}
              onImported={reloadData}
            />
          </PermissionGate>
        </div>
        <div className={styles.toolbarRight}>
          <Input
            allowClear
            className={styles.searchInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("knowledgeNetwork.searchPlaceholder")}
            prefix={<SearchOutlined className={styles.searchIcon} />}
            value={pageState.keyword}
          />
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t("common.tag")}</span>
            <Select
              className={styles.filterSelect}
              onChange={(value) => {
                setSelectedTag(value);
                setPagination(1, pageState.pageSize);
              }}
              options={[
                { label: t("common.all"), value: "all" },
                ...tags.map((tag) => ({ label: tag, value: tag })),
              ]}
              value={selectedTag ?? "all"}
            />
          </div>
          <div className={styles.toolbarActions}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "updateTime",
                    label: t("knowledgeNetwork.sortByUpdateTime"),
                  },
                  {
                    key: "name",
                    label: t("knowledgeNetwork.sortByName"),
                  },
                ],
                onClick: ({ key }) => {
                  const nextSortBy = key as "name" | "updateTime";
                  setSortDirection((current) =>
                    nextSortBy === sortBy ? (current === "desc" ? "asc" : "desc") : "desc",
                  );
                  setSortBy(nextSortBy);
                  setPagination(1, pageState.pageSize);
                },
              }}
              trigger={["click"]}
            >
              <button
                aria-label={t("knowledgeNetwork.sortByUpdateTime")}
                className={styles.iconButton}
                type="button"
              >
                <SortAscendingOutlined />
              </button>
            </Dropdown>
            <button
              className={styles.iconButton}
              disabled={loading}
              onClick={() => {
                void reloadData();
              }}
              type="button"
            >
              <ReloadOutlined />
            </button>
          </div>
        </div>
      </div>

      {loadError ? (
        <Alert
          action={
            <AppButton
              onClick={() => {
                void reloadData();
              }}
              type="link"
            >
              {t("common.retry")}
            </AppButton>
          }
          message={loadError}
          showIcon
          type="error"
        />
      ) : null}

      <div className={styles.contentArea}>
        <Spin spinning={loading} wrapperClassName={styles.loadingWrapper}>
          <div className={styles.listContent}>
            {!loadError && !loading && items.length === 0 ? (
              renderEmptyContent()
            ) : (
              <div className={styles.grid}>
                {items.map((record) => (
                  <KnowledgeNetworkCard
                    key={record.id}
                    onAuthorize={setAuthorizingRecord}
                    onDelete={openDelete}
                    onEdit={openEdit}
                    onExport={(nextRecord, format) => {
                      void exportKnowledgeNetwork(nextRecord.id, format).then(() => {
                        void message.success(t("knowledgeNetwork.exportSuccess"));
                      });
                    }}
                    onOpen={openWorkspace}
                    canRequestPermission={canRequestPermission}
                    onRequestPermission={
                      canRequestPermission
                        ? (record) => void openPermissionRequest(record)
                        : undefined
                    }
                    record={record}
                  />
                ))}
              </div>
            )}
          </div>
        </Spin>

        {items.length > 0 ? (
          <div className={styles.paginationBar}>
            <TablePaginationBar
              current={pageState.page}
              onChange={(page, pageSize) => setPagination(page, pageSize)}
              pageSize={pageState.pageSize}
              pageSizeOptions={CARD_GRID_PAGE_SIZE_OPTIONS}
              showSizeChanger
              showTotal={(nextTotal) => t("common.total", { total: nextTotal })}
              total={total}
            />
          </div>
        ) : null}
      </div>

      <KnowledgeNetworkFormModal
        mode={modalMode}
        onCancel={() => setFormOpen(false)}
        onSubmit={submitForm}
        open={formOpen}
        record={editingRecord}
      />
      <ObjectAuthorizeDrawer
        objectAuthorized={hasKnowledgeNetworkRecordOperation(authorizingRecord, "authorize")}
        objId={authorizingRecord?.id ?? ""}
        objName={authorizingRecord?.name ?? ""}
        objType="knowledge_network"
        onClose={() => setAuthorizingRecord(null)}
        open={Boolean(authorizingRecord)}
      />
      <Modal
        centered
        confirmLoading={permissionRequestSubmitting}
        okButtonProps={{
          disabled: permissionRequestLoading || selectablePermissionOperations.length === 0,
        }}
        okText={t("knowledgeNetwork.permissionRequestSubmit")}
        onCancel={() => closePermissionRequest()}
        onOk={() => permissionRequestForm.submit()}
        open={Boolean(permissionRequestRecord)}
        title={t("knowledgeNetwork.permissionRequestTitle")}
      >
        <Spin spinning={permissionRequestLoading}>
          <Form
            form={permissionRequestForm}
            layout="vertical"
            onFinish={(values) => void submitPermissionRequest(values)}
          >
            <Form.Item label={t("knowledgeNetwork.permissionRequestNetwork")}>
              <Input
                disabled
                value={
                  permissionRequestRecord
                    ? `${permissionRequestRecord.name} (${permissionRequestRecord.id})`
                    : ""
                }
              />
            </Form.Item>
            {communityBuild ? (
              <Alert
                showIcon
                type="warning"
                message={t("knowledgeNetwork.permissionRequestCommunity")}
              />
            ) : null}
            {pendingPermissionOperations.length > 0 ? (
              <Alert
                showIcon
                style={{ marginTop: 16 }}
                type="info"
                message={t("knowledgeNetwork.permissionRequestPending", {
                  operations: pendingPermissionOperations
                    .map((operation) => t(`knowledgeNetwork.permissionOperation.${operation}`))
                    .join("、"),
                })}
              />
            ) : null}
            {communityBuild ? (
              <Form.Item
                label={t("knowledgeNetwork.permissionRequestOperations")}
                style={{ marginTop: 16 }}
              >
                <Checkbox checked disabled>
                  {t("knowledgeNetwork.permissionOperation.full_business_access")}
                </Checkbox>
              </Form.Item>
            ) : (
              <Form.Item
                label={t("knowledgeNetwork.permissionRequestOperations")}
                name="operations"
                rules={[{ required: true }]}
                style={{ marginTop: 16 }}
              >
                <Checkbox.Group
                  options={selectablePermissionOperations.map((operation) => ({
                    label: t(`knowledgeNetwork.permissionOperation.${operation}`),
                    value: operation,
                  }))}
                />
              </Form.Item>
            )}
            <Form.Item label={t("knowledgeNetwork.permissionRequestReason")} name="reason">
              <Input.TextArea maxLength={512} rows={3} />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
      <Modal
        centered
        closable={!deleting}
        closeIcon={<span className={styles.deleteModalClose}>×</span>}
        footer={null}
        maskClosable={!deleting}
        onCancel={closeDelete}
        open={Boolean(deletingRecord)}
        rootClassName={styles.deleteModalRoot}
        title={t("knowledgeNetwork.deleteTitle")}
        width={652}
      >
        <Alert
          className={styles.deleteAlert}
          message={t("knowledgeNetwork.deleteDescription", {
            name: deletingRecord?.name ?? "",
          })}
          showIcon
          type="info"
        />
        <div className={styles.deleteModalFooter}>
          <AppButton disabled={deleting} onClick={closeDelete}>
            {t("common.cancel")}
          </AppButton>
          <AppButton danger loading={deleting} onClick={() => void confirmDelete()} type="primary">
            {t("common.delete")}
          </AppButton>
        </div>
      </Modal>
    </section>
  );
}
