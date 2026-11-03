/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Button, Checkbox, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import type { DraftObjectType, DraftObjectTypeSave } from "@/modules/bkn-project/types/draft";

const P = "bknProject.documentEditor";
export function FilePeriodEditor({
  object,
  value,
  onChange,
}: {
  object: DraftObjectType;
  value: DraftObjectTypeSave;
  onChange: (value: DraftObjectTypeSave) => void;
}) {
  const { t } = useTranslation();
  if (object.document?.role !== "file") return null;
  const protectedFields = new Set(object.properties.filter((p) => p.readOnly).map((p) => p.name));
  const fields = value.properties.filter(
    (p) => !protectedFields.has(p.name) && ["date", "datetime", "timestamp"].includes(p.type),
  );
  const choice = value.document?.filePeriod;
  const selected = Boolean(choice?.from || choice?.until);
  const valid =
    selected &&
    choice?.from !== choice?.until &&
    [choice?.from, choice?.until].every(
      (name) => !name || fields.some((field) => field.name === name),
    );
  const update = (next: NonNullable<NonNullable<DraftObjectTypeSave["document"]>["filePeriod"]>) =>
    onChange({
      ...value,
      document: { timeProperty: "", participantRelations: [], ...value.document, filePeriod: next },
    });
  const choose = (key: "from" | "until", name?: string) => {
    const next = {
      ...(choice?.from ? { from: choice.from } : {}),
      ...(choice?.until ? { until: choice.until } : {}),
      [key]: name,
      confirm: false,
    };
    if (!next.from && !next.until) update({ clear: true, confirm: false });
    else update(next);
  };
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message={t(`${P}.filePeriod`)}
        description={t(`${P}.filePeriodHelp`)}
      />
      {(["from", "until"] as const).map((key) => (
        <label key={key}>
          {t(`${P}.${key === "from" ? "effectiveDate" : "expiryDate"}`)}{" "}
          <Select
            aria-label={t(`${P}.${key === "from" ? "effectiveDate" : "expiryDate"}`)}
            allowClear
            style={{ minWidth: 220 }}
            value={fields.some((field) => field.name === choice?.[key]) ? choice?.[key] : undefined}
            options={fields
              .filter((field) => field.name !== choice?.[key === "from" ? "until" : "from"])
              .map((field) => ({
                label: field.displayName || t(`${P}.unnamedField`),
                value: field.name,
              }))}
            onChange={(name?: string) => choose(key, name)}
          />
        </label>
      ))}
      {selected && !choice?.clear && (
        <Button onClick={() => update({ clear: true, confirm: false })}>
          {t(`${P}.clearFilePeriod`)}
        </Button>
      )}
      <Checkbox
        disabled={!valid}
        checked={Boolean(valid && choice?.confirm)}
        onChange={(event) =>
          update({
            ...(choice?.from ? { from: choice.from } : {}),
            ...(choice?.until ? { until: choice.until } : {}),
            confirm: event.target.checked,
          })
        }
      >
        {t(`${P}.confirmFilePeriod`)}
      </Checkbox>
    </Space>
  );
}
