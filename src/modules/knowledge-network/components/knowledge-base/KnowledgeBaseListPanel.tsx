/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { PlusOutlined, QuestionCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Table, Tag, Tooltip } from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";
import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { KnowledgeBasePicker } from "@/modules/knowledge-network/components/knowledge-base/KnowledgeBasePicker";
import {
  detachKnowledgeNetworkCapabilities,
  listKnowledgeNetworkCapabilities,
} from "@/modules/knowledge-network/services/capability-binding.service";
import {
  CAPABILITY_STATUS_MISSING,
  type CapabilityBindingRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  knowledgeBaseBindingFailure,
  type KnowledgeBaseBindingFailure,
} from "@/modules/knowledge-network/utils/knowledge-base-binding-error";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import panelStyles from "./KnowledgeBaseListPanel.module.css";

/** Every binding of one network fits in one page: a network mounts a handful of knowledge bases. */
const LIST_LIMIT = 1000;

const isMissing = (binding: CapabilityBindingRecord) =>
  binding.status === CAPABILITY_STATUS_MISSING;

/**
 * The knowledge bases a knowledge network searches (professional edition). Each row says whether
 * the knowledge base is still there; one that is gone can only be unmounted.
 */
export function KnowledgeBaseListPanel({
  canModify,
  networkId,
}: {
  canModify: boolean;
  networkId: string;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [bindings, setBindings] = useState<CapabilityBindingRecord[]>([]);
  const [failure, setFailure] = useState<KnowledgeBaseBindingFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const result = await listKnowledgeNetworkCapabilities(networkId, {
        limit: LIST_LIMIT,
        type: "knowledge_base",
        // Status, and so "missing", comes with the detail.
        withDetail: true,
      });
      setBindings(result.entries);
    } catch (error) {
      setFailure(knowledgeBaseBindingFailure(error));
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useCallback(
    (binding: CapabilityBindingRecord) =>
      isMissing(binding)
        ? binding.name || t("knowledgeNetwork.knowledgeBasesMissingName")
        : binding.name || binding.capabilityId,
    [t],
  );

  const confirmDetach = (binding: CapabilityBindingRecord) => {
    modal.confirm({
      content: t("knowledgeNetwork.knowledgeBasesDetachConfirmContent"),
      okButtonProps: { danger: true },
      okText: t("knowledgeNetwork.knowledgeBasesDetach"),
      onOk: async () => {
        await detachKnowledgeNetworkCapabilities(networkId, [binding.id]);
        void message.success(t("knowledgeNetwork.knowledgeBasesDetachSuccess"));
        await load();
      },
      title: t("knowledgeNetwork.knowledgeBasesDetachConfirmTitle"),
    });
  };

  const columns: TableProps<CapabilityBindingRecord>["columns"] = [
    {
      dataIndex: "name",
      key: "name",
      render: (_, binding) => nameOf(binding),
      title: t("knowledgeNetwork.knowledgeBasesColumnName"),
    },
    {
      key: "status",
      render: (_, binding) =>
        isMissing(binding) ? (
          <Tooltip title={t("knowledgeNetwork.knowledgeBasesStatusMissingHint")}>
            <Tag>{t("knowledgeNetwork.knowledgeBasesStatusMissing")}</Tag>
          </Tooltip>
        ) : (
          <Tag color="success">{t("knowledgeNetwork.knowledgeBasesStatusReady")}</Tag>
        ),
      title: t("knowledgeNetwork.knowledgeBasesColumnStatus"),
      width: 140,
    },
    {
      dataIndex: "createTime",
      key: "createTime",
      title: t("knowledgeNetwork.knowledgeBasesColumnMountTime"),
      width: 200,
    },
    {
      dataIndex: "creatorName",
      key: "creatorName",
      title: t("knowledgeNetwork.knowledgeBasesColumnMountedBy"),
      width: 160,
    },
    ...(canModify
      ? [
          {
            key: "actions",
            render: (_: unknown, binding: CapabilityBindingRecord) => (
              <AppButton
                aria-label={t("knowledgeNetwork.knowledgeBasesDetachAction", {
                  name: nameOf(binding),
                })}
                onClick={() => confirmDetach(binding)}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.knowledgeBasesDetach")}
              </AppButton>
            ),
            title: t("knowledgeNetwork.knowledgeBasesColumnActions"),
            width: 120,
          },
        ]
      : []),
  ];

  const mountedIds = useMemo(
    () => new Set(bindings.map((binding) => binding.capabilityId)),
    [bindings],
  );

  const header = (
    <div className={panelStyles.header}>
      <h2 className={`${styles.title} ${panelStyles.titleRow}`}>
        {t("knowledgeNetwork.knowledgeBasesTitle")}
        <Tooltip title={t("knowledgeNetwork.knowledgeBasesUsageTip")}>
          <QuestionCircleOutlined
            aria-label={t("knowledgeNetwork.knowledgeBasesUsageTip")}
            className={panelStyles.usageTip}
          />
        </Tooltip>
      </h2>
    </div>
  );

  if (failure === "notSupported") {
    return (
      <section className={`${styles.page} ${styles.objectTypePage}`}>
        {header}
        <EmptyStatePanel
          description={t("knowledgeNetwork.knowledgeBasesNotSupportedDescription")}
          title={t("knowledgeNetwork.knowledgeBasesNotSupportedTitle")}
        />
      </section>
    );
  }

  return (
    <section className={`${styles.page} ${styles.objectTypePage}`}>
      {header}
      {failure ? (
        <Alert
          action={
            <AppButton onClick={() => void load()} size="small">
              {t("common.retry")}
            </AppButton>
          }
          className={styles.noticeBanner}
          description={t(`knowledgeNetwork.knowledgeBasesFailure.${failure}`)}
          message={t("knowledgeNetwork.knowledgeBasesLoadFailed")}
          showIcon
          type="warning"
        />
      ) : null}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {canModify ? (
            <AppButton
              className={styles.toolbarButton}
              disabled={failure !== null}
              icon={<PlusOutlined />}
              onClick={() => setPickerOpen(true)}
              type="primary"
            >
              {t("knowledgeNetwork.knowledgeBasesMount")}
            </AppButton>
          ) : null}
        </div>
        <div className={styles.toolbarRight}>
          <AppButton
            className={styles.iconButton}
            icon={<ReloadOutlined />}
            onClick={() => void load()}
            title={t("knowledgeNetwork.knowledgeBasesRefresh")}
          />
        </div>
      </div>
      <div className={styles.tableCard}>
        {!loading && !failure && bindings.length === 0 ? (
          <EmptyStatePanel
            description={
              canModify ? t("knowledgeNetwork.knowledgeBasesEmptyDescription") : undefined
            }
            title={t(
              canModify
                ? "knowledgeNetwork.knowledgeBasesEmpty"
                : "knowledgeNetwork.knowledgeBasesNoVisible",
            )}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={bindings}
            loading={loading}
            pagination={false}
            rowClassName={(binding) => (isMissing(binding) ? panelStyles.missingRow : "")}
            rowKey="id"
            size="middle"
          />
        )}
      </div>
      {pickerOpen ? (
        <KnowledgeBasePicker
          mountedIds={mountedIds}
          networkId={networkId}
          onClose={() => setPickerOpen(false)}
          onMounted={() => {
            setPickerOpen(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}
