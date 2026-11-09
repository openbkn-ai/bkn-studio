/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type {
  NetworkCheckInvalidParameter,
  NetworkCheckMisplacedParameter,
  NetworkCheckParameterOwner,
  NetworkCheckParameterValue,
  NetworkCheckResult,
} from "@/modules/knowledge-network/types/knowledge-network";
import { declarationKindKey } from "@/modules/knowledge-network/utils/declaration-labels";

import styles from "./NetworkCheckTables.module.css";

const PREFIX = "knowledgeNetwork.declarations.networkCheck";

// Below this width the tables scroll sideways inside the dialog instead of squeezing ids and
// value sources down to a character per line.
const TABLE_MIN_WIDTH = 640;

function formatValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * A parameter's value source, written the way the definition file writes it. The check sends an
 * unset field as an empty string, which gets no line.
 */
function ParameterValue({ value }: { value: NetworkCheckParameterValue }) {
  const lines = [
    value.source ? `source = ${value.source}` : null,
    value.valueFrom ? `value_from = ${value.valueFrom}` : null,
    value.value != null && value.value !== "" ? `value = ${formatValue(value.value)}` : null,
  ].filter((line): line is string => line !== null);

  return (
    <div className={styles.mono}>
      {lines.length ? lines.map((line) => <div key={line}>{line}</div>) : "-"}
    </div>
  );
}

function ParameterOwner({
  networkId,
  owner,
}: {
  networkId: string;
  owner: NetworkCheckParameterOwner;
}) {
  const { t } = useTranslation();
  const workspace = `/knowledge-network/workspace/${encodeURIComponent(networkId)}`;

  if (owner.actionTypeId) {
    return (
      <span>
        {t(declarationKindKey("action_type"))}{" "}
        <Link
          className={styles.mono}
          to={`${workspace}/action-types/${encodeURIComponent(owner.actionTypeId)}/edit`}
        >
          {owner.actionTypeId}
        </Link>
      </span>
    );
  }

  if (owner.objectTypeId) {
    return (
      <span>
        {t(declarationKindKey("object_type"))}{" "}
        <Link
          className={styles.mono}
          to={`${workspace}/object-types/${encodeURIComponent(owner.objectTypeId)}/edit`}
        >
          {owner.objectTypeId}
        </Link>
        {owner.logicProperty
          ? ` · ${t(`${PREFIX}.logicProperty`, { name: owner.logicProperty })}`
          : null}
      </span>
    );
  }

  return <span>-</span>;
}

const rowKey = (row: NetworkCheckParameterOwner & { parameter: string }) =>
  [row.actionTypeId, row.objectTypeId, row.logicProperty, row.parameter].join("/");

/**
 * The network check's misplaced and invalid parameters, each linked to the definition that holds
 * it. The check names definitions by id only, so that is what the rows show.
 */
export function NetworkCheckTables({
  check,
  networkId,
}: {
  check: NetworkCheckResult;
  networkId: string;
}) {
  const { t } = useTranslation();

  const ownerColumn = {
    key: "owner",
    render: (_: unknown, row: NetworkCheckParameterOwner) => (
      <ParameterOwner networkId={networkId} owner={row} />
    ),
    title: t(`${PREFIX}.columnOwner`),
  };
  const parameterColumn = {
    dataIndex: "parameter",
    key: "parameter",
    render: (parameter: string) => (
      <span className={`${styles.mono} ${styles.parameter}`}>{parameter}</span>
    ),
    title: t(`${PREFIX}.columnParameter`),
  };
  const currentColumn = {
    key: "current",
    render: (_: unknown, row: { current: NetworkCheckParameterValue }) => (
      <ParameterValue value={row.current} />
    ),
    title: t(`${PREFIX}.columnCurrent`),
  };

  const misplacedColumns: ColumnsType<NetworkCheckMisplacedParameter> = [
    ownerColumn,
    parameterColumn,
    currentColumn,
    {
      key: "suggested",
      render: (_, row) => <ParameterValue value={row.suggested} />,
      title: t(`${PREFIX}.columnSuggested`),
    },
    {
      key: "conflict",
      render: (_, row) =>
        row.conflict ? <Tag color="orange">{t(`${PREFIX}.conflict`)}</Tag> : null,
    },
  ];
  const invalidColumns: ColumnsType<NetworkCheckInvalidParameter> = [
    ownerColumn,
    parameterColumn,
    currentColumn,
  ];

  return (
    <>
      {check.misplacedParameters.length ? (
        <>
          <Typography.Text className={styles.sectionTitle} strong>
            {t(`${PREFIX}.misplacedTitle`, { total: check.misplacedParameters.length })}
          </Typography.Text>
          <Table<NetworkCheckMisplacedParameter>
            columns={misplacedColumns}
            dataSource={check.misplacedParameters}
            pagination={false}
            rowKey={rowKey}
            scroll={{ x: TABLE_MIN_WIDTH }}
            size="small"
          />
        </>
      ) : null}
      {check.invalidParameters.length ? (
        <>
          <Typography.Text className={styles.sectionTitle} strong>
            {t(`${PREFIX}.invalidTitle`, { total: check.invalidParameters.length })}
          </Typography.Text>
          <Table<NetworkCheckInvalidParameter>
            columns={invalidColumns}
            dataSource={check.invalidParameters}
            pagination={false}
            rowKey={rowKey}
            scroll={{ x: TABLE_MIN_WIDTH }}
            size="small"
          />
          <Typography.Paragraph className={styles.hint}>
            {t(`${PREFIX}.invalidHint`)}
          </Typography.Paragraph>
        </>
      ) : null}
    </>
  );
}
