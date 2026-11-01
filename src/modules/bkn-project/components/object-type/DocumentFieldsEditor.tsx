/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Card, Input, Modal, Select, Space, Typography } from "antd";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { readDocumentSamples } from "@/modules/bkn-project/services/draft.service";
import type {
  Draft,
  DraftObjectType,
  DraftObjectTypeSave,
  SamplePreview,
} from "@/modules/bkn-project/types/draft";
import { originalLocation, renameDocumentProperty, selectedExample } from "./document-values";

const P = "bknProject.documentEditor";
export function DocumentFieldsEditor({
  object,
  draft,
  projectId,
  value,
  onChange,
}: {
  object: DraftObjectType;
  draft: Draft;
  projectId: string;
  value: DraftObjectTypeSave;
  onChange: (value: DraftObjectTypeSave) => void;
}) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<number | null>(null);
  const [preview, setPreview] = useState<SamplePreview | null>(null);
  const [fragment, setFragment] = useState(0);
  const [quote, setQuote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  useEffect(
    () => () => {
      ++epoch.current;
    },
    [],
  );
  const fixed = object.document?.role.startsWith("evidence_");
  const readonly = new Set(object.properties.filter((p) => p.readOnly).map((p) => p.name));
  const changeProperty = (at: number, patch: Partial<DraftObjectTypeSave["properties"][number]>) =>
    onChange({
      ...value,
      properties: value.properties.map((p, i) => (i === at ? { ...p, ...patch } : p)),
    });
  const openExamples = async (at: number) => {
    if (!object.document) return;
    const request = ++epoch.current;
    setPicker(at);
    setPreview(null);
    setQuote("");
    setFragment(0);
    setError("");
    setLoading(true);
    try {
      const next = await readDocumentSamples(
        projectId,
        object.document.selectionId,
        object.document.selectionRevision,
      );
      if (request === epoch.current) setPreview(next);
    } catch (e) {
      if (request === epoch.current) setError(extractRequestErrorMessage(e));
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  };
  const closeExamples = () => {
    ++epoch.current;
    setLoading(false);
    setPicker(null);
    setPreview(null);
    setQuote("");
    setError("");
  };
  const chosen = preview?.fragments[fragment];
  const citation = chosen ? selectedExample(chosen, quote) : null;
  const addExample = () => {
    if (picker === null || !citation) return;
    const p = value.properties[picker];
    changeProperty(picker, {
      extraction: {
        instruction: p.extraction?.instruction ?? "",
        examples: [...(p.extraction?.examples ?? []), citation],
      },
    });
    closeExamples();
  };
  const fields = value.properties.map((p) => ({ label: p.displayName || p.name, value: p.name }));
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message={t(`${P}.source`)}
        description={object.document?.reason}
      />
      {object.document?.citations.map((q, i) => (
        <Typography.Link
          key={`${q.blockId}-${q.start}-${i}`}
          href={originalLocation(q)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t(`${P}.original`, { number: i + 1 })}
        </Typography.Link>
      ))}
      {!fixed && (
        <Space wrap>
          {object.document?.role === "entity" && (
            <label>
              {t(`${P}.identity`)}{" "}
              <Select
                style={{ minWidth: 180 }}
                mode="multiple"
                disabled={object.document?.role !== "entity"}
                value={value.primaryKeys}
                options={fields.filter((p) => !readonly.has(p.value))}
                onChange={(primaryKeys) => onChange({ ...value, primaryKeys })}
              />
            </label>
          )}
          <label>
            {t(`${P}.display`)}{" "}
            <Select
              style={{ minWidth: 180 }}
              allowClear
              value={value.displayKey || undefined}
              options={fields}
              onChange={(key) => onChange({ ...value, displayKey: key ?? "" })}
            />
          </label>
        </Space>
      )}
      {object.document?.role === "event" && (
        <Space wrap>
          <label>
            {t(`${P}.time`)}{" "}
            <Select
              style={{ minWidth: 180 }}
              value={value.document?.timeProperty || undefined}
              options={fields.filter((f) =>
                value.properties.some(
                  (p) =>
                    p.name === f.value &&
                    ["date", "time", "datetime", "timestamp"].includes(p.type),
                ),
              )}
              onChange={(timeProperty) =>
                onChange({
                  ...value,
                  document: {
                    timeProperty,
                    participantRelations: value.document?.participantRelations ?? [],
                  },
                })
              }
            />
          </label>
          <label>
            {t(`${P}.participants`)}{" "}
            <Select
              mode="multiple"
              style={{ minWidth: 240 }}
              value={value.document?.participantRelations ?? []}
              options={draft.items.relationTypes
                .filter(
                  (r) =>
                    r.document?.role === "relation" &&
                    (r.source === object.id || r.target === object.id),
                )
                .map((r) => ({ label: r.name, value: r.id }))}
              onChange={(participantRelations) =>
                onChange({
                  ...value,
                  document: {
                    timeProperty: value.document?.timeProperty ?? "",
                    participantRelations,
                  },
                })
              }
            />
          </label>
        </Space>
      )}
      {value.properties.map((p, i) =>
        readonly.has(p.name) || fixed ? (
          <Card size="small" key={p.name} title={p.displayName || p.name}>
            <Typography.Text type="secondary">{t(`${P}.managed`)}</Typography.Text>
            <p>{p.description}</p>
          </Card>
        ) : (
          <Card
            size="small"
            key={i}
            title={p.displayName || t(`${P}.newField`)}
            extra={
              <AppButton
                danger
                onClick={() =>
                  onChange({
                    ...value,
                    properties: value.properties.filter((_, at) => at !== i),
                    primaryKeys: value.primaryKeys.filter((k) => k !== p.name),
                    displayKey: value.displayKey === p.name ? "" : value.displayKey,
                  })
                }
              >
                {t(`${P}.remove`)}
              </AppButton>
            }
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <label>
                {t(`${P}.fieldName`)}
                <Input
                  value={p.displayName}
                  maxLength={128}
                  onChange={(e) => changeProperty(i, { displayName: e.target.value })}
                />
              </label>
              <label>
                {t(`${P}.apiName`)}
                <Input
                  value={p.name}
                  maxLength={40}
                  onChange={(e) => onChange(renameDocumentProperty(value, i, e.target.value))}
                />
              </label>
              <label>
                {t(`${P}.type`)}{" "}
                <Select
                  value={p.type}
                  style={{ minWidth: 180 }}
                  options={[
                    "string",
                    "text",
                    "integer",
                    "unsigned integer",
                    "float",
                    "decimal",
                    "boolean",
                    "date",
                    "time",
                    "datetime",
                    "timestamp",
                    "json",
                  ].map((type) => ({ value: type, label: t(`${P}.types.${type}`) }))}
                  onChange={(type) => changeProperty(i, { type })}
                />
              </label>
              <label>
                {t(`${P}.description`)}
                <Input.TextArea
                  value={p.description}
                  maxLength={1000}
                  onChange={(e) => changeProperty(i, { description: e.target.value })}
                />
              </label>
              <label>
                {t(`${P}.instruction`)}
                <Input.TextArea
                  value={p.extraction?.instruction ?? ""}
                  maxLength={1000}
                  showCount
                  onChange={(e) =>
                    changeProperty(i, {
                      extraction: {
                        instruction: e.target.value,
                        examples: p.extraction?.examples ?? [],
                      },
                    })
                  }
                />
              </label>
              <Typography.Text>{t(`${P}.examples`)}</Typography.Text>
              {(p.extraction?.examples ?? []).map((q, at) => (
                <Space key={`${q.blockId}-${q.start}-${at}`}>
                  <Typography.Link
                    href={originalLocation(q)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t(`${P}.original`, { number: at + 1 })}
                  </Typography.Link>
                  <AppButton
                    onClick={() =>
                      changeProperty(i, {
                        extraction: {
                          instruction: p.extraction?.instruction ?? "",
                          examples: p.extraction!.examples.filter((_, index) => index !== at),
                        },
                      })
                    }
                  >
                    {t(`${P}.remove`)}
                  </AppButton>
                </Space>
              ))}
              <AppButton
                disabled={(p.extraction?.examples.length ?? 0) >= 20}
                onClick={() => void openExamples(i)}
              >
                {t(`${P}.selectExample`)}
              </AppButton>
            </Space>
          </Card>
        ),
      )}
      {!fixed && (
        <AppButton
          onClick={() =>
            onChange({
              ...value,
              properties: [
                ...value.properties,
                {
                  name: "",
                  displayName: "",
                  description: "",
                  type: "string",
                  extraction: { instruction: "", examples: [] },
                },
              ],
            })
          }
        >
          {t(`${P}.add`)}
        </AppButton>
      )}
      <Modal
        open={picker !== null}
        title={t(`${P}.selectExample`)}
        onCancel={closeExamples}
        onOk={addExample}
        okButtonProps={{ disabled: !citation || loading }}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert type="info" message={t(`${P}.debugOnly`)} />
          {error && <Alert type="error" message={error} />}
          <Select
            loading={loading}
            style={{ width: "100%" }}
            value={fragment}
            options={preview?.fragments.map((f, i) => ({
              value: i,
              label: t(`${P}.fragment`, { file: f.fileName, number: i + 1 }),
            }))}
            onChange={(i) => {
              setFragment(i);
              setQuote("");
            }}
          />
          <Input.TextArea
            readOnly
            value={chosen?.text ?? ""}
            autoSize={{ minRows: 4, maxRows: 12 }}
          />
          <label>
            {t(`${P}.quote`)}
            <Input.TextArea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              maxLength={8000}
            />
          </label>
          {quote && !citation && (
            <Typography.Text type="danger">{t(`${P}.invalidExample`)}</Typography.Text>
          )}
        </Space>
      </Modal>
    </Space>
  );
}
