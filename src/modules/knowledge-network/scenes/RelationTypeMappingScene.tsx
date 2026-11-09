/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  RelationTypeMappingEditor,
  validateRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
} from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";
import { DefinitionRefusal } from "@/modules/knowledge-network/components/definition-declarations/DefinitionRefusal";
import { useRelationPropertyGuard } from "@/modules/knowledge-network/components/relation-type/relation-property-guard";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { knowledgeNetworkReturnPath } from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  getKnowledgeNetworkRelationTypeDetail,
  listKnowledgeNetworkObjectTypes,
  updateKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  type DeclarationRefusal,
  readDeclarationRefusal,
} from "@/modules/knowledge-network/services/shared/declaration-errors";
import { fitRelationDeclarations } from "@/modules/knowledge-network/utils/relation-declarations";
import type {
  KnowledgeNetworkObjectTypeRecord,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkResourceConfigScene.module.css";

export function RelationTypeMappingScene() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const { networkId = "", relationTypeId = "" } = useParams<{
    networkId: string;
    relationTypeId: string;
  }>();
  const [detail, setDetail] = useState<RelationTypeDetail | null>(null);
  const confirmRelationPropertyChange = useRelationPropertyGuard();
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [mappingValue, setMappingValue] = useState<RelationTypeMappingFormValues>(
    createDefaultRelationTypeMappingValues(),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<DeclarationRefusal | null>(null);

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/detail`;
  const returnPath = knowledgeNetworkReturnPath(
    networkId,
    location.state,
    relationTypeId ? detailPath : listPath,
  );

  useEffect(() => {
    if (!networkId || !relationTypeId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [relationTypeDetail, nextObjectTypes] = await Promise.all([
          getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId),
          listKnowledgeNetworkObjectTypes(networkId),
        ]);

        if (!relationTypeDetail) {
          throw new Error(t("common.notFound"));
        }

        setDetail(relationTypeDetail);
        setObjectTypes(nextObjectTypes);
        setMappingValue({
          mappingMode: relationTypeDetail.mappingMode,
          mappingRules: buildRelationTypeMappingRulesFromDetail(relationTypeDetail),
        });
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [networkId, relationTypeId, t]);

  const confirmClearing = () =>
    new Promise<boolean>((resolve) => {
      void modal.confirm({
        cancelText: t("common.cancel"),
        content: t("knowledgeNetwork.relationDeclarations.clearedOnSave.content"),
        okText: t("knowledgeNetwork.relationDeclarations.clearedOnSave.ok"),
        onCancel: () => resolve(false),
        onOk: () => resolve(true),
        title: t("knowledgeNetwork.relationDeclarations.clearedOnSave.title"),
      });
    });

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const validationError = validateRelationTypeMappingValues(t, mappingValue);
    if (validationError) {
      void message.error(validationError);
      return;
    }

    const normalizedMapping = normalizeRelationTypeMappingValues(mappingValue);
    // New ends may no longer allow the stored declarations; this page then clears them with the
    // ends, as the form does, once the user agrees. Otherwise it sends no declaration.
    const fitted = fitRelationDeclarations(detail.declarations, normalizedMapping.mappingRules);
    if (fitted.cleared.length && !(await confirmClearing())) {
      return;
    }

    setSubmitting(true);
    setRefusal(null);
    try {
      await updateKnowledgeNetworkRelationType(networkId, relationTypeId, {
        color: detail.color,
        description: detail.description,
        mappingMode: normalizedMapping.mappingMode,
        mappingRules: normalizedMapping.mappingRules,
        name: detail.name,
        sourceObjectTypeId: normalizedMapping.mappingRules.sourceObjectTypeId,
        tags: detail.tags,
        targetObjectTypeId: normalizedMapping.mappingRules.targetObjectTypeId,
        ...(fitted.cleared.length
          ? { declarationEdit: { baseline: detail.declarations, current: fitted.value } }
          : {}),
      });
      void message.success(t("common.success"));
      void navigate(returnPath);
    } catch (nextError) {
      // A refusal of the declarations names the definitions involved; shown above the mapping.
      const declarationRefusal = readDeclarationRefusal(nextError);
      if (declarationRefusal) {
        setRefusal(declarationRefusal);
      } else {
        void message.error(extractRequestErrorMessage(nextError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton loading={submitting} onClick={() => void handleSave()} type="primary">
          {t("common.save")}
        </AppButton>
      }
      onBack={() => {
        void navigate(returnPath);
      }}
      subtitle={t("knowledgeNetwork.relationTypeMappingSubtitle")}
      title={detail?.name ?? t("knowledgeNetwork.relationTypeMappingTitle")}
    >
      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <div className={styles.mappingFormPanel}>
          {refusal ? (
            <DefinitionRefusal
              networkId={networkId}
              refusal={refusal}
              saved={{ id: relationTypeId, kind: "relation_type" }}
            />
          ) : null}
          <RelationTypeMappingEditor
            confirmRelationPropertyChange={confirmRelationPropertyChange}
            networkId={networkId}
            objectTypes={objectTypes}
            onChange={setMappingValue}
            relationProperties={
              mappingValue.mappingMode === "resource" ? detail?.relationProperties : undefined
            }
            value={mappingValue}
          />
        </div>
      )}
    </KnowledgeNetworkResourceConfigShell>
  );
}
