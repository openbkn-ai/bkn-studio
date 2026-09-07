/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  ExportOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Empty, Input, Table, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { CapabilityMountModal } from "@/modules/knowledge-network/components/capability/CapabilityMountModal";
import type { CapabilityToolKind } from "@/modules/knowledge-network/services/capability-tool-kind.service";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import {
  CAPABILITY_STATUS_MISSING,
  type AttachCapabilityInput,
  type CapabilityBindingListResult,
  type CapabilityBindingRecord,
  type CapabilityType,
} from "@/modules/knowledge-network/types/knowledge-network";
import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

import panelStyles from "./CapabilityListPanel.module.css";

/**
 * One panel serves three nav entries. SKILLs and tools are different capability types on the wire;
 * "api" and "function" are the same type split by what the owning tool box holds.
 */
export type CapabilitySectionKind = "api" | "function" | "mcp" | "skill";

type CapabilityListPanelProps = {
  canDelete: boolean;
  canModify: boolean;
  data: CapabilityBindingListResult;
  kind: CapabilitySectionKind;
  loading?: boolean;
  onDetach: (bindingIds: string[]) => Promise<void>;
  onMount: (inputs: AttachCapabilityInput[]) => Promise<number>;
  onRefresh: () => Promise<void>;
};

/** Locale key fragment per section, so titles and empty states stay one lookup instead of a chain. */
const TITLE_KEY = {
  api: "Apis",
  function: "Functions",
  mcp: "McpTools",
  skill: "Skills",
} as const;

/**
 * The execution factory reports two status vocabularies: a tool is enabled/disabled, a SKILL, a
 * toolset and an MCP Server are published/unpublish/offline. Both reach the binding row untranslated,
 * so map them here and fall back to the raw value rather than hiding a status this list does not
 * know yet.
 */
const STATUS_LABEL_KEY: Record<string, string> = {
  disabled: "capabilityStatusDisabled",
  enabled: "capabilityStatusEnabled",
  offline: "capabilityStatusOffline",
  published: "capabilityStatusPublished",
  unpublish: "capabilityStatusUnpublished",
};

const STATUS_TAG_COLOR: Record<string, string> = {
  disabled: "default",
  enabled: "success",
  offline: "default",
  published: "success",
  unpublish: "warning",
};

/**
 * Where the asset itself lives; a binding is only a reference to it. An MCP tool has no page of its
 * own — it is addressed by name inside its Server — so it points at the Server.
 */
function executionFactoryPath(record: CapabilityBindingRecord) {
  switch (record.capabilityType) {
    case "skill":
      return `/execution-factory/skills/${record.capabilityId}`;
    case "mcp_tool":
      return `/execution-factory/mcp/${record.boxId}`;
    default:
      return `/execution-factory/toolboxes/${record.boxId}/tools/${record.capabilityId}/edit`;
  }
}

export function CapabilityListPanel({
  canDelete,
  canModify,
  data,
  kind,
  loading,
  onDetach,
  onMount,
  onRefresh,
}: CapabilityListPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentPageSize(`capability-${kind}`);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [mountOpen, setMountOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSkill = kind === "skill";
  const isMcp = kind === "mcp";
  const capabilityType: CapabilityType = isSkill
    ? "skill"
    : isMcp
      ? "mcp_tool"
      : "function";
  const toolKind: CapabilityToolKind | undefined =
    kind === "api" || kind === "function" ? kind : undefined;

  const filtered = useMemo(() => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) {
      return data.entries;
    }

    return data.entries.filter(
      (item) =>
        item.name.toLowerCase().includes(trimmed) ||
        item.capabilityId.toLowerCase().includes(trimmed) ||
        item.boxName.toLowerCase().includes(trimmed),
    );
  }, [data.entries, keyword]);

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const mountedRefs = useMemo(
    () =>
      new Set(
        data.entries.map((item) =>
          item.capabilityType === "skill"
            ? item.capabilityId
            : `${item.boxId}/${item.capabilityId}`,
        ),
      ),
    [data.entries],
  );

  const runDetach = async (bindingIds: string[]) => {
    setBusy(true);
    try {
      await onDetach(bindingIds);
      setSelectedRowKeys((keys) => keys.filter((key) => !bindingIds.includes(key)));
      void message.success(t("knowledgeNetwork.capabilityDetachSuccess"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDetach = (bindingIds: string[]) => {
    modal.confirm({
      content: t("knowledgeNetwork.capabilityDetachConfirmContent"),
      okButtonProps: { danger: true },
      okText: t("knowledgeNetwork.capabilityDetach"),
      onOk: () => runDetach(bindingIds),
      title: t("knowledgeNetwork.capabilityDetachConfirmTitle"),
    });
  };

  const columns: TableProps<CapabilityBindingRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      title: t("knowledgeNetwork.capabilityColumnName"),
      render: (_: string, record) => (
        <div>
          <AppButton
            onClick={() => {
              void navigate(executionFactoryPath(record));
            }}
            type="link"
          >
            {record.name || record.capabilityId}
          </AppButton>
          {record.name ? (
            <div className={styles.objectName}>{record.capabilityId}</div>
          ) : null}
        </div>
      ),
    },
    ...(isSkill
      ? []
      : [
          {
            dataIndex: "boxName",
            key: "boxName",
            title: t("knowledgeNetwork.capabilityColumnBox"),
            render: (_: string, record: CapabilityBindingRecord) => (
              <div>
                <div>{record.boxName || record.boxId}</div>
                {record.boundAsBox ? (
                  <Tag>{t("knowledgeNetwork.capabilityBoundAsBox")}</Tag>
                ) : null}
              </div>
            ),
          },
        ]),
    {
      dataIndex: "status",
      key: "status",
      title: t("knowledgeNetwork.capabilityColumnStatus"),
      render: (value: string) => {
        if (value === CAPABILITY_STATUS_MISSING) {
          return (
            <Tooltip title={t("knowledgeNetwork.capabilityStatusMissingHint")}>
              <Tag color="error">{t("knowledgeNetwork.capabilityStatusMissing")}</Tag>
            </Tooltip>
          );
        }

        if (!value) {
          return "-";
        }

        const labelKey = STATUS_LABEL_KEY[value];

        return (
          <Tag color={STATUS_TAG_COLOR[value] ?? "default"}>
            {labelKey ? t(`knowledgeNetwork.${labelKey}`) : value}
          </Tag>
        );
      },
    },
    {
      dataIndex: "comment",
      key: "comment",
      title: t("knowledgeNetwork.capabilityColumnComment"),
      render: (value: string) => value || "-",
    },
    {
      dataIndex: "createTime",
      key: "createTime",
      title: t("knowledgeNetwork.capabilityColumnMountTime"),
    },
    {
      key: "actions",
      title: t("common.actions"),
      width: 120,
      render: (_: unknown, record) =>
        canDelete ? (
          <AppButton danger onClick={() => confirmDetach([record.id])} type="link">
            {t("knowledgeNetwork.capabilityDetach")}
          </AppButton>
        ) : null,
    },
  ];

  const topUpBoxes = data.boxes.filter(
    (item) => item.unmountedTools > 0 || item.boxMissing,
  );

  return (
    <>
      {/* objectTypePage carries the console's list-page scale: 16px title, square controls, 14px
          table text. Without it this page renders a size larger than metrics or object types. */}
      <section className={`${styles.page} ${styles.objectTypePage}`}>
        <div className={panelStyles.header}>
          <h2 className={`${styles.title} ${panelStyles.titleRow}`}>
            {t(`knowledgeNetwork.capability${TITLE_KEY[kind]}Title`)}
            <Tooltip
              title={t(`knowledgeNetwork.capabilityUsageTip${TITLE_KEY[kind]}`)}
            >
              <QuestionCircleOutlined
                aria-label={t("knowledgeNetwork.capabilityUsageTipLabel")}
                className={panelStyles.usageTip}
              />
            </Tooltip>
          </h2>
          <AppButton
            className={panelStyles.manageLink}
            icon={<ExportOutlined />}
            onClick={() => {
              void navigate(
                isSkill
                  ? "/execution-factory/units?activeTab=skill"
                  : isMcp
                    ? "/execution-factory/units?activeTab=mcp"
                    : "/execution-factory/units?activeTab=toolbox",
              );
            }}
            type="link"
          >
            {t("knowledgeNetwork.capabilityManageInFactory")}
          </AppButton>
        </div>

        {data.metadataAvailable ? null : (
          <Alert
            className={styles.noticeBanner}
            message={t("knowledgeNetwork.capabilityMetadataUnavailable")}
            showIcon
            type="warning"
          />
        )}

        {topUpBoxes.map((box) => (
          <Alert
            action={
              box.boxMissing || !canModify ? null : (
                <AppButton
                  loading={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const created = await onMount([
                          { allTools: true, boxId: box.boxId, capabilityType: "function" },
                        ]);
                        void message.success(
                          t("knowledgeNetwork.capabilityMountSuccess", { count: created }),
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  size="small"
                  type="link"
                >
                  {t("knowledgeNetwork.capabilityBoxTopUpAction", {
                    count: box.unmountedTools,
                  })}
                </AppButton>
              )
            }
            className={styles.noticeBanner}
            key={box.boxId}
            message={
              box.boxMissing
                ? t("knowledgeNetwork.capabilityBoxMissing")
                : t("knowledgeNetwork.capabilityBoxTopUpTitle", {
                    boxName: box.boxName || box.boxId,
                    mounted: box.mountedTools,
                    total: box.totalTools,
                  })
            }
            showIcon
            type={box.boxMissing ? "error" : "info"}
          />
        ))}

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {canModify ? (
              <AppButton
                className={styles.toolbarButton}
                icon={<PlusOutlined />}
                onClick={() => setMountOpen(true)}
                type="primary"
              >
                {t(`knowledgeNetwork.capabilityMount${TITLE_KEY[kind]}`)}
              </AppButton>
            ) : null}
            {canDelete ? (
              <AppButton
                className={styles.toolbarButton}
                danger
                disabled={selectedRowKeys.length === 0}
                icon={<DeleteOutlined />}
                onClick={() => confirmDetach(selectedRowKeys)}
              >
                {t("knowledgeNetwork.capabilityDetachSelected")}
              </AppButton>
            ) : null}
          </div>
          <div className={styles.toolbarRight}>
            <Input
              allowClear
              className={styles.searchInput}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder={t("knowledgeNetwork.capabilitySearchPlaceholder")}
              prefix={<SearchOutlined className={styles.searchIcon} />}
              value={keyword}
            />
            <AppButton
              className={styles.iconButton}
              icon={<ReloadOutlined />}
              onClick={() => {
                void onRefresh();
              }}
              title={t("knowledgeNetwork.capabilityRefresh")}
            />
          </div>
        </div>

        <div className={styles.tableCard}>
          {filtered.length === 0 ? (
            <Empty
              className={styles.emptyPanel}
              description={t(`knowledgeNetwork.capabilityEmpty${TITLE_KEY[kind]}`)}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={pageItems}
              loading={loading || busy}
              pagination={false}
              rowKey="id"
              rowSelection={
                canDelete
                  ? {
                      onChange: (keys) => setSelectedRowKeys(keys as string[]),
                      selectedRowKeys,
                    }
                  : undefined
              }
              scroll={{ x: 880 }}
              size="middle"
            />
          )}
          {filtered.length > 0 ? (
            <TablePaginationBar
              current={page}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
              pageSize={pageSize}
              showSizeChanger
              total={filtered.length}
            />
          ) : null}
        </div>
      </section>

      <CapabilityMountModal
        capabilityType={capabilityType}
        toolKind={toolKind}
        mountedRefs={mountedRefs}
        onCancel={() => setMountOpen(false)}
        onSubmit={async (inputs) => {
          const created = await onMount(inputs);
          if (created === 0) {
            void message.info(t("knowledgeNetwork.capabilityMountNothingNew"));
          } else {
            void message.success(
              t("knowledgeNetwork.capabilityMountSuccess", { count: created }),
            );
          }
          setMountOpen(false);
        }}
        open={mountOpen}
      />
    </>
  );
}
