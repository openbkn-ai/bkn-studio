/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Descriptions, Drawer } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import { AdoptionTag, IdentityEvidence } from "@/modules/bkn-project/components/draft/DraftTables";
import {
  excludedReasonText,
  propertyTypeKey,
} from "@/modules/bkn-project/components/draft/evidence";
import type {
  DraftExcludedField,
  DraftObjectType,
  DraftProperty,
} from "@/modules/bkn-project/types/draft";

import styles from "./DraftTables.module.css";
import { originalLocation } from "@/modules/bkn-project/components/object-type/document-values";

/** An object type of the draft: its table, identity, properties and the fields left out. */
export function DraftObjectDrawer({
  catalogNames,
  excluded,
  objectType,
  onClose,
  onEdit,
}: {
  catalogNames: Record<string, string>;
  excluded: DraftExcludedField[];
  objectType: DraftObjectType | null;
  onClose: () => void;
  /** Opens the object type in the editor, where the draft can be edited. */
  onEdit?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const columns: ColumnsType<DraftProperty> = [
    {
      title: t("bknProject.model.detail.property"),
      dataIndex: "name",
      key: "name",
      render: (value: string, record) => (
        <div className={styles.evidence}>
          <code className={styles.mono}>
            {objectType?.document ? record.displayName || value : value}
          </code>
          {record.missingDescription ? (
            <LightStatusTag tone="neutral">
              {t("bknProject.model.detail.missingDescription")}
            </LightStatusTag>
          ) : (
            <span className={styles.muted}>{record.description}</span>
          )}
        </div>
      ),
    },
    {
      title: t("bknProject.model.detail.type"),
      dataIndex: "type",
      key: "type",
      width: 130,
      render: (value: string) => t(propertyTypeKey(value)),
    },
    {
      title: t(
        objectType?.document
          ? "bknProject.documentEditor.instruction"
          : "bknProject.model.detail.mappedField",
      ),
      dataIndex: "mappedField",
      key: "mappedField",
      render: (value: string, record) =>
        objectType?.document ? (
          <div>
            {record.readOnly
              ? t("bknProject.documentEditor.managed")
              : record.extraction?.instruction}
            {record.extraction?.examples.map((q, i) => (
              <div key={`${q.blockId}-${i}`}>
                <a href={originalLocation(q)} target="_blank" rel="noopener noreferrer">
                  {t("bknProject.documentEditor.original", { number: i + 1 })}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <code className={styles.mono}>{value}</code>
        ),
    },
  ];
  const left = objectType ? excluded.filter((field) => field.objectType === objectType.id) : [];

  return (
    <Drawer
      destroyOnHidden
      extra={
        objectType && onEdit ? (
          <AppButton onClick={() => onEdit(objectType.id)} type="primary">
            {t("bknProject.model.detail.edit")}
          </AppButton>
        ) : null
      }
      footer={<AppButton onClick={onClose}>{t("bknProject.model.detail.close")}</AppButton>}
      onClose={onClose}
      open={objectType !== null}
      title={
        objectType ? (
          <span>
            {objectType.name} <AdoptionTag adopted={objectType.adopted} />
          </span>
        ) : null
      }
      width={720}
    >
      {objectType ? (
        <div className={styles.stack}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label={t("bknProject.model.detail.apiName")}>
              <code className={styles.mono}>{objectType.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label={t("bknProject.model.detail.description")}>
              {objectType.description || (
                <span className={styles.muted}>{t("bknProject.model.detail.noDescription")}</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item
              label={t(
                objectType.document
                  ? "bknProject.model.columns.source"
                  : "bknProject.model.detail.table",
              )}
            >
              {objectType.document ? (
                objectType.document.reason
              ) : (
                <>
                  {objectType.table.name} ·{" "}
                  {catalogNames[objectType.table.catalogId] ?? objectType.table.catalogId}
                </>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("bknProject.model.detail.identity")}>
              <IdentityEvidence objectType={objectType} />
            </Descriptions.Item>
            <Descriptions.Item label={t("bknProject.model.detail.displayKey")}>
              <code className={styles.mono}>
                {objectType.document
                  ? objectType.properties.find((p) => p.name === objectType.displayKey)?.displayName
                  : objectType.displayKey}
              </code>
            </Descriptions.Item>
          </Descriptions>
          <section>
            <h3 className={styles.sectionTitle}>{t("bknProject.model.detail.propertiesTitle")}</h3>
            <AppTable<DraftProperty>
              columns={columns}
              dataSource={objectType.properties}
              pagination={false}
              rowKey="name"
              size="small"
            />
          </section>
          {left.length ? (
            <section>
              <h3 className={styles.sectionTitle}>{t("bknProject.model.detail.excludedTitle")}</h3>
              {left.map((field) => (
                <div className={styles.evidence} key={field.field}>
                  <code className={styles.mono}>{field.field}</code>
                  <span className={styles.muted}>
                    {excludedReasonText(t, field.reason, field.keyword)}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
