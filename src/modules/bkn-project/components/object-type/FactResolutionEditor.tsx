/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Button, Checkbox, Select, Space } from "antd";
import { useTranslation } from "react-i18next";
import type {
  Draft,
  DraftObjectType,
  DraftObjectTypeSave,
  FactResolutionChoice,
} from "@/modules/bkn-project/types/draft";

const P = "bknProject.documentEditor";
export function FactResolutionEditor({
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
  if (object.document?.role !== "fact") return null;
  const readonly = new Set(
    object.properties.filter((field) => field.readOnly).map((field) => field.name),
  );
  const fields = value.properties.filter((field) => !readonly.has(field.name));
  const relations = draft.items.relationTypes.filter((relation) => {
    const target = draft.items.objectTypes.find((item) => item.id === relation.target);
    return (
      relation.adopted &&
      relation.document?.role === "relation" &&
      !relation.documentRepair &&
      relation.source === object.id &&
      relation.documentMapping?.mode === "linking" &&
      target?.adopted &&
      (!target.document || target.document.role === "entity") &&
      target.primaryKeys.length === 1 &&
      target.primaryKeys[0] === relation.documentMapping.identityProperty
    );
  });
  const choice = value.document?.factResolution;
  const relationId = choice
    ? choice.subjectRelationId
    : relations.length === 1
      ? relations[0].id
      : undefined;
  const relation = relations.find((item) => item.id === relationId);
  const candidates = fields.filter(
    (field) => field.name !== relation?.documentMapping?.mentionProperty,
  );
  const property = choice
    ? choice.valueProperty
    : candidates.length === 1
      ? candidates[0].name
      : undefined;
  const target = draft.items.objectTypes.find((item) => item.id === relation?.target);
  const mention = fields.find((field) => field.name === relation?.documentMapping?.mentionProperty);
  const identity = target?.properties.find(
    (field) => field.name === relation?.documentMapping?.identityProperty,
  );
  const single =
    !!relation &&
    candidates.length === 1 &&
    candidates[0].name === property &&
    !!mention &&
    mention.type === identity?.type;
  const update = (next: FactResolutionChoice) =>
    onChange({
      ...value,
      document: {
        timeProperty: "",
        participantRelations: [],
        ...value.document,
        factResolution: next,
      },
    });
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message={t(`${P}.factResolution`)}
        description={t(`${P}.factResolutionHelp`)}
      />
      {fields.length > 2 && (
        <Alert type="warning" showIcon message={t(`${P}.factSingleValueRequired`)} />
      )}
      {!relations.length && (
        <Alert type="warning" showIcon message={t(`${P}.factSubjectRequired`)} />
      )}
      <label>
        {t(`${P}.factSubject`)}{" "}
        <Select
          aria-label={t(`${P}.factSubject`)}
          allowClear
          style={{ minWidth: 240 }}
          value={relation?.id}
          options={relations.map((item) => ({
            value: item.id,
            label: `${item.name} · ${draft.items.objectTypes.find((target) => target.id === item.target)?.name ?? ""}`,
          }))}
          onChange={(subjectRelationId?: string) =>
            update({ subjectRelationId, valueProperty: property, confirm: false })
          }
        />
      </label>
      <label>
        {t(`${P}.factValue`)}{" "}
        <Select
          aria-label={t(`${P}.factValue`)}
          allowClear
          style={{ minWidth: 240 }}
          value={candidates.some((field) => field.name === property) ? property : undefined}
          options={candidates.map((field) => ({
            value: field.name,
            label: field.displayName || t(`${P}.unnamedField`),
          }))}
          onChange={(valueProperty?: string) =>
            update({ valueProperty, subjectRelationId: relationId, confirm: false })
          }
        />
      </label>
      {object.document.factResolution?.state === "stale" && (
        <Alert type="warning" showIcon message={t(`${P}.factResolutionStale`)} />
      )}
      <Checkbox
        disabled={!single}
        checked={!!choice?.confirm && single}
        onChange={(event) =>
          update({
            valueProperty: property,
            subjectRelationId: relationId,
            confirm: event.target.checked,
          })
        }
      >
        {t(`${P}.confirmFactResolution`)}
      </Checkbox>
      {choice && !choice.clear && (
        <Button onClick={() => update({ clear: true, confirm: false })}>
          {t(`${P}.clearFactResolution`)}
        </Button>
      )}
    </Space>
  );
}
