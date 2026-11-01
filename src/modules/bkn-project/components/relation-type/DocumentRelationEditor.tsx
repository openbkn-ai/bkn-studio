/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import type { Draft, DraftRelationTypeSave } from "@/modules/bkn-project/types/draft";
import { documentCardinalityKey } from "@/modules/bkn-project/components/object-type/document-values";
const P = "bknProject.documentEditor";
export function DocumentRelationEditor({
  draft,
  value,
  onChange,
  readonly = false,
}: {
  draft: Draft;
  value: DraftRelationTypeSave;
  onChange: (value: DraftRelationTypeSave) => void;
  readonly?: boolean;
}) {
  const { t } = useTranslation();
  if (readonly) return <Alert type="info" showIcon message={t(`${P}.managedRelation`)} />;
  const source = draft.items.objectTypes.find((o) => o.id === value.source);
  const target = draft.items.objectTypes.find((o) => o.id === value.target);
  const mapping = value.documentMapping ?? { mode: "linking" };
  const options = (end: typeof source) =>
    end?.properties
      .filter((p) => !p.readOnly)
      .map((p) => ({ value: p.name, label: p.displayName || p.name })) ?? [];
  const field = (
    label: string,
    key: "mentionProperty" | "identityProperty" | "sourceNameProperty" | "targetNameProperty",
    end: typeof source,
  ) => (
    <label>
      {t(`${P}.${label}`)}{" "}
      <Select
        disabled={readonly}
        style={{ minWidth: 180 }}
        value={mapping[key]}
        options={options(end)}
        onChange={(name) => onChange({ ...value, documentMapping: { ...mapping, [key]: name } })}
      />
    </label>
  );
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert type="info" message={t(`${P}.relationHelp`)} />
      <Space wrap>
        <label>
          {t(`${P}.sourceObject`)}{" "}
          <Select
            disabled={readonly}
            style={{ minWidth: 180 }}
            value={value.source || undefined}
            options={draft.items.objectTypes
              .filter((o) => o.document?.role && !o.document.role.startsWith("evidence_"))
              .map((o) => ({ label: o.name, value: o.id }))}
            onChange={(source) =>
              onChange({ ...value, source, documentMapping: { mode: mapping.mode } })
            }
          />
        </label>
        <label>
          {t(`${P}.targetObject`)}{" "}
          <Select
            disabled={readonly}
            style={{ minWidth: 180 }}
            value={value.target || undefined}
            options={draft.items.objectTypes.map((o) => ({ label: o.name, value: o.id }))}
            onChange={(target) =>
              onChange({ ...value, target, documentMapping: { mode: mapping.mode } })
            }
          />
        </label>
      </Space>
      <label>
        {t(`${P}.connection`)}{" "}
        <Select
          disabled={readonly}
          style={{ minWidth: 180 }}
          value={mapping.mode}
          options={["linking", "same_document"].map((mode) => ({
            value: mode,
            label: t(`${P}.${mode}`),
          }))}
          onChange={(mode) => onChange({ ...value, documentMapping: { mode } })}
        />
      </label>
      {mapping.mode === "linking" ? (
        <Space wrap>
          {field("mention", "mentionProperty", source)}
          {field("targetIdentity", "identityProperty", target)}
        </Space>
      ) : (
        <Space wrap>
          {field("sourceName", "sourceNameProperty", source)}
          {field("targetName", "targetNameProperty", target)}
        </Space>
      )}
      <label>
        {t(`${P}.cardinality`)}{" "}
        <Select
          disabled={readonly}
          style={{ minWidth: 180 }}
          value={value.cardinality}
          options={["one_to_one", "one_to_many", "many_to_one", "many_to_many"].map(
            (cardinality) => ({
              value: cardinality,
              label: t(documentCardinalityKey(cardinality)),
            }),
          )}
          onChange={(cardinality) => onChange({ ...value, cardinality })}
        />
      </label>
    </Space>
  );
}
