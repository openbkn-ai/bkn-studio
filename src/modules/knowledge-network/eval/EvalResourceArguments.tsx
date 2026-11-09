/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { caseUiText } from "./case-ui-text";
import { useEvalTranslation } from "./useEvalTranslation";
import { Alert, Button, Collapse, DatePicker, Select, Space, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { EvalCaseArguments } from "./EvalCaseArguments";
import { listCaseActionInstances, type CaseTargetSchema } from "./case-form.service";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  networkId: string;
  kind?: string;
  contract: CaseTargetSchema;
};

export function EvalResourceArguments({
  value = "{}",
  onChange,
  networkId,
  kind,
  contract,
}: Props) {
  useEvalTranslation();
  const [instances, setInstances] = useState<Record<string, unknown>[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const requestScope = useRef(0);
  const invalidateRequestScope = useCallback(() => {
    requestScope.current++;
  }, []);
  useEffect(() => {
    let active = true;
    setInstances([]);
    setCursor(undefined);
    setError(false);
    setBusy(false);
    requestScope.current++;
    if (!contract.object_type_id || contract.available === false) return;
    setBusy(true);
    listCaseActionInstances(networkId, contract.object_type_id)
      .then((page) => {
        if (active) {
          setInstances(page.rows);
          setCursor(page.nextCursor);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      invalidateRequestScope();
    };
  }, [networkId, contract.object_type_id, contract.available, generation, invalidateRequestScope]);
  let data: Record<string, unknown> = {};
  try {
    data = parsePrecisionPreservingJSON(value) as Record<string, unknown>;
  } catch {
    /* The shared editor preserves invalid advanced JSON. */
  }
  const identities = Array.isArray(data?._instance_identities) ? data._instance_identities : [];
  const selected =
    identities[0] && typeof identities[0] === "object"
      ? transformPrecisionSafeJSONRequest(identities[0])
      : undefined;
  const options = Array.from(
    new Map(
      instances
        .filter((row) => row._instance_identity && typeof row._instance_identity === "object")
        .map((row) => ({
          value: transformPrecisionSafeJSONRequest(row._instance_identity),
          label:
            [row._display, row.name, row.title].find(
              (v): v is string => typeof v === "string" && v.length > 0,
            ) || transformPrecisionSafeJSONRequest(row._instance_identity),
        }))
        .map((option) => [option.value, option]),
    ).values(),
  );
  if (selected && !options.some((option) => option.value === selected))
    options.unshift({ value: selected, label: caseUiText("currentInstance", { name: selected }) });
  const noArguments = ["relationType", "skill"].includes(kind ?? "");
  const query =
    data?.query && typeof data.query === "object" ? (data.query as Record<string, unknown>) : {};
  const time =
    query.time && typeof query.time === "object"
      ? (query.time as { start?: number; end?: number })
      : undefined;
  const hasTime = Object.hasOwn(query, "time");
  const timeValue =
    time &&
    typeof time.start === "number" &&
    typeof time.end === "number" &&
    Number.isFinite(time.start) &&
    Number.isFinite(time.end) &&
    dayjs(time.start).isValid() &&
    dayjs(time.end).isValid() &&
    time.start <= time.end
      ? ([dayjs(time.start), dayjs(time.end)] as [Dayjs, Dayjs])
      : null;
  const dimensions = (contract.metric_dimensions ?? []).map((ref) => ({
    value: transformPrecisionSafeJSONRequest(ref),
    label: `${ref.object_type_id} / ${ref.property_name}${ref.relation_path_alias ? ` (${ref.relation_path_alias})` : ""}`,
  }));
  const selectedDimensions = Array.isArray(query.group_by)
    ? query.group_by.map((ref) => transformPrecisionSafeJSONRequest(ref))
    : [];
  for (const ref of selectedDimensions)
    if (!dimensions.some((option) => option.value === ref))
      dimensions.push({ value: ref, label: caseUiText("currentDimension", { name: ref }) });
  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {contract.metric_version && (
        <Typography.Text type="secondary">
          {caseUiText("publishedVersionV")}
          {contract.metric_version}
          {caseUiText("theActualVersionIsFixedDuringRun")}
        </Typography.Text>
      )}
      {kind === "metric" && (contract.metric_time_available || hasTime) && (
        <div>
          <Typography.Text strong>{caseUiText("queryTimeRange")}</Typography.Text>
          <DatePicker.RangePicker
            showTime
            style={{ width: "100%" }}
            aria-label={caseUiText("queryTimeRange")}
            value={timeValue}
            onChange={(range) => {
              const next = { ...query };
              if (range?.[0] && range[1])
                next.time = { start: range[0].valueOf(), end: range[1].valueOf() };
              else delete next.time;
              onChange?.(transformPrecisionSafeJSONRequest({ ...data, query: next }));
            }}
          />
          {hasTime && !timeValue && (
            <Alert type="warning" message={caseUiText("theExistingTimeRangeIsInvalidSelectIt")} />
          )}
        </div>
      )}
      {kind === "metric" && dimensions.length > 0 && (
        <div>
          <Typography.Text strong>{caseUiText("analysisDimensionsOptional")}</Typography.Text>
          <Select
            aria-label={caseUiText("analysisDimensions")}
            mode="multiple"
            style={{ width: "100%" }}
            options={dimensions}
            value={selectedDimensions}
            onChange={(refs) => {
              const next = { ...query };
              if (refs.length)
                next.group_by = refs.map((ref: string) => parsePrecisionPreservingJSON(ref));
              else delete next.group_by;
              onChange?.(transformPrecisionSafeJSONRequest({ ...data, query: next }));
            }}
          />
        </div>
      )}
      {contract.object_type_id && (
        <div>
          <Typography.Text strong>{caseUiText("executionInstanceRequired")}</Typography.Text>
          <Select
            aria-label={caseUiText("executionInstance")}
            style={{ width: "100%" }}
            showSearch
            optionFilterProp="label"
            allowClear
            loading={busy}
            placeholder={caseUiText("selectAnInstanceVisibleToYourAccount")}
            value={selected}
            options={options}
            onChange={(identity) => {
              const next = { ...data };
              if (identity) next._instance_identities = [parsePrecisionPreservingJSON(identity)];
              else delete next._instance_identities;
              onChange?.(transformPrecisionSafeJSONRequest(next));
            }}
          />
          {error && (
            <Alert
              type="error"
              showIcon
              message={caseUiText("knowledgeNetwork.eval.relationChecks.instanceError")}
              action={
                <Button size="small" onClick={() => setGeneration((g) => g + 1)}>
                  {caseUiText("knowledgeNetwork.eval.suiteCaseUi.retry")}
                </Button>
              }
            />
          )}
          {cursor && (
            <Button
              type="link"
              loading={busy}
              onClick={() => {
                void (async () => {
                  const scope = requestScope.current;
                  setBusy(true);
                  try {
                    const page = await listCaseActionInstances(
                      networkId,
                      contract.object_type_id!,
                      cursor,
                    );
                    if (requestScope.current !== scope) return;
                    setInstances((rows) =>
                      Array.from(
                        new Map(
                          [...rows, ...page.rows].map((row) => [
                            transformPrecisionSafeJSONRequest(row._instance_identity),
                            row,
                          ]),
                        ).values(),
                      ),
                    );
                    setCursor(page.nextCursor);
                    setError(false);
                  } catch {
                    if (requestScope.current === scope) setError(true);
                  } finally {
                    if (requestScope.current === scope) setBusy(false);
                  }
                })();
              }}
            >
              {caseUiText("knowledgeNetwork.eval.relationChecks.loadMore")}
            </Button>
          )}
          {!busy && !error && !options.length && (
            <Typography.Text type="secondary">
              {caseUiText("noSelectableInstancesWereFoundCheckTheData")}
            </Typography.Text>
          )}
        </div>
      )}
      {kind === "metric" && (query.cursor || query.bucket_selection) ? (
        <Typography.Text type="warning">
          {caseUiText("cursorOrBucketContextIsConfiguredCheckIn")}
        </Typography.Text>
      ) : null}
      {noArguments ? (
        <Typography.Text type="secondary">
          {caseUiText("noCallParametersAreRequiredForThisCheck")}
        </Typography.Text>
      ) : kind === "metric" ? (
        <Collapse
          size="small"
          items={[
            {
              key: "query",
              label: caseUiText("otherQuerySettingsOptional"),
              children: (
                <EvalCaseArguments
                  value={value}
                  onChange={onChange}
                  schema={contract.input}
                  hiddenFields={[
                    "query.time",
                    ...(dimensions.length ? ["query.group_by"] : []),
                    "query.cursor",
                    "query.bucket_selection",
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <EvalCaseArguments
          value={value}
          onChange={onChange}
          schema={contract.input}
          hiddenFields={["_instance_identities", ...(kind === "metric" ? ["query.time"] : [])]}
        />
      )}
    </Space>
  );
}
