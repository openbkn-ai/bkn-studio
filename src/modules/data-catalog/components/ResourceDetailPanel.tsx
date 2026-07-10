/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import { updateCatalogResource } from "@/modules/data-catalog/services/resource.service";
import type { CatalogResource, ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./ResourceDetailPanel.module.css";

type ResourceDetailPanelProps = {
  catalog: CatalogRecord | null;
  onUpdated?: () => Promise<void> | void;
  resource: CatalogResource;
};

export function ResourceDetailPanel({
  catalog,
  onUpdated,
  resource,
}: ResourceDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [schemaPage, setSchemaPage] = useState(1);
  const [schemaPageSize, setSchemaPageSize] = useState(10);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(resource.description);
  const [schemaDraft, setSchemaDraft] = useState<ResourceSchemaField[]>(resource.schema);

  const gate = resourceGateOf(catalog);
  const schemaOffset = (schemaPage - 1) * schemaPageSize;

  useEffect(() => {
    setSchemaPage(1);
  }, [resource.id]);

  useEffect(() => {
    setEditing(false);
    setSaving(false);
    setDescriptionDraft(resource.description);
    setSchemaDraft(resource.schema);
  }, [resource]);

  const pagedSchema = useMemo(
    () => schemaDraft.slice(schemaOffset, schemaOffset + schemaPageSize),
    [schemaDraft, schemaOffset, schemaPageSize],
  );

  const modifiedFieldCount = useMemo(
    () =>
      schemaDraft.reduce((count, field, index) => {
        const origin = resource.schema[index];
        if (!origin) {
          return count;
        }

        const displayNameChanged = (field.displayName ?? "") !== (origin.displayName ?? "");
        const descriptionChanged = (field.description ?? "") !== (origin.description ?? "");
        return count + Number(displayNameChanged) + Number(descriptionChanged);
      }, 0),
    [resource.schema, schemaDraft],
  );

  const basicInfoDirty = descriptionDraft.trim() !== resource.description.trim();
  const hasDirtyChanges = basicInfoDirty || modifiedFieldCount > 0;

  const handleFieldChange = (
    fieldIndex: number,
    patch: Pick<ResourceSchemaField, "description" | "displayName">,
  ) => {
    setSchemaDraft((current) =>
      current.map((field, index) =>
        index === fieldIndex
          ? {
              ...field,
              ...patch,
            }
          : field,
      ),
    );
  };

  const handleRestoreAll = () => {
    setDescriptionDraft(resource.description);
    setSchemaDraft(resource.schema);
  };

  const handleCancel = () => {
    handleRestoreAll();
    setEditing(false);
  };

  const isFieldDirty = (fieldIndex: number, key: "description" | "displayName") => {
    const origin = resource.schema[fieldIndex];
    const current = schemaDraft[fieldIndex];
    return (current?.[key] ?? "") !== (origin?.[key] ?? "");
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await updateCatalogResource(resource.id, {
        catalogId: resource.catalogId,
        category: resource.category,
        description: descriptionDraft.trim(),
        name: resource.name,
        schema: schemaDraft.map((field) => ({
          ...field,
          description: field.description?.trim() || undefined,
          displayName: field.displayName?.trim() || undefined,
        })),
        sourceIdentifier: resource.sourceIdentifier,
      });
      void message.success(t("common.success"));
      setEditing(false);
      await onUpdated?.();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const schemaColumns: ColumnsType<ResourceSchemaField> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.fieldName"),
    },
    {
      dataIndex: "displayName",
      title: t("dataCatalog.resource.fieldDisplayName"),
      render: (value: string | undefined, _record, index) => {
        if (!editing || index === undefined) {
          return value || "-";
        }

        const absoluteIndex = schemaOffset + index;
        return (
          <Input
            allowClear
            className={`${styles.inlineInput} ${
              isFieldDirty(absoluteIndex, "displayName") ? styles.inlineInputDirty : ""
            }`}
            maxLength={255}
            onChange={(event) => {
              handleFieldChange(absoluteIndex, {
                displayName: event.target.value || undefined,
              });
            }}
            value={value}
          />
        );
      },
    },
    {
      dataIndex: "type",
      title: t("dataCatalog.resource.fieldType"),
    },
    {
      dataIndex: "description",
      title: t("dataCatalog.resource.fieldDescription"),
      render: (value: string | undefined, _record, index) => {
        if (!editing || index === undefined) {
          return (
            <span className={styles.fieldDescription} title={value}>
              {value || "-"}
            </span>
          );
        }

        const absoluteIndex = schemaOffset + index;
        return (
          <Input
            allowClear
            className={`${styles.inlineInput} ${
              isFieldDirty(absoluteIndex, "description") ? styles.inlineInputDirty : ""
            }`}
            maxLength={255}
            onChange={(event) => {
              handleFieldChange(absoluteIndex, {
                description: event.target.value || undefined,
              });
            }}
            value={value}
          />
        );
      },
    },
  ];

  return (
    <div className={styles.contentSurface}>
      {!gate.ok && catalog ? (
        <div className={styles.calloutWarn}>
          <ExclamationCircleOutlined />
          <span>
            {t("dataCatalog.gate.catalogDisabled", { name: catalog.name })}{" "}
            <button
              className={styles.textLink}
              onClick={() => {
                void navigate("/data-connect");
              }}
              type="button"
            >
              {t("dataCatalog.gate.goEnable")}
            </button>
          </span>
        </div>
      ) : null}

      <div className={styles.sectionCard}>
        <div className={styles.sectionTitleRow}>
          <h3 className={styles.sectionTitle}>{t("common.basicInfo")}</h3>
          <div className={styles.sectionTools}>
            {editing ? (
              <>
                <span className={styles.editingMeta}>
                  {t("dataCatalog.resource.modifiedCount", {
                    count: Number(basicInfoDirty) + modifiedFieldCount,
                  })}
                </span>
                <AppButton disabled={!hasDirtyChanges || saving} onClick={handleRestoreAll}>
                  {t("dataCatalog.resource.restoreAll")}
                </AppButton>
                <AppButton disabled={saving} onClick={handleCancel}>
                  {t("common.cancel")}
                </AppButton>
                <AppButton
                  disabled={!hasDirtyChanges}
                  loading={saving}
                  onClick={() => void handleSave()}
                  type="primary"
                >
                  {t("common.save")}
                </AppButton>
              </>
            ) : (
              <AppButton onClick={() => setEditing(true)}>
                {t("dataCatalog.resource.editFields")}
              </AppButton>
            )}
          </div>
        </div>
        {editing ? <p className={styles.editHint}>{t("dataCatalog.resource.editHint")}</p> : null}
        <div className={styles.basicInfo}>
          <p className={styles.basicInfoRow}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.basicName")}:</span>{" "}
            <span>{resource.name}</span>
            <span className={styles.basicInfoDivider}>|</span>
            <span className={styles.basicInfoLabel}>ID:</span> <span>{resource.id}</span>
          </p>
          <p className={styles.basicInfoRow}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.description")}:</span>{" "}
            {editing ? (
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                className={`${styles.descriptionInput} ${
                  basicInfoDirty ? styles.descriptionInputDirty : ""
                }`}
                maxLength={500}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                value={descriptionDraft}
              />
            ) : (
              <span>{resource.description || "-"}</span>
            )}
          </p>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionTitleRow}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.resource.schemaSection")}</h3>
          {editing ? (
            <span className={styles.sectionCaption}>
              {t("dataCatalog.resource.fieldEditableHint")}
            </span>
          ) : null}
        </div>
        <TableSurface className={styles.tableSurface}>
          <AppTable<ResourceSchemaField>
            columns={schemaColumns}
            dataSource={pagedSchema}
            locale={{ emptyText: t("dataCatalog.resource.schemaEmpty") }}
            pagination={false}
            rowKey="name"
          />
        </TableSurface>
        {resource.schema.length > 0 ? (
          <TablePaginationBar
            current={schemaPage}
            onChange={(nextPage, nextPageSize) => {
              setSchemaPage(nextPage);
              setSchemaPageSize(nextPageSize);
            }}
            pageSize={schemaPageSize}
            showSizeChanger
            showTotal={(count) => t("common.total", { total: count })}
            total={schemaDraft.length}
          />
        ) : null}
      </div>
    </div>
  );
}
