/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Input, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import {
  cypherParameterDraft,
  type CypherParameterDraft,
  type CypherRuleDraft,
} from "@/modules/knowledge-network/components/event-class/event-cypher-rule";
import type { KnEventValueFrom } from "@/modules/knowledge-network/types/event-type";

import styles from "./EventClassFormDrawer.module.css";

function displayValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

type EventCypherRuleEditorProps = {
  onChange: (draft: CypherRuleDraft) => void;
  value: CypherRuleDraft;
};

/** A Cypher query whose rows are the objects found, and the parameters it names. */
export function EventCypherRuleEditor({ onChange, value }: EventCypherRuleEditorProps) {
  const { t } = useTranslation();
  const updateRow = (id: number, patch: Partial<CypherParameterDraft>) =>
    onChange({
      ...value,
      parameters: value.parameters.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });

  return (
    <div className={styles.parameters}>
      <Input.TextArea
        aria-label={t("knowledgeNetwork.eventClasses.form.cypherQuery")}
        autoSize={{ maxRows: 14, minRows: 5 }}
        className={styles.cypher}
        onChange={(event) => onChange({ ...value, query: event.target.value })}
        placeholder={t("knowledgeNetwork.eventClasses.form.cypherQueryPlaceholder")}
        spellCheck={false}
        value={value.query}
      />
      <Typography.Text className={styles.parameterHint} type="secondary">
        {t("knowledgeNetwork.eventClasses.form.cypherHint")}
      </Typography.Text>
      <Typography.Text strong>{t("knowledgeNetwork.eventClasses.form.parameters")}</Typography.Text>
      {value.parameters.map((row) => (
        <div className={styles.cypherParameter} key={row.id}>
          <Input
            aria-label={t("knowledgeNetwork.eventClasses.form.cypherParameterName")}
            className={styles.cypherParameterName}
            onChange={(event) => updateRow(row.id, { name: event.target.value })}
            placeholder={t("knowledgeNetwork.eventClasses.form.cypherParameterName")}
            prefix="$"
            value={row.name}
          />
          <Select
            aria-label={t("knowledgeNetwork.eventClasses.form.parameterMode")}
            className={styles.parameterMode}
            onChange={(valueFrom: KnEventValueFrom) =>
              updateRow(row.id, { value: undefined, value_from: valueFrom })
            }
            options={[
              { label: t("knowledgeNetwork.eventClasses.form.parameterFixed"), value: "const" },
              {
                label: t("knowledgeNetwork.eventClasses.form.valueFromCheckTime"),
                value: "check_time",
              },
              {
                label: t("knowledgeNetwork.eventClasses.form.valueFromCheckDate"),
                value: "check_date",
              },
            ]}
            value={row.value_from}
          />
          <Input
            aria-label={
              row.value_from === "const"
                ? t("knowledgeNetwork.eventClasses.form.parameterValue")
                : t("knowledgeNetwork.eventClasses.form.offset")
            }
            className={styles.cypherParameterValue}
            onChange={(event) => updateRow(row.id, { value: event.target.value })}
            placeholder={
              row.value_from === "const"
                ? t("knowledgeNetwork.eventClasses.form.parameterValue")
                : row.value_from === "check_date"
                  ? t("knowledgeNetwork.eventClasses.form.offsetDatePlaceholder")
                  : t("knowledgeNetwork.eventClasses.form.offsetTimePlaceholder")
            }
            title={
              row.value_from === "const"
                ? undefined
                : t("knowledgeNetwork.eventClasses.form.offsetHint")
            }
            value={displayValue(row.value)}
          />
          <AppButton
            aria-label={t("common.delete")}
            icon={<DeleteOutlined />}
            onClick={() =>
              onChange({
                ...value,
                parameters: value.parameters.filter((item) => item.id !== row.id),
              })
            }
            type="text"
          />
        </div>
      ))}
      <div>
        <AppButton
          icon={<PlusOutlined />}
          onClick={() =>
            onChange({ ...value, parameters: [...value.parameters, cypherParameterDraft("")] })
          }
          size="small"
        >
          {t("knowledgeNetwork.eventClasses.form.cypherParameterAdd")}
        </AppButton>
      </div>
    </div>
  );
}
