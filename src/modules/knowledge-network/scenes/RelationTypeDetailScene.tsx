/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ApartmentOutlined } from "@ant-design/icons";
import { Alert, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { RelationDeclarationsSummary } from "@/modules/knowledge-network/components/relation-type/RelationDeclarationsSummary";
import { RelationTypeMappingConfigTable } from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingConfigTable";
import { useRelationTypeDeleteRefusal } from "@/modules/knowledge-network/components/relation-type/relation-type-delete-refusal";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { KnowledgeNetworkResourceDetailActions } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceDetailActions";
import {
  clearKnowledgeNetworkGraphSelectionFromPath,
  knowledgeNetworkReturnPath,
  knowledgeNetworkReturnState,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  deleteKnowledgeNetworkRelationType,
  getKnowledgeNetworkRelationTypeDetail,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { listKnowledgeNetworkRelationTypePage } from "@/modules/knowledge-network/services/relation-type.service";
import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import { fallbackPathsFor } from "@/modules/knowledge-network/utils/relation-declarations";

import styles from "./RelationTypeDetailScene.module.css";

export function RelationTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = useAppServices();
  const { networkId = "", relationTypeId = "" } = useParams<{
    networkId: string;
    relationTypeId: string;
  }>();
  const [detail, setDetail] = useState<RelationTypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  // The relation types with the same ends: names for the fallback path, and the paths to this one.
  const [sameEndRelationTypes, setSameEndRelationTypes] = useState<
    KnowledgeNetworkRelationTypeRecord[]
  >([]);
  const showDeleteError = useRelationTypeDeleteRefusal();

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/detail`;
  const returnPath = knowledgeNetworkReturnPath(networkId, location.state, listPath);

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      content: t("knowledgeNetwork.relationTypeDeleteDescription", { name: detail.name }),
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        try {
          await deleteKnowledgeNetworkRelationType(networkId, relationTypeId);
        } catch (deleteError) {
          showDeleteError(deleteError, [detail]);
          return;
        }
        void message.success(t("common.success"));
        void navigate(clearKnowledgeNetworkGraphSelectionFromPath(returnPath));
      },
      title: t("knowledgeNetwork.relationTypeDeleteTitle"),
      width: 520,
    });
  };

  const loadData = useCallback(async () => {
    if (!networkId || !relationTypeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId);
      setDetail(result);
      if (result) {
        void listKnowledgeNetworkRelationTypePage(networkId, {
          direction: "asc",
          limit: -1,
          offset: 0,
          sort: "name",
          sourceObjectTypeId: result.sourceObjectTypeId,
          targetObjectTypeId: result.targetObjectTypeId,
        })
          .then((page) => setSameEndRelationTypes(page.entries))
          .catch(() => setSameEndRelationTypes([]));
      }
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [networkId, relationTypeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <KnowledgeNetworkResourceConfigShell
        loading
        onBack={() => {
          void navigate(returnPath);
        }}
        subtitle={t("knowledgeNetwork.relationTypeDetailDescription")}
        title={t("knowledgeNetwork.relationTypeDetailTitle")}
      />
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <>
      <KnowledgeNetworkResourceConfigShell
        actions={
          <KnowledgeNetworkResourceDetailActions
            actions={[
              {
                key: "edit",
                label: t("common.edit"),
                onClick: () => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/edit`,
                    { state: knowledgeNetworkReturnState(returnPath) },
                  );
                },
                operation: "modify",
                type: "primary",
              },
              {
                key: "mapping",
                label: t("knowledgeNetwork.relationTypeMappingEntry"),
                onClick: () => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/mapping`,
                    { state: knowledgeNetworkReturnState(returnPath) },
                  );
                },
                operation: "modify",
              },
              {
                key: "authorize",
                label: t("knowledgeNetwork.authorizeAction"),
                onClick: () => setAuthorizeOpen(true),
                operation: "authorize",
              },
              {
                danger: true,
                key: "delete",
                label: t("common.delete"),
                onClick: confirmDelete,
                operation: "delete",
              },
            ]}
            record={detail}
          />
        }
        onBack={() => {
          void navigate(returnPath);
        }}
        subtitle={t("knowledgeNetwork.relationTypeDetailDescription")}
        title={detail.name}
      >
        <div className={styles.page}>
          <section className={styles.summaryCard}>
            <div className={styles.summaryHead}>
              <span className={styles.objectIconSquare} style={{ backgroundColor: detail.color }}>
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
              {detail.relationProperties?.length ? (
                <span title={t("knowledgeNetwork.relationDeclarations.relationPropertiesHint")}>
                  {t("knowledgeNetwork.relationDeclarations.relationProperties", {
                    count: detail.relationProperties.length,
                  })}
                </span>
              ) : null}
              <span>{t("knowledgeNetwork.updatedBy", { name: detail.updaterName })}</span>
              <span>{detail.updateTime}</span>
            </div>
          </section>

          {detail.declarations || fallbackPathsFor(detail.id, sameEndRelationTypes).length ? (
            <section className={styles.sectionCard}>
              <h3>{t("knowledgeNetwork.relationDeclarations.title")}</h3>
              <RelationDeclarationsSummary
                declarations={detail.declarations}
                ends={detail}
                onOpenRelationType={(id) => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/relation-types/${id}/detail`,
                    {
                      state: knowledgeNetworkReturnState(returnPath),
                    },
                  );
                }}
                relationTypeId={detail.id}
                sameEndRelationTypes={sameEndRelationTypes}
                sourceName={detail.sourceObjectTypeName}
                targetName={detail.targetObjectTypeName}
              />
            </section>
          ) : null}

          <section className={styles.sectionCard}>
            <h3>{t("knowledgeNetwork.relationTypeConfigSection")}</h3>
            <RelationTypeMappingConfigTable
              detail={detail}
              networkId={networkId}
              onOpenObjectType={(objectTypeId) => {
                void navigate(
                  `/knowledge-network/workspace/${networkId}/object-types/${objectTypeId}/detail`,
                  {
                    state: {
                      knowledgeNetworkReturnTo: detailPath,
                    },
                  },
                );
              }}
            />
          </section>
        </div>
      </KnowledgeNetworkResourceConfigShell>
      <KnowledgeNetworkObjectAuthorizeDrawer
        networkId={networkId}
        objectType="relation_type"
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
        record={detail}
      />
    </>
  );
}
