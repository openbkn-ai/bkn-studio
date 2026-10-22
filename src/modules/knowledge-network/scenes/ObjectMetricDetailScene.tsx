/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  useKnowledgeNetworkCanModify,
  useKnowledgeNetworkCanOperate,
} from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  extractRequestErrorDetails,
  isRequestForbidden,
  isRequestNotFound,
} from "@/framework/request/error-message";
import { ObjectMetricLineagePanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricLineagePanel";
import { ObjectMetricAuthorizeDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricAuthorizeDrawer";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import {
  expressionLabel,
  replaceObjectMetricDependencyAliases,
} from "@/modules/knowledge-network/components/object-metric/object-metric-model";
import { objectMetricBusinessConditionLabel } from "@/modules/knowledge-network/lib/object-metric-condition-label";
import {
  objectMetricAggregationDisplayName,
  objectMetricPropertyDisplayName,
} from "@/modules/knowledge-network/lib/object-metric-display";
import { objectMetricUnitDisplayLabel } from "@/modules/knowledge-network/lib/object-metric-unit-catalog";
import { findMetricLogicProperty } from "@/modules/knowledge-network/lib/object-metric-binding";
import {
  objectMetricTimeWindowBusinessLabel,
  objectMetricTimeWindowSelection,
} from "@/modules/knowledge-network/lib/object-metric-time-window";
import {
  directObjectMetricReferences,
  objectMetricVersionKey,
  resolveObjectMetricReferences,
  type MetricReferenceResolution,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import { objectMetricReturnPath } from "@/modules/knowledge-network/lib/object-metric-navigation";
import {
  bindObjectMetricLogicPropertyV1,
  createNextObjectMetricDraftV1,
  getObjectMetricV1,
  listObjectMetricsV1,
  listObjectMetricVersionsV1,
  queryObjectMetricDataV1,
  queryObjectMetricDrillThroughV1,
  trialObjectMetricDataV1,
  trialObjectMetricDrillThroughV1,
  upgradeObjectMetricLogicPropertyV1,
} from "@/modules/knowledge-network/services/object-metric.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import { getKnowledgeNetworkRelationType } from "@/modules/knowledge-network/services/relation-type.service";
import type {
  MetricPropertyBindingV1,
  ObjectMetricDefinitionV1,
  ObjectMetricPropertyRefV1,
  ObjectMetricRecordV1,
  ObjectMetricTimeGranularityV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricDetailScene.module.css";
import metricTheme from "@/modules/knowledge-network/components/object-metric/ObjectMetricTheme.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

const typeNames = {
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
const statusNames: Record<ObjectMetricRecordV1["definition"]["lifecycle"]["status"], string> = {
  get deprecated() {
    return objectMetricText("ma8c3698b5b8c");
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

const dimensionPreviewCount = 3;

function referencedPropertyObjectTypeIds(definition: ObjectMetricDefinitionV1): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const fields = value as Record<string, unknown>;
    if (typeof fields.object_type_id === "string" && typeof fields.property_name === "string") {
      ids.add(fields.object_type_id);
    }
    Object.values(fields).forEach(visit);
  };
  visit(definition);
  return [...ids];
}

function MetricDimensionList({ items, emptyText }: { items: string[]; emptyText: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return emptyText;

  const hasMore = items.length > dimensionPreviewCount;
  return (
    <span className={styles.dimensionList}>
      {items.slice(0, expanded ? undefined : dimensionPreviewCount).join("、")}
      {hasMore ? (
        <button
          className={styles.dimensionToggle}
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded
            ? objectMetricText("dimensionCollapse")
            : objectMetricText("dimensionMoreCount", { p0: items.length - dimensionPreviewCount })}
        </button>
      ) : null}
    </span>
  );
}

type MetricTextKey = Parameters<typeof objectMetricText>[0];

const timeGranularityKeys: Record<ObjectMetricTimeGranularityV1, MetricTextKey> = {
  minute: "mbd957bc497aa",
  hour: "m3b6fefc50feb",
  day: "m85217f7aff77",
  week: "m5c553ec3f6db",
  month: "m1625179badc0",
  quarter: "m4f1c54f507c9",
  year: "m62ef900a8f5d",
};

const physicalTypeKeys: Record<
  ObjectMetricRecordV1["definition"]["result_semantics"]["value"]["physical_type"],
  MetricTextKey
> = {
  int64: "m67e2bb6ef67b",
  decimal: "m75a7f49573c8",
  boolean: "mc08142c140ff",
  string: "mdd81861811e5",
  date: "m70d0c1b33626",
  datetime: "m6ac8b7718121",
  duration: "m3e777ea8f1e8",
};

const semanticTypeKeys: Record<
  ObjectMetricRecordV1["definition"]["result_semantics"]["value"]["semantic_type"],
  MetricTextKey
> = {
  measure: "m208d85fd9f3a",
  count: "m21179deb9a74",
  amount: "mffc624300de8",
  ratio: "m8a457b6b1337",
  percentage: "m03af18e36797",
  score: "m96fff2e26c8d",
  rank: "m6570a98f2850",
  timestamp: "m2d1060334622",
  duration: "m04a95e0654d3",
  date: "m70d0c1b33626",
  category: "m20fcf2eb775f",
  boolean: "mc08142c140ff",
};

function timeWindowLabel(
  window: Extract<
    ObjectMetricRecordV1["definition"]["specification"],
    { kind: "derived" }
  >["business_qualifiers"]["time_window"],
) {
  if (!window || window.mode === "unbounded") return objectMetricText("m12edbc42122f");
  if (window.mode === "rolling")
    return objectMetricText("mff99c135adbc", {
      p0: window.length,
      p1: objectMetricText(timeGranularityKeys[window.unit]),
    });
  if (window.mode === "fixed_range") {
    return objectMetricText("mf971493b1e41", {
      p0: dayjs(window.start_at).format("YYYY-MM-DD HH:mm"),
      p1: dayjs(window.end_at).format("YYYY-MM-DD HH:mm"),
      p2: window.timezone,
    });
  }
  return `${objectMetricTimeWindowBusinessLabel(objectMetricTimeWindowSelection(window)) ?? window.period} · ${window.timezone}`;
}

function dependencyFailureLabel(error: unknown, version: number) {
  if (isRequestNotFound(error)) return objectMetricText("mf40f436696fb", { p0: version });
  if (isRequestForbidden(error)) return objectMetricText("m193341f84d98", { p0: version });
  return objectMetricText("m654b86d99a38", { p0: version });
}

function dependencyFailureDescription(error: unknown) {
  const details = extractRequestErrorDetails(error);
  return details.details ? `${details.description}：${details.details}` : details.description;
}

export function ObjectMetricDetailScene() {
  const { t } = useTranslation();
  const { metricId = "", networkId = "" } = useParams<{ metricId: string; networkId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedVersionValue = Number(new URLSearchParams(location.search ?? "").get("version"));
  const requestedVersion =
    Number.isSafeInteger(requestedVersionValue) && requestedVersionValue > 0
      ? requestedVersionValue
      : undefined;
  const { message } = useAppServices();
  const canModify = useKnowledgeNetworkCanModify(networkId);
  const canAuthorizeMetric = useKnowledgeNetworkCanOperate(networkId, "authorize");
  const [record, setRecord] = useState<ObjectMetricRecordV1>();
  const [versions, setVersions] = useState<ObjectMetricRecordV1[]>([]);
  const [objectTypeNames, setObjectTypeNames] = useState<Record<string, string>>({});
  const [relationTypeNames, setRelationTypeNames] = useState<Record<string, string>>({});
  const [lineageMetrics, setLineageMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [dependencyResolution, setDependencyResolution] = useState<{
    entries: MetricReferenceResolution[];
    rootKey: string;
  }>();
  const [ownerObjectType, setOwnerObjectType] = useState<ObjectTypeDetail | null>();
  const [ownerRefresh, setOwnerRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"forbidden" | "not-found" | "unknown" | null>(null);
  const [bindingOpen, setBindingOpen] = useState(false);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
  const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [bindingForm] =
    Form.useForm<Pick<MetricPropertyBindingV1, "comment" | "display_name" | "property_name">>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setRecord(undefined);

    void getObjectMetricV1(networkId, metricId, requestedVersion, { skipErrorToast: true })
      .then(async (latest) => {
        if (
          !latest ||
          (requestedVersion && latest.definition.version !== requestedVersion) ||
          !active
        ) {
          if (active) setLoadError("not-found");
          return;
        }
        const [entries, allMetrics] = await Promise.all([
          listObjectMetricVersionsV1(networkId, metricId, { skipErrorToast: true }),
          listObjectMetricsV1(networkId, { limit: 500 }, { skipErrorToast: true }),
        ]);
        if (!active) return;
        const newest = (records: ObjectMetricRecordV1[]) =>
          records.reduce<ObjectMetricRecordV1 | undefined>(
            (current, candidate) =>
              !current || candidate.definition.version > current.definition.version
                ? candidate
                : current,
            undefined,
          );
        setRecord(
          (requestedVersion
            ? (entries.find((item) => item.definition.version === requestedVersion) ?? latest)
            : undefined) ??
            newest(entries.filter((item) => item.definition.lifecycle.status === "published")) ??
            newest(entries.filter((item) => item.definition.lifecycle.status === "deprecated")) ??
            latest,
        );
        setVersions(entries.length ? entries : [latest]);
        setLineageMetrics(allMetrics.entries);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          isRequestForbidden(error)
            ? "forbidden"
            : isRequestNotFound(error)
              ? "not-found"
              : "unknown",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [metricId, networkId, requestedVersion]);

  useEffect(() => {
    const ownerObjectTypeId = record?.definition.owner_object_type_id;
    setOwnerObjectType(undefined);
    if (!ownerObjectTypeId) return;
    let active = true;
    void getKnowledgeNetworkObjectTypeDetail(networkId, ownerObjectTypeId)
      .then((detail) => {
        if (active) setOwnerObjectType(detail);
      })
      .catch(() => {
        if (active) setOwnerObjectType(null);
      });
    return () => {
      active = false;
    };
  }, [networkId, record?.definition.owner_object_type_id, ownerRefresh]);

  useEffect(() => {
    setObjectTypeNames({});
    setRelationTypeNames({});
    if (!record) return;
    let active = true;
    const definition = record.definition;
    const objectTypeIds = referencedPropertyObjectTypeIds(definition).filter(
      (id) => id !== definition.owner_object_type_id,
    );
    const relationTypeIds =
      definition.specification.kind === "derived"
        ? [
            ...new Set(
              definition.specification.business_qualifiers.relation_path?.steps.map(
                (step) => step.relation_type_id,
              ) ?? [],
            ),
          ]
        : [];
    void Promise.all(
      objectTypeIds.map(async (id) => {
        const detail = await getKnowledgeNetworkObjectTypeDetail(networkId, id).catch(() => null);
        return [id, detail?.name ?? id] as const;
      }),
    ).then((entries) => {
      if (active) setObjectTypeNames(Object.fromEntries(entries));
    });
    void Promise.all(
      relationTypeIds.map(async (id) => {
        const relation = await getKnowledgeNetworkRelationType(networkId, id).catch(() => null);
        return [id, relation?.name ?? id] as const;
      }),
    ).then((entries) => {
      if (active) setRelationTypeNames(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [networkId, record]);

  const dependencyReferenceSignature = record
    ? directObjectMetricReferences(record)
        .map((item) => objectMetricVersionKey(item.metric_id, item.version))
        .join("|")
    : "";

  useEffect(() => {
    const current = record?.definition;
    if (!current) {
      setDependencyResolution(undefined);
      return;
    }
    let active = true;
    const rootKey = objectMetricVersionKey(current.id, current.version);
    void resolveObjectMetricReferences(
      directObjectMetricReferences(record),
      (dependencyMetricId, dependencyVersion) =>
        getObjectMetricV1(networkId, dependencyMetricId, dependencyVersion, {
          skipErrorToast: true,
        }),
    ).then((entries) => {
      if (active) setDependencyResolution({ entries, rootKey });
    });
    return () => {
      active = false;
    };
  }, [dependencyReferenceSignature, networkId, record]);

  if (loading)
    return (
      <div className={styles.loading}>
        <Spin />
      </div>
    );
  if (!record) {
    if (loadError === "forbidden") {
      return (
        <Alert
          action={
            <Button
              onClick={() => void navigate(objectMetricReturnPath(networkId, location.state))}
            >
              {objectMetricText("me9d5ca6c1406")}
            </Button>
          }
          description={objectMetricText("m9590c71c5808")}
          message={objectMetricText("m2a9ed8385cd1")}
          showIcon
          type="warning"
        />
      );
    }
    return (
      <Empty
        description={
          loadError === "unknown"
            ? objectMetricText("m51fc5b3bc879")
            : objectMetricText("mcbc612fb7c63")
        }
      >
        <Button onClick={() => void navigate(objectMetricReturnPath(networkId, location.state))}>
          {objectMetricText("me9d5ca6c1406")}
        </Button>
      </Empty>
    );
  }
  const definition = record.definition;
  const boundProperty = findMetricLogicProperty(ownerObjectType, definition.id);
  const boundVersion = boundProperty?.metricBinding?.metric_ref.version;
  const ownerObjectTypeName = ownerObjectType?.name || record.owner_object_type_name;
  const displayProperty = (reference: ObjectMetricPropertyRefV1) => {
    const name = objectMetricPropertyDisplayName(reference, ownerObjectType);
    if (
      reference.object_type_id === definition.owner_object_type_id ||
      name !== reference.property_name
    )
      return name;
    const objectTypeName = objectTypeNames[reference.object_type_id] ?? reference.object_type_id;
    return `${objectTypeName}.${name}`;
  };
  const bindingStatus =
    ownerObjectType === undefined
      ? objectMetricText("bindingLoading")
      : ownerObjectType === null
        ? objectMetricText("bindingUnknown")
        : boundProperty
          ? `${boundProperty.displayName || boundProperty.name} · v${boundVersion}`
          : objectMetricText("bindingUnbound");
  const returnTo = objectMetricReturnPath(
    networkId,
    location.state,
    definition.owner_object_type_id,
  );
  const specification = definition.specification;
  const expression =
    specification.kind === "atomic"
      ? specification.measure.expression
      : specification.kind === "composite"
        ? specification.expression
        : undefined;
  const isPublishedVersion = ["published", "deprecated"].includes(definition.lifecycle.status);
  const workingDraft = versions.find((item) =>
    ["draft", "validated"].includes(item.definition.lifecycle.status),
  );
  const draftVersions = versions.filter((item) =>
    ["draft", "validated"].includes(item.definition.lifecycle.status),
  );
  const releasedVersions = versions.filter((item) =>
    ["published", "deprecated"].includes(item.definition.lifecycle.status),
  );
  const draftLabel = (draft: ObjectMetricRecordV1) => {
    const baseVersion = releasedVersions.reduce(
      (highest, item) =>
        item.definition.version < draft.definition.version
          ? Math.max(highest, item.definition.version)
          : highest,
      0,
    );
    return `${statusNames[draft.definition.lifecycle.status]} · ${
      baseVersion
        ? objectMetricText("draftBasedOnVersion", { p0: baseVersion })
        : objectMetricText("draftBeforeFirstRelease")
    }`;
  };
  const canBindLogicProperty =
    canModify &&
    definition.lifecycle.status === "published" &&
    definition.calculation_scope === "object_instance" &&
    !!ownerObjectType &&
    !boundProperty;
  const canUpgradeLogicProperty =
    canModify &&
    definition.lifecycle.status === "published" &&
    definition.calculation_scope === "object_instance" &&
    !!boundProperty &&
    !!boundVersion &&
    definition.version > boundVersion;
  const currentRootKey = objectMetricVersionKey(definition.id, definition.version);
  const dependenciesResolving = dependencyResolution?.rootKey !== currentRootKey;
  const exactDependencies = new Map(
    dependencyResolution?.rootKey === currentRootKey
      ? dependencyResolution.entries.map((entry) => [entry.key, entry])
      : [],
  );
  const compositeDependencies =
    specification.kind === "composite"
      ? specification.dependencies.map((dependency) => {
          const resolution = exactDependencies.get(
            objectMetricVersionKey(dependency.metric_ref.metric_id, dependency.metric_ref.version),
          );
          return {
            dependency,
            error: resolution?.error,
            loading: dependenciesResolving,
            record: resolution?.record,
          };
        })
      : [];
  const compositeDependencyLabels = Object.fromEntries(
    compositeDependencies.flatMap(({ dependency, record }) =>
      record ? [[dependency.alias, record.definition.name]] : [],
    ),
  );
  const exactDependencyRecords =
    dependencyResolution?.rootKey === currentRootKey
      ? dependencyResolution.entries.flatMap(({ record: dependencyRecord }) =>
          dependencyRecord ? [dependencyRecord] : [],
        )
      : [];
  const lineageCatalog = [
    ...lineageMetrics.filter(
      (candidate) =>
        !exactDependencyRecords.some(
          (exact) =>
            exact.definition.id === candidate.definition.id &&
            exact.definition.version === candidate.definition.version,
        ),
    ),
    ...exactDependencyRecords,
  ];

  const bindLogicProperty = async (
    values: Pick<MetricPropertyBindingV1, "comment" | "display_name" | "property_name">,
  ) => {
    await bindObjectMetricLogicPropertyV1(networkId, definition.id, definition.version, {
      ...values,
      execution: { mode: "realtime" },
      metric_ref: { metric_id: definition.id, version: definition.version },
      no_data_policy: definition.result_semantics.no_data_policy,
      object_type_id: definition.owner_object_type_id,
      on_error: "unavailable",
      status: "published",
    });
    void message.success(objectMetricText("mbc21b4167a12"));
    setBindingOpen(false);
    setOwnerRefresh((current) => current + 1);
  };

  const upgradeLogicProperty = async () => {
    if (!boundProperty || !boundVersion) return;
    setUpgrading(true);
    try {
      await upgradeObjectMetricLogicPropertyV1(
        networkId,
        definition.id,
        boundProperty.name,
        definition.version,
      );
      setUpgradeConfirmOpen(false);
      setOwnerRefresh((current) => current + 1);
      void message.success(objectMetricText("bindingUpgradeSuccess"));
    } catch {
      void message.error(objectMetricText("bindingUpgradeFailed"));
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <main className={`${styles.page} ${metricTheme.scope}`}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <h1>{definition.name}</h1>
          <div className={styles.identityMeta}>
            <Select
              aria-label={objectMetricText("graphMetricVersion")}
              className={styles.versionSelect}
              onChange={(version) => {
                setUpgradeConfirmOpen(false);
                const selected = versions.find((item) => item.definition.version === version);
                if (selected) {
                  setRecord(selected);
                  void navigate(
                    `/knowledge-network/workspace/${encodeURIComponent(networkId)}/metrics/${encodeURIComponent(definition.id)}/detail?version=${version}`,
                    {
                      replace: true,
                      state: location.state as {
                        knowledgeNetworkReturnTo?: string;
                        justPublished?: boolean;
                      } | null,
                    },
                  );
                }
              }}
              options={[
                ...(draftVersions.length
                  ? [
                      {
                        label: objectMetricText("workingDraftGroup"),
                        options: draftVersions.map((item) => ({
                          label: draftLabel(item),
                          value: item.definition.version,
                        })),
                      },
                    ]
                  : []),
                ...(releasedVersions.length
                  ? [
                      {
                        label: objectMetricText("releasedVersionGroup"),
                        options: releasedVersions.map((item) => ({
                          label: `v${item.definition.version} · ${statusNames[item.definition.lifecycle.status]}`,
                          value: item.definition.version,
                        })),
                      },
                    ]
                  : []),
              ]}
              value={definition.version}
            />
            <span className={styles.metricCode}>{definition.code}</span>
          </div>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => void navigate(returnTo)}>
            {objectMetricText("me9d5ca6c1406")}
          </Button>
          <Tooltip
            title={
              isPublishedVersion
                ? objectMetricText("m7a26b9117cf8")
                : objectMetricText("m0f8ba014cedf")
            }
          >
            <Button autoInsertSpace={false} onClick={() => setTrialOpen(true)}>
              {objectMetricText(isPublishedVersion ? "analysisEntry" : "m073728637a26")}
            </Button>
          </Tooltip>
          {canAuthorizeMetric ? (
            <Button autoInsertSpace={false} onClick={() => setAuthorizeOpen(true)}>
              <KnowledgeNetworkAuthorizationActionLabel>
                {t("knowledgeNetwork.authorizeAction")}
              </KnowledgeNetworkAuthorizationActionLabel>
            </Button>
          ) : null}
          {canBindLogicProperty ? (
            <Tooltip title={objectMetricText("md320de80ff41")}>
              <Button onClick={() => setBindingOpen(true)}>
                {objectMetricText("m915fe912305c")}
              </Button>
            </Tooltip>
          ) : null}
          {canUpgradeLogicProperty ? (
            <Button onClick={() => setUpgradeConfirmOpen(true)}>
              {objectMetricText("bindingUpgradeAction")}
            </Button>
          ) : null}
          {canModify && definition.lifecycle.status !== "deprecated" ? (
            <Tooltip
              title={
                isPublishedVersion && workingDraft
                  ? objectMetricText("editWorkingDraftHint")
                  : undefined
              }
            >
              <Button
                autoInsertSpace={false}
                onClick={() => {
                  void (async () => {
                    if (isPublishedVersion && !workingDraft) {
                      await createNextObjectMetricDraftV1(networkId, definition.id);
                    }
                    void navigate(
                      `/knowledge-network/workspace/${networkId}/metrics/${definition.id}/edit`,
                      { state: { knowledgeNetworkReturnTo: returnTo } },
                    );
                  })();
                }}
                type="primary"
              >
                {isPublishedVersion
                  ? workingDraft
                    ? objectMetricText("continueEditingDraft")
                    : objectMetricText("createWorkingDraftFromLatest")
                  : objectMetricText("m9d0eedd99d2b")}
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className={styles.content}>
        {(location.state as { justPublished?: boolean } | null)?.justPublished ? (
          <Alert
            message={objectMetricText("m7d6fe77cb980", { p0: definition.version })}
            type="success"
            showIcon
            closable
          />
        ) : null}
        <Card className={styles.sectionCard} title={objectMetricText("detailBasicInfo")}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label={objectMetricText("m7626be61e570")}>
              <Tag color="blue">{typeNames[definition.metric_type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m6320b4a8722a")}>
              <Tag color={definition.lifecycle.status === "published" ? "success" : "default"}>
                {statusNames[definition.lifecycle.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m26c439016066")}>
              {ownerObjectTypeName ||
                (ownerObjectType === undefined
                  ? objectMetricText("bindingLoading")
                  : objectMetricText("restrictedOwnerName"))}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("mec7844e49915")}>
              {definition.calculation_scope === "object_instance"
                ? objectMetricText("mabe9d02781fc")
                : objectMetricText("m9c51e86f9307")}
              {definition.calculation_scope === "object_instance" ? (
                <span className={styles.inlineBinding}>
                  {objectMetricText("bindingStatusLabel")}：{bindingStatus}
                </span>
              ) : null}
            </Descriptions.Item>
          </Descriptions>
          <div className={styles.businessDefinition}>
            <div className={styles.businessDefinitionLabel}>
              {objectMetricText("m419eb90613fd")}
            </div>
            <div className={styles.businessDefinitionContent}>{definition.description}</div>
          </div>
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("m6c7b29b8b211")}>
          {specification.kind === "atomic" ? (
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={objectMetricText("mb17e03bc6bad")}>
                {objectMetricAggregationDisplayName(specification.measure.aggregation)}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("me92a76d3b298")}>
                {expression ? (
                  <Tooltip title={expressionLabel(expression)}>
                    <span>{expressionLabel(expression, displayProperty)}</span>
                  </Tooltip>
                ) : (
                  objectMetricText("m21179deb9a74")
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "derived" ? (
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={objectMetricText("m4919ba2e9c0b")}>
                <span className={styles.metricReference}>
                  <span className={styles.metricReferenceVersion}>
                    v{specification.base_metric.version}
                  </span>
                  <span className={styles.metricReferenceName}>
                    {lineageCatalog.find(
                      (item) =>
                        item.definition.id === specification.base_metric.metric_id &&
                        item.definition.version === specification.base_metric.version,
                    )?.definition.name ?? specification.base_metric.metric_id}
                  </span>
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("me306e231fb23")}>
                {timeWindowLabel(specification.business_qualifiers.time_window)}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("m391f2f5d1034")} span={2}>
                <Tooltip
                  title={objectMetricBusinessConditionLabel(specification.business_qualifiers)}
                >
                  <span>
                    {objectMetricBusinessConditionLabel(
                      specification.business_qualifiers,
                      displayProperty,
                    )}
                  </span>
                </Tooltip>
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("mf8c41076f5dc")} span={2}>
                {specification.business_qualifiers.relation_path?.steps
                  .map((step) => relationTypeNames[step.relation_type_id] ?? step.relation_type_id)
                  .join(" → ") || objectMetricText("m21f55b7680c9")}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {specification.kind === "composite" ? (
            <>
              <Descriptions column={1}>
                <Descriptions.Item label={objectMetricText("ma6ace5b29ab9")}>
                  <Space size={[8, 8]} wrap>
                    {compositeDependencies.map(
                      ({
                        dependency,
                        error,
                        loading: dependencyLoading,
                        record: dependencyRecord,
                      }) => {
                        const detail = dependencyRecord
                          ? objectMetricText("m12e768346231", {
                              p0: dependencyRecord.definition.name,
                              p1: dependencyRecord.definition.version,
                              p2: typeNames[dependencyRecord.definition.metric_type],
                              p3: statusNames[dependencyRecord.definition.lifecycle.status],
                              p4: dependency.alias,
                            })
                          : dependencyLoading
                            ? objectMetricText("m7d9782471028", {
                                p0: dependency.metric_ref.version,
                                p1: dependency.alias,
                              })
                            : objectMetricText("mcb1ed2f66b66", {
                                p0: dependencyFailureLabel(error, dependency.metric_ref.version),
                                p1: dependency.alias,
                              });
                        return (
                          <Tooltip
                            key={`${dependency.metric_ref.metric_id}@${dependency.metric_ref.version}`}
                            title={error ? dependencyFailureDescription(error) : detail}
                          >
                            <Tag
                              color={
                                dependencyRecord ? "blue" : dependencyLoading ? "default" : "error"
                              }
                            >
                              {dependencyRecord
                                ? `${dependencyRecord.definition.name} · v${dependencyRecord.definition.version}`
                                : dependencyLoading
                                  ? objectMetricText("detailDependencyLoading", {
                                      p0: dependency.metric_ref.version,
                                    })
                                  : dependencyFailureLabel(error, dependency.metric_ref.version)}
                            </Tag>
                          </Tooltip>
                        );
                      },
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label={objectMetricText("me1126763a0f0")}>
                  {expressionLabel(
                    replaceObjectMetricDependencyAliases(
                      specification.expression,
                      compositeDependencyLabels,
                    ),
                  )}
                </Descriptions.Item>
              </Descriptions>
              <details className={styles.technicalDetails}>
                <summary>{objectMetricText("m485ac2c76c24")}</summary>
                <code>{expressionLabel(specification.expression)}</code>
              </details>
            </>
          ) : null}
        </Card>
        <Card className={styles.sectionCard} title={objectMetricText("mf006fe7f4bbf")}>
          <Descriptions
            className={styles.resultDescriptions}
            column={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
            bordered
          >
            <Descriptions.Item label={objectMetricText("m88459b43afb6")}>
              <MetricDimensionList
                key={`${definition.id}@${definition.version}:group`}
                items={definition.result_semantics.statistical_grain.group_by_dimensions.map(
                  (item) => objectMetricPropertyDisplayName(item, ownerObjectType),
                )}
                emptyText={objectMetricText(
                  definition.calculation_scope === "object_instance"
                    ? "detailNoFixedGroupForInstance"
                    : "m9f05b0e41cb5",
                )}
              />
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m0a2ce90e187a")}>
              {definition.result_semantics.statistical_grain.time_granularity
                ? `${objectMetricText(timeGranularityKeys[definition.result_semantics.statistical_grain.time_granularity])} · ${definition.result_semantics.statistical_grain.timezone ?? objectMetricText("m589d84e4cca8")}${definition.result_semantics.statistical_grain.week_start ? objectMetricText("m8dba6895a41a", { p0: objectMetricText(definition.result_semantics.statistical_grain.week_start === "monday" ? "detailWeekStartMonday" : "detailWeekStartSunday") }) : ""}`
                : objectMetricText("m484d55613910")}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("me659c05e3760")}>
              {objectMetricText(physicalTypeKeys[definition.result_semantics.value.physical_type])}
              {" / "}
              {objectMetricText(semanticTypeKeys[definition.result_semantics.value.semantic_type])}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m80b19d68b149")}>
              {definition.result_semantics.value.unit ? (
                <Tooltip title={definition.result_semantics.value.unit.code}>
                  <span>
                    {objectMetricUnitDisplayLabel(definition.result_semantics.value.unit, true)}
                  </span>
                </Tooltip>
              ) : (
                objectMetricText("m484d55613910")
              )}
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m9a004b7a1da9")}>
              <MetricDimensionList
                key={`${definition.id}@${definition.version}:analysis`}
                items={definition.query_capabilities.analysis_dimensions.map((item) =>
                  objectMetricPropertyDisplayName(item, ownerObjectType),
                )}
                emptyText={objectMetricText("m484d55613910")}
              />
            </Descriptions.Item>
            <Descriptions.Item label={objectMetricText("m40e232fef99f")}>
              <MetricDimensionList
                key={`${definition.id}@${definition.version}:time`}
                items={definition.query_capabilities.time_dimensions.map((item) =>
                  objectMetricPropertyDisplayName(item, ownerObjectType),
                )}
                emptyText={objectMetricText("m484d55613910")}
              />
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Card
          className={styles.sectionCard}
          extra={
            <Tooltip
              title={objectMetricText("lineageDownstreamNotice")}
              trigger={["hover", "focus", "click"]}
            >
              <Button
                aria-label={objectMetricText("lineageDownstreamUnverified")}
                icon={<QuestionCircleOutlined />}
                size="small"
                type="text"
              >
                {objectMetricText("lineageDownstreamUnverified")}
              </Button>
            </Tooltip>
          }
          title={objectMetricText("lineageDependenciesAndReferences")}
        >
          <ObjectMetricLineagePanel
            metric={record}
            metrics={lineageCatalog}
            onOpenMetric={(relatedMetricId, version) =>
              void navigate(
                `/knowledge-network/workspace/${encodeURIComponent(networkId)}/metrics/${encodeURIComponent(relatedMetricId)}/detail?version=${version}`,
                { state: { knowledgeNetworkReturnTo: returnTo } },
              )
            }
            ownerObjectType={ownerObjectType}
          />
        </Card>
      </div>
      <ObjectMetricTrialDrawer
        definition={definition}
        mode={isPublishedVersion ? "published" : "draft"}
        networkId={networkId}
        objectType={ownerObjectType}
        onClose={() => setTrialOpen(false)}
        onRun={(query) =>
          isPublishedVersion
            ? queryObjectMetricDataV1(networkId, definition.id, definition.version, query)
            : trialObjectMetricDataV1(networkId, definition, query)
        }
        onDrillThrough={(query, bucketKey, cursor) =>
          isPublishedVersion
            ? queryObjectMetricDrillThroughV1(
                networkId,
                definition.id,
                definition.version,
                query,
                bucketKey,
                cursor,
              )
            : trialObjectMetricDrillThroughV1(networkId, definition, query, bucketKey, cursor)
        }
        open={trialOpen}
      />
      <ObjectMetricAuthorizeDrawer
        metric={record}
        networkId={networkId}
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
      />
      <Modal
        confirmLoading={upgrading}
        onCancel={() => setUpgradeConfirmOpen(false)}
        onOk={() => void upgradeLogicProperty()}
        okText={objectMetricText("bindingUpgradeAction")}
        open={upgradeConfirmOpen && canUpgradeLogicProperty}
        rootClassName={metricTheme.scope}
        title={objectMetricText("bindingUpgradeTitle")}
      >
        {objectMetricText("bindingUpgradeConfirm", { p0: boundVersion, p1: definition.version })}
      </Modal>
      <Drawer
        destroyOnHidden
        forceRender
        onClose={() => setBindingOpen(false)}
        open={bindingOpen}
        rootClassName={`${styles.drawer} ${metricTheme.scope}`}
        title={
          ownerObjectTypeName
            ? objectMetricText("m6c461a9f092b", { p0: ownerObjectTypeName })
            : objectMetricText("bindingCurrentObjectTypeTitle")
        }
        width="min(520px, calc(100vw - 24px))"
      >
        <Form
          form={bindingForm}
          layout="vertical"
          onFinish={(values) => {
            void bindLogicProperty(values);
          }}
        >
          <Form.Item
            label={objectMetricText("maac14899bd42")}
            name="property_name"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: objectMetricText("m1223e28b1644") },
            ]}
          >
            <Input placeholder={objectMetricText("m262469df7a5d")} />
          </Form.Item>
          <Form.Item
            label={objectMetricText("ma98585871c53")}
            name="display_name"
            rules={[{ required: true }]}
          >
            <Input placeholder={objectMetricText("me8b7c5d7cc73")} />
          </Form.Item>
          <Form.Item label={objectMetricText("m4262c45dc797")} name="comment">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button htmlType="submit" type="primary">
            {objectMetricText("md45097132e0d")}
          </Button>
        </Form>
      </Drawer>
    </main>
  );
}
