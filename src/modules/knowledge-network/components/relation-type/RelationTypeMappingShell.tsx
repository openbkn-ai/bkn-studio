/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined } from "@ant-design/icons";
import { Radio } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { RelationMappingPreview } from "./RelationMappingPreview";
import styles from "./RelationTypeMappingShell.module.css";
import { RelationTypeObjectTypeSelect } from "./RelationTypeObjectTypeSelect";

type RelationTypeMappingShellProps = {
  /** The mapping rules, which depend on the ends and the mapping mode chosen above them. */
  children: ReactNode;
  mappingMode: "direct" | "resource";
  mappingModeField?: boolean;
  /** Where the end selects look object types up; absent, only `objectTypes` are offered. */
  networkId?: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  resourceName?: string;
  /** What the relation means between its ends, shown after the ends and before the rules. */
  semantics?: ReactNode;
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
  onMappingModeChange: (mode: "direct" | "resource") => void;
  onSourceChange: (objectTypeId: string) => void;
  onTargetChange: (objectTypeId: string) => void;
};

/**
 * The relation settings step: the ends and the mapping mode first, since what follows depends on
 * them; then what the relation means; then the mapping rules.
 */
export function RelationTypeMappingShell({
  children,
  mappingMode,
  mappingModeField = true,
  networkId,
  objectTypes,
  resourceName,
  semantics,
  sourceObjectTypeId,
  targetObjectTypeId,
  onMappingModeChange,
  onSourceChange,
  onTargetChange,
}: RelationTypeMappingShellProps) {
  const { t } = useTranslation();

  const sourceObject = useMemo(
    () => objectTypes.find((item) => item.id === sourceObjectTypeId),
    [objectTypes, sourceObjectTypeId],
  );
  const targetObject = useMemo(
    () => objectTypes.find((item) => item.id === targetObjectTypeId),
    [objectTypes, targetObjectTypeId],
  );

  return (
    <div className={styles.shell}>
      <section className={styles.group}>
        <h3 className={styles.groupTitle}>{t("knowledgeNetwork.relationTypeConfigEnds")}</h3>
        <div className={styles.ends}>
          <div className={styles.endField}>
            <span>{t("knowledgeNetwork.relationTypeMappingSourcePoint")}</span>
            <RelationTypeObjectTypeSelect
              aria-label={t("knowledgeNetwork.relationTypeMappingSourcePoint")}
              networkId={networkId}
              objectTypes={objectTypes}
              onChange={(next) => onSourceChange(next ?? "")}
              placeholder={t("knowledgeNetwork.relationTypeSourceObjectPlaceholder")}
              value={sourceObjectTypeId || undefined}
            />
          </div>
          <ArrowRightOutlined aria-hidden className={styles.endArrow} />
          <div className={styles.endField}>
            <span>{t("knowledgeNetwork.relationTypeMappingTargetPoint")}</span>
            <RelationTypeObjectTypeSelect
              aria-label={t("knowledgeNetwork.relationTypeMappingTargetPoint")}
              networkId={networkId}
              objectTypes={objectTypes}
              onChange={(next) => onTargetChange(next ?? "")}
              placeholder={t("knowledgeNetwork.relationTypeTargetObjectPlaceholder")}
              value={targetObjectTypeId || undefined}
            />
          </div>
        </div>
        {mappingModeField ? (
          <div className={styles.endField}>
            <span>{t("knowledgeNetwork.relationTypeMappingMode")}</span>
            <Radio.Group
              aria-label={t("knowledgeNetwork.relationTypeMappingMode")}
              className={styles.modeOptions}
              onChange={(event) => {
                onMappingModeChange(event.target.value as "direct" | "resource");
              }}
              options={[
                {
                  label: t("knowledgeNetwork.relationTypeDirectMappingOption"),
                  value: "direct",
                },
                {
                  label: t("knowledgeNetwork.relationTypeResourceMappingOption"),
                  value: "resource",
                },
              ]}
              value={mappingMode}
            />
          </div>
        ) : null}

        <RelationMappingPreview
          bridgeLabel={
            mappingMode === "resource"
              ? resourceName || t("knowledgeNetwork.relationTypePreviewResource")
              : t("knowledgeNetwork.relationTypePreviewPropertyLink")
          }
          mappingMode={mappingMode}
          sourceObject={sourceObject}
          targetObject={targetObject}
        />
      </section>

      {semantics ? (
        <section className={styles.group}>
          <h3 className={styles.groupTitle}>{t("knowledgeNetwork.relationTypeConfigSemantics")}</h3>
          {semantics}
        </section>
      ) : null}

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>{t("knowledgeNetwork.relationTypeConfigRules")}</h3>
        {children}
      </section>
    </div>
  );
}
