/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Select, Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type {
  Draft,
  DraftObjectType,
  DraftObjectTypeSave,
} from "@/modules/bkn-project/types/draft";

const P = "bknProject.documentEditor";
export function FileIdentityEditor({
  object,
  draft,
  value,
  onChange,
}: {
  object: DraftObjectType;
  draft: Draft;
  value: DraftObjectTypeSave;
  onChange: (value: DraftObjectTypeSave) => void;
}) {
  const { t } = useTranslation();
  if (object.document?.role !== "file") return null;
  const fixed = new Set(object.properties.filter((p) => p.readOnly).map((p) => p.name));
  const fields = value.properties.filter(
    (p) => !fixed.has(p.name) && ["string", "text", "integer", "unsigned integer"].includes(p.type),
  );
  const reused = draft.items.objectTypes
    .filter(
      (o) =>
        o.adopted &&
        o.document?.dualSource?.state === "confirmed" &&
        o.document.dualSource.fileObjectTypeId === object.id &&
        o.primaryKeys.length === 1,
    )
    .map((o) => o.primaryKeys[0]);
  const inherited = reused.length > 0 && new Set(reused).size === 1 ? reused[0] : undefined;
  const choice = value.document?.fileIdentity;
  const property = inherited ?? choice?.property ?? object.document.fileIdentity?.property;
  const confirmed = Boolean(
    inherited || (choice ? choice.confirm : object.document.fileIdentity?.confirmedAt),
  );
  const update = (next: { property: string; confirm: boolean; clear?: boolean }) =>
    onChange({
      ...value,
      document: {
        timeProperty: "",
        participantRelations: [],
        ...value.document,
        fileIdentity: next,
      },
    });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert
        type={confirmed ? "info" : "warning"}
        showIcon
        message={t(`${P}.fileNumber`)}
        description={t(`${P}.fileNumberHelp`)}
      />
      <label>
        {t(`${P}.fileNumber`)}{" "}
        <Select
          aria-label={t(`${P}.fileNumber`)}
          style={{ minWidth: 220 }}
          allowClear
          disabled={Boolean(inherited)}
          value={fields.some((p) => p.name === property) ? property : undefined}
          options={fields.map((p) => ({
            label: p.displayName || t(`${P}.unnamedField`),
            value: p.name,
          }))}
          onChange={(name: string | undefined) =>
            update(
              name
                ? { property: name, confirm: false }
                : { property: "", confirm: false, clear: true },
            )
          }
        />
      </label>
      {inherited ? (
        <Typography.Text type="secondary">{t(`${P}.fileNumberInherited`)}</Typography.Text>
      ) : (
        <Checkbox
          disabled={!property}
          checked={confirmed}
          onChange={(event) => update({ property: property ?? "", confirm: event.target.checked })}
        >
          {t(`${P}.confirmFileNumber`)}
        </Checkbox>
      )}
    </Space>
  );
}
