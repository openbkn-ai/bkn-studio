import {
  ExclamationCircleOutlined,
  KeyOutlined,
  LoadingOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Input, Select, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { PermissionGate } from "@/framework/permission/PermissionGate";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { formatCount, timeAgo } from "@/modules/data-catalog/lib/format";
import {
  effectiveIndexOf,
  indexStateOf,
  isCatalogPhysical,
} from "@/modules/data-catalog/lib/index-state";
import { pauseListeningTasksOfCatalog } from "@/modules/data-catalog/services/build-task.service";
import { triggerCatalogScan } from "@/modules/data-catalog/services/resource.service";
import type {
  BuildTask,
  CatalogResource,
  CatalogScanRecord,
} from "@/modules/data-catalog/types/data-catalog";
import {
  deleteDataConnectRecord,
  setDataConnectRecordEnabled,
  testDataConnectRecord,
} from "@/modules/data-connect/services/data-connect.service";
import type {
  DataConnectConnectorType,
  DataConnectRecord,
} from "@/modules/data-connect/types/data-connect";
import { IndexStateTag } from "@/modules/data-catalog/components/IndexStateTag";
import { ObjectAuthorizeDrawer } from "@/modules/system-admin/components/ObjectAuthorizeDrawer";

import styles from "./shared.module.css";

// 索引状态下拉的粗分桶:把 indexStateOf 的细分 key 收敛成可过滤的几类
const INDEX_FILTERS = ["built", "none", "building", "listening", "failed"] as const;

function indexFilterBucket(key: string) {
  if (key === "built") return "built";
  if (key === "none") return "none";
  if (key === "building" || key === "rebuilding") return "building";
  if (key === "listening" || key === "paused") return "listening";
  return "failed"; // failed / failed-stale
}

type CatalogDetailPanelProps = {
  catalog: DataConnectRecord;
  connectorTypes: DataConnectConnectorType[];
  onBuildResource: (resource: CatalogResource) => void;
  onCreateResource: (catalogId: string) => void;
  onRefresh: () => Promise<void> | void;
  onSelectResource: (resourceId: string) => void;
  resources: CatalogResource[];
  scanning: boolean;
  scans: CatalogScanRecord[];
  tasks: BuildTask[];
};

export function CatalogDetailPanel({
  catalog,
  connectorTypes,
  onBuildResource,
  onCreateResource,
  onRefresh,
  onSelectResource,
  resources,
  scanning,
  scans,
  tasks,
}: CatalogDetailPanelProps) {
  const { i18n, t } = useTranslation();
  const { message, modal } = useAppServices();
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [resourceKeyword, setResourceKeyword] = useState("");
  const [indexFilter, setIndexFilter] = useState<string | undefined>(undefined);
  const [scansExpanded, setScansExpanded] = useState(false);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);

  const physical = isCatalogPhysical(catalog);
  const connectorType = connectorTypes.find((item) => item.type === catalog.connectorType);

  const tasksByResource = useMemo(() => {
    const map = new Map<string, BuildTask[]>();
    tasks.forEach((task) => {
      map.set(task.resourceId, [...(map.get(task.resourceId) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const filteredResources = useMemo(() => {
    const kw = resourceKeyword.trim().toLowerCase();
    return resources.filter((resource) => {
      if (
        kw &&
        !resource.name.toLowerCase().includes(kw) &&
        !(resource.sourceIdentifier ?? "").toLowerCase().includes(kw)
      ) {
        return false;
      }
      if (indexFilter) {
        const key = indexStateOf(tasksByResource.get(resource.id) ?? []).key;
        if (indexFilterBucket(key) !== indexFilter) {
          return false;
        }
      }
      return true;
    });
  }, [resources, resourceKeyword, indexFilter, tasksByResource]);

  // 已建索引 = 当前有生效索引在服务的资源数(built / 流式监听 / 重建失败沿用旧索引等)
  const indexedCount = useMemo(
    () =>
      resources.filter(
        (resource) => effectiveIndexOf(tasksByResource.get(resource.id) ?? []) != null,
      ).length,
    [resources, tasksByResource],
  );

  const listeningCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "listening" &&
          resources.some((resource) => resource.id === task.resourceId),
      ).length,
    [resources, tasks],
  );

  const lastScan = scans[0];
  const lastScanText = !lastScan
    ? t("dataCatalog.catalog.neverScanned")
    : lastScan.status === "running"
      ? t("dataCatalog.tree.scanning")
      : timeAgo(lastScan.startedAt, i18n.language);

  const runScan = async () => {
    try {
      await triggerCatalogScan(catalog.id);
      message.success(t("dataCatalog.catalog.scanTriggered", { name: catalog.name }));
      await onRefresh();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      await testDataConnectRecord(catalog.id);
      message.success(t("dataConnect.testConnectionSuccess"));
      await onRefresh();
    } catch (error) {
      void message.error(extractRequestErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const toggleEnabled = () => {
    if (catalog.enabled) {
      void modal.confirm({
        title: t("dataCatalog.catalog.disableConfirmTitle", { name: catalog.name }),
        content: t("dataCatalog.catalog.disableConfirmContent", {
          listeningCount,
          resourceCount: resources.length,
        }),
        okText: t("common.disabled"),
        cancelText: t("common.cancel"),
        okButtonProps: { danger: true },
        onOk: async () => {
          await setDataConnectRecordEnabled(catalog.id, false);
          await pauseListeningTasksOfCatalog(resources.map((item) => item.id));
          message.success(t("dataCatalog.catalog.disabled", { name: catalog.name }));
          await onRefresh();
        },
      });
      return;
    }

    void (async () => {
      try {
        await setDataConnectRecordEnabled(catalog.id, true);
        message.success(t("common.success"));
        await onRefresh();
      } catch (error) {
        void message.error(extractRequestErrorMessage(error));
      }
    })();
  };

  const removeCatalog = () => {
    void modal.confirm({
      title: t("dataCatalog.catalog.deleteConfirmTitle", { name: catalog.name }),
      content: t("dataCatalog.catalog.deleteConfirmContent", {
        resourceCount: resources.length,
      }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteDataConnectRecord(catalog.id);
        message.success(t("common.success"));
        void navigate("/data-catalog", { replace: true });
        await onRefresh();
      },
    });
  };

  const resourceColumns: ColumnsType<CatalogResource> = [
    {
      dataIndex: "name",
      title: t("dataCatalog.resource.name"),
      render: (_, record) => (
        <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
          <AppButton
            onClick={() => onSelectResource(record.id)}
            style={{ padding: 0, height: "auto", fontWeight: 600 }}
            type="link"
          >
            {record.name}
          </AppButton>
          {/* sourceIdentifier 与 name 相同(物理表常见)时是重复信息,只在不同时展示 */}
          {record.sourceIdentifier && record.sourceIdentifier !== record.name ? (
            <span className={styles.slugChip}>{record.sourceIdentifier}</span>
          ) : null}
        </div>
      ),
    },
    {
      dataIndex: "category",
      title: t("dataCatalog.resource.category"),
      render: (value: CatalogResource["category"]) => (
        <span
          className={[
            styles.tag,
            value === "table"
              ? styles.catTable
              : value === "logicview"
                ? styles.catLogicview
                : styles.catDataset,
          ].join(" ")}
        >
          {t(`dataCatalog.categories.${value}`)}
        </span>
      ),
    },
    {
      dataIndex: "columnCount",
      title: t("dataCatalog.resource.fieldCount"),
      sorter: (left, right) => (left.columnCount ?? 0) - (right.columnCount ?? 0),
      // 列表接口用后端标量 column_count(schema_definition 不在列表返回);0 视为未返回
      render: (value: number) =>
        value > 0 ? <span className={styles.monoText}>{value}</span> : "—",
    },
    {
      dataIndex: "rowCount",
      title: t("dataCatalog.resource.rowCount"),
      sorter: (left, right) => (left.rowCount ?? 0) - (right.rowCount ?? 0),
      render: (value: number) =>
        value > 0 ? <span className={styles.monoText}>{formatCount(value)}</span> : "—",
    },
    {
      key: "indexState",
      title: t("dataCatalog.resource.indexState"),
      render: (_, record) => (
        <IndexStateTag showProgress state={indexStateOf(tasksByResource.get(record.id) ?? [])} />
      ),
    },
    {
      key: "actions",
      title: t("common.actions"),
      render: (_, record) => (
        <Space>
          <AppButton onClick={() => onSelectResource(record.id)} type="link">
            {t("common.detail")}
          </AppButton>
          <PermissionGate permissions="resource:task_manage">
            <AppButton
              disabled={physical && !catalog.enabled}
              onClick={() => onBuildResource(record)}
              title={
                physical && !catalog.enabled
                  ? t("dataCatalog.gate.catalogDisabledShort")
                  : undefined
              }
              type="link"
            >
              {t("dataCatalog.actions.buildIndex")}
            </AppButton>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  return (
    <section>
      <div className={styles.detailHeader}>
        <div className={styles.detailHeadMain}>
          <div className={styles.detailTitleRow}>
            <h2 className={styles.detailTitle}>{catalog.name}</h2>
            <span
              className={[styles.tag, physical ? styles.kindPhysical : styles.kindLogical].join(" ")}
            >
              {physical
                ? t("dataCatalog.kind.physical")
                : t("dataCatalog.kind.logical")}
            </span>
            {catalog.connectorType ? (
              <span className={[styles.tag, styles.kindPhysical].join(" ")}>
                {catalog.connectorType}
              </span>
            ) : null}
            <span
              className={[
                styles.tag,
                catalog.enabled ? styles.statusEnabled : styles.statusDisabled,
              ].join(" ")}
            >
              {catalog.enabled ? t("common.enabled") : t("common.disabled")}
            </span>
            {catalog.healthStatus !== "unchecked" ? (
              <span
                className={[
                  styles.tag,
                  {
                    healthy: styles.healthHealthy,
                    degraded: styles.healthDegraded,
                    unhealthy: styles.healthUnhealthy,
                    offline: styles.healthOffline,
                    unchecked: styles.healthUnchecked,
                  }[catalog.healthStatus],
                ].join(" ")}
              >
                {t(`dataConnect.healthStatuses.${catalog.healthStatus}`)}
              </span>
            ) : null}
          </div>
          <div className={styles.detailSub}>
            <span className={styles.slugChip}>{catalog.id}</span>
            {catalog.description ? <span>{catalog.description}</span> : null}
            {catalog.tags.map((tag) => (
              <span className={styles.tag} key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.detailActions}>
          <PermissionGate permissions="catalog:task_manage">
            <AppButton
              disabled={scanning || !physical || !catalog.enabled}
              icon={scanning ? <LoadingOutlined spin /> : <SearchOutlined />}
              onClick={() => void runScan()}
              type="primary"
            >
              {scanning
                ? t("dataCatalog.catalog.scanningAction")
                : t("dataCatalog.catalog.scanNow")}
            </AppButton>
          </PermissionGate>
          <AppButton
            disabled={testing || !physical}
            icon={testing ? <LoadingOutlined spin /> : undefined}
            onClick={() => void runTest()}
          >
            {testing ? t("dataCatalog.catalog.testing") : t("common.testConnection")}
          </AppButton>
          <PermissionGate permissions="catalog:modify">
            <AppButton onClick={toggleEnabled}>
              {catalog.enabled ? t("common.disabled") : t("common.enabled")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:modify">
            <AppButton
              disabled={!physical}
              onClick={() => {
                void navigate(`/data-connect/${catalog.id}/edit`);
              }}
            >
              {t("common.edit")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="admin-authz:grant">
            <AppButton icon={<KeyOutlined />} onClick={() => setAuthorizeOpen(true)}>
              {t("systemAdmin.objectGrants.authorize")}
            </AppButton>
          </PermissionGate>
          <PermissionGate permissions="catalog:delete">
            <AppButton danger onClick={removeCatalog}>
              {t("common.delete")}
            </AppButton>
          </PermissionGate>
        </div>
      </div>

      <ObjectAuthorizeDrawer
        objId={catalog.id}
        objName={catalog.name}
        objSub={connectorType?.name ?? catalog.connectorType}
        objType="catalog"
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
      />

      <div className={styles.statStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.catalog.statResources")}</div>
          <div className={styles.statValue}>
            {resources.length} <small>{t("dataCatalog.unit.item")}</small>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.catalog.statLastScan")}</div>
          <div className={[styles.statValue, styles.statValueSmall].join(" ")}>{lastScanText}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataCatalog.catalog.statIndexed")}</div>
          <div className={styles.statValue}>
            {indexedCount} <small>/ {resources.length}</small>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>{t("dataConnect.createTime")}</div>
          <div className={[styles.statValue, styles.statValueSmall].join(" ")}>
            {catalog.createTime.slice(0, 10)}
          </div>
        </div>
      </div>

      <div className={styles.sectionGrid}>
        <div className={[styles.sectionCard, styles.sectionCardFlat].join(" ")}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>
              {t("dataCatalog.catalog.connectionInfo")}{" "}
              <span className={styles.sectionTitleHint}>GET /catalogs/{"{id}"}</span>
            </h3>
            <div className={styles.sectionTools}>
              <span
                className={[
                  styles.tag,
                  catalog.enabled ? styles.statusEnabled : styles.statusDisabled,
                ].join(" ")}
              >
                {catalog.enabled ? t("common.enabled") : t("common.disabled")}
              </span>
              {catalog.healthStatus !== "unchecked" ? (
                <span
                  className={[
                    styles.tag,
                    {
                      healthy: styles.healthHealthy,
                      degraded: styles.healthDegraded,
                      unhealthy: styles.healthUnhealthy,
                      offline: styles.healthOffline,
                      unchecked: styles.healthUnchecked,
                    }[catalog.healthStatus],
                  ].join(" ")}
                >
                  {t(`dataConnect.healthStatuses.${catalog.healthStatus}`)}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.descGrid}>
            {physical ? (
              <>
                {(() => {
                  const connectorTypeText = connectorType
                    ? `${connectorType.name}(${t(`dataConnect.categories.${connectorType.category}`)})`
                    : catalog.connectorType || "—";
                  return (
                    <div className={styles.descItem}>
                      <span className={styles.descLabel}>{t("dataConnect.connectorType")}</span>
                      <span className={styles.descValue} title={connectorTypeText}>
                        {connectorTypeText}
                      </span>
                    </div>
                  );
                })()}
                <div className={styles.descItem}>
                  <span className={styles.descLabel}>{t("common.mode")}</span>
                  <span className={styles.descValue}>{t(`dataConnect.modes.${catalog.mode}`)}</span>
                </div>
                {Object.entries(catalog.connectorConfig).map(([key, value]) => {
                  const field = connectorType?.fieldConfig[key];
                  const text = field?.encrypted ? "••••••••" : String(value ?? "—");
                  return (
                    <div className={styles.descItem} key={key}>
                      <span className={styles.descLabel}>{field?.name ?? key}</span>
                      <span className={styles.descValue} title={text}>
                        {text}
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className={[styles.descItem, styles.descItemWide].join(" ")}>
                <span className={styles.descValue} style={{ color: "#8b98ac" }}>
                  {t("dataCatalog.catalog.logicalNoConfig")}
                </span>
              </div>
            )}
            <div className={styles.descItem}>
              <span className={styles.descLabel}>{t("dataConnect.createTime")}</span>
              <span className={styles.descValue} title={catalog.createTime}>
                {catalog.createTime}
              </span>
            </div>
            <div className={styles.descItem}>
              <span className={styles.descLabel}>{t("dataConnect.updater")}</span>
              <span className={styles.descValue} title={catalog.updaterName}>
                {catalog.updaterName}
              </span>
            </div>
          </div>
        </div>

        <div className={[styles.sectionCard, styles.sectionCardFlat].join(" ")}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>
              {t("dataCatalog.catalog.scanSection")}{" "}
              <span className={styles.sectionTitleHint}>discover</span>
            </h3>
            <div className={styles.sectionTools}>
              <PermissionGate permissions="catalog:task_manage">
                <AppButton
                  disabled={scanning || !physical || !catalog.enabled}
                  onClick={() => void runScan()}
                  size="small"
                >
                  {scanning
                    ? t("dataCatalog.catalog.scanningAction")
                    : t("dataCatalog.catalog.runScan")}
                </AppButton>
              </PermissionGate>
            </div>
          </div>
          {physical && !catalog.enabled ? (
            <div className={styles.calloutWarn}>
              <ExclamationCircleOutlined />
              <span>{t("dataCatalog.catalog.disabledScanHint")}</span>
            </div>
          ) : null}
          {scans.length === 0 ? (
            <div className={styles.scanItemMeta}>
              {physical
                ? t("dataCatalog.catalog.noScans")
                : t("dataCatalog.catalog.logicalNoScans")}
            </div>
          ) : (
            <div className={styles.scanList}>
              {(scansExpanded ? scans : scans.slice(0, 2)).map((scan) => (
                <div className={styles.scanItem} key={scan.id}>
                  {scan.status === "running" ? (
                    <span className={styles.scanSpin}>
                      <LoadingOutlined spin />
                    </span>
                  ) : (
                    <span
                      className={[
                        styles.scanDot,
                        scan.status === "failed" ? styles.scanDotFailed : "",
                      ].join(" ")}
                    />
                  )}
                  <div className={styles.scanItemBody}>
                    <span className={styles.scanItemTitle}>
                      <span className={styles.slugChip}>{scan.id}</span>
                      {scan.status === "running" ? (
                        <span className={[styles.tag, styles.taskRunning].join(" ")}>
                          {t("dataCatalog.tree.scanning")}
                        </span>
                      ) : null}
                      {scan.status === "failed" ? (
                        <span className={[styles.tag, styles.taskFailed].join(" ")}>
                          {t("dataCatalog.task.statuses.failed")}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.scanItemMeta}>
                      {scan.startTime} ·{" "}
                      {t(`dataCatalog.catalog.trigger.${scan.trigger}`)}
                      {scan.status === "succeeded"
                        ? ` · ${t("dataCatalog.catalog.scanResult", {
                            duration: scan.durationSec ?? 0,
                            found: scan.foundResources ?? 0,
                            fresh: scan.newResources ?? 0,
                          })}`
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
              {scans.length > 2 ? (
                <AppButton
                  onClick={() => setScansExpanded((prev) => !prev)}
                  size="small"
                  style={{ alignSelf: "flex-start", padding: 0 }}
                  type="link"
                >
                  {scansExpanded
                    ? t("dataCatalog.catalog.scanShowLess")
                    : t("dataCatalog.catalog.scanShowMore", { count: scans.length - 2 })}
                </AppButton>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionTitleRow}>
          <h3 className={styles.sectionTitle}>
            {t("dataCatalog.catalog.resourceSection")}{" "}
            <span className={styles.sectionTitleHint}>
              GET /resources?catalog_id={"{id}"}
            </span>
          </h3>
          <div className={styles.sectionTools}>
            {resources.length > 0 ? (
              <>
                <Input.Search
                  allowClear
                  onChange={(event) => setResourceKeyword(event.target.value)}
                  placeholder={t("dataCatalog.resource.searchPlaceholder")}
                  size="small"
                  style={{ width: 200 }}
                  value={resourceKeyword}
                />
                <Select
                  allowClear
                  onChange={(value) => setIndexFilter(value)}
                  options={INDEX_FILTERS.map((key) => ({
                    label: t(`dataCatalog.indexState.${key}`),
                    value: key,
                  }))}
                  placeholder={t("dataCatalog.resource.indexFilterPlaceholder")}
                  size="small"
                  style={{ width: 130 }}
                  value={indexFilter}
                />
              </>
            ) : null}
            <PermissionGate permissions="resource:create">
              <AppButton onClick={() => onCreateResource(catalog.id)} size="small">
                {t("dataCatalog.resource.create")}
              </AppButton>
            </PermissionGate>
          </div>
        </div>
        {resources.length === 0 ? (
          <div className={styles.scanItemMeta}>
            {physical
              ? t("dataCatalog.catalog.emptyResourcesPhysical")
              : t("dataCatalog.catalog.emptyResourcesLogical")}
          </div>
        ) : (
          <AppTable<CatalogResource>
            columns={resourceColumns}
            dataSource={filteredResources}
            pagination={{
              pageSize: 10,
              size: "small",
              hideOnSinglePage: true,
              showSizeChanger: false,
            }}
            rowKey="id"
            size="small"
          />
        )}
      </div>
    </section>
  );
}
