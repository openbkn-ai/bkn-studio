/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Modal, Space, Table, Tag } from "antd";
import { useMemo, useState } from "react";

import { ObjectMetricAnalysisPanel } from "@/modules/knowledge-network/components/object-metric/ObjectMetricAnalysisPanel";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type {
  ObjectMetricDataEntryV1,
  ObjectMetricDataV1,
  ObjectMetricDrillThroughV1,
} from "@/modules/knowledge-network/types/object-metric";

import { metricCell } from "./metric-cell";
import styles from "./MetricAnalysisView.module.css";

type Props = {
  result: ObjectMetricDataV1;
  busy?: boolean;
  error?: string;
  onNextPage?: () => void;
  onParticipants?: (
    entry: ObjectMetricDataEntryV1,
    cursor?: string,
  ) => Promise<ObjectMetricDrillThroughV1>;
};

export function MetricAnalysisView({ result, busy, error, onNextPage, onParticipants }: Props) {
  const [selected, setSelected] = useState<ObjectMetricDataEntryV1>();
  const [participants, setParticipants] = useState<ObjectMetricDrillThroughV1>();
  const [participantBusy, setParticipantBusy] = useState(false);
  const [participantError, setParticipantError] = useState<string>();
  const dimensions = useMemo(() => {
    const first = result.entries.find((entry) => entry.dimension_cells?.length || entry.dimensions);
    return first?.dimension_cells?.length
      ? first.dimension_cells.map(({ ref }) => ({
          key: JSON.stringify([
            ref.object_type_id,
            ref.relation_path_alias ?? "",
            ref.property_name,
          ]),
          title: ref.relation_path_alias
            ? `${ref.relation_path_alias}.${ref.property_name}`
            : ref.property_name,
        }))
      : Object.keys(first?.dimensions ?? {}).map((key) => ({ key, title: key }));
  }, [result.entries]);
  const hasIdentity = result.entries.some((entry) => entry.instance_identity);
  const hasTime = result.entries.some((entry) => entry.time !== undefined || entry.time_bucket);

  const openParticipants = async (entry: ObjectMetricDataEntryV1, cursor?: string) => {
    if (!onParticipants || !entry.bucket_key) return;
    setSelected(entry);
    setParticipantBusy(true);
    setParticipantError(undefined);
    try {
      const next = await onParticipants(entry, cursor);
      setParticipants((previous) =>
        cursor && previous
          ? { ...next, participants: [...previous.participants, ...next.participants] }
          : next,
      );
    } catch (cause) {
      setParticipantError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setParticipantBusy(false);
    }
  };
  const resultTable = (
    <Table<ObjectMetricDataEntryV1>
      columns={[
        ...(hasIdentity
          ? [
              {
                title: objectMetricText("mcpInstance"),
                key: "identity",
                render: (_: unknown, row: ObjectMetricDataEntryV1) =>
                  metricCell(row.instance_identity),
              },
            ]
          : []),
        ...dimensions.map(({ key, title }) => ({
          title,
          key,
          render: (_: unknown, row: ObjectMetricDataEntryV1) =>
            metricCell(
              row.dimension_cells?.find(
                ({ ref }) =>
                  JSON.stringify([
                    ref.object_type_id,
                    ref.relation_path_alias ?? "",
                    ref.property_name,
                  ]) === key,
              )?.value ?? row.dimensions?.[key],
            ),
        })),
        ...(hasTime
          ? [
              {
                title: objectMetricText("mcpTime"),
                key: "time",
                render: (_: unknown, row: ObjectMetricDataEntryV1) =>
                  metricCell(row.time_bucket?.start ?? row.time),
              },
            ]
          : []),
        {
          title: objectMetricText("mcpValue"),
          key: "value",
          render: (_: unknown, row: ObjectMetricDataEntryV1) =>
            metricCell(
              (row as ObjectMetricDataEntryV1 & { display_value?: string }).display_value ??
                row.value,
            ),
        },
        {
          title: objectMetricText("mcpStatus"),
          dataIndex: "status",
          key: "status",
          render: (value: string) => <Tag>{value}</Tag>,
        },
        ...(onParticipants
          ? [
              {
                title: objectMetricText("mcpAction"),
                key: "action",
                render: (_: unknown, row: ObjectMetricDataEntryV1) =>
                  row.bucket_key && row.available_actions?.includes("participants") ? (
                    <Button onClick={() => void openParticipants(row)} size="small" type="link">
                      {objectMetricText("mcpParticipants")}
                    </Button>
                  ) : null,
              },
            ]
          : []),
      ]}
      dataSource={result.entries.map((entry, index) => ({ ...entry, key: `entry-${index}` }))}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      rowKey="key"
      scroll={{ x: true }}
      size="small"
    />
  );

  return (
    <main className={styles.root}>
      <header className={styles.heading}>
        <div>
          <h2>{result.model.name}</h2>
          <span>{objectMetricText("mcpPublishedVersion", { p0: result.model.version })}</span>
        </div>
        <Tag color={result.status === "ok" ? "success" : "warning"}>{result.status}</Tag>
      </header>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      {result.warnings?.map((warning, index) => (
        <Alert key={`${index}-${warning}`} message={warning} showIcon type="warning" />
      ))}
      <ObjectMetricAnalysisPanel
        onSelectEntry={(entry) => {
          if (entry.available_actions?.includes("participants")) void openParticipants(entry);
        }}
        result={result}
        resultTable={resultTable}
      />
      <footer className={styles.footer}>
        <span>
          {objectMetricText("mcpRows", { p0: result.entries.length })}
          {result.total_count !== undefined
            ? ` · ${objectMetricText("mcpTotal", { p0: result.total_count })}`
            : ""}
          {result.model.value.unit
            ? ` · ${objectMetricText("mcpUnit", { p0: result.model.value.unit.display_symbol ?? result.model.value.unit.code })}`
            : ""}
        </span>
        {result.next_cursor && onNextPage ? (
          <Button loading={busy} onClick={onNextPage}>
            {objectMetricText("mcpNextPage")}
          </Button>
        ) : null}
      </footer>
      <Modal
        footer={null}
        onCancel={() => {
          setSelected(undefined);
          setParticipants(undefined);
        }}
        open={Boolean(selected)}
        title={objectMetricText("mcpParticipantsTitle")}
        width={760}
      >
        {participantError ? <Alert message={participantError} showIcon type="error" /> : null}
        <Table
          columns={[
            { title: objectMetricText("mcpRole"), dataIndex: "role", key: "role" },
            {
              title: objectMetricText("mcpIdentity"),
              dataIndex: "instance_identity",
              key: "identity",
              render: metricCell,
            },
          ]}
          dataSource={(participants?.participants ?? []).map((participant, index) => ({
            ...participant,
            key: `participant-${index}`,
          }))}
          loading={participantBusy}
          pagination={false}
          rowKey="key"
          size="small"
        />
        {participants?.warnings?.map((warning, index) => (
          <Alert key={`${index}-${warning}`} message={warning} showIcon type="warning" />
        ))}
        {participants?.next_cursor && selected ? (
          <Space className={styles.participantMore}>
            <Button
              loading={participantBusy}
              onClick={() => void openParticipants(selected, participants.next_cursor)}
            >
              {objectMetricText("mcpMoreParticipants")}
            </Button>
          </Space>
        ) : null}
      </Modal>
    </main>
  );
}
