/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DoubleLeftOutlined, DoubleRightOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Input,
  Pagination,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { listKnowledgeNetworkActionTypes } from "@/modules/knowledge-network/services/action-type.service";
import { listObjectMetricsV1 } from "@/modules/knowledge-network/services/object-metric.service";
import { listKnowledgeNetworkObjectTypes } from "@/modules/knowledge-network/services/object-type.service";
import { getEffectivePropertySnapshot } from "@/modules/knowledge-network/services/property-authorization.service";
import { listKnowledgeNetworkRelationTypes } from "@/modules/knowledge-network/services/relation-type.service";
import { explainRowFilter } from "@/modules/knowledge-network/services/row-filter-authorization.service";
import type { RowFilterExplain } from "@/modules/knowledge-network/types/row-filter-authorization";
import {
  getNetworkPermissionSources,
  type PermissionSourceDecision,
} from "@/modules/system-admin/services/authz.service";
import type {
  PropertyGrantEntry,
  PropertyGrantSnapshot,
} from "@/modules/knowledge-network/types/property-authorization";
import type {
  RowFilterSnapshot,
  RowFilterPredicate,
} from "@/modules/knowledge-network/types/row-filter-authorization";
import { getAuthorizationRegistry } from "@/modules/system-admin/services/authorization-registry.service";
import {
  listGrantableRolesForObject,
  listGrantableUsersForObject,
  projectNetworkPermissions,
} from "@/modules/system-admin/services/authz.service";
import type { EffectiveDecision, ObjectGrant } from "@/modules/system-admin/types/authz";

import styles from "./WorkspacePermissionMatrixSection.module.css";

const ObjectAuthorizeDrawer = lazy(async () => ({
  default: (await import("@/modules/system-admin/components/ObjectAuthorizeDrawer"))
    .ObjectAuthorizeDrawer,
}));

type Category = "knowledge_network" | "object_type" | "relation_type" | "action_type" | "metric";
type ResourceRow = {
  id: string;
  name: string;
  objId: string;
  type: Category;
  canAuthorize: boolean;
};
type FineState = {
  explanation?: RowFilterExplain;
  row?: RowFilterSnapshot;
  property?: PropertyGrantSnapshot;
  rowStatus?: "loaded" | "error";
  propertyStatus?: "loaded" | "error";
};
type SubjectType = "user" | "role";
type SubjectOption = { id: string; type: SubjectType; name: string; detail?: string };
type ConfiguredGrant = { key: string; resource: ResourceRow; grant: ObjectGrant };
type GrantSource = { type: SubjectType; id?: string; inherited: boolean };
type SourceDetailRow = {
  key: string;
  operation: string;
  decision: string;
  basis: string;
  grant?: PermissionSourceDecision["steps"][number]["matched_grants"][number];
  resourceId: string;
  resourceType: string;
};
type ObjectPermissionRow = {
  key: string;
  object: ResourceRow;
  grant?: ObjectGrant;
  row?: RowFilterSnapshot;
  fields: PropertyGrantEntry[];
};

const CATEGORIES: Category[] = [
  "knowledge_network",
  "object_type",
  "relation_type",
  "action_type",
  "metric",
];
const EMPTY_ROWS: ResourceRow[] = [];
const EMPTY_GROUPS: Partial<Record<Category, ResourceRow[]>> = {};
const CATEGORY_LABELS: Record<Category, string> = {
  knowledge_network: "permissionMatrix.root",
  object_type: "workspaceObjectTypes",
  relation_type: "workspaceRelationTypes",
  action_type: "workspaceActionTypes",
  metric: "workspaceMetrics",
};
const OPERATORS: Record<string, string> = {
  between: "∈",
  gt: ">",
  gte: "≥",
  in: "∈",
  lt: "<",
  lte: "≤",
  not_in: "∉",
};

async function loadMetricNames(networkId: string): Promise<Array<{ id: string; name: string }>> {
  const entries: Array<{ id: string; name: string }> = [];
  while (true) {
    const page = await listObjectMetricsV1(
      networkId,
      { limit: 100, offset: entries.length },
      { skipErrorToast: true },
    );
    entries.push(
      ...page.entries.map(({ definition }) => ({ id: definition.id, name: definition.name })),
    );
    if (entries.length >= page.total_count) return entries;
    if (page.entries.length === 0) throw new Error("Incomplete object metric list");
  }
}

async function loadCategory(
  category: Category,
  networkId: string,
  networkName: string,
  canAuthorize: boolean,
): Promise<ResourceRow[]> {
  if (category === "knowledge_network")
    return [{ id: networkId, name: networkName, objId: networkId, type: category, canAuthorize }];
  const records =
    category === "object_type"
      ? await listKnowledgeNetworkObjectTypes(networkId, { skipErrorToast: true })
      : category === "relation_type"
        ? await listKnowledgeNetworkRelationTypes(networkId)
        : category === "action_type"
          ? await listKnowledgeNetworkActionTypes(networkId, { skipErrorToast: true })
          : await loadMetricNames(networkId);
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    objId: `${networkId}/${record.id}`,
    type: category,
    // Match the existing KN child authorization drawer: parent authorize plus visible child.
    canAuthorize:
      canAuthorize &&
      (category === "metric" ||
        ("operations" in record &&
          Array.isArray(record.operations) &&
          record.operations.includes("view_detail"))),
  }));
}

function fineKey(objectId: string, subject: Pick<SubjectOption, "type" | "id">) {
  return `${objectId}\u0000${subject.type}\u0000${subject.id}`;
}

export function WorkspacePermissionMatrixSection({
  networkId,
  networkName,
  canAuthorize,
  fineGrainedAvailable,
  fineGrainedStatus,
  metricsAvailable = false,
}: {
  networkId: string;
  networkName: string;
  canAuthorize: boolean;
  fineGrainedAvailable: boolean;
  metricsAvailable?: boolean;
  fineGrainedStatus?: "available" | "unknown" | "not-licensed" | "not-installed";
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("objects");
  const [resourceState, setResourceState] = useState<{
    networkId: string;
    groups: Partial<Record<Category, ResourceRow[]>>;
  }>({ networkId, groups: EMPTY_GROUPS });
  const [resourceErrors, setResourceErrors] = useState<Category[]>([]);
  const [, setResourceLoading] = useState(true);
  const [resourceRevision, setResourceRevision] = useState(0);
  const [grantRevision, setGrantRevision] = useState(0);
  const [fineRevision, setFineRevision] = useState(0);
  const [fine, setFine] = useState<Record<string, FineState>>({});
  const [subjectType, setSubjectType] = useState<SubjectType>("user");
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [foundSubjects, setFoundSubjects] = useState<SubjectOption[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectPage, setSubjectPage] = useState(1);
  const [subjectPaneCollapsed, setSubjectPaneCollapsed] = useState(false);
  const [fineDetail, setFineDetail] = useState<{
    object: ResourceRow;
    kind: "row" | "fields";
  } | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailLevel, setDetailLevel] = useState("all");
  useEffect(() => {
    setDetailSearch("");
    setDetailLevel("all");
  }, [fineDetail?.object.objId, fineDetail?.kind]);
  const [sourceResource, setSourceResource] = useState<ResourceRow | null>(null);
  const [sourceDecisions, setSourceDecisions] = useState<PermissionSourceDecision[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState(false);
  const [subjectError, setSubjectError] = useState(false);
  const [operationNames, setOperationNames] = useState<Record<string, Record<string, string>>>({});
  const [search, setSearch] = useState("");
  const [resourcePage, setResourcePage] = useState(1);
  const [resourcePageSize, setResourcePageSize] = useState(10);
  const [drawerRow, setDrawerRow] = useState<ResourceRow | null>(null);
  const [drawerSubject, setDrawerSubject] = useState<SubjectOption | null>(null);
  const [effectiveLoading, setEffectiveLoading] = useState(false);
  const [effectiveError, setEffectiveError] = useState(false);
  const [effectiveEntries, setEffectiveEntries] = useState<ObjectGrant[]>([]);
  const fineCache = useRef<Record<string, FineState>>({});
  const fineCacheKey = useRef("");
  const resourceGroups =
    resourceState.networkId === networkId ? resourceState.groups : EMPTY_GROUPS;
  const resources = useMemo(
    () => CATEGORIES.flatMap((category) => resourceGroups[category] ?? EMPTY_ROWS),
    [resourceGroups],
  );
  const objectRows = resourceGroups.object_type ?? EMPTY_ROWS;
  const objectLoading = !resourceGroups.object_type && !resourceErrors.includes("object_type");
  const activeCategory: Category =
    tab === "network"
      ? "knowledge_network"
      : tab === "objects"
        ? "object_type"
        : tab === "relations"
          ? "relation_type"
          : tab === "actions"
            ? "action_type"
            : "metric";
  const filteredResources = useMemo(
    () =>
      (resourceGroups[activeCategory] ?? EMPTY_ROWS).filter(
        (row) =>
          !search.trim() ||
          `${row.name} ${row.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
    [resourceGroups, activeCategory, search],
  );
  const pageResources = useMemo(
    () =>
      filteredResources.slice(
        (resourcePage - 1) * resourcePageSize,
        resourcePage * resourcePageSize,
      ),
    [filteredResources, resourcePage, resourcePageSize],
  );
  useEffect(() => {
    setResourcePage(1);
    setFineDetail(null);
  }, [selectedSubject?.id, selectedSubject?.type, networkId, search]);

  useEffect(() => {
    let active = true;
    void getAuthorizationRegistry()
      .then((registry) => {
        if (!active) return;
        setOperationNames(
          Object.fromEntries(
            registry.resourceTypes.map((type) => [
              type.id,
              Object.fromEntries(
                type.operations.map((operation) => [operation.id, operation.name || operation.id]),
              ),
            ]),
          ),
        );
      })
      .catch(() => {
        /* Operation IDs remain readable if the catalog is unavailable. */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedSubject(null);
    setFoundSubjects([]);
    setSubjectSearch("");
    setSubjectError(false);
  }, [networkId]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      () => {
        const request =
          subjectType === "user"
            ? listGrantableUsersForObject("knowledge_network", networkId, subjectSearch, {
                skipErrorToast: true,
              }).then((users) =>
                users.map((user) => ({
                  id: user.id,
                  type: "user" as const,
                  name: user.name || user.account || user.id,
                  detail: user.account,
                })),
              )
            : listGrantableRolesForObject("knowledge_network", networkId, subjectSearch, {
                skipErrorToast: true,
              }).then((roles) =>
                roles.map((role) => ({
                  id: role.id,
                  type: "role" as const,
                  name: role.name || role.id,
                })),
              );
        void request
          .then((found) => {
            if (!active) return;
            setFoundSubjects(found);
            setSubjectError(false);
          })
          .catch(() => {
            if (active) setSubjectError(true);
          });
      },
      subjectSearch ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [networkId, subjectSearch, subjectType]);

  useEffect(() => {
    let active = true;
    setResourceLoading(true);
    setResourceState({ networkId, groups: EMPTY_GROUPS });
    setResourceErrors([]);
    void Promise.all(
      CATEGORIES.map(async (category) => {
        if (category === "metric" && !metricsAvailable) {
          setResourceState((current) => ({ networkId, groups: { ...current.groups, metric: [] } }));
          return;
        }
        try {
          const rows = await loadCategory(category, networkId, networkName, canAuthorize);
          if (active)
            setResourceState((current) =>
              current.networkId === networkId
                ? { networkId, groups: { ...current.groups, [category]: rows } }
                : current,
            );
        } catch {
          if (active) setResourceErrors((current) => [...current, category]);
        }
      }),
    ).then(() => {
      if (active) setResourceLoading(false);
    });
    return () => {
      active = false;
    };
  }, [networkId, networkName, canAuthorize, resourceRevision, metricsAvailable]);

  useEffect(() => {
    let active = true;
    const cacheKey = `${networkId}\u0000${fineRevision}\u0000${fineGrainedAvailable}`;
    const controller = new AbortController();
    if (fineCacheKey.current !== cacheKey) {
      fineCacheKey.current = cacheKey;
      fineCache.current = {};
      setFine({});
    }
    if (!fineGrainedAvailable || !fineDetail)
      return () => {
        active = false;
      };
    if (!selectedSubject) return;
    const key = fineKey(fineDetail.object.objId, selectedSubject);
    const kind = fineDetail.kind;
    if (kind === "row" ? fineCache.current[key]?.rowStatus : fineCache.current[key]?.propertyStatus)
      return;
    void (async () => {
      let patch: FineState;
      try {
        const options = { skipErrorToast: true, signal: controller.signal };
        if (kind === "row") {
          const explanation = await explainRowFilter(
            selectedSubject,
            fineDetail.object.objId,
            options,
          );
          patch = { row: explanation.snapshot, explanation, rowStatus: "loaded" };
        } else {
          patch = {
            property: await getEffectivePropertySnapshot(
              selectedSubject,
              fineDetail.object.objId,
              options,
            ),
            propertyStatus: "loaded",
          };
        }
      } catch {
        patch = kind === "row" ? { rowStatus: "error" } : { propertyStatus: "error" };
      }
      if (!active) return;
      const state = { ...fineCache.current[key], ...patch };
      fineCache.current[key] = state;
      setFine((current) => ({ ...current, [key]: state }));
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [fineDetail, selectedSubject, fineRevision, fineGrainedAvailable, networkId]);

  const finePairs = selectedSubject
    ? objectRows.map((object) => fine[fineKey(object.objId, selectedSubject)])
    : [];
  const fineError = finePairs.some(
    (item) => item?.rowStatus === "error" || item?.propertyStatus === "error",
  );
  useEffect(() => {
    const controller = new AbortController();
    setSourceDecisions([]);
    setSourcesError(false);
    if (!sourceResource || !selectedSubject) return;
    setSourcesLoading(true);
    void getNetworkPermissionSources(
      networkId,
      selectedSubject,
      { type: sourceResource.type, id: sourceResource.objId },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setSourceDecisions(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSourcesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSourcesLoading(false);
      });
    return () => controller.abort();
  }, [sourceResource, selectedSubject, networkId, grantRevision]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!selectedSubject || pageResources.length === 0) {
      setEffectiveEntries([]);
      setEffectiveLoading(false);
      setEffectiveError(false);
      return () => {
        active = false;
      };
    }
    setEffectiveEntries([]);
    setEffectiveLoading(true);
    setEffectiveError(false);
    void (async () => {
      try {
        const entries = await projectNetworkPermissions(
          networkId,
          selectedSubject,
          pageResources.map((row) => ({ type: row.type, id: row.objId })),
          controller.signal,
        );
        if (active) setEffectiveEntries(entries);
      } catch {
        if (active) {
          setEffectiveEntries([]);
          setEffectiveError(true);
        }
      } finally {
        if (active) setEffectiveLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedSubject, grantRevision, networkId, pageResources]);
  const subjectGrants = selectedSubject
    ? effectiveEntries.flatMap((grant, index) => {
        const resource = resources.find(
          (row) => row.type === grant.objType && row.objId === grant.objId,
        );
        return resource
          ? [
              {
                key: `${grant.objType}:${grant.objId}:${selectedSubject.id}:${index}`,
                resource,
                grant,
              },
            ]
          : [];
      })
    : [];
  const objectGrants = subjectGrants.filter((item) => item.resource.type === "object_type");
  const networkGrants = subjectGrants.filter((item) => item.resource.type === "knowledge_network");
  const actionGrants = subjectGrants.filter((item) => item.resource.type === "action_type");
  const metricGrants = subjectGrants.filter((item) => item.resource.type === "metric");
  const relationGrants = subjectGrants.filter((item) => item.resource.type === "relation_type");
  const configuredGrants = subjectGrants;
  const normalizedSubjectSearch = subjectSearch.trim().toLocaleLowerCase();
  const knownSubjects: SubjectOption[] = configuredGrants
    .filter(({ grant }) => (grant.accessorType ?? "user") === subjectType)
    .map(({ grant }) => ({
      id: grant.accessorId,
      type: subjectType,
      name: grant.accessorName || grant.accessorAccount || grant.accessorId,
      detail: grant.accessorAccount,
    }))
    .filter(
      (subject) =>
        !foundSubjects.some((found) => found.id === subject.id && found.type === subject.type),
    )
    .filter(
      (subject) =>
        !normalizedSubjectSearch ||
        `${subject.name} ${subject.id} ${subject.detail ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSubjectSearch),
    );
  const subjectOptions = [
    ...new Map(
      [...foundSubjects, ...knownSubjects, ...(selectedSubject ? [selectedSubject] : [])]
        .filter((subject) => subject.type === subjectType)
        .map((subject) => [subject.id, subject]),
    ).values(),
  ];
  const subjectPageSize = 10;
  const pagedSubjects = subjectOptions.slice(
    (subjectPage - 1) * subjectPageSize,
    subjectPage * subjectPageSize,
  );
  const keyword = search.trim().toLocaleLowerCase();
  const matches = (row: ResourceRow) =>
    !keyword ||
    `${row.name} ${row.id} ${t(`knowledgeNetwork.${CATEGORY_LABELS[row.type]}`)}`
      .toLocaleLowerCase()
      .includes(keyword);
  const operationLabel = (type: Category, operation: string) =>
    operationNames[type]?.[operation] || operation;
  const matchesGrant = (row: ConfiguredGrant) =>
    !keyword ||
    `${row.resource.name} ${row.resource.id} ${row.grant.accessorName ?? ""} ${row.grant.accessorId} ${row.grant.operations.join(" ")} ${(row.grant.deniedOperations ?? []).join(" ")} ${(row.grant.effectiveDecisions ?? []).map((decision) => decision.operation).join(" ")} ${(row.grant.grants ?? []).map((source) => source.accessorId).join(" ")}`
      .toLocaleLowerCase()
      .includes(keyword);

  const effectiveOperations = (grant: ObjectGrant): EffectiveDecision[] =>
    (grant.effectiveDecisions?.length
      ? grant.effectiveDecisions
      : [
          ...grant.operations.map((operation) => ({
            basis: "direct" as const,
            decision: "allow" as const,
            operation,
            requires: [],
          })),
          ...(grant.deniedOperations ?? []).map((operation) => ({
            basis: "direct" as const,
            decision: "deny" as const,
            operation,
            requires: [],
          })),
        ]
    ).filter((decision) => decision.operation !== "create");
  const openGrantEditor = (row: ConfiguredGrant, source?: GrantSource) => {
    if (source && !source.id) return;
    const sourceName = source?.id
      ? (configuredGrants.find(
          (item) => item.grant.accessorId === source.id && item.grant.accessorType === source.type,
        )?.grant.accessorName ?? source.id)
      : undefined;
    setDrawerSubject(
      source && source.id
        ? { id: source.id, type: source.type, name: sourceName ?? source.id }
        : selectedSubject,
    );
    setDrawerRow(row.resource);
  };

  const renderPermissionSources = (resource: ResourceRow, grant: ObjectGrant) => (
    <Space direction="vertical" size={2}>
      <Typography.Text type="secondary">
        {[
          ...new Set(
            effectiveOperations(grant)
              .filter((decision) => decision.decision === "allow" || decision.basis !== "default")
              .map((decision) => decision.basis),
          ),
        ]
          .map((basis) => t(`knowledgeNetwork.permissionMatrix.basis.${basis}`))
          .join("、") || "—"}
      </Typography.Text>
      <Button size="small" type="link" onClick={() => setSourceResource(resource)}>
        {t("knowledgeNetwork.permissionMatrix.viewSources")}
      </Button>
    </Space>
  );
  const grantColumns: ColumnsType<ConfiguredGrant> = [
    {
      title: t("knowledgeNetwork.permissionMatrix.resource"),
      key: "resource",
      width: 220,
      render: (_value, row) => (
        <div className={styles.resourceCell}>
          <strong>{row.resource.name}</strong>
        </div>
      ),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.effectivePermissions"),
      key: "operations",
      width: 300,
      render: (_value, row) => (
        <div className={styles.grantCell}>
          {row.grant.bundle === "full_business_access" ? (
            <Tag color="blue" className={styles.grantTag}>
              {t("knowledgeNetwork.permissionMatrix.fullBusinessAccess")}
            </Tag>
          ) : (
            effectiveOperations(row.grant).map((decision) => (
              <Tag
                color={decision.decision === "deny" ? "red" : "blue"}
                className={styles.grantTag}
                key={`${decision.decision}:${decision.operation}:${decision.basis}`}
              >
                {decision.decision === "deny"
                  ? t("knowledgeNetwork.permissionMatrix.denyOperation", {
                      operation: operationLabel(row.resource.type, decision.operation),
                    })
                  : operationLabel(row.resource.type, decision.operation)}
              </Tag>
            ))
          )}
        </div>
      ),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.permissionSource"),
      key: "source",
      width: 220,
      render: (_value, row) => renderPermissionSources(row.resource, row.grant),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.actions"),
      key: "actions",
      width: 160,
      render: (_value, row) => (
        <Space direction="vertical" size={0}>
          <Button size="small" type="link" onClick={() => openGrantEditor(row)}>
            {t("knowledgeNetwork.permissionMatrix.managePermissions")}
          </Button>
          {row.resource.type === "object_type" ? (
            <Button
              size="small"
              type="link"
              onClick={() =>
                void navigate(
                  `/knowledge-network/workspace/${networkId}/object-types/${row.resource.id}/authorization`,
                )
              }
            >
              {t(
                row.resource.canAuthorize
                  ? "knowledgeNetwork.permissionMatrix.editObjectType"
                  : "knowledgeNetwork.permissionMatrix.editRules",
              )}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const objectPermissionRows: ObjectPermissionRow[] = selectedSubject
    ? pageResources
        .filter((row) => row.type === "object_type")
        .map((object) => {
          const state = fine[fineKey(object.objId, selectedSubject)];
          return {
            key: object.objId,
            object,
            grant: objectGrants.find((item) => item.resource.objId === object.objId)?.grant,
            row: state?.row,
            fields: state?.property?.entries ?? [],
          };
        })
    : [];
  const renderFineSummary = (
    object: ResourceRow,
    kind: "row" | "fields",
    status: "loaded" | "error" | undefined,
    count: number,
    summary?: ObjectGrant["configurationSummary"],
  ) => {
    if (!fineGrainedAvailable)
      return (
        <Tooltip title={t("knowledgeNetwork.permissionMatrix.fineUnavailable")}>
          <Typography.Text type="secondary">
            {t(
              `knowledgeNetwork.permissionMatrix.${fineGrainedStatus === "unknown" ? "capabilityLoading" : fineGrainedStatus === "not-licensed" || fineGrainedStatus === "not-installed" ? "enterpriseCapability" : "capabilityUnavailable"}`,
            )}
          </Typography.Text>
        </Tooltip>
      );
    if (!status && summary)
      return (
        <Space direction="vertical" size={0}>
          <Tooltip title={t("knowledgeNetwork.permissionMatrix.configurationSummaryHelp")}>
            <Typography.Text type="secondary">
              {kind === "row"
                ? t("knowledgeNetwork.permissionMatrix.rowRuleCount", {
                    count: summary.row_conditions,
                  })
                : t("knowledgeNetwork.permissionMatrix.fieldSummary", {
                    count: summary.field_rules,
                    masked: summary.masked_rules,
                    hidden: summary.hidden_rules,
                  })}
            </Typography.Text>
          </Tooltip>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setFineDetail({ object, kind });
              setDetailSearch("");
            }}
          >
            {t("knowledgeNetwork.permissionMatrix.viewDetails")}
          </Button>
        </Space>
      );
    if (!status)
      return (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setFineDetail({ object, kind });
            setDetailSearch("");
          }}
        >
          {t("knowledgeNetwork.permissionMatrix.viewDetails")}
        </Button>
      );
    if (status === "error")
      return (
        <Typography.Text type="danger">
          {t("knowledgeNetwork.permissionMatrix.detailFailed")}
        </Typography.Text>
      );
    if (count === 0) return <Typography.Text type="secondary">—</Typography.Text>;
    return (
      <Space direction="vertical" size={0}>
        <Typography.Text type="secondary">
          {t(
            `knowledgeNetwork.permissionMatrix.${count ? (kind === "row" ? "rowRuleCount" : "fieldRuleCount") : kind === "row" ? "noRowRule" : "noFieldRule"}`,
            { count },
          )}
        </Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={() => {
            setFineDetail({ object, kind });
            setDetailSearch("");
          }}
        >
          {t("knowledgeNetwork.permissionMatrix.viewDetails")}
        </Button>
      </Space>
    );
  };
  const detailState =
    fineDetail && selectedSubject
      ? fine[fineKey(fineDetail.object.objId, selectedSubject)]
      : undefined;
  const detailKeyword = detailSearch.trim().toLocaleLowerCase();
  const formatPredicate = (predicate: RowFilterPredicate): string => {
    if (predicate.predicates?.length)
      return `(${predicate.predicates.map(formatPredicate).join(` ${predicate.kind.toUpperCase()} `)})`;
    if (predicate.kind === "true" || predicate.kind === "false")
      return t(
        `knowledgeNetwork.permissionMatrix.${predicate.kind === "true" ? "allRows" : "noRows"}`,
      );
    const field = detailState?.row?.availableFields.find(
      (item) => item.name === predicate.property,
    );
    return `${field?.displayName || predicate.property || ""} ${OPERATORS[predicate.kind] || predicate.kind} ${(predicate.values ?? []).join("、")}`;
  };
  const rowDetailConditions = [
    ...(detailState?.row?.policy
      ? [
          {
            policy: detailState.row.policy,
            source: t("knowledgeNetwork.permissionMatrix.directRule"),
          },
        ]
      : []),
    ...(detailState?.explanation?.rolePolicies ?? []).map((entry) => ({
      policy: entry.policy,
      source: t("knowledgeNetwork.permissionMatrix.inheritedFromRole", {
        role:
          subjectOptions.find(
            (subject) => subject.type === "role" && subject.id === entry.subject.id,
          )?.name || entry.subject.id,
      }),
    })),
  ].flatMap((entry, group) =>
    entry.policy.conditions.map((condition, index) => ({
      ...condition,
      key: `${group}:${index}`,
      source: entry.source,
      relation: entry.policy.relation.toUpperCase(),
    })),
  );
  const detailFields = detailState?.property?.decisions?.length
    ? detailState.property.decisions.map((entry) => ({
        propertyName: entry.name,
        displayName: entry.displayName,
        level: entry.level,
        source: entry.source,
      }))
    : (detailState?.property?.entries ?? []);
  const objectPermissionColumns: ColumnsType<ObjectPermissionRow> = [
    {
      title: t("knowledgeNetwork.permissionMatrix.resource"),
      key: "object",
      width: 220,
      render: (_value, row) => (
        <div className={styles.resourceCell}>
          <strong>{row.object.name}</strong>
        </div>
      ),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.effectivePermissions"),
      key: "permissions",
      width: 300,
      render: (_value, row) =>
        row.grant ? (
          <div className={styles.grantCell}>
            {effectiveOperations(row.grant).map((decision) => (
              <Tag
                color={decision.decision === "deny" ? "red" : "blue"}
                className={styles.grantTag}
                key={`${decision.decision}:${decision.operation}:${decision.basis}`}
              >
                {decision.decision === "deny"
                  ? t("knowledgeNetwork.permissionMatrix.denyOperation", {
                      operation: operationLabel(row.object.type, decision.operation),
                    })
                  : operationLabel(row.object.type, decision.operation)}
              </Tag>
            ))}
          </div>
        ) : (
          <Typography.Text type="secondary">
            {t("knowledgeNetwork.permissionMatrix.noObjectPermission")}
          </Typography.Text>
        ),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.rowScope"),
      key: "row",
      width: 220,
      render: (_value, row) => {
        const state = selectedSubject
          ? fine[fineKey(row.object.objId, selectedSubject)]
          : undefined;
        return renderFineSummary(
          row.object,
          "row",
          state?.rowStatus,
          (row.row?.policy?.conditions.length ?? 0) +
            (state?.explanation?.rolePolicies ?? []).reduce(
              (sum, entry) => sum + entry.policy.conditions.length,
              0,
            ),
          row.grant?.configurationSummary,
        );
      },
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.fieldScope"),
      key: "fields",
      width: 220,
      render: (_value, row) => {
        const state = selectedSubject
          ? fine[fineKey(row.object.objId, selectedSubject)]
          : undefined;
        return renderFineSummary(
          row.object,
          "fields",
          state?.propertyStatus,
          state?.property?.decisions?.length || row.fields.length,
          row.grant?.configurationSummary,
        );
      },
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.permissionSource"),
      key: "source",
      width: 220,
      render: (_value, row) =>
        row.grant ? (
          renderPermissionSources(row.object, row.grant)
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: t("knowledgeNetwork.permissionMatrix.actions"),
      key: "actions",
      width: 160,
      render: (_value, row) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setDrawerSubject(selectedSubject);
            setDrawerRow(row.object);
          }}
        >
          {t("knowledgeNetwork.permissionMatrix.managePermissions")}
        </Button>
      ),
    },
  ];

  const tableProps = {
    bordered: true,
    size: "small" as const,
    pagination: {
      current: resourcePage,
      pageSize: resourcePageSize,
      total: selectedSubject ? filteredResources.length : 0,
      onChange: (page: number, size: number) => {
        setResourcePage(page);
        setResourcePageSize(size);
      },
      showSizeChanger: true,
      pageSizeOptions: [10, 25, 50, 100],
      position: ["bottomRight" as const],
      showTotal: (total: number) =>
        t("knowledgeNetwork.permissionMatrix.paginationTotal", { total }),
    },
    scroll: { x: tab === "objects" && fineGrainedAvailable ? 1340 : 900 },
  };
  const tabs = [
    {
      key: "network",
      label: t("knowledgeNetwork.permissionMatrix.networkTabBase"),
      children: (
        <Table<ConfiguredGrant>
          {...tableProps}
          locale={{
            emptyText: t(
              selectedSubject
                ? "knowledgeNetwork.permissionMatrix.noSubjectGrants"
                : "knowledgeNetwork.permissionMatrix.chooseSubject",
            ),
          }}
          rowKey="key"
          columns={grantColumns}
          dataSource={networkGrants.filter(matchesGrant)}
          loading={
            effectiveLoading ||
            (!resourceGroups.knowledge_network && !resourceErrors.includes("knowledge_network"))
          }
        />
      ),
    },
    {
      key: "objects",
      label: t("knowledgeNetwork.permissionMatrix.objectsTabBase"),
      children: (
        <Table<ObjectPermissionRow>
          {...tableProps}
          locale={{
            emptyText: t(
              selectedSubject
                ? "knowledgeNetwork.permissionMatrix.noObjectPermissions"
                : "knowledgeNetwork.permissionMatrix.chooseSubject",
            ),
          }}
          rowKey="key"
          columns={objectPermissionColumns}
          dataSource={objectPermissionRows.filter((row) => matches(row.object))}
          loading={effectiveLoading || objectLoading}
        />
      ),
    },
    {
      key: "relations",
      label: t("knowledgeNetwork.permissionMatrix.relationsTabBase"),
      children: (
        <Table<ConfiguredGrant>
          {...tableProps}
          locale={{
            emptyText: t(
              selectedSubject
                ? "knowledgeNetwork.permissionMatrix.noSubjectGrants"
                : "knowledgeNetwork.permissionMatrix.chooseSubject",
            ),
          }}
          rowKey="key"
          columns={grantColumns}
          dataSource={relationGrants.filter(matchesGrant)}
          loading={
            effectiveLoading ||
            (!resourceGroups.relation_type && !resourceErrors.includes("relation_type"))
          }
        />
      ),
    },
    {
      key: "actions",
      label: t("knowledgeNetwork.permissionMatrix.actionsTabBase"),
      children: (
        <Table<ConfiguredGrant>
          {...tableProps}
          locale={{
            emptyText: t(
              selectedSubject
                ? "knowledgeNetwork.permissionMatrix.noSubjectGrants"
                : "knowledgeNetwork.permissionMatrix.chooseSubject",
            ),
          }}
          rowKey="key"
          columns={grantColumns}
          dataSource={actionGrants.filter(matchesGrant)}
          loading={
            effectiveLoading ||
            (!resourceGroups.action_type && !resourceErrors.includes("action_type"))
          }
        />
      ),
    },
    {
      key: "metrics",
      label: t("knowledgeNetwork.permissionMatrix.metricsTabBase"),
      children: (
        <Table<ConfiguredGrant>
          {...tableProps}
          locale={{
            emptyText: t(
              selectedSubject
                ? "knowledgeNetwork.permissionMatrix.noSubjectGrants"
                : "knowledgeNetwork.permissionMatrix.chooseSubject",
            ),
          }}
          rowKey="key"
          columns={grantColumns}
          dataSource={metricGrants.filter(matchesGrant)}
          loading={
            effectiveLoading || (!resourceGroups.metric && !resourceErrors.includes("metric"))
          }
        />
      ),
    },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.matrixLayout}>
        <aside
          className={`${styles.subjectPane} ${subjectPaneCollapsed ? styles.subjectPaneCollapsed : ""}`}
        >
          {!subjectPaneCollapsed ? (
            <>
              <Segmented
                block
                size="small"
                value={subjectType}
                options={
                  [
                    {
                      label: t("knowledgeNetwork.permissionMatrix.subjectTypes.user"),
                      value: "user",
                    },
                    {
                      label: t("knowledgeNetwork.permissionMatrix.subjectTypes.role"),
                      value: "role",
                    },
                  ] as const
                }
                onChange={(value) => {
                  setSubjectType(value);
                  setSelectedSubject(null);
                  setFoundSubjects([]);
                  setSubjectSearch("");
                  setSubjectPage(1);
                  setSubjectError(false);
                }}
              />
              <Input.Search
                size="small"
                allowClear
                value={subjectSearch}
                onChange={(event) => {
                  setSubjectSearch(event.target.value);
                  setSubjectPage(1);
                }}
                placeholder={t(
                  subjectType === "user"
                    ? "knowledgeNetwork.permissionMatrix.searchUser"
                    : "knowledgeNetwork.permissionMatrix.searchRole",
                )}
                status={subjectError ? "error" : undefined}
              />
              <div className={styles.subjectList}>
                {pagedSubjects.map((subject) => (
                  <button
                    className={
                      selectedSubject?.id === subject.id
                        ? styles.subjectItemActive
                        : styles.subjectItem
                    }
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject)}
                    type="button"
                  >
                    <strong>{subject.name}</strong>
                  </button>
                ))}
                {!subjectOptions.length ? (
                  <Typography.Text type="secondary" className={styles.emptySubjects}>
                    {t("knowledgeNetwork.permissionMatrix.noSubjects")}
                  </Typography.Text>
                ) : null}
              </div>
              {subjectOptions.length > subjectPageSize ? (
                <Pagination
                  className={styles.subjectPagination}
                  current={subjectPage}
                  pageSize={subjectPageSize}
                  showSizeChanger={false}
                  size="small"
                  total={subjectOptions.length}
                  onChange={setSubjectPage}
                />
              ) : null}
              {subjectError ? (
                <Typography.Text type="danger" className={styles.subjectError}>
                  {t("knowledgeNetwork.permissionMatrix.subjectsLoadError")}
                </Typography.Text>
              ) : null}
            </>
          ) : null}
          <div className={styles.subjectPaneFooter}>
            <Tooltip
              title={t(
                subjectPaneCollapsed
                  ? "knowledgeNetwork.permissionMatrix.expandSubjectPane"
                  : "knowledgeNetwork.permissionMatrix.collapseSubjectPane",
              )}
            >
              <Button
                aria-label={t(
                  subjectPaneCollapsed
                    ? "knowledgeNetwork.permissionMatrix.expandSubjectPane"
                    : "knowledgeNetwork.permissionMatrix.collapseSubjectPane",
                )}
                className={styles.subjectPaneToggle}
                icon={subjectPaneCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                onClick={() => setSubjectPaneCollapsed((value) => !value)}
                size="small"
                type="text"
              />
            </Tooltip>
          </div>
        </aside>
        <div className={styles.permissionContent}>
          <div className={styles.toolbar}>
            <Input.Search
              size="small"
              className={styles.resourceSearch}
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("knowledgeNetwork.permissionMatrix.searchResource")}
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                setResourceRevision((value) => value + 1);
                setGrantRevision((value) => value + 1);
                setFineRevision((value) => value + 1);
              }}
            >
              {t("knowledgeNetwork.permissionMatrix.refresh")}
            </Button>
          </div>
          {resourceErrors.length > 0 ? (
            <Alert
              type="warning"
              message={t("knowledgeNetwork.permissionMatrix.partialResources", {
                categories: resourceErrors
                  .map((category) => t(`knowledgeNetwork.${CATEGORY_LABELS[category]}`))
                  .join("、"),
              })}
            />
          ) : null}
          {effectiveError ? (
            <Alert
              type="warning"
              message={t("knowledgeNetwork.permissionMatrix.effectiveLoadError")}
              action={
                <Button onClick={() => setGrantRevision((value) => value + 1)}>
                  {t("knowledgeNetwork.permissionMatrix.retry")}
                </Button>
              }
            />
          ) : null}
          {fineError && tab === "objects" ? (
            <Alert
              type="warning"
              message={t("knowledgeNetwork.permissionMatrix.fineError")}
              action={
                <Button onClick={() => setFineRevision((value) => value + 1)}>
                  {t("knowledgeNetwork.permissionMatrix.retry")}
                </Button>
              }
            />
          ) : null}
          <Tabs
            activeKey={tab}
            onChange={(value) => {
              setTab(value);
              setResourcePage(1);
            }}
            items={tabs.filter((item) => metricsAvailable || item.key !== "metrics")}
            className={styles.matrixTabs}
          />
        </div>
      </div>
      <Drawer
        open={Boolean(sourceResource)}
        onClose={() => setSourceResource(null)}
        width="min(960px, 92vw)"
        title={
          sourceResource
            ? `${sourceResource.name} · ${t("knowledgeNetwork.permissionMatrix.permissionSource")}`
            : undefined
        }
      >
        <Typography.Paragraph>{selectedSubject?.name}</Typography.Paragraph>
        {sourcesError ? (
          <Alert
            type="warning"
            message={t("knowledgeNetwork.permissionMatrix.effectiveLoadError")}
          />
        ) : null}
        <Table<SourceDetailRow>
          size="small"
          loading={sourcesLoading}
          rowKey="key"
          pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          columns={[
            {
              title: t("knowledgeNetwork.permissionMatrix.effectivePermissions"),
              render: (_value, row) =>
                sourceResource ? operationLabel(sourceResource.type, row.operation) : row.operation,
            },
            {
              title: t("knowledgeNetwork.permissionMatrix.result"),
              render: (_value, row) => (
                <Tag color={row.decision === "allow" ? "green" : "red"}>
                  {t(
                    `knowledgeNetwork.permissionMatrix.${row.decision === "allow" ? "allow" : "deny"}`,
                  )}
                </Tag>
              ),
            },
            {
              title: t("knowledgeNetwork.permissionMatrix.permissionSource"),
              render: (_value, row) =>
                row.grant
                  ? `${t(`knowledgeNetwork.permissionMatrix.subjectTypes.${row.grant.subject_kind === "role" ? "role" : "user"}`)}：${row.grant.subject_name || t("knowledgeNetwork.permissionMatrix.sourceByServer")}`
                  : t(`knowledgeNetwork.permissionMatrix.basis.${row.basis}`),
            },
            {
              title: t("knowledgeNetwork.permissionMatrix.actions"),
              render: (_value, row) => {
                const grant = row.grant;
                const management = grant?.management;
                const target = resources.find(
                  (resource) =>
                    resource.type === management?.resource_type &&
                    resource.objId === management?.resource_id,
                );
                if (
                  !grant ||
                  !management?.can_manage ||
                  !["user", "role"].includes(grant.subject_kind) ||
                  (management.kind !== "role_permissions" && !target)
                )
                  return "—";
                return (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      if (management.kind === "role_permissions") {
                        void navigate("/system/roles");
                        return;
                      }
                      setDrawerSubject({
                        id: grant.subject_id,
                        type: grant.subject_kind as SubjectType,
                        name: grant.subject_name || "",
                      });
                      if (target) setDrawerRow(target);
                    }}
                  >
                    {t("knowledgeNetwork.permissionMatrix.manageSource")}
                  </Button>
                );
              },
            },
          ]}
          dataSource={sourceDecisions
            .filter((decision) => decision.operation !== "create")
            .flatMap<SourceDetailRow>((decision) => {
              const sources = (decision.steps ?? []).flatMap((step) =>
                step.matched_grants.map((grant) => ({
                  grant,
                  resourceId: step.resource_id,
                  resourceType: step.resource_type,
                })),
              );
              return sources.length
                ? sources.map((source, index) => ({
                    key: `${decision.operation}:${index}`,
                    operation: decision.operation,
                    decision: decision.decision,
                    basis: decision.basis,
                    ...source,
                  }))
                : [
                    {
                      key: decision.operation,
                      operation: decision.operation,
                      decision: decision.decision,
                      basis: decision.basis,
                      grant: undefined,
                      resourceId: "",
                      resourceType: "",
                    },
                  ];
            })}
        />
      </Drawer>
      <Drawer
        open={Boolean(fineDetail)}
        onClose={() => setFineDetail(null)}
        width="min(860px, 90vw)"
        title={
          fineDetail
            ? `${fineDetail.object.name} · ${t(`knowledgeNetwork.permissionMatrix.${fineDetail.kind === "row" ? "rowScope" : "fieldScope"}`)}`
            : undefined
        }
        extra={
          <Button
            size="small"
            disabled={!fineDetail}
            onClick={() => {
              if (fineDetail)
                void navigate(
                  `/knowledge-network/workspace/${networkId}/object-types/${fineDetail.object.id}/authorization`,
                );
            }}
          >
            {t("knowledgeNetwork.permissionMatrix.editObjectType")}
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Text strong>{selectedSubject?.name}</Typography.Text>
          {(fineDetail?.kind === "row" ? detailState?.rowStatus : detailState?.propertyStatus) ===
          "error" ? (
            <Alert
              type="warning"
              message={t("knowledgeNetwork.permissionMatrix.detailFailed")}
              action={
                <Button size="small" onClick={() => setFineRevision((value) => value + 1)}>
                  {t("knowledgeNetwork.permissionMatrix.retry")}
                </Button>
              }
            />
          ) : null}
          {fineDetail?.kind === "row" ? (
            <>
              {detailState?.explanation?.effectivePredicate ? (
                <Typography.Paragraph>
                  <Typography.Text strong>
                    {t("knowledgeNetwork.permissionMatrix.effectiveRowScope")}：
                  </Typography.Text>
                  {formatPredicate(detailState.explanation.effectivePredicate)}
                </Typography.Paragraph>
              ) : null}
              {detailState?.rowStatus !== "error" ? (
                <Typography.Text>
                  {detailState?.row?.policy
                    ? t("knowledgeNetwork.permissionMatrix.ruleRelation", {
                        relation: detailState.row.policy.relation.toUpperCase(),
                      })
                    : detailState?.explanation?.rolePolicies.length
                      ? t("knowledgeNetwork.permissionMatrix.inheritedRules")
                      : detailState?.rowStatus === "loaded"
                        ? t("knowledgeNetwork.permissionMatrix.noRowRule")
                        : t("knowledgeNetwork.permissionMatrix.detailLoading")}
                </Typography.Text>
              ) : null}
              <Table
                size="small"
                loading={!detailState?.rowStatus}
                rowKey="key"
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 25, 50],
                }}
                locale={{
                  emptyText: t(
                    detailState?.rowStatus === "error"
                      ? "knowledgeNetwork.permissionMatrix.detailFailed"
                      : detailState?.rowStatus === "loaded"
                        ? "knowledgeNetwork.permissionMatrix.noRowRule"
                        : "knowledgeNetwork.permissionMatrix.detailLoading",
                  ),
                }}
                columns={[
                  { title: t("knowledgeNetwork.permissionMatrix.source"), dataIndex: "source" },
                  { title: t("knowledgeNetwork.permissionMatrix.relation"), dataIndex: "relation" },
                  {
                    title: t("knowledgeNetwork.permissionMatrix.field"),
                    render: (_value, condition) =>
                      detailState?.row?.availableFields.find(
                        (field) => field.name === condition.propertyName,
                      )?.displayName || condition.propertyName,
                  },
                  {
                    title: t("knowledgeNetwork.permissionMatrix.operator"),
                    render: (_value, condition) =>
                      OPERATORS[condition.operator] || condition.operator,
                  },
                  {
                    title: t("knowledgeNetwork.permissionMatrix.values"),
                    render: (_value, condition) => (
                      <span style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                        {condition.values.join("、")}
                      </span>
                    ),
                  },
                ]}
                dataSource={rowDetailConditions}
              />
            </>
          ) : (
            <>
              <div className={styles.detailToolbar}>
                <Input.Search
                  className={styles.detailSearch}
                  allowClear
                  value={detailSearch}
                  onChange={(event) => setDetailSearch(event.target.value)}
                  placeholder={t("knowledgeNetwork.permissionMatrix.searchField")}
                />
                <Select
                  className={styles.detailLevel}
                  value={detailLevel}
                  onChange={setDetailLevel}
                  options={[
                    { value: "all", label: t("knowledgeNetwork.permissionMatrix.allLevels") },
                    ...["none", "schema", "masked", "full"].map((value) => ({
                      value,
                      label: t(`knowledgeNetwork.permissionMatrix.levels.${value}`),
                    })),
                  ]}
                />
              </div>
              <Table<PropertyGrantEntry>
                size="small"
                loading={!detailState?.propertyStatus}
                rowKey="propertyName"
                locale={{
                  emptyText: t(
                    detailState?.propertyStatus === "error"
                      ? "knowledgeNetwork.permissionMatrix.detailFailed"
                      : !detailState?.propertyStatus
                        ? "knowledgeNetwork.permissionMatrix.detailLoading"
                        : detailKeyword || detailLevel !== "all"
                          ? "knowledgeNetwork.permissionMatrix.noMatchingFields"
                          : "knowledgeNetwork.permissionMatrix.noFieldConfiguration",
                  ),
                }}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 25, 50],
                }}
                columns={[
                  {
                    title: t("knowledgeNetwork.permissionMatrix.field"),
                    render: (_value, field) => field.displayName || field.propertyName,
                  },
                  {
                    title: t("knowledgeNetwork.permissionMatrix.level"),
                    width: 130,
                    render: (_value, field) => (
                      <Tag>{t(`knowledgeNetwork.permissionMatrix.levels.${field.level}`)}</Tag>
                    ),
                  },
                  {
                    title: t("knowledgeNetwork.permissionMatrix.source"),
                    width: 220,
                    render: (_value, field) =>
                      field.source === "object_type" || field.source === "property"
                        ? t(`knowledgeNetwork.permissionMatrix.fieldSources.${field.source}`)
                        : field.source || "—",
                  },
                ]}
                dataSource={detailFields.filter(
                  (field) =>
                    (detailLevel === "all" || field.level === detailLevel) &&
                    (!detailKeyword ||
                      `${field.propertyName} ${field.displayName || ""}`
                        .toLocaleLowerCase()
                        .includes(detailKeyword)),
                )}
              />
            </>
          )}
        </Space>
      </Drawer>
      {drawerRow ? (
        <Suspense fallback={null}>
          <ObjectAuthorizeDrawer
            open
            objType={drawerRow.type}
            objId={drawerRow.objId}
            objName={drawerRow.name}
            objSub={drawerRow.type === "knowledge_network" ? undefined : networkName}
            objectAuthorized={drawerRow.canAuthorize}
            prefillGranteeId={drawerSubject?.id}
            prefillGranteeType={drawerSubject?.type}
            onClose={() => {
              setDrawerRow(null);
              setDrawerSubject(null);
            }}
            onChanged={() => setGrantRevision((value) => value + 1)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
