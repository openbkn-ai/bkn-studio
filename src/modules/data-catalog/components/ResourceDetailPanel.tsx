/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Input, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { formatDateTime } from "@/framework/i18n/format";
import { extractRequestErrorMessage, isRequestConflict } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { TableSurface } from "@/framework/ui/common/TableSurface";
import { resourceGateOf } from "@/modules/data-catalog/lib/index-state";
import { isResourceIndexReadOnly } from "@/modules/data-catalog/lib/resource-index-access";
import {
  getCatalogResource,
  updateCatalogResource,
} from "@/modules/data-catalog/services/resource.service";
import type {
  CatalogResource,
  ResourceSchemaField,
} from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

import styles from "./ResourceDetailPanel.module.css";

type ResourceDetailPanelProps = {
  active: boolean;
  canEdit: boolean;
  catalog: CatalogRecord | null;
  onEditingChange?: (editing: boolean) => void;
  onResourceRefreshed?: (resource: CatalogResource) => void;
  onUpdated?: () => Promise<void> | void;
  resource: CatalogResource;
};

export function ResourceDetailPanel({
  active,
  canEdit,
  catalog,
  onEditingChange,
  onResourceRefreshed,
  onUpdated,
  resource: resourceProp,
}: ResourceDetailPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [schemaPage, setSchemaPage] = useState(1);
  const [schemaPageSize, setSchemaPageSize] = useState(10);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resource, setResource] = useState(resourceProp);
  const [descriptionDraft, setDescriptionDraft] = useState(resourceProp.description);
  const [schemaDraft, setSchemaDraft] = useState<ResourceSchemaField[]>(resourceProp.schema);
  const resourceIdentityKey = `${resourceProp.id}:${resourceProp.expectedUpdateTime}`;
  const resourceIdentityRef = useRef(resourceIdentityKey);
  resourceIdentityRef.current = resourceIdentityKey;

  const gate = resourceGateOf(catalog);
  const readOnly = isResourceIndexReadOnly(catalog) || !canEdit;
  const schemaOffset = (schemaPage - 1) * schemaPageSize;
  const rowCount = resource.rowCount ?? resource.estimatedRowCount;
  const rowCountDisplay =
    rowCount === null || rowCount === undefined
      ? "-"
      : resource.rowCount === null
        ? t("dataCatalog.resource.estimatedRowCount", { count: rowCount })
        : rowCount;

  useEffect(() => {
    setResource(resourceProp);
  }, [resourceProp]);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  useEffect(() => {
    if (!active || readOnly) {
      setEditing(false);
      setDescriptionDraft(resource.description);
      setSchemaDraft(resource.schema);
    }
  }, [active, readOnly, resource]);

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

  const copyValue = async (label: string, value: string) => {
    try {
      await writeTextToClipboard(value);
      message.success(t("dataCatalog.resource.copyValueSuccess", { label }));
    } catch {
      message.error(t("dataCatalog.resource.copyValueFailed", { label }));
    }
  };

  const renderCopyableValue = (label: string, value?: string) => {
    if (!value) {
      return "-";
    }
    return (
      <span className={styles.copyableValue}>
        <code title={value}>{value}</code>
        <AppButton
          aria-label={t("dataCatalog.resource.copyValue", { label })}
          icon={<CopyOutlined />}
          onClick={() => void copyValue(label, value)}
          size="small"
          title={t("dataCatalog.resource.copyValue", { label })}
          type="link"
        />
      </span>
    );
  };

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
    const submittedResourceId = resource.id;
    const submittedResourceIdentity = resourceIdentityRef.current;
    setSaving(true);

    try {
      await updateCatalogResource(resource.id, {
        catalogId: resource.catalogId,
        category: resource.category,
        description: descriptionDraft.trim(),
        enabled: resource.enabled ?? true,
        expectedUpdateTime: resource.expectedUpdateTime,
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

      if (isRequestConflict(error)) {
        try {
          const latestResource = await getCatalogResource(submittedResourceId);
          if (latestResource && resourceIdentityRef.current === submittedResourceIdentity) {
            setResource(latestResource);
            onResourceRefreshed?.(latestResource);
          }
        } catch (refreshError) {
          if (resourceIdentityRef.current === submittedResourceIdentity) {
            void message.error(extractRequestErrorMessage(refreshError));
          }
        }
      }
    } finally {
      if (resourceIdentityRef.current === submittedResourceIdentity) {
        setSaving(false);
      }
    }
  };

  const schemaColumns: ColumnsType<ResourceSchemaField> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.fieldName"),
      width: "14%",
    },
    {
      dataIndex: "displayName",
      title: t("dataCatalog.resource.fieldDisplayName"),
      width: "14%",
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
      width: "10%",
    },
    {
      dataIndex: "description",
      title: t("dataCatalog.resource.fieldDescription"),
      width: "18%",
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
    {
      dataIndex: "originalName",
      render: (value: string | undefined) => value?.trim() || "-",
      title: t("dataCatalog.resource.fieldOriginalName"),
      width: "14%",
    },
    {
      dataIndex: "originalType",
      render: (value: string | undefined) => value || "-",
      title: t("dataCatalog.resource.fieldOriginalType"),
      width: "10%",
    },
    {
      dataIndex: "originalDescription",
      render: (value: string | undefined) => (
        <span className={styles.fieldDescription} title={value}>
          {value?.trim() || "-"}
        </span>
      ),
      title: t("dataCatalog.resource.fieldOriginalDescription"),
      width: "20%",
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
            ) : !readOnly ? (
              <AppButton onClick={() => setEditing(true)}>
                {t("dataCatalog.resource.editFields")}
              </AppButton>
            ) : null}
          </div>
        </div>
        {editing ? <p className={styles.editHint}>{t("dataCatalog.resource.editHint")}</p> : null}
        <div className={styles.basicInfo}>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoHalf}`}>
            <span className={styles.basicInfoLabel}>ID</span>
            <span className={styles.basicInfoValue}>{renderCopyableValue("ID", resource.id)}</span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoHalf}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.basicName")}</span>
            <span className={styles.basicInfoValue}>
              {renderCopyableValue(t("dataCatalog.resource.basicName"), resource.name)}
            </span>
          </div>
          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.tags")}</span>
            <span className={styles.basicInfoValue}>
              {resource.tags?.length ? (
                <Space size={[12, 8]} wrap>
                  {resource.tags.map((tag) => (
                    <Tag className={styles.resourceTag} key={tag}>
                      {tag}
                    </Tag>
                  ))}
                </Space>
              ) : (
                "-"
              )}
            </span>
          </div>

          <div className={`${styles.basicInfoItem} ${styles.basicInfoSpanTwo}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.description")}</span>
            <span className={styles.basicInfoValue}>
              {editing ? (
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  className={`${styles.descriptionInput} ${basicInfoDirty ? styles.descriptionInputDirty : ""}`}
                  maxLength={500}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  value={descriptionDraft}
                />
              ) : (
                <span
                  className={styles.basicInfoDescription}
                  title={resource.description || undefined}
                >
                  {resource.description || "-"}
                </span>
              )}
            </span>
          </div>

          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.category")}</span>
            <span className={styles.basicInfoValue}>
              {t(`dataCatalog.categories.${resource.category}`)}
            </span>
          </div>
          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.enabledStatus")}</span>
            <span className={styles.basicInfoValue}>
              <Tag
                className={
                  resource.enabled === false ? styles.statusTagNeutral : styles.statusTagSuccess
                }
              >
                {t(resource.enabled === false ? "common.disabled" : "common.enabled")}
              </Tag>
            </span>
          </div>
          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>
              {t("dataCatalog.resource.discoverStatus")}
            </span>
            <span className={styles.basicInfoValue}>
              {resource.lastDiscoverStatus ? (
                <Tag
                  className={
                    resource.lastDiscoverStatus === "error" ||
                    resource.lastDiscoverStatus === "missing"
                      ? styles.statusTagError
                      : resource.lastDiscoverStatus === "new" ||
                          resource.lastDiscoverStatus === "updated"
                        ? styles.statusTagProcessing
                        : styles.statusTagSuccess
                  }
                >
                  {t(`dataCatalog.discoverStatuses.${resource.lastDiscoverStatus}`)}
                </Tag>
              ) : (
                "-"
              )}
            </span>
          </div>

          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>
              {t("dataCatalog.resource.resourceStatus")}
            </span>
            <span className={styles.basicInfoValue}>
              {resource.status ? (
                <Tag
                  className={
                    resource.status === "active"
                      ? styles.statusTagSuccess
                      : resource.status === "stale"
                        ? styles.statusTagWarning
                        : styles.statusTagNeutral
                  }
                >
                  {t(`dataCatalog.resourceStatuses.${resource.status}`)}
                </Tag>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoSpanTwo}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.statusMessage")}</span>
            <span className={styles.basicInfoValue}>{resource.statusMessage || "-"}</span>
          </div>

          <div className={`${styles.basicInfoItem} ${styles.basicInfoHalf}`}>
            <span className={styles.basicInfoLabel}>
              {t("dataCatalog.resource.sourceIdentifier")}
            </span>
            <span className={styles.basicInfoValue}>
              {renderCopyableValue(
                t("dataCatalog.resource.sourceIdentifier"),
                resource.sourceIdentifier,
              )}
            </span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.fieldCount")}</span>
            <span className={styles.basicInfoValue}>{resource.columnCount ?? "-"}</span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.rowCount")}</span>
            <span className={styles.basicInfoValue}>{rowCountDisplay}</span>
          </div>

          <div className={styles.basicInfoItem}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.indexState")}</span>
            <span className={styles.basicInfoValue}>
              <Tag
                className={
                  resource.localIndexStatus === "available"
                    ? styles.statusTagSuccess
                    : resource.localIndexStatus === "stale"
                      ? styles.statusTagWarning
                      : styles.statusTagNeutral
                }
              >
                {t(`dataCatalog.resource.localIndexStatuses.${resource.localIndexStatus}`)}
              </Tag>
            </span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoSpanTwo}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.indexName")}</span>
            <span className={styles.basicInfoValue}>
              {renderCopyableValue(t("dataCatalog.resource.indexName"), resource.localIndexName)}
            </span>
          </div>

          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.creator")}</span>
            <span className={styles.basicInfoValue}>{resource.creatorName || "-"}</span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.createTime")}</span>
            <span className={styles.basicInfoValue}>{formatDateTime(resource.createTime)}</span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.updater")}</span>
            <span className={styles.basicInfoValue}>{resource.updaterName || "-"}</span>
          </div>
          <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
            <span className={styles.basicInfoLabel}>{t("common.updateTime")}</span>
            <span className={styles.basicInfoValue}>{formatDateTime(resource.updateTime)}</span>
          </div>
        </div>
      </div>

      {resource.category !== "dataset" ? (
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>{t("dataCatalog.resource.sourceMetadata")}</h3>
          <div className={styles.basicInfo}>
            <div className={styles.basicInfoItem}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.originalName")}
              </span>
              <span className={styles.basicInfoValue}>
                {resource.sourceMetadata?.originalName || "-"}
              </span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoSpanTwo}`}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.originalDescription")}
              </span>
              <span className={styles.basicInfoValue}>
                <span
                  className={styles.basicInfoDescription}
                  title={resource.sourceMetadata?.originalDescription || undefined}
                >
                  {resource.sourceMetadata?.originalDescription || "-"}
                </span>
              </span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.sourceObjectType")}
              </span>
              <span className={styles.basicInfoValue}>
                {resource.sourceMetadata?.objectType
                  ? t(
                      `dataCatalog.resource.sourceObjectTypes.${resource.sourceMetadata.objectType}`,
                      { defaultValue: resource.sourceMetadata.objectType },
                    )
                  : "-"}
              </span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.schemaName")}</span>
              <span className={styles.basicInfoValue}>{resource.schemaName || "-"}</span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoHalf}`}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.sourcePrimaryKeys")}
              </span>
              <span className={styles.basicInfoValue}>
                {resource.sourceMetadata?.primaryKeys?.length ? (
                  <Space size={[8, 8]} wrap>
                    {resource.sourceMetadata.primaryKeys.map((key) => (
                      <Tag className={styles.resourceTag} key={key}>
                        {key}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  "-"
                )}
              </span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.fieldCount")}</span>
              <span className={styles.basicInfoValue}>{resource.columnCount ?? "-"}</span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>{t("dataCatalog.resource.rowCount")}</span>
              <span className={styles.basicInfoValue}>{rowCountDisplay}</span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.sourceIndexCount")}
              </span>
              <span className={styles.basicInfoValue}>
                {resource.sourceMetadata?.indexCount ?? "-"}
              </span>
            </div>
            <div className={`${styles.basicInfoItem} ${styles.basicInfoQuarter}`}>
              <span className={styles.basicInfoLabel}>
                {t("dataCatalog.resource.sourceForeignKeyCount")}
              </span>
              <span className={styles.basicInfoValue}>
                {resource.sourceMetadata?.foreignKeyCount ?? "-"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

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
            tableLayout="fixed"
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
