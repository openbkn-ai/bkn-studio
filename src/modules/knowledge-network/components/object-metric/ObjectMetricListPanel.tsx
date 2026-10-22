/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { TableProps } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { ObjectMetricGraphCanvas } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphCanvas";
import { ObjectMetricAuthorizeDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricAuthorizeDrawer";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { ObjectTypeRemoteFilter } from "@/modules/knowledge-network/components/shared/ObjectTypeRemoteFilter";
import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import { usePersistentPageSize } from "@/modules/knowledge-network/components/shared/usePersistentPageSize";
import { useKnowledgeNetworkCanOperate } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import { findMetricLogicProperty } from "@/modules/knowledge-network/lib/object-metric-binding";
import { objectMetricActions } from "@/modules/knowledge-network/lib/object-metric-actions";
import {
  objectMetricListPath,
  readObjectMetricListLocation,
} from "@/modules/knowledge-network/lib/object-metric-navigation";
import {
  checkObjectMetricVersionDeletionV1,
  deleteObjectMetricVersionV1,
  deprecateObjectMetricV1,
  listObjectMetricsV1,
  queryObjectMetricDataV1,
  queryObjectMetricDrillThroughV1,
  trialObjectMetricDataV1,
  trialObjectMetricDrillThroughV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage,
} from "@/modules/knowledge-network/services/object-type.service";
import type {
  ObjectMetricRecordV1,
  ObjectMetricTypeV1,
  ObjectMetricVersionDeletionCheckV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricListPanel.module.css";
import metricTheme from "./ObjectMetricTheme.module.css";
import graphStyles from "@/modules/knowledge-network/components/shared/ResourceGraphExplorer.module.css";
import listStyles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

type Props = { canDelete: boolean; canModify: boolean; networkId: string; networkName?: string };
type MetricStatus = ObjectMetricRecordV1["definition"]["lifecycle"]["status"];
type CreateIntent = { type: ObjectMetricTypeV1 };

const PAGE_SIZE_STORAGE_SCOPE = "object-metrics";
const OBJECT_PAGE_SIZE = 10;
const COUNT_CONCURRENCY = 4;

const typeNames: Record<ObjectMetricTypeV1, string> = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
};
const statusNames = {
  get deprecated() {
    return objectMetricText("m1948aabb85ed");
  },
  get draft() {
    return objectMetricText("m2a2fd29bd27a");
  },
  get published() {
    return objectMetricText("md334724d6b2f");
  },
  get validated() {
    return objectMetricText("m1936eafc0c3c");
  },
};

export function ObjectMetricListPanel({ canDelete, canModify, networkId, networkName }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canAuthorizeMetrics = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialLocation] = useState(() => readObjectMetricListLocation(searchParams));
  const [initialGraphMetric] = useState(() => {
    const version = Number(searchParams.get("graphMetricVersion"));
    const id = searchParams.get("graphMetricId");
    return initialLocation.view === "graph" && id && Number.isSafeInteger(version) && version > 0
      ? { id, objectTypeId: initialLocation.objectTypeId, version }
      : undefined;
  });
  const { message } = useAppServices();
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [objectListError, setObjectListError] = useState(false);
  const [objectMetricCounts, setObjectMetricCounts] = useState<Record<string, number | null>>({});
  const [visibleObjectTypeIds, setVisibleObjectTypeIds] = useState<string[]>([]);
  const [objectTotal, setObjectTotal] = useState(0);
  const [objectPage, setObjectPage] = useState(initialLocation.objectPage);
  const [listMetrics, setListMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [authorizingMetric, setAuthorizingMetric] = useState<ObjectMetricRecordV1>();
  const [trialMetric, setTrialMetric] = useState<ObjectMetricRecordV1>();
  const [trialObjectType, setTrialObjectType] = useState<ObjectTypeDetail | null>();
  const [trialLoadingKey, setTrialLoadingKey] = useState<string>();
  const [deletionPendingKey, setDeletionPendingKey] = useState<string>();
  const deletionPendingRef = useRef<string | undefined>(undefined);
  const [listTotal, setListTotal] = useState(0);
  const [listResultKey, setListResultKey] = useState("");
  const [selectedObjectTypeId, setSelectedObjectTypeId] = useState(initialLocation.objectTypeId);
  const [selectedObjectTypeName, setSelectedObjectTypeName] = useState("");
  const [selectedObjectDetail, setSelectedObjectDetail] = useState<{
    id: string;
    detail: ObjectTypeDetail | null | undefined;
  }>();
  const [objectKeyword, setObjectKeyword] = useState(initialLocation.objectQuery);
  const [debouncedObjectKeyword, setDebouncedObjectKeyword] = useState(initialLocation.objectQuery);
  const [metricKeyword, setMetricKeyword] = useState(initialLocation.metricQuery);
  const [debouncedMetricKeyword, setDebouncedMetricKeyword] = useState(initialLocation.metricQuery);
  const [metricType, setMetricType] = useState<ObjectMetricTypeV1 | undefined>(
    initialLocation.metricType,
  );
  const [metricStatus, setMetricStatus] = useState<MetricStatus | undefined>(
    initialLocation.metricStatus,
  );
  const [listObjectTypeId, setListObjectTypeId] = useState(initialLocation.listObjectTypeId);
  const [viewMode, setViewMode] = useState<"graph" | "list">(initialLocation.view);
  const [page, setPage] = useState(initialLocation.metricPage);
  const [pageSize, setPageSize] = usePersistentPageSize(PAGE_SIZE_STORAGE_SCOPE, 10);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [listOwnerDetails, setListOwnerDetails] = useState<
    Record<string, ObjectTypeDetail | null | undefined>
  >({});
  const [createIntent, setCreateIntent] = useState<CreateIntent>();
  const [createObjectTypeId, setCreateObjectTypeId] = useState("all");
  const returnTo = objectMetricListPath(networkId, {
    listObjectTypeId,
    metricPage: page,
    metricQuery: metricKeyword,
    metricStatus,
    metricType,
    objectPage,
    objectQuery: objectKeyword,
    objectTypeId: selectedObjectTypeId,
    sidebarCollapsed: false,
    view: viewMode,
  });
  const search = searchParams.toString();
  const listRequestKey = JSON.stringify([
    networkId,
    listObjectTypeId,
    debouncedMetricKeyword,
    metricType,
    metricStatus,
    page,
    pageSize,
    refreshVersion,
  ]);
  const listCurrent = listResultKey === listRequestKey;
  const messageRef = useRef(message);
  const selectedObjectRef = useRef({ id: selectedObjectTypeId, name: selectedObjectTypeName });
  const objectKeywordRef = useRef(objectKeyword);
  const tableViewportRef = useRef<HTMLDivElement>(null);
  const objectListRef = useRef<HTMLDivElement>(null);
  const objectMetricCountCache = useRef(new Map<string, number | null>());
  const objectMetricCountRequests = useRef(new Set<string>());
  const countRequestScope = useRef("");
  const graphOwnerMetricCache = useRef(
    new Map<string, { entries: ObjectMetricRecordV1[]; total: number }>(),
  );
  const listOwnerDetailCache = useRef(new Map<string, ObjectTypeDetail | null>());
  const trialRequestRef = useRef(0);

  useEffect(() => {
    countRequestScope.current = `${networkId}\0${refreshVersion}`;
    return () => {
      countRequestScope.current = "";
    };
  }, [networkId, refreshVersion]);

  useEffect(() => {
    const expected = new URL(returnTo, "http://metric-navigation.local").searchParams;
    if (search !== expected.toString()) setSearchParams(expected, { replace: true });
  }, [returnTo, search, setSearchParams]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    selectedObjectRef.current = { id: selectedObjectTypeId, name: selectedObjectTypeName };
  }, [selectedObjectTypeId, selectedObjectTypeName]);

  useEffect(() => {
    if (viewMode !== "graph") {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setObjectListError(false);
    void listKnowledgeNetworkObjectTypePage(
      networkId,
      {
        direction: "asc",
        limit: OBJECT_PAGE_SIZE,
        namePattern: debouncedObjectKeyword || undefined,
        offset: (objectPage - 1) * OBJECT_PAGE_SIZE,
        sort: "name",
      },
      { skipErrorToast: true },
    )
      .then((result) => {
        if (!active || objectKeywordRef.current.trim() !== debouncedObjectKeyword) return;
        setObjectListError(false);
        const maxPage = Math.max(1, Math.ceil(result.totalCount / OBJECT_PAGE_SIZE));
        setObjectTotal(result.totalCount);
        if (objectPage > maxPage) {
          setObjectTypes([]);
          setObjectPage(maxPage);
          return;
        }
        setObjectTypes(result.entries);
        const first = result.entries[0];
        const currentSelection = selectedObjectRef.current;
        if (first && !currentSelection.id) {
          setSelectedObjectTypeId(first.id);
          setSelectedObjectTypeName(first.name);
        } else if (!first && result.totalCount === 0) {
          setSelectedObjectTypeId("");
          setSelectedObjectTypeName("");
        } else {
          const selected = result.entries.find((item) => item.id === currentSelection.id);
          if (selected) setSelectedObjectTypeName(selected.name);
        }
      })
      .catch(() => {
        if (active) {
          setObjectTypes([]);
          setObjectTotal(0);
          setObjectListError(true);
          setSelectedObjectTypeId("");
          setSelectedObjectTypeName("");
          void messageRef.current.error(objectMetricText("m51fc5b3bc879"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedObjectKeyword, networkId, objectPage, refreshVersion, viewMode]);

  useEffect(() => {
    if (viewMode !== "graph" || loading || objectListError || !selectedObjectTypeId) {
      setSelectedObjectDetail(undefined);
      return;
    }
    let active = true;
    setSelectedObjectDetail({ id: selectedObjectTypeId, detail: undefined });
    void getKnowledgeNetworkObjectTypeDetail(networkId, selectedObjectTypeId)
      .then((detail) => {
        if (!active) return;
        setSelectedObjectDetail({ id: selectedObjectTypeId, detail: detail ?? null });
        if (detail?.name) setSelectedObjectTypeName(detail.name);
      })
      .catch(() => {
        if (active) setSelectedObjectDetail({ id: selectedObjectTypeId, detail: null });
      });
    return () => {
      active = false;
    };
  }, [loading, networkId, objectListError, selectedObjectTypeId, refreshVersion, viewMode]);

  useEffect(() => {
    if (!selectedObjectTypeId) return;
    const selectedButton = [...(objectListRef.current?.querySelectorAll("button") ?? [])].find(
      (button) => button.dataset.objectTypeId === selectedObjectTypeId,
    );
    selectedButton?.scrollIntoView?.({ block: "nearest" });
  }, [objectTypes, selectedObjectTypeId]);

  useEffect(() => {
    if (viewMode !== "graph" || objectTypes.length === 0) {
      setVisibleObjectTypeIds([]);
      return;
    }
    const root = objectListRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setVisibleObjectTypeIds(objectTypes.map((item) => item.id));
      return;
    }
    setVisibleObjectTypeIds([]);
    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible = entries.flatMap((entry) =>
          entry.isIntersecting && entry.target instanceof HTMLElement
            ? [entry.target.dataset.objectTypeId]
            : [],
        );
        setVisibleObjectTypeIds((current) => {
          const added = newlyVisible.filter(
            (id): id is string => typeof id === "string" && !current.includes(id),
          );
          return added.length ? [...current, ...new Set(added)] : current;
        });
      },
      { root, rootMargin: "160px 0px" },
    );
    root
      .querySelectorAll("button[data-object-type-id]")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [objectTypes, viewMode]);

  useEffect(() => {
    let active = true;
    const countKey = (id: string) => `${networkId}\0${id}`;
    const requestScope = `${networkId}\0${refreshVersion}`;
    const visibleIds = new Set(visibleObjectTypeIds);
    const pending = objectTypes.filter(
      (item) =>
        visibleIds.has(item.id) &&
        !objectMetricCountCache.current.has(countKey(item.id)) &&
        !objectMetricCountRequests.current.has(`${requestScope}\0${item.id}`),
    );
    setObjectMetricCounts(
      Object.fromEntries(
        objectTypes
          .filter((item) => objectMetricCountCache.current.has(countKey(item.id)))
          .map((item) => [item.id, objectMetricCountCache.current.get(countKey(item.id))!]),
      ),
    );

    let nextIndex = 0;
    async function loadCounts() {
      while (active && nextIndex < pending.length) {
        const item = pending[nextIndex++];
        const requestKey = `${requestScope}\0${item.id}`;
        objectMetricCountRequests.current.add(requestKey);
        let count: number | null = null;
        try {
          const result = await listObjectMetricsV1(
            networkId,
            { limit: 1, offset: 0, ownerObjectTypeId: item.id },
            { skipErrorToast: true },
          );
          count = result.total_count;
        } catch {
          // A failed count must not look like an actual zero.
        } finally {
          objectMetricCountRequests.current.delete(requestKey);
        }
        if (countRequestScope.current === requestScope) {
          objectMetricCountCache.current.set(countKey(item.id), count);
          setObjectMetricCounts((current) => ({ ...current, [item.id]: count }));
        }
      }
    }
    for (let worker = 0; worker < Math.min(COUNT_CONCURRENCY, pending.length); worker += 1) {
      void loadCounts();
    }
    return () => {
      active = false;
    };
  }, [networkId, objectTypes, refreshVersion, visibleObjectTypeIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedObjectKeyword(objectKeyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [objectKeyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedMetricKeyword(metricKeyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [metricKeyword]);

  useEffect(() => {
    if (viewMode !== "list") {
      return;
    }

    let cancelled = false;
    setListLoading(true);
    void listObjectMetricsV1(networkId, {
      keyword: debouncedMetricKeyword || undefined,
      limit: pageSize,
      metricType,
      offset: (page - 1) * pageSize,
      ownerObjectTypeId: listObjectTypeId === "all" ? undefined : listObjectTypeId,
      status: metricStatus,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        const maxPage = Math.max(1, Math.ceil(result.total_count / pageSize));
        setListTotal(result.total_count);
        if (page > maxPage) {
          setListMetrics([]);
          setPage(maxPage);
          return;
        }
        setListMetrics(result.entries);
        setListResultKey(listRequestKey);
      })
      .catch(() => {
        if (!cancelled) {
          setListMetrics([]);
          setListTotal(0);
          setListResultKey(listRequestKey);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedMetricKeyword,
    listRequestKey,
    listObjectTypeId,
    refreshVersion,
    metricStatus,
    metricType,
    networkId,
    page,
    pageSize,
    viewMode,
  ]);

  useEffect(() => {
    if (viewMode !== "list" || !listCurrent) return;
    const ownerIds = [...new Set(listMetrics.map((item) => item.definition.owner_object_type_id))];
    const missingIds = ownerIds.filter((id) => !listOwnerDetailCache.current.has(id));
    setListOwnerDetails(
      Object.fromEntries(
        ownerIds
          .filter((id) => listOwnerDetailCache.current.has(id))
          .map((id) => [id, listOwnerDetailCache.current.get(id)]),
      ),
    );
    if (missingIds.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missingIds.map(async (id) => {
        const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, id).catch(() => null);
        return [id, detail ?? null] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      for (const [id, detail] of entries) listOwnerDetailCache.current.set(id, detail);
      setListOwnerDetails((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [listCurrent, listMetrics, networkId, viewMode]);

  const refresh = useCallback(() => {
    if (viewMode === "graph") setLoading(true);
    objectMetricCountCache.current.clear();
    graphOwnerMetricCache.current.clear();
    listOwnerDetailCache.current.clear();
    setObjectMetricCounts({});
    setListOwnerDetails({});
    setRefreshVersion((current) => current + 1);
  }, [viewMode]);

  const navigateToCreate = (objectTypeId: string, type: ObjectMetricTypeV1) => {
    void navigate(
      `/knowledge-network/workspace/${networkId}/metrics/create?objectTypeId=${encodeURIComponent(objectTypeId)}&metricType=${type}`,
      { state: { knowledgeNetworkReturnTo: returnTo } },
    );
  };

  const openCreate = (type: ObjectMetricTypeV1) => {
    const objectTypeId = viewMode === "graph" ? selectedObjectTypeId : listObjectTypeId;
    if (objectTypeId && objectTypeId !== "all") {
      navigateToCreate(objectTypeId, type);
      return;
    }
    setCreateObjectTypeId("all");
    setCreateIntent({ type });
  };

  const metricReturnTo = (record: ObjectMetricRecordV1, restoreGraphFocus: boolean) => {
    if (!restoreGraphFocus) return returnTo;
    const graphReturnTo = new URL(returnTo, "http://metric-navigation.local");
    graphReturnTo.searchParams.set("graphMetricId", record.definition.id);
    graphReturnTo.searchParams.set("graphMetricVersion", String(record.definition.version));
    return `${graphReturnTo.pathname}${graphReturnTo.search}`;
  };

  const openEditor = (record: ObjectMetricRecordV1, restoreGraphFocus = false) => {
    void navigate(
      `/knowledge-network/workspace/${networkId}/metrics/${record.definition.id}/edit`,
      {
        state: { knowledgeNetworkReturnTo: metricReturnTo(record, restoreGraphFocus) },
      },
    );
  };

  const openDetail = (record: ObjectMetricRecordV1, restoreGraphFocus = false) => {
    void navigate(
      `/knowledge-network/workspace/${encodeURIComponent(networkId)}/metrics/${encodeURIComponent(record.definition.id)}/detail?version=${record.definition.version}`,
      {
        state: {
          knowledgeNetworkReturnTo: metricReturnTo(record, restoreGraphFocus),
        },
      },
    );
  };

  const ownerObjectTypeFor = (record: ObjectMetricRecordV1) => {
    const ownerId = record.definition.owner_object_type_id;
    if (selectedObjectDetail?.id === ownerId) return selectedObjectDetail.detail;
    return listOwnerDetails[ownerId];
  };

  const openTrial = async (record: ObjectMetricRecordV1) => {
    const request = ++trialRequestRef.current;
    setTrialLoadingKey(`${record.definition.id}@${record.definition.version}`);
    try {
      const cachedDetail = ownerObjectTypeFor(record);
      const detail =
        cachedDetail ??
        (await getKnowledgeNetworkObjectTypeDetail(
          networkId,
          record.definition.owner_object_type_id,
        ));
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(detail ?? null);
    } catch {
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(null);
    } finally {
      if (request === trialRequestRef.current) {
        setTrialMetric(record);
        setTrialLoadingKey(undefined);
      }
    }
  };

  const ownerObjectType =
    selectedObjectDetail?.id === selectedObjectTypeId ? selectedObjectDetail.detail : undefined;

  const showDeletionBlocked = (check: ObjectMetricVersionDeletionCheckV1) => {
    const hasReferenceBlockers = check.blockers.length > 0 || check.hidden_blocker_count > 0;
    Modal.warning({
      content: (
        <div>
          <p>
            {hasReferenceBlockers
              ? objectMetricText("metricDeleteBlockedDescription")
              : objectMetricText("metricDeleteStatusBlocked", { p0: check.status })}
          </p>
          {check.blockers.length ? (
            <ul>
              {check.blockers.map((blocker) => (
                <li
                  key={`${blocker.resource_type}:${blocker.resource_id}:${blocker.version ?? 0}:${blocker.field}`}
                >
                  {blocker.resource_type === "metric_version"
                    ? objectMetricText("metricDeleteMetricBlocker", {
                        p0: blocker.name || blocker.resource_id,
                        p1: blocker.version,
                        p2: blocker.field,
                      })
                    : objectMetricText("metricDeletePropertyBlocker", {
                        p0: blocker.name || blocker.resource_id,
                        p1: blocker.property_name,
                        p2: blocker.field,
                      })}
                </li>
              ))}
            </ul>
          ) : null}
          {check.hidden_blocker_count > 0 ? (
            <p>
              {objectMetricText("metricDeleteHiddenBlockers", {
                count: check.hidden_blocker_count,
              })}
            </p>
          ) : null}
        </div>
      ),
      title: objectMetricText("metricDeleteBlockedTitle"),
    });
  };

  const confirmDeleteVersion = async (record: ObjectMetricRecordV1) => {
    if (
      !objectMetricActions(record, canModify, canDelete, ownerObjectTypeFor(record))
        .canDeleteVersion
    )
      return;
    const pendingKey = `${record.definition.id}@${record.definition.version}`;
    if (deletionPendingRef.current) return;
    deletionPendingRef.current = pendingKey;
    setDeletionPendingKey(pendingKey);
    let check: ObjectMetricVersionDeletionCheckV1;
    try {
      check = await checkObjectMetricVersionDeletionV1(
        networkId,
        record.definition.id,
        record.definition.version,
      );
    } catch {
      return;
    } finally {
      deletionPendingRef.current = undefined;
      setDeletionPendingKey(undefined);
    }
    if (!check.deletable) {
      showDeletionBlocked(check);
      return;
    }
    Modal.confirm({
      content: objectMetricText("metricDeleteVersionConfirm", {
        p0: record.definition.name,
        p1: record.definition.version,
      }),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteObjectMetricVersionV1(
            networkId,
            record.definition.id,
            record.definition.version,
            { skipErrorToast: true },
          );
          void message.success(objectMetricText("metricDeleteVersionSuccess"));
          refresh();
        } catch (error) {
          try {
            const latest = await checkObjectMetricVersionDeletionV1(
              networkId,
              record.definition.id,
              record.definition.version,
              { skipErrorToast: true },
            );
            if (!latest.deletable) {
              showDeletionBlocked(latest);
              return;
            }
          } catch {
            // Preserve the original delete failure below.
          }
          void message.error(extractRequestErrorMessage(error));
        }
      },
      title: objectMetricText("metricDeleteVersion"),
    });
  };

  const confirmDeprecate = (record: ObjectMetricRecordV1) => {
    const actions = objectMetricActions(record, canModify, canDelete, ownerObjectTypeFor(record));
    if (!actions.canDeprecate || actions.deprecateReason) return;
    Modal.confirm({
      content: objectMetricText("mcb05d2c2df12"),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deprecateObjectMetricV1(networkId, record.definition.id, record.definition.version);
        void message.success(objectMetricText("mda791b06ec77"));
        refresh();
      },
      title: objectMetricText("ma01ab2ceb262", { p0: record.definition.name }),
    });
  };

  const columns: TableProps<ObjectMetricRecordV1>["columns"] = [
    {
      key: "name",
      title: objectMetricText("mb87e67c7dae0"),
      width: 280,
      render: (_, record) => (
        <div className={styles.nameCell}>
          <strong title={record.definition.name}>{record.definition.name}</strong>
        </div>
      ),
    },
    {
      key: "type",
      title: objectMetricText("mba40014ff496"),
      width: 100,
      render: (_, record) => (
        <Tag
          color={
            record.definition.metric_type === "atomic"
              ? "blue"
              : record.definition.metric_type === "derived"
                ? "green"
                : "purple"
          }
        >
          {typeNames[record.definition.metric_type]}
        </Tag>
      ),
    },
    {
      key: "ownerObjectType",
      title: objectMetricText("m26c439016066"),
      width: 180,
      render: (_, record) => {
        const ownerId = record.definition.owner_object_type_id;
        const owner = ownerObjectTypeFor(record);
        if (owner === undefined) return <span>{objectMetricText("bindingLoading")}</span>;
        if (owner === null) {
          const label = record.owner_object_type_name || objectMetricText("restrictedOwnerName");
          return (
            <Tooltip title={objectMetricText("restrictedObjectPermissionDenied")}>
              <span className={styles.restrictedOwnerLabel}>
                <LockOutlined />
                {label}
              </span>
            </Tooltip>
          );
        }
        const label = owner.name;
        return (
          <Button
            className={styles.ownerLink}
            onClick={() => {
              setSelectedObjectTypeId(ownerId);
              setSelectedObjectTypeName(owner.name);
              setViewMode("graph");
              setPage(1);
            }}
            title={label}
            type="link"
          >
            {label}
          </Button>
        );
      },
    },
    {
      key: "scope",
      title: objectMetricText("mec7844e49915"),
      width: 112,
      render: (_, record) =>
        record.definition.calculation_scope === "object_instance"
          ? objectMetricText("mabe9d02781fc")
          : objectMetricText("m9c51e86f9307"),
    },
    {
      key: "status",
      title: objectMetricText("m6320b4a8722a"),
      width: 90,
      render: (_, record) => (
        <Tag color={record.definition.lifecycle.status === "published" ? "success" : "default"}>
          {statusNames[record.definition.lifecycle.status]}
        </Tag>
      ),
    },
    {
      key: "logicalProperty",
      title: objectMetricText("bindingStatusLabel"),
      width: 152,
      render: (_, record) => {
        if (record.definition.calculation_scope !== "object_instance")
          return objectMetricText("bindingNotApplicable");
        const detail = ownerObjectTypeFor(record);
        if (detail === undefined) return objectMetricText("bindingLoading");
        if (detail === null) return objectMetricText("bindingUnknown");
        const property = findMetricLogicProperty(detail, record.definition.id);
        const label = property
          ? `${property.displayName || property.name} · v${property.metricBinding?.metric_ref.version}`
          : objectMetricText("bindingUnbound");
        return (
          <span className={styles.bindingCell} title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "description",
      title: objectMetricText("m419eb90613fd"),
      ellipsis: true,
      width: 300,
      render: (_, record) => record.definition.description || "--",
    },
    {
      key: "actions",
      title: objectMetricText("med31fbb483ee"),
      width: 320,
      fixed: "right",
      render: (_, record) => {
        const actions = objectMetricActions(
          record,
          canModify,
          canDelete,
          ownerObjectTypeFor(record),
        );
        return (
          <Space size={4}>
            <Button onClick={() => openDetail(record)} size="small" type="link">
              {objectMetricText("m979a332955c8")}
            </Button>
            <Button
              loading={trialLoadingKey === `${record.definition.id}@${record.definition.version}`}
              onClick={() => void openTrial(record)}
              size="small"
              type="link"
            >
              {objectMetricText("m073728637a26")}
            </Button>
            {canAuthorizeMetrics ? (
              <Button onClick={() => setAuthorizingMetric(record)} size="small" type="link">
                <KnowledgeNetworkAuthorizationActionLabel>
                  {t("knowledgeNetwork.authorizeAction")}
                </KnowledgeNetworkAuthorizationActionLabel>
              </Button>
            ) : null}
            {actions.canEdit ? (
              <Button
                aria-label={objectMetricText("m79bef996428f", { p0: record.definition.name })}
                icon={<EditOutlined />}
                onClick={() => void openEditor(record)}
                size="small"
                type="text"
              />
            ) : null}
            {actions.canDeleteVersion ? (
              <Button
                aria-label={objectMetricText("metricDeleteVersionLabel", {
                  p0: record.definition.name,
                  p1: record.definition.version,
                })}
                danger
                icon={<DeleteOutlined />}
                loading={
                  deletionPendingKey === `${record.definition.id}@${record.definition.version}`
                }
                onClick={() => void confirmDeleteVersion(record)}
                size="small"
                type="text"
              />
            ) : null}
            {actions.canDeprecate ? (
              <Tooltip title={actions.deprecateReason}>
                <span>
                  <Button
                    danger
                    disabled={!!actions.deprecateReason}
                    onClick={() => confirmDeprecate(record)}
                    size="small"
                    type="link"
                  >
                    {objectMetricText("mca0ff1e63793")}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <section
      className={`${listStyles.page} ${listStyles.objectTypePage} ${graphStyles.panelPage} ${metricTheme.scope} ${
        viewMode === "graph" ? graphStyles.graphPage : ""
      }`}
    >
      <div className={`${listStyles.toolbar} ${graphStyles.pageToolbar}`}>
        <div className={graphStyles.viewModeRow}>
          <div className={listStyles.toolbarLeft}>
            <Segmented
              onChange={(value) => {
                if (value === "graph") setLoading(true);
                setViewMode(value as "graph" | "list");
                setPage(1);
              }}
              options={[
                { label: objectMetricText("m3b51eaa93417"), value: "graph" },
                { label: objectMetricText("maedd6814ff8c"), value: "list" },
              ]}
              value={viewMode}
            />
          </div>
        </div>
        <div className={graphStyles.operationRow}>
          <div className={listStyles.toolbarLeft}>
            {canModify ? (
              <Dropdown
                menu={{
                  items: (["atomic", "derived", "composite"] as ObjectMetricTypeV1[]).map(
                    (type) => ({
                      key: type,
                      label: typeNames[type],
                    }),
                  ),
                  onClick: ({ key }) => openCreate(key as ObjectMetricTypeV1),
                }}
              >
                <AppButton
                  className={listStyles.toolbarButton}
                  disabled={viewMode === "graph" && !selectedObjectTypeId}
                  icon={<ThunderboltOutlined />}
                  type="primary"
                >
                  {objectMetricText("aiCreateMetric")}
                </AppButton>
              </Dropdown>
            ) : null}
          </div>
          <div className={listStyles.toolbarRight}>
            {viewMode === "graph" ? (
              <Input
                allowClear
                className={listStyles.searchInput}
                onChange={(event) => {
                  objectKeywordRef.current = event.target.value;
                  setObjectKeyword(event.target.value);
                  setObjectPage(1);
                  setSelectedObjectTypeId("");
                  setSelectedObjectTypeName("");
                  setPage(1);
                  if (objectListRef.current) objectListRef.current.scrollTop = 0;
                }}
                placeholder={objectMetricText("graphSearchObjectTypes")}
                prefix={<SearchOutlined className={listStyles.searchIcon} />}
                value={objectKeyword}
              />
            ) : (
              <>
                <Input
                  allowClear
                  className={listStyles.searchInput}
                  onChange={(event) => {
                    setMetricKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder={objectMetricText("searchAllMetrics")}
                  prefix={<SearchOutlined className={listStyles.searchIcon} />}
                  value={metricKeyword}
                />
                <ObjectTypeRemoteFilter
                  label={objectMetricText("m26c439016066")}
                  networkId={networkId}
                  onChange={(value) => {
                    setListObjectTypeId(value);
                    setPage(1);
                  }}
                  value={listObjectTypeId}
                />
              </>
            )}
            {viewMode === "list" ? (
              <>
                <Select
                  allowClear
                  className={listStyles.filterSelect}
                  onChange={(value) => {
                    setMetricType(value);
                    setPage(1);
                  }}
                  options={Object.entries(typeNames).map(([value, label]) => ({ label, value }))}
                  placeholder={objectMetricText("m267c4a7a86dd")}
                  value={metricType}
                />
                <Select
                  allowClear
                  className={listStyles.filterSelect}
                  onChange={(value) => {
                    setMetricStatus(value);
                    setPage(1);
                  }}
                  options={Object.entries(statusNames).map(([value, label]) => ({ label, value }))}
                  placeholder={objectMetricText("allStatuses")}
                  value={metricStatus}
                />
              </>
            ) : null}
            <button
              aria-label={objectMetricText("m09f60ac5c12e")}
              className={listStyles.iconButton}
              onClick={() => void refresh()}
              type="button"
            >
              <ReloadOutlined />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div className={graphStyles.graphLayout}>
          <aside className={graphStyles.objectSidebar}>
            <div className={graphStyles.objectSidebarHeader}>
              <strong>{objectMetricText("graphObjectTypes")}</strong>
              <span>{objectTotal}</span>
            </div>
            <div className={graphStyles.objectListArea}>
              <Spin spinning={loading}>
                <div className={graphStyles.objectList} ref={objectListRef}>
                  {objectTypes.map((item) => (
                    <button
                      className={`${graphStyles.objectButton} ${
                        selectedObjectTypeId === item.id ? graphStyles.objectButtonSelected : ""
                      }`}
                      data-object-type-id={item.id}
                      key={item.id}
                      onClick={() => {
                        setSelectedObjectTypeId(item.id);
                        setSelectedObjectTypeName(item.name);
                        setPage(1);
                      }}
                      title={item.name}
                      type="button"
                    >
                      <span
                        className={styles.objectIconSquare}
                        style={{ backgroundColor: item.color || "#1677ff" }}
                      >
                        {renderResourceIcon(item.icon)}
                      </span>
                      <span className={graphStyles.objectButtonName}>{item.name}</span>
                      <span
                        aria-label={
                          typeof objectMetricCounts[item.id] === "number"
                            ? objectMetricText("graphObjectMetricCount", {
                                p0: item.name,
                                p1: objectMetricCounts[item.id]!,
                              })
                            : undefined
                        }
                        className={graphStyles.objectResourceCount}
                        title={
                          typeof objectMetricCounts[item.id] === "number"
                            ? objectMetricText("graphUnfilteredMetricCount", {
                                p0: objectMetricCounts[item.id]!,
                              })
                            : undefined
                        }
                      >
                        {objectMetricCounts[item.id] === undefined
                          ? "…"
                          : objectMetricCounts[item.id] === null
                            ? "—"
                            : objectMetricCounts[item.id]}
                      </span>
                    </button>
                  ))}
                  {!objectTypes.length && !loading ? (
                    <Empty
                      description={objectMetricText("mc90d408577d0")}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : null}
                </div>
              </Spin>
            </div>
            {objectTotal > OBJECT_PAGE_SIZE ? (
              <div className={graphStyles.objectPagination}>
                <TablePaginationBar
                  current={objectPage}
                  onChange={(nextPage) => {
                    setObjectPage(nextPage);
                    if (objectListRef.current) objectListRef.current.scrollTop = 0;
                  }}
                  pageSize={OBJECT_PAGE_SIZE}
                  showLessItems
                  showSizeChanger={false}
                  total={objectTotal}
                />
              </div>
            ) : null}
          </aside>
          <div className={`${graphStyles.graphContent} ${styles.graphPanel}`}>
            <ObjectMetricGraphCanvas
              canDelete={canDelete}
              canModify={canModify}
              initialFocusedMetric={initialGraphMetric}
              networkId={networkId}
              objectTypeSearchEmpty={
                !loading && !objectListError && Boolean(debouncedObjectKeyword) && objectTotal === 0
              }
              objectTypesLoading={loading}
              ownerMetricCache={graphOwnerMetricCache.current}
              onDeleteVersion={(record) => void confirmDeleteVersion(record)}
              onDeprecate={confirmDeprecate}
              onEditMetric={(record) => openEditor(record, true)}
              onOpenMetric={(record) => openDetail(record, true)}
              onRestrictedObjectClick={() =>
                void message.warning(objectMetricText("restrictedObjectPermissionDenied"))
              }
              onAuthorizeMetric={canAuthorizeMetrics ? setAuthorizingMetric : undefined}
              onSelectObject={(objectTypeId, objectTypeName) => {
                setSelectedObjectTypeId(objectTypeId);
                setSelectedObjectTypeName(objectTypeName);
                setPage(1);
              }}
              onSwitchList={() => setViewMode("list")}
              onTrialMetric={(record) => void openTrial(record)}
              ownerObjectType={ownerObjectType}
              refreshVersion={refreshVersion}
              restrictedObjectTypes={
                !loading && !objectListError && !debouncedObjectKeyword && objectTotal === 0
              }
              selectedObjectTypeId={selectedObjectTypeId}
              selectedObjectTypeName={selectedObjectTypeName}
            />
          </div>
        </div>
      ) : (
        <div className={`${listStyles.tableCard} ${styles.content} ${styles.listContent}`}>
          <div className={styles.listView}>
            <div className={styles.tableArea}>
              <div className={styles.tableViewport} ref={tableViewportRef}>
                <Table
                  columns={columns}
                  dataSource={listCurrent ? listMetrics : []}
                  locale={{
                    emptyText: (
                      <Empty
                        className={styles.empty}
                        description={objectMetricText("noMetricsInList")}
                      />
                    ),
                  }}
                  pagination={false}
                  rowKey={(record) => `${record.definition.id}-${record.definition.version}`}
                  scroll={{ x: 1426 }}
                  tableLayout="fixed"
                />
              </div>
              {listLoading || !listCurrent ? (
                <div className={styles.tableLoading} role="status">
                  <Spin />
                </div>
              ) : null}
            </div>
            {listCurrent && listTotal > 0 ? (
              <div className={styles.paginationBar}>
                <TablePaginationBar
                  current={page}
                  onChange={(nextPage, nextPageSize) => {
                    setPage(nextPageSize === pageSize ? nextPage : 1);
                    setPageSize(nextPageSize);
                    if (tableViewportRef.current) tableViewportRef.current.scrollTop = 0;
                  }}
                  pageSize={pageSize}
                  showSizeChanger
                  showTotal={(total) => t("common.total", { total })}
                  total={listTotal}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
      <Modal
        cancelText={t("common.cancel")}
        okButtonProps={{ disabled: createObjectTypeId === "all" }}
        okText={objectMetricText("continueCreateMetric")}
        onCancel={() => setCreateIntent(undefined)}
        onOk={() => {
          if (!createIntent || createObjectTypeId === "all") return;
          const intent = createIntent;
          setCreateIntent(undefined);
          navigateToCreate(createObjectTypeId, intent.type);
        }}
        open={Boolean(createIntent)}
        title={objectMetricText("selectMetricOwner")}
      >
        <ObjectTypeRemoteFilter
          label={objectMetricText("m26c439016066")}
          networkId={networkId}
          onChange={setCreateObjectTypeId}
          value={createObjectTypeId}
        />
      </Modal>
      {trialMetric ? (
        <ObjectMetricTrialDrawer
          definition={trialMetric.definition}
          key={`${trialMetric.definition.id}@${trialMetric.definition.version}`}
          mode={
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? "published"
              : "draft"
          }
          networkId={networkId}
          objectType={trialObjectType}
          onClose={() => {
            setTrialMetric(undefined);
            setTrialObjectType(undefined);
          }}
          onRun={(query) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDataV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                )
              : trialObjectMetricDataV1(networkId, trialMetric.definition, query)
          }
          onDrillThrough={(query, bucketKey, cursor) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                  bucketKey,
                  cursor,
                )
              : trialObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition,
                  query,
                  bucketKey,
                  cursor,
                )
          }
          open
        />
      ) : null}
      <ObjectMetricAuthorizeDrawer
        metric={authorizingMetric}
        networkId={networkId}
        networkName={networkName}
        onClose={() => setAuthorizingMetric(undefined)}
        open={Boolean(authorizingMetric)}
      />
    </section>
  );
}
