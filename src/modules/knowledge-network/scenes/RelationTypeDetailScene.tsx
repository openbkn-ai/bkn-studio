/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined, EditOutlined } from "@ant-design/icons";
import { Alert, Spin, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { RelationTypeMappingConfigTable } from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingConfigTable";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  deleteKnowledgeNetworkRelationType,
  getKnowledgeNetworkRelationTypeDetail,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { RelationTypeDetail } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationTypeDetailScene.module.css";

export function RelationTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", relationTypeId = "" } = useParams<{
    networkId: string;
    relationTypeId: string;
  }>();
  const [detail, setDetail] = useState<RelationTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;

  const loadData = useCallback(async () => {
    if (!networkId || !relationTypeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId);
      setDetail(result);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [networkId, relationTypeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.relationTypeDeleteTitle"),
      content: t("knowledgeNetwork.relationTypeDeleteDescription", { name: detail.name }),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkRelationType(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
    });
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <>
          <AppButton
            icon={<EditOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/edit`,
              );
            }}
          >
            {t("common.edit")}
          </AppButton>
          <AppButton
            icon={<ApartmentOutlined />}
            onClick={() => {
              void navigate(
                `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/mapping`,
              );
            }}
          >
            {t("knowledgeNetwork.relationTypeMappingEntry")}
          </AppButton>
          <AppButton danger onClick={confirmDelete}>
            {t("common.delete")}
          </AppButton>
        </>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.relationTypeDetailDescription")}
      title={detail.name}
    >
      <div className={styles.page}>
        <section className={styles.summaryCard}>
          <div className={styles.summaryHead}>
            <span
              className={styles.objectIconSquare}
              style={{ backgroundColor: detail.color }}
            >
              <ApartmentOutlined />
            </span>
            <div>
              <h2 className={styles.summaryTitle}>{detail.name}</h2>
              <p className={styles.summaryDescription}>
                {detail.description || t("knowledgeNetwork.noDescription")}
              </p>
            </div>
          </div>
          <div className={styles.tagRow}>
            {detail.tags.length > 0 ? (
              detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
            ) : (
              <span className={styles.placeholder}>{t("knowledgeNetwork.noTags")}</span>
            )}
          </div>
          <div className={styles.metaRow}>
            <span>ID: {detail.id}</span>
            <span>
              {t("knowledgeNetwork.relationTypeMappingMode")}:{" "}
              {detail.mappingMode === "direct"
                ? t("knowledgeNetwork.relationTypeDirectMapping")
                : t("knowledgeNetwork.relationTypeResourceMapping")}
            </span>
            <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
            <span>{detail.updateTime}</span>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <h3>{t("knowledgeNetwork.relationTypeConfigSection")}</h3>
          <RelationTypeMappingConfigTable detail={detail} networkId={networkId} />
        </section>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
