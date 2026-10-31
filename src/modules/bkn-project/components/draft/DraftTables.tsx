/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EditOutlined } from "@ant-design/icons";
import { Switch, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { AppTable } from "@/framework/ui/common/AppTable";
import { LightStatusTag } from "@/framework/ui/common/LightStatusTag";
import {
  joinCountPhrase,
  keyCountPhrase,
  keySourcePhrase,
  keyWarnings,
  originPhrase,
  propertyTypeKey,
  excludedReasonText,
  say,
  verificationPhrase,
} from "@/modules/bkn-project/components/draft/evidence";
import {
  type AdoptBlocker,
  type EditableItem,
  restorable,
} from "@/modules/bkn-project/components/draft/edit";
import type {
  DraftExcludedField,
  DraftItemKind,
  DraftObjectType,
  DraftRelationType,
  DraftTable,
  DraftValueType,
} from "@/modules/bkn-project/types/draft";

import styles from "./DraftTables.module.css";

const PAGE_SIZE = 50;

// Keys must not end in _one: i18next would read them as plural forms.
const CARDINALITY: Record<string, string> = {
  many_to_many: "manyToMany",
  many_to_one: "manyToOne",
  one_to_one: "oneToOne",
};

export function AdoptionTag({ adopted }: { adopted: boolean }) {
  const { t } = useTranslation();
  return (
    <LightStatusTag tone={adopted ? "success" : "neutral"}>
      {t(adopted ? "bknProject.model.state.adopted" : "bknProject.model.state.notAdopted")}
    </LightStatusTag>
  );
}

/** What the tables may do to an item; the page decides and sends every edit. */
export type DraftItemActions = {
  adoptBlocker: (kind: DraftItemKind, item: EditableItem) => AdoptBlocker | null;
  /** Edits are not offered on an archived project. */
  archived: boolean;
  /** True while an edit is being sent: one at a time. */
  busy: boolean;
  onAdopt: (kind: DraftItemKind, item: EditableItem, adopted: boolean) => void;
  onChooseIdentity: (objectType: DraftObjectType) => void;
  onEdit: (kind: DraftItemKind, item: EditableItem) => void;
  onRestore: (field: DraftExcludedField) => void;
};

function AdoptSwitch({
  actions,
  item,
  kind,
}: {
  actions: DraftItemActions;
  item: EditableItem;
  kind: DraftItemKind;
}) {
  const { t } = useTranslation();
  const blocker = actions.archived ? "archived" : actions.adoptBlocker(kind, item);
  // A switch that cannot be turned says why, so people know what to do first.
  return (
    <Tooltip title={blocker ? t(`bknProject.model.adoptBlocked.${blocker}`) : undefined}>
      <span>
        <Switch
          aria-label={t("bknProject.model.actions.adoptItem", { name: item.name })}
          checked={item.adopted}
          disabled={actions.busy || blocker !== null}
          onChange={(adopted) => actions.onAdopt(kind, item, adopted)}
          size="small"
        />
      </span>
    </Tooltip>
  );
}

function editColumn<T extends EditableItem>(
  kind: DraftItemKind,
  actions: DraftItemActions,
  t: TFunction,
): ColumnsType<T>[number] {
  return {
    key: "edit",
    width: 56,
    render: (_value, record) => (
      <AppButton
        aria-label={t("bknProject.model.actions.edit", { name: record.name })}
        disabled={actions.archived || actions.busy}
        icon={<EditOutlined />}
        onClick={() => actions.onEdit(kind, record)}
        size="small"
        type="text"
      />
    ),
  };
}

/** The identity of an object type with its basis, its counts and their warnings. */
export function IdentityEvidence({
  compact = false,
  objectType,
}: {
  /**
   * In a table cell: the identity by its properties' display names, warnings as tags, and the
   * field names and the counts in a tooltip, not in the cell.
   */
  compact?: boolean;
  objectType: DraftObjectType;
}) {
  const { t } = useTranslation();
  const { key } = objectType;
  if (compact) {
    const label = (name: string) =>
      objectType.properties.find((property) => property.name === name)?.displayName || name;
    const details = [
      objectType.primaryKeys.join(t("bknProject.listSeparator")),
      say(t, keySourcePhrase(key.source)),
      say(t, keyCountPhrase(key)),
    ]
      .filter(Boolean)
      .join(t("bknProject.model.identity.detailSeparator"));
    return (
      <div className={styles.evidence}>
        {objectType.needsIdentity ? (
          <Tooltip title={details}>
            <span className={styles.identityName}>
              <Tag color="warning">{t("bknProject.model.identityPending")}</Tag>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title={details}>
            <span className={styles.identityName}>
              {objectType.primaryKeys.map(label).join(t("bknProject.listSeparator"))}
            </span>
          </Tooltip>
        )}
        {keyWarnings(key).length ? (
          <span className={styles.tags}>
            {keyWarnings(key).map((warning) => (
              <Tag color="warning" key={warning.key}>
                {say(t, warning)}
              </Tag>
            ))}
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div className={styles.evidence}>
      {objectType.needsIdentity ? (
        <LightStatusTag tone="warning">{t("bknProject.model.identityPending")}</LightStatusTag>
      ) : (
        <code className={styles.mono}>{objectType.primaryKeys.join(", ")}</code>
      )}
      <span className={styles.muted}>
        {say(t, keySourcePhrase(key.source))} · {say(t, keyCountPhrase(key))}
      </span>
      {keyWarnings(key).map((warning) => (
        <span className={styles.warning} key={warning.key}>
          {say(t, warning)}
        </span>
      ))}
    </div>
  );
}

function TableSource({
  table,
  catalogNames,
}: {
  catalogNames: Record<string, string>;
  table: DraftTable;
}) {
  // The table by its name; which catalog it is in is a tooltip, not part of the cell.
  return (
    <Tooltip title={catalogNames[table.catalogId] ?? table.catalogId}>
      <span>{table.name}</span>
    </Tooltip>
  );
}

export function DraftObjectsTable({
  actions,
  catalogNames,
  items,
  onOpen,
}: {
  actions: DraftItemActions;
  catalogNames: Record<string, string>;
  items: DraftObjectType[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const columns: ColumnsType<DraftObjectType> = [
    {
      title: t("bknProject.model.columns.objectType"),
      dataIndex: "name",
      key: "name",
      render: (value: string, record) => (
        <button className={styles.link} onClick={() => onOpen(record.id)} type="button">
          <strong>{value}</strong>
          {record.description ? <span className={styles.muted}>{record.description}</span> : null}
        </button>
      ),
    },
    {
      title: t("bknProject.model.columns.state"),
      key: "state",
      width: 140,
      render: (_value, record) => (
        <div className={styles.state}>
          <AdoptSwitch actions={actions} item={record} kind="object_types" />
        </div>
      ),
    },
    {
      title: t("bknProject.model.columns.identity"),
      key: "identity",
      render: (_value, record) => (
        <div className={styles.evidence}>
          <IdentityEvidence compact objectType={record} />
          <AppButton
            aria-label={t(
              record.needsIdentity
                ? "bknProject.model.identity.choose"
                : "bknProject.model.identity.change",
              { name: record.name },
            )}
            className={record.needsIdentity ? undefined : styles.inlineAction}
            disabled={actions.archived || actions.busy}
            onClick={() => actions.onChooseIdentity(record)}
            size="small"
            type={record.needsIdentity ? "primary" : "link"}
          >
            {t(
              record.needsIdentity
                ? "bknProject.model.identity.chooseLabel"
                : "bknProject.model.identity.changeLabel",
            )}
          </AppButton>
        </div>
      ),
    },
    {
      title: t("bknProject.model.columns.properties"),
      key: "properties",
      width: 90,
      render: (_value, record) => record.properties.length,
    },
    {
      title: t("bknProject.model.columns.source"),
      key: "source",
      render: (_value, record) => <TableSource catalogNames={catalogNames} table={record.table} />,
    },
    editColumn<DraftObjectType>("object_types", actions, t),
  ];
  return (
    <AppTable<DraftObjectType>
      columns={columns}
      dataSource={items}
      pagination={items.length > PAGE_SIZE ? { pageSize: PAGE_SIZE } : false}
      rowKey="id"
      size="middle"
    />
  );
}

export function DraftRelationsTable({
  actions,
  items,
  objectNames,
  unadoptedEnds,
}: {
  actions: DraftItemActions;
  items: DraftRelationType[];
  objectNames: Record<string, string>;
  /** Relations adopted while an end is not, marked for people to unadopt. */
  unadoptedEnds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const columns: ColumnsType<DraftRelationType> = [
    {
      title: t("bknProject.model.columns.relationType"),
      dataIndex: "name",
      key: "name",
      render: (value: string) => <strong>{value}</strong>,
    },
    {
      title: t("bknProject.model.columns.ends"),
      key: "ends",
      render: (_value, record) =>
        `${objectNames[record.source] ?? record.source} → ${objectNames[record.target] ?? record.target}`,
    },
    {
      title: t("bknProject.model.columns.cardinality"),
      dataIndex: "cardinality",
      key: "cardinality",
      width: 110,
      render: (value: string) =>
        CARDINALITY[value] ? t(`bknProject.model.cardinality.${CARDINALITY[value]}`) : value,
    },
    {
      title: t("bknProject.model.columns.evidence"),
      key: "evidence",
      render: (_value, record) => {
        return (
          <div className={styles.evidence}>
            <span>
              {say(t, originPhrase(record.origin))} ·{" "}
              {say(t, verificationPhrase(record.verification))}
            </span>
            <span className={styles.muted}>{say(t, joinCountPhrase(record.evidence))}</span>
          </div>
        );
      },
    },
    {
      title: t("bknProject.model.columns.state"),
      key: "state",
      width: 160,
      render: (_value, record) => (
        <div className={styles.state}>
          <AdoptSwitch actions={actions} item={record} kind="relation_types" />
          {unadoptedEnds.has(record.id) ? (
            <LightStatusTag tone="warning">
              {t("bknProject.model.state.unadoptedEnd")}
            </LightStatusTag>
          ) : null}
        </div>
      ),
    },
    editColumn<DraftRelationType>("relation_types", actions, t),
  ];
  return (
    <AppTable<DraftRelationType>
      columns={columns}
      dataSource={items}
      pagination={items.length > PAGE_SIZE ? { pageSize: PAGE_SIZE } : false}
      rowKey="id"
      size="middle"
    />
  );
}

export function DraftValueTypesTable({
  actions,
  catalogNames,
  items,
}: {
  actions: DraftItemActions;
  catalogNames: Record<string, string>;
  items: DraftValueType[];
}) {
  const { t } = useTranslation();
  const columns: ColumnsType<DraftValueType> = [
    {
      title: t("bknProject.model.columns.valueType"),
      dataIndex: "name",
      key: "name",
      render: (value: string) => <strong>{value}</strong>,
    },
    {
      title: t("bknProject.model.columns.baseType"),
      dataIndex: "baseType",
      key: "baseType",
      width: 110,
      render: (value: string) => t(propertyTypeKey(value)),
    },
    {
      title: t("bknProject.model.columns.values"),
      key: "values",
      render: (_value, record) => (
        <span className={styles.muted}>
          {record.values.map((value) => `${value.value} ${value.display}`.trim()).join("; ")}
        </span>
      ),
    },
    {
      title: t("bknProject.model.columns.codeTable"),
      key: "codeTable",
      render: (_value, record) => (
        <TableSource catalogNames={catalogNames} table={record.codeTable} />
      ),
    },
    {
      title: t("bknProject.model.columns.usedBy"),
      key: "usedBy",
      render: (_value, record) =>
        record.usedBy.map((ref) => `${ref.objectType}.${ref.property}`).join(", "),
    },
    {
      title: t("bknProject.model.columns.state"),
      key: "state",
      width: 140,
      render: (_value, record) => (
        <div className={styles.state}>
          <AdoptSwitch actions={actions} item={record} kind="value_types" />
        </div>
      ),
    },
    editColumn<DraftValueType>("value_types", actions, t),
  ];
  return (
    <AppTable<DraftValueType>
      columns={columns}
      dataSource={items}
      pagination={false}
      rowKey="id"
      size="middle"
    />
  );
}

/** Fields drafting left out, and tables it could not read. */
export function DraftExcludedPanel({
  actions,
  catalogNames,
  excluded,
  objectNames,
  unreadable,
}: {
  actions: DraftItemActions;
  catalogNames: Record<string, string>;
  excluded: DraftExcludedField[];
  objectNames: Record<string, string>;
  unreadable: DraftTable[];
}) {
  const { t } = useTranslation();
  const fieldColumns: ColumnsType<DraftExcludedField> = [
    {
      title: t("bknProject.model.columns.objectType"),
      key: "objectType",
      render: (_value, record) => objectNames[record.objectType] ?? record.objectType,
    },
    {
      title: t("bknProject.model.columns.field"),
      dataIndex: "field",
      key: "field",
      render: (value: string) => <code className={styles.mono}>{value}</code>,
    },
    {
      title: t("bknProject.model.columns.reason"),
      key: "reason",
      render: (_value, record) => excludedReasonText(t, record.reason, record.keyword),
    },
    {
      key: "restore",
      width: 96,
      render: (_value, record) =>
        restorable(record) ? (
          <AppButton
            aria-label={t("bknProject.model.restore.action", {
              field: record.field,
              objectType: objectNames[record.objectType] ?? record.objectType,
            })}
            disabled={actions.archived || actions.busy}
            onClick={() => actions.onRestore(record)}
            size="small"
          >
            {t("bknProject.model.restore.label")}
          </AppButton>
        ) : null,
    },
  ];
  const tableColumns: ColumnsType<DraftTable> = [
    {
      title: t("bknProject.model.columns.table"),
      key: "table",
      render: (_value, record) => <TableSource catalogNames={catalogNames} table={record} />,
    },
    {
      title: t("bknProject.model.columns.reason"),
      key: "reason",
      render: (_value, record) => excludedReasonText(t, record.reason),
    },
  ];
  return (
    <div className={styles.stack}>
      {excluded.length ? (
        <section>
          <h3 className={styles.sectionTitle}>{t("bknProject.model.excluded.fieldsTitle")}</h3>
          <p className={styles.muted}>{t("bknProject.model.excluded.fieldsTip")}</p>
          <AppTable<DraftExcludedField>
            columns={fieldColumns}
            dataSource={excluded}
            pagination={false}
            rowKey={(record) => `${record.objectType}.${record.field}`}
            size="middle"
          />
        </section>
      ) : null}
      {unreadable.length ? (
        <section>
          <h3 className={styles.sectionTitle}>{t("bknProject.model.excluded.unreadableTitle")}</h3>
          <AppTable<DraftTable>
            columns={tableColumns}
            dataSource={unreadable}
            pagination={false}
            rowKey="resourceId"
            size="middle"
          />
        </section>
      ) : null}
    </div>
  );
}
