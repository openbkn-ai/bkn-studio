/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Radio, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  getKnowledgeNetworkRelationTypeDetail,
  listKnowledgeNetworkRelationTypePage,
} from "../../services/relation-type.service";
import type { KnowledgeNetworkRelationTypeRecord } from "../../types/relation-type";
import { getActionRelationAnchor } from "../../utils/action-type-operation";

type Props = {
  networkId: string;
  objectTypeId: string;
  onRelationChange: (relation: KnowledgeNetworkRelationTypeRecord | null) => void;
  onRelationTypeChange?: () => void;
};

export function ActionTypeRelationFields({
  networkId,
  objectTypeId,
  onRelationChange,
  onRelationTypeChange,
}: Props) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const relationTypeId = Form.useWatch("relationTypeId", form) as string | undefined;
  const anchor = Form.useWatch("relationAnchor", form) as "source" | "target" | undefined;
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [selected, setSelected] = useState<KnowledgeNetworkRelationTypeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incident = (relation: KnowledgeNetworkRelationTypeRecord) =>
    Boolean(objectTypeId) &&
    (relation.sourceObjectTypeId === objectTypeId || relation.targetObjectTypeId === objectTypeId);
  const current =
    selected && selected.id === relationTypeId && incident(selected) ? selected : null;
  const selfRelation =
    current?.sourceObjectTypeId === objectTypeId && current?.targetObjectTypeId === objectTypeId;

  useEffect(() => {
    onRelationChange(current);
  }, [current, onRelationChange]);
  useEffect(() => {
    if (!current) return;
    const inferred = getActionRelationAnchor(current, objectTypeId);
    if (inferred) form.setFieldValue("relationAnchor", inferred);
  }, [current, form, objectTypeId]);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setError(null);
    if (!objectTypeId) {
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listKnowledgeNetworkRelationTypePage(networkId, {
        boundObjectTypeId: objectTypeId,
        direction: "asc",
        limit: 20,
        namePattern: keyword,
        offset: 0,
        sort: "name",
      })
        .then((result) => {
          if (!cancelled) setItems(result.entries);
        })
        .catch((reason) => {
          if (!cancelled) setError(extractRequestErrorMessage(reason));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword, networkId, objectTypeId]);

  useEffect(() => {
    setSelected(null);
    if (!relationTypeId || !objectTypeId) return;
    let cancelled = false;
    void getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId)
      .then((result) => {
        if (!cancelled) setSelected(result);
      })
      .catch((reason) => {
        if (!cancelled) setError(extractRequestErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, relationTypeId, objectTypeId]);

  const options = useMemo(
    () =>
      [
        ...items.filter(
          (item) =>
            Boolean(objectTypeId) &&
            (item.sourceObjectTypeId === objectTypeId || item.targetObjectTypeId === objectTypeId),
        ),
        ...(current && !items.some((item) => item.id === current.id) ? [current] : []),
      ].map((item) => ({ label: item.name, value: item.id })),
    [current, items, objectTypeId],
  );

  useEffect(() => {
    if (
      relationTypeId &&
      form.getFieldError("relationTypeId").length > 0 &&
      options.some((option) => option.value === relationTypeId)
    ) {
      void form.validateFields(["relationTypeId"]).catch(() => undefined);
    }
  }, [form, options, relationTypeId]);

  return (
    <>
      {error ? <Alert message={error} showIcon type="error" /> : null}
      <Form.Item
        label={t("knowledgeNetwork.actionRelationType")}
        name="relationTypeId"
        rules={[
          { required: true, message: t("common.required") },
          {
            validator: (_, value: string) =>
              !value || options.some((option) => option.value === value)
                ? Promise.resolve()
                : Promise.reject(new Error(t("knowledgeNetwork.actionRelationBoundRequired"))),
          },
        ]}
      >
        <Select
          disabled={!objectTypeId}
          showSearch
          filterOption={false}
          loading={loading}
          onSearch={setKeyword}
          onChange={(nextId: string) => {
            if (nextId !== relationTypeId) {
              form.setFieldValue("relationAnchor", undefined);
              onRelationTypeChange?.();
            }
          }}
          notFoundContent={t("knowledgeNetwork.actionRelationBoundEmpty")}
          options={options}
          placeholder={t(
            objectTypeId
              ? "knowledgeNetwork.actionRelationTypePlaceholder"
              : "knowledgeNetwork.actionRelationObjectFirst",
          )}
        />
      </Form.Item>
      {current ? (
        <p>
          {current.sourceObjectTypeName || current.sourceObjectTypeId}
          {anchor === "source" ? `（${t("knowledgeNetwork.actionRelationCurrentObject")}）` : ""}
          {" → "}
          {current.name}
          {" → "}
          {current.targetObjectTypeName || current.targetObjectTypeId}
          {anchor === "target" ? `（${t("knowledgeNetwork.actionRelationCurrentObject")}）` : ""}
        </p>
      ) : null}
      <Form.Item
        hidden={!selfRelation}
        label={t("knowledgeNetwork.actionRelationAnchor")}
        name="relationAnchor"
        rules={[{ required: true, message: t("knowledgeNetwork.actionRelationAnchorRequired") }]}
      >
        <Radio.Group
          options={[
            { label: t("knowledgeNetwork.actionRelationAnchorSource"), value: "source" },
            { label: t("knowledgeNetwork.actionRelationAnchorTarget"), value: "target" },
          ]}
          onChange={onRelationTypeChange}
        />
      </Form.Item>
    </>
  );
}
