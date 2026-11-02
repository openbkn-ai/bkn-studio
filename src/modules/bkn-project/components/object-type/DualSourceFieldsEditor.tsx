/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { Alert, Card, Checkbox, Select, Space, Table, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";
import type {
  Draft,
  DraftObjectType,
  DraftObjectTypeSave,
  DualSourceChoice,
  DualSourceDecision,
  SourceFieldRule,
} from "@/modules/bkn-project/types/draft";

const P = "bknProject.sourceFields";
const priority = ["effective_time", "evidence_strength", "recorded_at"];
export function DualSourceFieldsEditor({
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
  const saved = object.document?.dualSource;
  const decision = value.document?.dualSource;
  const relations = draft.items.relationTypes.filter((relation) => {
    const target = draft.items.objectTypes.find((item) => item.id === relation.target);
    return (
      relation.source === object.id &&
      relation.cardinality === "one_to_one" &&
      relation.documentMapping?.mode === "linking" &&
      value.primaryKeys.length === 1 &&
      value.primaryKeys[0] === relation.documentMapping.mentionProperty &&
      target &&
      !target.document &&
      Boolean(target.table.resourceId)
    );
  });
  if (object.document?.role !== "entity" || (!relations.length && !saved && !decision)) return null;
  const relationId =
    decision?.relationTypeId ??
    saved?.relationTypeId ??
    (relations.length === 1 ? relations[0].id : "");
  const relation = relations.find((item) => item.id === relationId);
  const system = draft.items.objectTypes.find((item) => item.id === relation?.target);
  const files = draft.items.objectTypes.filter((item) => item.document?.role === "file");
  const fileId = decision?.fileObjectTypeId ?? saved?.fileObjectTypeId ?? "";
  const file = files.find((item) => item.id === fileId);
  const fixed = new Set(
    object.properties.filter((field) => field.readOnly).map((field) => field.name),
  );
  const current = value.properties.filter((field) => !fixed.has(field.name));
  const defaultFields = (
    master: DraftObjectType | undefined,
    sourceFile: DraftObjectType | undefined,
  ): SourceFieldRule[] => {
    const names = new Set([
      ...(master?.properties.filter((field) => !field.readOnly).map((field) => field.name) ?? []),
      ...current.map((field) => field.name),
    ]);
    return [...names].map((name) => {
      const inSystem = master?.properties.some((field) => field.name === name);
      const inText =
        current.some((field) => field.name === name) ||
        sourceFile?.properties.some((field) => field.name === name);
      return {
        name,
        category: inSystem ? (inText ? "both" : "system_only") : "text_only",
        sourceOfRecord: inSystem ? "table" : "document",
        destinationObjectTypeId: inSystem ? (master?.id ?? "") : object.id,
      };
    });
  };
  const fields = decision?.fields ?? saved?.fields ?? defaultFields(system, file);
  const choice: DualSourceChoice = {
    systemObjectTypeId: system?.id ?? "",
    relationTypeId: relation?.id ?? "",
    fileObjectTypeId: file?.id ?? "",
    fields,
  };
  const update = (next: DualSourceDecision) =>
    onChange({
      ...value,
      document: {
        timeProperty: value.document?.timeProperty ?? "",
        participantRelations: value.document?.participantRelations ?? [],
        dualSource: next,
      },
    });
  const change = (index: number, patch: Partial<SourceFieldRule>) =>
    update({
      ...choice,
      confirm: false,
      fields: fields.map((field, at) => {
        if (at !== index) return field;
        const next = { ...field, ...patch };
        if (patch.category) {
          if (patch.category === "system_only" || patch.category === "both") {
            next.sourceOfRecord = "table";
            next.destinationObjectTypeId = system?.id ?? "";
          }
          if (patch.category === "text_only") {
            next.sourceOfRecord = "document";
            next.destinationObjectTypeId = object.id;
          }
          if (patch.category === "temporal") {
            next.sourceOfRecord = "fusion";
            next.destinationObjectTypeId = "";
          }
        }
        next.evidenceOrder = next.sourceOfRecord === "fusion" ? priority : undefined;
        return next;
      }),
    });
  const label = (name: string) =>
    current.find((field) => field.name === name)?.displayName ||
    system?.properties.find((field) => field.name === name)?.displayName ||
    file?.properties.find((field) => field.name === name)?.displayName ||
    draft.items.objectTypes.flatMap((item) => item.properties).find((field) => field.name === name)
      ?.displayName ||
    t(`${P}.changedField`);
  const verified = Boolean(
    relation &&
    system &&
    ((system.primaryKeys.length === 1 &&
      system.primaryKeys[0] === relation.documentMapping?.identityProperty) ||
      relation.documentMapping?.businessIdentity),
  );
  return (
    <Card size="small" title={t(`${P}.title`)}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Alert type="info" showIcon message={t(`${P}.help`)} />
        {saved && !decision && (
          <Alert
            type={saved.state === "confirmed" ? "success" : "warning"}
            showIcon
            message={t(`${P}.state.${saved.state ?? "proposed"}`)}
          />
        )}
        {decision && !decision.clear && (
          <Alert
            type="info"
            showIcon
            message={t(decision.confirm ? `${P}.pendingSave` : `${P}.state.proposed`)}
          />
        )}
        {decision?.clear ? (
          <Alert type="warning" showIcon message={t(`${P}.clearPending`)} />
        ) : (
          <>
            <label>
              {t(`${P}.systemConnection`)}{" "}
              <Select
                style={{ minWidth: 180 }}
                value={relation?.id}
                placeholder={t(`${P}.chooseConnection`)}
                options={relations.map((item) => ({
                  value: item.id,
                  label: item.name || t(`${P}.unnamedModel`),
                }))}
                onChange={(id) => {
                  const selected = relations.find((item) => item.id === id);
                  const master = draft.items.objectTypes.find(
                    (item) => item.id === selected?.target,
                  );
                  update({
                    ...choice,
                    relationTypeId: id,
                    systemObjectTypeId: master?.id ?? "",
                    fields: defaultFields(master, file),
                    confirm: false,
                  });
                }}
              />
            </label>
            <label>
              {t(`${P}.mainFile`)}{" "}
              <Select
                style={{ minWidth: 180 }}
                value={file?.id}
                placeholder={t(`${P}.chooseFile`)}
                options={files.map((item) => ({
                  value: item.id,
                  label: item.name || t(`${P}.unnamedModel`),
                }))}
                onChange={(id) => {
                  const selected = files.find((item) => item.id === id);
                  update({
                    ...choice,
                    fileObjectTypeId: id,
                    fields: defaultFields(system, selected),
                    confirm: false,
                  });
                }}
              />
            </label>
            {file?.description && (
              <Typography.Paragraph type="secondary">{file.description}</Typography.Paragraph>
            )}
            {!verified && <Alert type="warning" showIcon message={t(`${P}.verifyFirst`)} />}
            <Table<SourceFieldRule>
              size="small"
              pagination={false}
              rowKey="name"
              dataSource={fields}
              columns={[
                { title: t(`${P}.field`), render: (_, field) => label(field.name) },
                {
                  title: t(`${P}.placement`),
                  render: (_, field, index) => (
                    <Select
                      value={field.category}
                      style={{ minWidth: 130 }}
                      options={(["system_only", "both", "text_only", "temporal"] as const).map(
                        (category) => ({ value: category, label: t(`${P}.category.${category}`) }),
                      )}
                      onChange={(category: SourceFieldRule["category"]) =>
                        change(index, { category })
                      }
                    />
                  ),
                },
                {
                  title: t(`${P}.authority`),
                  render: (_, field, index) =>
                    field.category === "text_only" ? (
                      <Select
                        value={field.sourceOfRecord}
                        style={{ minWidth: 110 }}
                        options={(["document", "fusion"] as const).map((authority) => ({
                          value: authority,
                          label: t(`${P}.authorityKind.${authority}`),
                        }))}
                        onChange={(sourceOfRecord: SourceFieldRule["sourceOfRecord"]) =>
                          change(index, { sourceOfRecord })
                        }
                      />
                    ) : (
                      t(`${P}.authorityKind.${field.sourceOfRecord}`)
                    ),
                },
                {
                  title: t(`${P}.destination`),
                  render: (_, field, index) =>
                    field.category === "temporal" ? (
                      <Select
                        style={{ minWidth: 140 }}
                        value={
                          draft.items.objectTypes.some(
                            (item) => item.id === field.destinationObjectTypeId,
                          )
                            ? field.destinationObjectTypeId
                            : undefined
                        }
                        placeholder={t(`${P}.chooseFact`)}
                        options={draft.items.objectTypes
                          .filter(
                            (item) =>
                              ["fact", "event"].includes(item.document?.role ?? "") &&
                              item.properties.some(
                                (property) => property.name === field.name && !property.readOnly,
                              ),
                          )
                          .map((item) => ({
                            value: item.id,
                            label: item.name || t(`${P}.unnamedModel`),
                          }))}
                        onChange={(destinationObjectTypeId) =>
                          change(index, { destinationObjectTypeId })
                        }
                      />
                    ) : (
                      draft.items.objectTypes.find(
                        (item) => item.id === field.destinationObjectTypeId,
                      )?.name || t(`${P}.changedDestination`)
                    ),
                },
                {
                  title: t(`${P}.remove`),
                  render: (_, field, index) =>
                    !system?.properties.some((property) => property.name === field.name) &&
                    !current.some((property) => property.name === field.name) ? (
                      <AppButton
                        size="small"
                        onClick={() =>
                          update({
                            ...choice,
                            confirm: false,
                            fields: fields.filter((_, at) => at !== index),
                          })
                        }
                      >
                        {t(`${P}.remove`)}
                      </AppButton>
                    ) : null,
                },
              ]}
            />
            <Select
              style={{ minWidth: 220 }}
              value={undefined}
              placeholder={t(`${P}.addTemporal`)}
              options={draft.items.objectTypes
                .filter((item) => ["fact", "event"].includes(item.document?.role ?? ""))
                .flatMap((item) =>
                  item.properties
                    .filter(
                      (field) => !field.readOnly && !fields.some((row) => row.name === field.name),
                    )
                    .map((field) => ({
                      value: `${item.id}/${field.name}`,
                      label: `${item.name || t(`${P}.unnamedModel`)} · ${field.displayName || t(`${P}.changedField`)}`,
                    })),
                )}
              onChange={(selected: string) => {
                const [destinationObjectTypeId, name] = selected.split("/");
                update({
                  ...choice,
                  confirm: false,
                  fields: [
                    ...fields,
                    {
                      name,
                      category: "temporal",
                      sourceOfRecord: "fusion",
                      destinationObjectTypeId,
                      evidenceOrder: priority,
                    },
                  ],
                });
              }}
            />
            <Typography.Paragraph type="secondary">{t(`${P}.placementHelp`)}</Typography.Paragraph>
            {fields.some((field) => field.sourceOfRecord === "fusion") && (
              <Typography.Paragraph>{t(`${P}.priority`)}</Typography.Paragraph>
            )}
            <Checkbox
              disabled={!relation || !file || !verified || !fields.length}
              checked={decision ? decision.confirm : saved?.state === "confirmed"}
              onChange={(event) => update({ ...choice, confirm: event.target.checked })}
            >
              {t(`${P}.confirm`)}
            </Checkbox>
          </>
        )}
        {(saved || decision) && (
          <AppButton
            size="small"
            onClick={() =>
              decision?.clear
                ? onChange({
                    ...value,
                    document: {
                      timeProperty: value.document?.timeProperty ?? "",
                      participantRelations: value.document?.participantRelations ?? [],
                      dualSource: undefined,
                    },
                  })
                : update({ ...choice, fields: [], confirm: false, clear: true })
            }
          >
            {t(decision?.clear ? `${P}.undoClear` : `${P}.clear`)}
          </AppButton>
        )}
      </Space>
    </Card>
  );
}
