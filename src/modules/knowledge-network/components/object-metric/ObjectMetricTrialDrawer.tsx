/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
  Breadcrumb,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { extractRequestErrorDetails } from "@/framework/request/error-message";
import { ObjectMetricAnalysisPanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel";
import { formatMetricTimeLabel } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  ObjectMetricDataV1,
  ObjectMetricDefinitionV1,
  ObjectMetricDrillThroughV1,
  ObjectMetricQueryRequestV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import {
  objectMetricBusinessConditionLabel,
  objectMetricConditionLabel,
} from "@/modules/knowledge-network/lib/object-metric-condition-label";
import {
  objectMetricPropertyDisplayLabels,
  objectMetricPropertyDisplayName,
} from "@/modules/knowledge-network/lib/object-metric-display";
import metricTheme from "./ObjectMetricTheme.module.css";
import styles from "./ObjectMetricTrialDrawer.module.css";
import { useTranslation } from "react-i18next";

type TrialFormValues = {
  analysisDimensions?: string[];
  identity?: Record<string, string>;
  time?: [import("dayjs").Dayjs, import("dayjs").Dayjs];
};

function dimensionReferenceKey(reference: {
  object_type_id: string;
  property_name: string;
  relation_path_alias?: string;
}): string {
  return JSON.stringify([
    reference.object_type_id,
    reference.relation_path_alias ?? "",
    reference.property_name,
  ]);
}

type ObjectMetricTrialDrawerProps = {
  definition: ObjectMetricDefinitionV1;
  mode: "draft" | "published";
  networkId?: string;
  objectType?: ObjectTypeDetail | null;
  onClose: () => void;
  onRun: (query: ObjectMetricQueryRequestV1) => Promise<ObjectMetricDataV1>;
  onDrillThrough?: (
    query: ObjectMetricQueryRequestV1,
    bucketKey: string,
    cursor?: string,
  ) => Promise<ObjectMetricDrillThroughV1>;
  open: boolean;
};

function parseIdentityValue(value: string, type?: string): unknown {
  const normalized = type?.toLowerCase();
  if (["integer", "int", "int32", "int64", "long"].includes(normalized ?? "")) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : value;
  }
  if (["decimal", "double", "float", "number"].includes(normalized ?? "")) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (["bool", "boolean"].includes(normalized ?? "")) return value === "true";
  return value;
}

function displayMetricValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return "—";
}

function sameMetricScalarValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const scalar = (value: unknown): value is string | number | bigint =>
    typeof value === "string" || typeof value === "number" || typeof value === "bigint";
  return scalar(left) && scalar(right) && String(left) === String(right);
}

function displayMetricFields(
  value: Record<string, unknown> | undefined,
  propertyLabels: Record<string, string>,
): string {
  if (!value || !Object.keys(value).length) return "—";
  return Object.entries(value)
    .map(([key, fieldValue]) => `${propertyLabels[key] || key}: ${displayMetricValue(fieldValue)}`)
    .join("、");
}

function displayMetricDimensions(
  entry: ObjectMetricDataV1["entries"][number],
  propertyLabels: Record<string, string>,
): string {
  if (!entry.dimension_cells?.length) return displayMetricFields(entry.dimensions, propertyLabels);
  return entry.dimension_cells
    .map(({ ref, value }) => {
      const name = propertyLabels[ref.property_name] || ref.property_name;
      return `${ref.relation_path_alias ? `${name} (${ref.relation_path_alias})` : name}: ${displayMetricValue(value)}`;
    })
    .join("、");
}

function displayMetricBucket(
  entry: ObjectMetricDataV1["entries"][number],
  propertyLabels: Record<string, string>,
  identityLabels: Record<string, string>,
): string {
  const dimensions = displayMetricDimensions(entry, propertyLabels);
  if (dimensions !== "—") return dimensions;
  if (entry.time_bucket) return formatMetricTimeLabel(entry.time_bucket.start);
  if (entry.instance_identity) return displayMetricFields(entry.instance_identity, identityLabels);
  return objectMetricText("analysisAllData");
}

function trialErrorMessage(error: unknown): string {
  const details = extractRequestErrorDetails(error);
  if (details.details?.includes("requires numeric operands")) {
    return objectMetricText("mbaea9b35162e");
  }
  if (details.details?.includes("to_number")) {
    return objectMetricText("m228e2f6a7e9d");
  }
  return details.details ? `${details.description}：${details.details}` : details.description;
}

function trialStatusLabel(
  status: ObjectMetricDataV1["status"] | ObjectMetricDataV1["entries"][number]["status"],
): string {
  return objectMetricText(
    (
      {
        ok: "trialStatusSuccess",
        no_data: "trialStatusNoData",
        partial: "trialStatusPartial",
        unavailable: "trialStatusUnavailable",
      } as const
    )[status],
  );
}

export function ObjectMetricTrialDrawer({
  definition,
  mode,
  networkId,
  objectType,
  onClose,
  onRun,
  onDrillThrough,
  open,
}: ObjectMetricTrialDrawerProps) {
  useTranslation();
  const [form] = Form.useForm<TrialFormValues>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ObjectMetricDataV1>();
  const [history, setHistory] = useState<
    Array<{ query: ObjectMetricQueryRequestV1; result: ObjectMetricDataV1; label: string }>
  >([]);
  const [selected, setSelected] = useState<ObjectMetricDataV1["entries"][number]>();
  const [nextDimension, setNextDimension] = useState<string>();
  const [participants, setParticipants] = useState<ObjectMetricDrillThroughV1>();
  const [participantsPage, setParticipantsPage] = useState(1);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const bucketActionsRef = useRef<HTMLDivElement>(null);
  const formId = `metric-trial-${definition.id}-${definition.version}`;
  const identityLabels = useMemo(() => objectMetricPropertyDisplayLabels(objectType), [objectType]);
  const propertyLabels = useMemo(
    () =>
      objectMetricPropertyDisplayLabels(
        objectType,
        definition.query_capabilities.analysis_dimensions,
      ),
    [definition.query_capabilities.analysis_dimensions, objectType],
  );
  const tableEntries = useMemo(
    () => result?.entries.map((item, index) => ({ ...item, key: index })) ?? [],
    [result?.entries],
  );
  const usesFixedDerivedTimeWindow =
    definition.specification.kind === "derived" &&
    definition.specification.business_qualifiers.time_window?.mode !== undefined &&
    definition.specification.business_qualifiers.time_window.mode !== "unbounded";
  const supportsRuntimeTimeRange = definition.query_capabilities.time_dimensions.length === 1;
  const hasSelectableBuckets = result?.entries.some((entry) => Boolean(entry.bucket_key)) ?? false;

  useEffect(() => {
    if (result || error)
      resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [error, result]);

  useEffect(() => {
    if (selected?.bucket_key)
      bucketActionsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const run = async (values: TrialFormValues) => {
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      const identity = Object.fromEntries(
        objectType?.primaryKeys.map((name) => {
          const property = objectType.dataProperties.find((item) => item.name === name);
          return [name, parseIdentityValue(values.identity?.[name] ?? "", property?.type)];
        }) ?? [],
      );
      const query: ObjectMetricQueryRequestV1 = {
        analysis_dimensions: definition.query_capabilities.analysis_dimensions.filter((item) =>
          values.analysisDimensions?.includes(dimensionReferenceKey(item)),
        ),
        instance_identities:
          definition.calculation_scope === "object_instance" ? [identity] : undefined,
        time:
          supportsRuntimeTimeRange && values.time
            ? { start: values.time[0].valueOf(), end: values.time[1].valueOf() }
            : undefined,
      };
      const nextResult = await onRun(query);
      setResult(nextResult);
      setHistory([{ query, result: nextResult, label: objectMetricText("analysisRoot") }]);
      setSelected(undefined);
    } catch (requestError) {
      setError(trialErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const currentQuery = history.at(-1)?.query;
  const availableDimensions = definition.query_capabilities.analysis_dimensions.filter(
    (item) =>
      !currentQuery?.analysis_dimensions?.some(
        (chosen) => dimensionReferenceKey(chosen) === dimensionReferenceKey(item),
      ),
  );
  const drill = async (dimension?: string) => {
    if (!selected?.bucket_key || !currentQuery) return;
    const ref = definition.query_capabilities.analysis_dimensions.find(
      (item) => dimensionReferenceKey(item) === dimension,
    );
    if (dimension && !ref) return;
    const query: ObjectMetricQueryRequestV1 = {
      ...currentQuery,
      analysis_dimensions: [...(currentQuery.analysis_dimensions ?? []), ...(ref ? [ref] : [])],
      bucket_selection: { parent_query: currentQuery, bucket_key: selected.bucket_key },
    };
    setLoading(true);
    setError(undefined);
    try {
      const nextResult = await onRun(query);
      setHistory((items) => [
        ...items,
        {
          query,
          result: nextResult,
          label: displayMetricBucket(selected, propertyLabels, identityLabels),
        },
      ]);
      setResult(nextResult);
      setSelected(undefined);
      setNextDimension(undefined);
    } catch (requestError) {
      setError(trialErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async (cursor?: string) => {
    if (!onDrillThrough || !selected?.bucket_key || !currentQuery) return;
    setParticipantsLoading(true);
    setError(undefined);
    try {
      const page = await onDrillThrough(currentQuery, selected.bucket_key, cursor);
      setParticipantsPage(
        cursor && participants ? Math.floor(participants.participants.length / 20) + 1 : 1,
      );
      setParticipants((previous) =>
        cursor && previous
          ? {
              ...page,
              participants: [...previous.participants, ...page.participants],
            }
          : page,
      );
      setParticipantsOpen(true);
    } catch (requestError) {
      setError(trialErrorMessage(requestError));
    } finally {
      setParticipantsLoading(false);
    }
  };

  return (
    <Drawer
      rootClassName={metricTheme.scope}
      destroyOnHidden
      footer={
        <div className={styles.footer}>
          <Button
            aria-label={objectMetricText(mode === "published" ? "analysisRun" : "m073728637a26")}
            disabled={
              definition.calculation_scope === "object_instance" && !objectType?.primaryKeys.length
            }
            form={formId}
            htmlType="submit"
            loading={loading}
            type="primary"
          >
            {objectMetricText(mode === "published" ? "analysisRun" : "m073728637a26")}
          </Button>
        </div>
      }
      forceRender
      onClose={onClose}
      open={open}
      title={
        <div className={styles.title}>
          <span>
            {objectMetricText(mode === "published" ? "analysisTitle" : "trialTitle", {
              p0: definition.name || objectMetricText("ma8da957c687c"),
            })}
          </span>
          <Tag>
            {objectMetricText(
              (
                {
                  draft: "m2a2fd29bd27a",
                  validated: "m1936eafc0c3c",
                  published: "md334724d6b2f",
                  deprecated: "m1948aabb85ed",
                } as const
              )[definition.lifecycle.status],
            )}
            {mode === "published" ? ` · v${definition.version}` : null}
          </Tag>
        </div>
      }
      width="min(760px, calc(100vw - 24px))"
    >
      <h3 className={styles.sectionTitle}>
        {objectMetricText(mode === "published" ? "analysisConditions" : "trialConditions")}
      </h3>
      <Form
        className={styles.form}
        form={form}
        id={formId}
        layout="vertical"
        onFinish={(values) => void run(values)}
      >
        {definition.calculation_scope === "object_instance" ? (
          objectType?.primaryKeys.length ? (
            objectType.primaryKeys.map((name) => {
              const property = objectType.dataProperties.find((item) => item.name === name);
              return (
                <Form.Item
                  key={name}
                  label={property?.displayName || name}
                  name={["identity", name]}
                  rules={[{ required: true, message: objectMetricText("m803fff99642e") }]}
                  tooltip={
                    property?.displayName && property.displayName !== name ? name : undefined
                  }
                >
                  <Input
                    placeholder={objectMetricText("m52a8e4de05d5", {
                      p0: property?.displayName || name,
                    })}
                  />
                </Form.Item>
              );
            })
          ) : (
            <Alert message={objectMetricText("md23ea9c2fae2")} type="error" showIcon />
          )
        ) : null}
        {usesFixedDerivedTimeWindow ? (
          <p className={styles.fixedTimeNotice}>{objectMetricText("m80365c614b62")}</p>
        ) : supportsRuntimeTimeRange ? (
          <Form.Item
            label={objectMetricText("m76a5dbc71e2b")}
            name="time"
            tooltip={objectMetricText("mb4dd619d5bbc")}
          >
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        ) : (
          <p className={styles.fixedTimeNotice}>
            {objectMetricText(
              definition.query_capabilities.time_dimensions.length > 1
                ? "analysisTimeAmbiguous"
                : "analysisTimeUnavailable",
            )}
          </p>
        )}
        {definition.calculation_scope === "object_set" &&
        definition.query_capabilities.analysis_dimensions.length > 0 ? (
          <Form.Item
            extra={objectMetricText("trialDimensionHint")}
            label={objectMetricText("m2acf103ad6cf")}
            name="analysisDimensions"
          >
            <Select
              mode="multiple"
              options={definition.query_capabilities.analysis_dimensions.map((item) => ({
                label: item.relation_path_alias
                  ? `${objectMetricPropertyDisplayName(item, objectType)} (${item.relation_path_alias})`
                  : objectMetricPropertyDisplayName(item, objectType),
                value: dimensionReferenceKey(item),
              }))}
              placeholder={objectMetricText("m6f346a890bc4")}
            />
          </Form.Item>
        ) : null}
      </Form>
      {error || result ? (
        <div className={styles.result} ref={resultRef}>
          <div className={styles.resultHeader}>
            <h3 className={styles.sectionTitle}>
              {objectMetricText(mode === "published" ? "analysisResults" : "trialResults")}
            </h3>
            {result ? (
              <div className={styles.resultMeta}>
                <Tag
                  color={
                    result.status === "ok"
                      ? "success"
                      : result.status === "partial"
                        ? "warning"
                        : result.status === "unavailable"
                          ? "error"
                          : undefined
                  }
                >
                  {trialStatusLabel(result.status)}
                </Tag>
                <span>{objectMetricText("m164ba48e7c5d", { p0: result.overall_ms })}</span>
              </div>
            ) : null}
          </div>
          {error ? <Alert message={error} showIcon type="error" /> : null}
          {result ? (
            <Space direction="vertical" size={16} className={styles.resultContent}>
              {history.length > 1 ? (
                <Breadcrumb
                  items={history.map((item, index) => ({
                    title: (
                      <Button
                        type="link"
                        onClick={() => {
                          setHistory((items) => items.slice(0, index + 1));
                          setResult(item.result);
                          setSelected(undefined);
                        }}
                      >
                        {item.label}
                      </Button>
                    ),
                  }))}
                />
              ) : null}
              {result.warnings?.length ? (
                <Alert message={result.warnings.join("；")} showIcon type="warning" />
              ) : null}
              {result.entries.length ? (
                <>
                  <ObjectMetricAnalysisPanel
                    identityLabels={identityLabels}
                    propertyLabels={propertyLabels}
                    result={result}
                    onSelectEntry={setSelected}
                  />
                  {selected?.bucket_key ? (
                    <div aria-live="polite" className={styles.bucketActions} ref={bucketActionsRef}>
                      <strong>
                        {objectMetricText("analysisSelectedBucket")}:{" "}
                        {displayMetricBucket(selected, propertyLabels, identityLabels)}
                      </strong>
                      <Space wrap>
                        {selected.available_actions?.includes("filter") ? (
                          <Button loading={loading} onClick={() => void drill()}>
                            {objectMetricText("analysisFilterBucket")}
                          </Button>
                        ) : null}
                        {selected.available_actions?.includes("drill") &&
                        availableDimensions.length ? (
                          <>
                            <Select
                              aria-label={objectMetricText("analysisNextDimension")}
                              onChange={setNextDimension}
                              options={availableDimensions.map((item) => ({
                                label: objectMetricPropertyDisplayName(item, objectType),
                                value: dimensionReferenceKey(item),
                              }))}
                              placeholder={objectMetricText("analysisNextDimension")}
                              style={{ minWidth: 160 }}
                              value={nextDimension}
                            />
                            <Button
                              disabled={!nextDimension}
                              loading={loading}
                              onClick={() => void drill(nextDimension)}
                            >
                              {objectMetricText("analysisDrill")}
                            </Button>
                          </>
                        ) : null}
                        {selected.available_actions?.includes("participants") && onDrillThrough ? (
                          <Button
                            loading={participantsLoading}
                            onClick={() => void loadParticipants()}
                          >
                            {objectMetricText("analysisParticipants")}
                          </Button>
                        ) : null}
                        <Button onClick={() => setContextOpen(true)}>
                          {objectMetricText("analysisContext")}
                        </Button>
                      </Space>
                    </div>
                  ) : hasSelectableBuckets ? (
                    <div aria-live="polite" className={styles.bucketActions} ref={bucketActionsRef}>
                      <strong>{objectMetricText("analysisSelectBucketTitle")}</strong>
                      <span className={styles.bucketHint}>
                        {objectMetricText("analysisSelectBucketHint")}
                      </span>
                      {result.entries.some((entry) =>
                        entry.available_actions?.includes("drill"),
                      ) ? (
                        <Button disabled>{objectMetricText("analysisDrill")}</Button>
                      ) : null}
                    </div>
                  ) : null}
                  <Table
                    columns={[
                      {
                        dataIndex: "instance_identity",
                        key: "instance_identity",
                        render: (value: Record<string, unknown> | undefined) =>
                          displayMetricFields(value, identityLabels),
                        title: objectMetricText("m99fc84c8b8ae"),
                      },
                      {
                        dataIndex: "dimensions",
                        key: "dimensions",
                        render: (
                          _value: Record<string, unknown> | undefined,
                          entry: ObjectMetricDataV1["entries"][number],
                        ) => displayMetricDimensions(entry, propertyLabels),
                        title: objectMetricText("m4fa164bacd53"),
                      },
                      {
                        dataIndex: "time",
                        key: "time",
                        render: (value: number | undefined) =>
                          value ? formatMetricTimeLabel(value) : "—",
                        title: objectMetricText("mbf80e223ad96"),
                      },
                      {
                        dataIndex: "value",
                        key: "value",
                        render: displayMetricValue,
                        title: objectMetricText("m6018e00aca78"),
                      },
                      {
                        dataIndex: "status",
                        key: "status",
                        render: (status: ObjectMetricDataV1["entries"][number]["status"]) =>
                          trialStatusLabel(status),
                        title: objectMetricText("m0d9a32dba031"),
                      },
                    ]}
                    dataSource={tableEntries}
                    onRow={(entry) => ({
                      "aria-selected": Boolean(
                        entry.bucket_key && selected?.bucket_key === entry.bucket_key,
                      ),
                      onClick: () => {
                        if (entry.bucket_key) setSelected(entry);
                      },
                      onKeyDown: (event) => {
                        if (entry.bucket_key && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          setSelected(entry);
                        }
                      },
                      tabIndex: entry.bucket_key ? 0 : undefined,
                    })}
                    rowClassName={(entry) =>
                      entry.bucket_key
                        ? `${styles.selectableResultRow} ${
                            selected?.bucket_key === entry.bucket_key
                              ? styles.selectedResultRow
                              : ""
                          }`
                        : ""
                    }
                    locale={{ emptyText: objectMetricText("ma1af72fea205") }}
                    pagination={
                      result.entries.length > 50 ? { pageSize: 50, showSizeChanger: false } : false
                    }
                    scroll={{ x: 680 }}
                    size="small"
                  />
                </>
              ) : null}
            </Space>
          ) : null}
        </div>
      ) : null}
      <Modal
        footer={null}
        onCancel={() => setParticipantsOpen(false)}
        open={participantsOpen}
        title={objectMetricText("analysisParticipants")}
      >
        <p>{objectMetricText("analysisLiveNotice")}</p>
        {participants?.status === "partial" || participants?.warnings?.length ? (
          <Alert
            showIcon
            type="warning"
            message={participants.warnings?.join("；") || objectMetricText("analysisPartial")}
          />
        ) : null}
        {participants &&
        selected?.value != null &&
        participants.bucket_value != null &&
        !sameMetricScalarValue(selected.value, participants.bucket_value) ? (
          <Alert showIcon type="info" message={objectMetricText("analysisDataChanged")} />
        ) : null}
        <Table
          columns={[
            {
              title: objectMetricText("analysisInstance"),
              dataIndex: "instance_identity",
              render: (value: Record<string, unknown>) => {
                const label = displayMetricFields(value, identityLabels);
                if (!networkId || !objectType?.primaryKeys.length) return label;
                if (objectType.primaryKeys.some((key) => value[key] == null || value[key] === ""))
                  return label;
                const params = new URLSearchParams({
                  tab: "data",
                  section: "instance",
                  metricInstance: JSON.stringify(value),
                });
                return (
                  <Button
                    type="link"
                    href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/knowledge-network/workspace/${encodeURIComponent(networkId)}/object-types/${encodeURIComponent(definition.owner_object_type_id)}/detail?${params}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </Button>
                );
              },
            },
            {
              title: objectMetricText("analysisRole"),
              dataIndex: "role",
              render: (role: string) =>
                role === "owner" ? objectMetricText("analysisOwnerRole") : role,
            },
          ]}
          dataSource={
            participants?.participants.map((item, index) => ({ ...item, key: index })) ?? []
          }
          pagination={{ current: participantsPage, onChange: setParticipantsPage, pageSize: 20 }}
          size="small"
        />
        {participants?.next_cursor ? (
          <Button
            loading={participantsLoading}
            onClick={() => void loadParticipants(participants.next_cursor)}
          >
            {objectMetricText("analysisLoadMore")}
          </Button>
        ) : null}
      </Modal>
      <Modal
        footer={null}
        onCancel={() => setContextOpen(false)}
        open={contextOpen}
        title={objectMetricText("analysisContext")}
      >
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: "metric", label: objectMetricText("analysisMetric"), children: definition.name },
            {
              key: "version",
              label: objectMetricText("analysisVersion"),
              children:
                mode === "published" ? `v${definition.version}` : objectMetricText("analysisDraft"),
            },
            {
              key: "aggregation",
              label: objectMetricText("analysisAggregation"),
              children:
                definition.specification.kind === "atomic"
                  ? (definition.specification.measure?.aggregation ?? "—")
                  : "—",
            },
            {
              key: "scope",
              label: objectMetricText("analysisScope"),
              children: definition.calculation_scope,
            },
            {
              key: "dimensions",
              label: objectMetricText("analysisDimensions"),
              children:
                currentQuery?.analysis_dimensions
                  ?.map((item) => objectMetricPropertyDisplayName(item, objectType))
                  .join("、") || "—",
            },
            {
              key: "fixedGrain",
              label: objectMetricText("analysisFixedGrain"),
              children:
                definition.result_semantics.statistical_grain.group_by_dimensions
                  .map((item) => objectMetricPropertyDisplayName(item, objectType))
                  .join("、") || "—",
            },
            {
              key: "fixedConditions",
              label: objectMetricText("analysisFixedConditions"),
              children:
                definition.specification.kind === "derived"
                  ? objectMetricBusinessConditionLabel(
                      definition.specification.business_qualifiers,
                      (item) => objectMetricPropertyDisplayName(item, objectType),
                    )
                  : "—",
            },
            {
              key: "runtimeFilter",
              label: objectMetricText("analysisRuntimeFilter"),
              children: currentQuery?.filter
                ? objectMetricConditionLabel(currentQuery.filter, (item) =>
                    objectMetricPropertyDisplayName(item, objectType),
                  )
                : "—",
            },
            {
              key: "selectedBucket",
              label: objectMetricText("analysisSelectedBucket"),
              children: selected
                ? displayMetricBucket(selected, propertyLabels, identityLabels)
                : "—",
            },
            {
              key: "selectedTime",
              label: objectMetricText("analysisSelectedTime"),
              children: selected?.time_bucket
                ? `${formatMetricTimeLabel(selected.time_bucket.start)} — ${formatMetricTimeLabel(selected.time_bucket.end)}`
                : "—",
            },
            {
              key: "time",
              label: objectMetricText("analysisTime"),
              children: currentQuery?.time
                ? `${formatMetricTimeLabel(currentQuery.time.start)} — ${formatMetricTimeLabel(currentQuery.time.end)}`
                : "—",
            },
            {
              key: "effectiveWindow",
              label: objectMetricText("analysisEffectiveWindow"),
              children: result?.effective_window
                ? `${formatMetricTimeLabel(result.effective_window.start)} — ${formatMetricTimeLabel(result.effective_window.end)}`
                : "—",
            },
            {
              key: "dependencies",
              label: objectMetricText("analysisDependencies"),
              children:
                definition.specification.kind === "derived"
                  ? `${definition.specification.base_metric.metric_id} · v${definition.specification.base_metric.version}`
                  : definition.specification.kind === "composite"
                    ? definition.specification.dependencies
                        .map(
                          (item) =>
                            `${item.alias}: ${item.metric_ref.metric_id} · v${item.metric_ref.version}`,
                        )
                        .join("、") || "—"
                    : "—",
            },
            {
              key: "evaluated",
              label: objectMetricText("analysisEvaluatedAt"),
              children: result?.evaluated_at ? formatMetricTimeLabel(result.evaluated_at) : "—",
            },
          ]}
        />
      </Modal>
    </Drawer>
  );
}
