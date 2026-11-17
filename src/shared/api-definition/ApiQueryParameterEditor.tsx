/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AutoComplete, Button, Input } from "antd";
import { useTranslation } from "react-i18next";
import { replaceMember, type DefinitionObject } from "./model";
import styles from "./editor.module.css";

export function ApiQueryParameterEditor({
  value,
  onChange,
  onRemove,
  disabled,
  variableNames,
  label,
}: {
  value: DefinitionObject;
  onChange: (value: DefinitionObject) => void;
  onRemove: () => void;
  disabled?: boolean;
  variableNames: string[];
  label: string;
}) {
  const { t } = useTranslation();
  const change = (key: string, next: string) => onChange(replaceMember(value, key, next));
  return (
    <div className={styles.member} role="group" aria-label={label}>
      <div className={`${styles.memberHeader} ${styles.inlineMemberHeader}`}>
        <label className={styles.inlineField}>
          <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.parameterName")}</span>
          <Input
            aria-label={`${label} ${t("dataConnect.apiEditor.name")}`}
            value={typeof value.name === "string" ? value.name : ""}
            disabled={disabled}
            onChange={(event) => change("name", event.target.value)}
          />
        </label>
        <Button type="text" size="middle" danger disabled={disabled} onClick={onRemove}>
          {t("dataConnect.apiEditor.remove")}
        </Button>
      </div>
      <label className={styles.inlineField}>
        <span className={styles.fieldTitle}>{t("dataConnect.apiEditor.parameterValue")}</span>
        <AutoComplete
          value={typeof value.value === "string" ? value.value : ""}
          disabled={disabled}
          options={variableNames.map((name) => ({ value: `{{ ${name} }}` }))}
          filterOption={(input, option) =>
            (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
          }
          onChange={(next) => change("value", next)}
        >
          <Input aria-label={`${label} ${t("dataConnect.apiEditor.value")}`} disabled={disabled} />
        </AutoComplete>
      </label>
    </div>
  );
}
