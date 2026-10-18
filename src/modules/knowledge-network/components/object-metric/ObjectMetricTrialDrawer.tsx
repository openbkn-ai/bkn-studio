/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  Alert,
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
  objectMetricAggregationDisplayName,
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

function displayMetricDrillStep(
  entry: ObjectMetricDataV1["entries"][number],
  parent: ObjectMetricDataV1["entries"][number] | undefined,
  propertyLabels: Record<string, string>,
  identityLabels: Record<string, string>,
): string {
  if (parent?.dimension_cells?.length && entry.dimension_cells?.length) {
    const addedCells = entry.dimension_cells.filter(
      (cell) =>
        !parent.dimension_cells?.some(
          (previous) =>
            dimensionReferenceKey(previous.ref) === dimensionReferenceKey(cell.ref) &&
            sameMetricScalarValue(previous.value, cell.value),
        ),
    );
    if (addedCells.length) {
      return displayMetricDimensions({ ...entry, dimension_cells: addedCells }, propertyLabels);
    }
  }
  return displayMetricBucket(entry, propertyLabels, identityLabels);
}

function bucketAddsNewConstraint(
  entry: ObjectMetricDataV1["entries"][number],
  previous: ObjectMetricDataV1["entries"],
): boolean {
  for (const [name, value] of Object.entries(entry.instance_identity ?? {})) {
    if (!previous.some((item) => sameMetricScalarValue(item.instance_identity?.[name], value)))
      return true;
  }
  if (entry.dimension_cells?.length) {
    for (const cell of entry.dimension_cells) {
      if (
        !previous.some((item) =>
          item.dimension_cells?.some(
            (prior) =>
              dimensionReferenceKey(prior.ref) === dimensionReferenceKey(cell.ref) &&
              sameMetricScalarValue(prior.value, cell.value),
          ),
        )
      )
        return true;
    }
  } else {
    for (const [name, value] of Object.entries(entry.dimensions ?? {})) {
      if (!previous.some((item) => sameMetricScalarValue(item.dimensions?.[name], value)))
        return true;
    }
  }
  if (entry.time !== undefined && !previous.some((item) => item.time === entry.time)) return true;
  if (
    entry.time_bucket &&
    !previous.some(
      (item) =>
        item.time_bucket?.start === entry.time_bucket?.start &&
        item.time_bucket?.end === entry.time_bucket?.end,
    )
  )
    return true;
  return false;
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
    Array<{
      query: ObjectMetricQueryRequestV1;
      result: ObjectMetricDataV1;
      label: string;
      sourceBucket?: ObjectMetricDataV1["entries"][number];
    }>
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
  const hasInstanceColumn = result?.entries.some((entry) => entry.instance_identity) ?? false;
  const tableDimensionFields = useMemo(() => {
    const fields = new Map<
      string,
      { key: string; title: string; propertyName: string; referenceKey?: string }
    >();
    for (const entry of result?.entries ?? []) {
      if (entry.dimension_cells?.length) {
        for (const { ref } of entry.dimension_cells) {
          const referenceKey = dimensionReferenceKey(ref);
          if (fields.has(referenceKey)) continue;
          const name = propertyLabels[ref.property_name] || ref.property_name;
          fields.set(referenceKey, {
            key: referenceKey,
            title: ref.relation_path_alias ? `${name} (${ref.relation_path_alias})` : name,
            propertyName: ref.property_name,
            referenceKey,
          });
        }
      } else {
        for (const propertyName of Object.keys(entry.dimensions ?? {})) {
          const key = `legacy:${propertyName}`;
          if (fields.has(key)) continue;
          fields.set(key, {
            key,
            title: propertyLabels[propertyName] || propertyName,
            propertyName,
          });
        }
      }
    }
    return Array.from(fields.values());
  }, [propertyLabels, result?.entries]);
  const hasTimeColumn =
    result?.entries.some((entry) => entry.time !== undefined || entry.time_bucket) ?? false;
  const hasStatusColumn = result?.entries.some((entry) => entry.status !== "ok") ?? false;
  const usesFixedDerivedTimeWindow =
    definition.specification.kind === "derived" &&
    definition.specification.business_qualifiers.time_window?.mode !== undefined &&
    definition.specification.business_qualifiers.time_window.mode !== "unbounded";
  const supportsRuntimeTimeRange = definition.query_capabilities.time_dimensions.length === 1;
  const timeNoticeKey = usesFixedDerivedTimeWindow
    ? "m80365c614b62"
    : supportsRuntimeTimeRange
      ? undefined
      : definition.query_capabilities.time_dimensions.length > 1
        ? "analysisTimeAmbiguous"
        : "analysisTimeUnavailable";
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
      setNextDimension(undefined);
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
  const canFilterSelected =
    selected !== undefined &&
    Boolean(selected.bucket_key && selected.available_actions?.includes("filter")) &&
    bucketAddsNewConstraint(
      selected,
      history.flatMap((item) => (item.sourceBucket ? [item.sourceBucket] : [])),
    );
  const drill = async (dimension?: string) => {
    if (!selected?.bucket_key || !currentQuery) return;
    if (!dimension && !canFilterSelected) return;
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
          label: displayMetricDrillStep(
            selected,
            items.at(-1)?.sourceBucket,
            propertyLabels,
            identityLabels,
          ),
          sourceBucket: selected,
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

  const returnToHistory = (index: number) => {
    const item = history[index];
    if (!item) return;
    setHistory((items) => items.slice(0, index + 1));
    setResult(item.result);
    setSelected(undefined);
    setNextDimension(undefined);
    setError(undefined);
    setParticipantsOpen(false);
  };

  const pathControls =
    history.length > 1 ? (
      <nav aria-label={objectMetricText("analysisPath")} className={styles.analysisPath}>
        <span className={styles.analysisPathLabel}>{objectMetricText("analysisPath")}</span>
        <ol className={styles.analysisPathSteps}>
          {history.map((item, index) => {
            const isCurrent = index === history.length - 1;
            return (
              <li className={styles.analysisPathStep} key={index}>
                {index > 0 ? (
                  <span aria-hidden="true" className={styles.analysisPathSeparator}>
                    ›
                  </span>
                ) : null}
                {isCurrent ? (
                  <span aria-current="step" className={styles.analysisPathCurrent}>
                    <span className={styles.analysisPathCurrentLabel}>
                      {objectMetricText("analysisCurrentLevel")}
                    </span>
                    <span>{item.label}</span>
                  </span>
                ) : (
                  <button
                    className={styles.analysisPathLink}
                    onClick={() => returnToHistory(index)}
                    type="button"
                  >
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <Button
          className={styles.analysisPathBack}
          onClick={() => returnToHistory(history.length - 2)}
          size="small"
        >
          {objectMetricText("analysisBackLevel")}
        </Button>
      </nav>
    ) : null;

  return (
    <Drawer
      rootClassName={`${metricTheme.scope} ${mode === "published" ? styles.analysisDrawer : ""}`}
      destroyOnHidden
      footer={
        mode === "draft" ? (
          <div className={styles.footer}>
            <Button
              aria-label={objectMetricText("m073728637a26")}
              disabled={
                definition.calculation_scope === "object_instance" &&
                !objectType?.primaryKeys.length
              }
              form={formId}
              htmlType="submit"
              loading={loading}
              type="primary"
            >
              {objectMetricText("m073728637a26")}
            </Button>
          </div>
        ) : null
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
      width={mode === "published" ? "min(1200px, 100vw)" : "min(760px, calc(100vw - 24px))"}
    >
      <div className={mode === "published" ? styles.analysisWorkspace : styles.trialWorkspace}>
        <section className={styles.conditions}>
          <div className={styles.conditionsHeading}>
            <div className={styles.conditionsIntro}>
              <h3 className={styles.sectionTitle}>
                {objectMetricText(mode === "published" ? "analysisConditions" : "trialConditions")}
              </h3>
              {mode === "published" && timeNoticeKey ? (
                <p className={styles.fixedTimeNotice}>{objectMetricText(timeNoticeKey)}</p>
              ) : null}
            </div>
            {mode === "published" ? (
              <Button
                className={styles.conditionsRunButton}
                disabled={
                  definition.calculation_scope === "object_instance" &&
                  !objectType?.primaryKeys.length
                }
                form={formId}
                htmlType="submit"
                loading={loading}
                type="primary"
              >
                {objectMetricText("analysisRun")}
              </Button>
            ) : null}
          </div>
          <Form
            className={`${styles.form} ${
              mode === "published" && timeNoticeKey && definition.calculation_scope === "object_set"
                ? styles.noTimeForm
                : ""
            }`}
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
            {timeNoticeKey ? (
              mode === "draft" ? (
                <p className={styles.fixedTimeNotice}>{objectMetricText(timeNoticeKey)}</p>
              ) : null
            ) : (
              <Form.Item
                label={objectMetricText("m76a5dbc71e2b")}
                name="time"
                tooltip={objectMetricText("mb4dd619d5bbc")}
              >
                <DatePicker.RangePicker
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder={[
                    objectMetricText("analysisStartDateTime"),
                    objectMetricText("analysisEndDateTime"),
                  ]}
                  showTime
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
            {definition.calculation_scope === "object_set" &&
            definition.query_capabilities.analysis_dimensions.length > 0 ? (
              <Form.Item
                label={objectMetricText("m2acf103ad6cf")}
                name="analysisDimensions"
                tooltip={objectMetricText("trialDimensionHint")}
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
        </section>
        <div className={styles.analysisMain}>
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
                    {result.evaluated_at ? (
                      <span>
                        {objectMetricText("analysisEvaluatedAt")}:{" "}
                        {formatMetricTimeLabel(result.evaluated_at)}
                      </span>
                    ) : null}
                    <span>{objectMetricText("m164ba48e7c5d", { p0: result.overall_ms })}</span>
                  </div>
                ) : null}
              </div>
              {error ? <Alert message={error} showIcon type="error" /> : null}
              {result ? (
                <Space direction="vertical" size={16} className={styles.resultContent}>
                  {result.warnings?.length ? (
                    <Alert message={result.warnings.join("；")} showIcon type="warning" />
                  ) : null}
                  <ObjectMetricAnalysisPanel
                    identityLabels={identityLabels}
                    pathControls={pathControls}
                    propertyLabels={propertyLabels}
                    result={result}
                    onSelectEntry={(entry) => {
                      setSelected(entry);
                      setNextDimension(undefined);
                    }}
                    selectionControls={
                      selected?.bucket_key ? (
                        <div
                          aria-live="polite"
                          className={styles.bucketActions}
                          ref={bucketActionsRef}
                        >
                          <strong>
                            {objectMetricText("analysisSelectedBucket")}:{" "}
                            {displayMetricBucket(selected, propertyLabels, identityLabels)}
                          </strong>
                          <Space wrap>
                            {canFilterSelected ? (
                              <Button loading={loading} onClick={() => void drill()} size="small">
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
                                  size="small"
                                  style={{ minWidth: 160 }}
                                  value={nextDimension}
                                />
                                <Button
                                  disabled={!nextDimension}
                                  loading={loading}
                                  onClick={() => void drill(nextDimension)}
                                  size="small"
                                >
                                  {objectMetricText("analysisDrill")}
                                </Button>
                              </>
                            ) : null}
                            {selected.available_actions?.includes("participants") &&
                            onDrillThrough ? (
                              <Button
                                loading={participantsLoading}
                                onClick={() => void loadParticipants()}
                                size="small"
                              >
                                {objectMetricText("analysisParticipants")}
                              </Button>
                            ) : null}
                            <Button onClick={() => setContextOpen(true)} size="small">
                              {objectMetricText("analysisContext")}
                            </Button>
                            {!canFilterSelected &&
                            (!selected.available_actions?.includes("drill") ||
                              !availableDimensions.length) ? (
                              <span className={styles.bucketTerminalHint}>
                                {objectMetricText("analysisTerminalHint")}
                              </span>
                            ) : null}
                          </Space>
                        </div>
                      ) : hasSelectableBuckets ? (
                        <div className={styles.bucketHint}>
                          {objectMetricText("analysisSelectBucketHint")}
                        </div>
                      ) : null
                    }
                    resultTable={
                      <div className={styles.resultTable}>
                        <div className={styles.resultTableSummary} role="status">
                          <span>
                            {objectMetricText("analysisTableCount", {
                              p0: result.entries.length,
                            })}
                          </span>
                          <span>
                            {result.status === "partial"
                              ? objectMetricText("analysisTablePartial")
                              : result.entries.length > 50
                                ? objectMetricText("analysisTableLocalPages")
                                : objectMetricText("analysisTableLoaded")}
                          </span>
                        </div>
                        <Table
                          columns={[
                            ...(hasInstanceColumn
                              ? [
                                  {
                                    dataIndex: "instance_identity",
                                    key: "instance_identity",
                                    render: (value: Record<string, unknown> | undefined) =>
                                      displayMetricFields(value, identityLabels),
                                    title: objectMetricText("m99fc84c8b8ae"),
                                  },
                                ]
                              : []),
                            ...tableDimensionFields.map((field) => ({
                              key: field.key,
                              render: (
                                _value: unknown,
                                entry: ObjectMetricDataV1["entries"][number],
                              ) =>
                                displayMetricValue(
                                  field.referenceKey
                                    ? entry.dimension_cells?.find(
                                        ({ ref }) =>
                                          dimensionReferenceKey(ref) === field.referenceKey,
                                      )?.value
                                    : entry.dimensions?.[field.propertyName],
                                ),
                              title: field.title,
                            })),
                            ...(hasTimeColumn
                              ? [
                                  {
                                    dataIndex: "time",
                                    key: "time",
                                    render: (
                                      _value: number | undefined,
                                      entry: ObjectMetricDataV1["entries"][number],
                                    ) => {
                                      const value = entry.time_bucket?.start ?? entry.time;
                                      return value !== undefined
                                        ? formatMetricTimeLabel(value)
                                        : "—";
                                    },
                                    title: objectMetricText("mbf80e223ad96"),
                                  },
                                ]
                              : []),
                            {
                              dataIndex: "value",
                              key: "value",
                              render: displayMetricValue,
                              title: objectMetricText("m6018e00aca78"),
                            },
                            ...(hasStatusColumn
                              ? [
                                  {
                                    dataIndex: "status",
                                    key: "status",
                                    render: (
                                      status: ObjectMetricDataV1["entries"][number]["status"],
                                    ) => trialStatusLabel(status),
                                    title: objectMetricText("m0d9a32dba031"),
                                  },
                                ]
                              : []),
                          ]}
                          dataSource={tableEntries}
                          onRow={(entry) => ({
                            "aria-selected": Boolean(
                              entry.bucket_key && selected?.bucket_key === entry.bucket_key,
                            ),
                            onClick: () => {
                              if (entry.bucket_key) {
                                setSelected(entry);
                                setNextDimension(undefined);
                              }
                            },
                            onKeyDown: (event) => {
                              if (
                                entry.bucket_key &&
                                (event.key === "Enter" || event.key === " ")
                              ) {
                                event.preventDefault();
                                setSelected(entry);
                                setNextDimension(undefined);
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
                            result.entries.length > 50
                              ? { pageSize: 50, showSizeChanger: false }
                              : false
                          }
                          scroll={{ x: Math.max(680, 180 + tableDimensionFields.length * 180) }}
                          size="small"
                        />
                      </div>
                    }
                  />
                </Space>
              ) : null}
            </div>
          ) : mode === "published" ? (
            <div className={styles.readyHint}>{objectMetricText("analysisReadyHint")}</div>
          ) : null}
        </div>
      </div>
      <Drawer
        destroyOnHidden
        onClose={() => setParticipantsOpen(false)}
        open={participantsOpen}
        title={`${objectMetricText("analysisParticipants")} · ${
          selected ? displayMetricBucket(selected, propertyLabels, identityLabels) : ""
        }`}
        width="min(620px, 100vw)"
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
      </Drawer>
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
                  ? objectMetricAggregationDisplayName(definition.specification.measure.aggregation)
                  : "—",
            },
            {
              key: "scope",
              label: objectMetricText("analysisScope"),
              children:
                definition.calculation_scope === "object_instance"
                  ? objectMetricText("mabe9d02781fc")
                  : objectMetricText("m9c51e86f9307"),
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
