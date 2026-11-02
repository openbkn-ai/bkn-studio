/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import type { DraftObjectType, DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";
const P = "bknProject.documentEditor";
export function SentenceIdentityEditor({
  object,
  value,
  onChange,
}: {
  object: DraftObjectType;
  value: DraftObjectTypeSave;
  onChange: (value: DraftObjectTypeSave) => void;
}) {
  const { t } = useTranslation();
  if (!object.document || !["in_document", "fact", "event"].includes(object.document.role))
    return null;
  const managed = new Set(
    object.properties.filter((field) => field.readOnly).map((field) => field.name),
  );
  const fields = value.properties.filter(
    (field) =>
      field.type !== "json" &&
      (!managed.has(field.name) ||
        (["fact", "event"].includes(object.document?.role ?? "") &&
          ["effective_from", "effective_to"].includes(field.name))),
  );
  const choice = value.document?.sentenceIdentity;
  const keys = choice?.properties ?? object.document.sentenceIdentity?.properties ?? [];
  const confirmed = choice
    ? choice.confirm
    : Boolean(object.document.sentenceIdentity?.confirmedAt);
  const update = (properties: string[], confirm: boolean) =>
    onChange({
      ...value,
      document: {
        timeProperty: "",
        participantRelations: [],
        ...value.document,
        sentenceIdentity: { properties, confirm, ...(!properties.length ? { clear: true } : {}) },
      },
    });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert
        type={keys.length && !confirmed ? "warning" : "info"}
        showIcon
        message={t(`${P}.sentenceKey`)}
        description={t(`${P}.sentenceKeyHelp`)}
      />
      <Select
        mode="multiple"
        allowClear
        aria-label={t(`${P}.sentenceKey`)}
        style={{ width: "100%" }}
        value={keys}
        options={fields.map((field) => ({
          value: field.name,
          label: field.displayName || t(`${P}.unnamedField`),
        }))}
        onChange={(names: string[]) => update(names, false)}
      />
      <Checkbox
        checked={confirmed && keys.length > 0}
        disabled={!keys.length}
        onChange={(event) => update(keys, event.target.checked)}
      >
        {t(`${P}.confirmSentenceKey`)}
      </Checkbox>
    </Space>
  );
}
