/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Checkbox, Typography } from "antd";
import { useId, useState } from "react";
import { LimitedTagsSelect } from "@/framework/ui/common/LimitedTagsSelect";
import { ApiConditionEditor } from "./ApiConditionEditor";
import { useTranslation } from "react-i18next";
import { EditorValidity } from "./EditorValidity";
import { replaceMember, valueType } from "./model";
import type { ApiDefinitionEditorProps } from "./types";
import { useEditorValidity } from "./validity";
import styles from "./editor.module.css";

function SuccessStatusesEditor({
  value,
  onChange,
  disabled,
}: {
  value: unknown;
  onChange: (value: number[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [touched, setTouched] = useState(false);
  const statuses = Array.isArray(value) ? value.map(String) : [];
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(statuses).size === statuses.length &&
    value.every((status) => valueType(status) === "number" && /^[1-5]\d{2}$/.test(String(status)));
  const showError = touched && !valid && !disabled;
  useEditorValidity(valid || !!disabled);

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        <Typography.Text type="danger" aria-hidden="true">
          *
        </Typography.Text>{" "}
        {t("dataConnect.apiEditor.allowedStatuses")}
      </label>
      <p className={styles.hint} id={`${id}-hint`}>
        {t("dataConnect.apiEditor.statusesHint")}
      </p>
      <LimitedTagsSelect
        id={id}
        aria-required="true"
        aria-invalid={showError}
        aria-describedby={`${id}-hint${showError ? ` ${id}-error` : ""}`}
        disabled={disabled}
        open={false}
        value={statuses}
        placeholder={t("dataConnect.apiEditor.statusesPlaceholder")}
        limit={500}
        limitMessage={t("dataConnect.apiEditor.errors.status")}
        normalizeTag={(tag) => tag.trim()}
        validateTag={(tag) =>
          /^[1-5]\d{2}$/.test(tag.trim()) ? null : t("dataConnect.apiEditor.errors.status")
        }
        status={showError ? "error" : undefined}
        onBlur={() => setTouched(true)}
        onChange={(tags) => {
          setTouched(true);
          onChange(tags.map(Number));
        }}
      />
      {showError ? (
        <Typography.Text type="danger" role="alert" id={`${id}-error`}>
          {t("dataConnect.apiEditor.errors.status")}
        </Typography.Text>
      ) : null}
    </div>
  );
}

export function ApiSuccessRuleEditor({
  value = {},
  onChange,
  disabled,
  onValidityChange,
}: ApiDefinitionEditorProps) {
  const { t } = useTranslation();
  const success = value;
  const changeSuccess = (key: string, next: unknown) => onChange(replaceMember(value, key, next));
  return (
    <EditorValidity onValidityChange={onValidityChange}>
      <div
        className={`${styles.member} ${styles.sectionCard}`}
        role="group"
        aria-label={t("dataConnect.apiEditor.success")}
      >
        <SuccessStatusesEditor
          value={success.http_status}
          disabled={disabled}
          onChange={(next) => changeSuccess("http_status", next)}
        />
        <Checkbox
          disabled={disabled}
          checked={Object.hasOwn(success, "body_filter_condition")}
          onChange={(event) =>
            changeSuccess(
              "body_filter_condition",
              event.target.checked ? { operation: "and", sub_conditions: [] } : undefined,
            )
          }
        >
          {t("dataConnect.apiEditor.configCondition")}
        </Checkbox>
        {Object.hasOwn(success, "body_filter_condition") ? (
          <ApiConditionEditor
            value={success.body_filter_condition}
            disabled={disabled}
            label={t("dataConnect.apiEditor.condition")}
            onChange={(next) => changeSuccess("body_filter_condition", next)}
          />
        ) : null}
      </div>
    </EditorValidity>
  );
}
