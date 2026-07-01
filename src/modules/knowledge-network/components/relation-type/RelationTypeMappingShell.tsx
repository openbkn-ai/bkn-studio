/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Radio } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { RelationMappingPreview } from "./RelationMappingPreview";
import styles from "./RelationTypeMappingShell.module.css";

type RelationTypeMappingShellProps = {
  children: ReactNode;
  mappingMode: "direct" | "resource";
  mappingModeField?: boolean;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  propertyMappingCount: number;
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
  onMappingModeChange: (mode: "direct" | "resource") => void;
};

export function RelationTypeMappingShell({
  children,
  mappingMode,
  mappingModeField = true,
  objectTypes,
  propertyMappingCount,
  sourceObjectTypeId,
  targetObjectTypeId,
  onMappingModeChange,
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
      {mappingModeField ? (
        <Form.Item
          className={styles.modeField}
          label={t("knowledgeNetwork.relationTypeMappingAssociation")}
          labelCol={{ span: 3 }}
          wrapperCol={{ span: 21 }}
        >
          <Radio.Group
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
        </Form.Item>
      ) : null}

      <RelationMappingPreview
        propertyMappingCount={propertyMappingCount}
        sourceObject={sourceObject}
        targetObject={targetObject}
      />

      <div className={styles.rulesPanel}>{children}</div>
    </div>
  );
}
