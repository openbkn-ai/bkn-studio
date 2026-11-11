/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Drawer, Empty, Input, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  deleteKnowledgeNetworkValueType,
  listKnowledgeNetworkValueTypes,
  ValueTypeReferencedError,
} from "@/modules/knowledge-network/services/value-type.service";
import type { ValueType } from "@/modules/knowledge-network/types/knowledge-network";
import { valueTypeKind } from "@/modules/knowledge-network/utils/property-declarations";

import { ValueTypeEnumItems } from "./ValueTypeEnumItems";
import { useValueTypeEditor, valueTypeFormTitle } from "./useValueTypeEditor";
import { ValueTypeFormFields } from "./ValueTypeForm";
import styles from "./ValueTypeListDrawer.module.css";
import {
  ValueTypeReferencedDialog,
  type ValueTypeReferencedRefusal,
} from "./ValueTypeReferencedDialog";
import { describeValueTypeRules } from "./value-type-text";

const PREFIX = "knowledgeNetwork.valueTypes";

type ListState =
  { kind: "loading" } | { error: string; kind: "failed" } | { items: ValueType[]; kind: "done" };

/** The kind of a value type as a tag, its rules in the tooltip. */
export function ValueTypeKindTag({ valueType }: { valueType: ValueType }) {
  const { t } = useTranslation();
  const kind = valueTypeKind(valueType);
  if (!kind) {
    return <span>—</span>;
  }
  const label =
    kind === "enum"
      ? `${t(`${PREFIX}.kind.enum`)} · ${t(`${PREFIX}.enumCount`, { count: valueType.enum?.length ?? 0 })}`
      : [t(`${PREFIX}.kind.${kind}`), kind !== "unit" ? valueType.unit : undefined]
          .filter(Boolean)
          .join(" · ");
  return (
    <Tooltip title={describeValueTypeRules(valueType, t).join(t(`${PREFIX}.summary.separator`))}>
      <Tag color={kind === "enum" ? "blue" : undefined}>{label}</Tag>
    </Tooltip>
  );
}

type FormTarget = { valueType?: ValueType } | null;

/**
 * The value types of a network, opened from the object type section. They belong to the whole
 * network, which the title says, so no one takes them for part of one object type. Creating,
 * editing and viewing one shows its form in this drawer, in place of the list.
 */
export function ValueTypeListDrawer({
  canModify,
  networkId,
  onClose,
  open,
}: {
  canModify: boolean;
  networkId: string;
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [refusal, setRefusal] = useState<ValueTypeReferencedRefusal | null>(null);
  const editor = useValueTypeEditor({
    active: formTarget !== null,
    networkId,
    onSaved: () => {
      setFormTarget(null);
      setReload((value) => value + 1);
    },
    valueType: formTarget?.valueType,
  });

  useEffect(() => {
    if (!open) {
      setFormTarget(null);
      return;
    }
    let current = true;
    setState({ kind: "loading" });
    listKnowledgeNetworkValueTypes(networkId)
      .then((items) => {
        if (current) setState({ items, kind: "done" });
      })
      .catch((error: unknown) => {
        if (current) setState({ error: extractRequestErrorMessage(error), kind: "failed" });
      });
    return () => {
      current = false;
    };
  }, [networkId, open, reload]);

  const items = useMemo(() => {
    const all = state.kind === "done" ? state.items : [];
    const normalized = keyword.trim().toLowerCase();
    return normalized
      ? all.filter(
          (item) =>
            item.name.toLowerCase().includes(normalized) ||
            item.id.toLowerCase().includes(normalized),
        )
      : all;
  }, [keyword, state]);

  const confirmDelete = (valueType: ValueType) => {
    void modal.confirm({
      cancelText: t("common.cancel"),
      content: t(`${PREFIX}.deleteConfirmDescription`),
      okButtonProps: { danger: true },
      okText: t("common.delete"),
      onOk: async () => {
        try {
          await deleteKnowledgeNetworkValueType(networkId, valueType.id);
          void message.success(t(`${PREFIX}.deleted`));
          setReload((value) => value + 1);
        } catch (error) {
          if (error instanceof ValueTypeReferencedError) {
            setRefusal({ action: "delete", name: valueType.name, references: error.references });
            return;
          }
          void message.error(extractRequestErrorMessage(error));
        }
      },
      title: t(`${PREFIX}.deleteConfirmTitle`, { name: valueType.name }),
    });
  };

  const columns: ColumnsType<ValueType> = [
    {
      dataIndex: "name",
      key: "name",
      render: (name: string, row) => (
        <Typography.Link onClick={() => setFormTarget({ valueType: row })}>{name}</Typography.Link>
      ),
      title: t(`${PREFIX}.columnName`),
    },
    {
      dataIndex: "id",
      key: "id",
      render: (id: string) => <span className={styles.mono}>{id}</span>,
      title: t(`${PREFIX}.columnId`),
    },
    {
      dataIndex: "baseType",
      key: "baseType",
      title: t(`${PREFIX}.columnBaseType`),
      width: 132,
    },
    {
      key: "kind",
      render: (_, row) => <ValueTypeKindTag valueType={row} />,
      title: t(`${PREFIX}.columnKind`),
      width: 132,
    },
    ...(canModify
      ? [
          {
            key: "actions",
            render: (_: unknown, row: ValueType) => (
              <span className={styles.actions}>
                <Typography.Link onClick={() => setFormTarget({ valueType: row })}>
                  {t(`${PREFIX}.edit`)}
                </Typography.Link>
                <Typography.Link onClick={() => confirmDelete(row)} type="danger">
                  {t(`${PREFIX}.delete`)}
                </Typography.Link>
              </span>
            ),
            title: t(`${PREFIX}.columnActions`),
            width: 112,
          },
        ]
      : []),
  ];

  const leaveForm = () => setFormTarget(null);

  const list = (
    <>
      <Typography.Paragraph className={styles.description}>
        {t(`${PREFIX}.drawerDescription`)}
      </Typography.Paragraph>
      <div className={styles.toolbar}>
        <Input
          allowClear
          className={styles.search}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t(`${PREFIX}.searchPlaceholder`)}
          prefix={<SearchOutlined />}
          value={keyword}
        />
        {canModify ? (
          <AppButton icon={<PlusOutlined />} onClick={() => setFormTarget({})} type="primary">
            {t(`${PREFIX}.create`)}
          </AppButton>
        ) : null}
      </div>
      {state.kind === "failed" ? (
        <Alert
          description={state.error}
          message={t(`${PREFIX}.loadFailed`)}
          showIcon
          type="error"
        />
      ) : (
        <Table<ValueType>
          columns={columns}
          dataSource={items}
          expandable={{
            expandedRowRender: (row) => <ValueTypeEnumItems items={row.enum ?? []} />,
            rowExpandable: (row) => Boolean(row.enum?.length),
          }}
          loading={state.kind === "loading"}
          locale={{
            emptyText: (
              <Empty
                description={t(keyword.trim() ? `${PREFIX}.noMatch` : `${PREFIX}.empty`)}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
          pagination={false}
          rowKey="id"
          scroll={{ x: 640 }}
          size="middle"
        />
      )}
    </>
  );

  return (
    <Drawer
      // Leaving a form goes back to the list.
      closable={formTarget === null}
      destroyOnHidden
      footer={
        formTarget ? (
          <div className={styles.footer}>
            <AppButton onClick={leaveForm}>{t("common.back")}</AppButton>
            {canModify ? (
              <AppButton
                loading={editor.submitting}
                onClick={() => void editor.submit()}
                type="primary"
              >
                {t("common.save")}
              </AppButton>
            ) : null}
          </div>
        ) : undefined
      }
      maskClosable={formTarget === null}
      onClose={formTarget ? leaveForm : onClose}
      open={open}
      title={
        formTarget ? (
          <span className={styles.formTitle}>
            <AppButton
              aria-label={t("common.back")}
              icon={<ArrowLeftOutlined />}
              onClick={leaveForm}
              size="small"
              type="text"
            />
            {valueTypeFormTitle(t, !canModify, formTarget.valueType)}
          </span>
        ) : (
          t(`${PREFIX}.drawerTitle`)
        )
      }
      width={820}
    >
      {formTarget ? (
        <ValueTypeFormFields
          form={editor.form}
          readOnly={!canModify}
          valueType={formTarget.valueType}
        />
      ) : (
        list
      )}
      {editor.refusalDialog}
      {refusal ? (
        <ValueTypeReferencedDialog
          networkId={networkId}
          onClose={() => setRefusal(null)}
          refusal={refusal}
        />
      ) : null}
    </Drawer>
  );
}
