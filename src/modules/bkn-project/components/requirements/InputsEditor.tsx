/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Checkbox, Input, Select } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { propertyTypeKey } from "@/modules/bkn-project/components/draft/evidence";
import { objectTypeOf } from "@/modules/bkn-project/components/requirements/inputs";
import type { DraftedItem } from "@/modules/bkn-project/components/requirements/RequirementDialogs";
import { inputReasonText } from "@/modules/bkn-project/components/requirements/requirementMessages";
import type { QuestionInput, RequirementSpec } from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements.editing.inputs";
const ROLES = ["record", "reference_time"];

/**
 * A question's inputs, edited as rows. Which inputs a template takes, and which property may be
 * a reference time, is the server's to say: its refusals show on the row they name.
 */
export function InputsEditor({
  drafted,
  errors,
  inputs,
  onChange,
  onWindowChange,
  relativeWindow,
  spec,
}: {
  drafted: DraftedItem[];
  /** The server's reason for each refused input, by name. */
  errors: Record<string, string>;
  inputs: QuestionInput[];
  onChange: (inputs: QuestionInput[]) => void;
  onWindowChange: (relativeWindow: boolean) => void;
  relativeWindow: boolean;
  spec: RequirementSpec;
}) {
  const { t } = useTranslation();
  // Only concepts the draft maps to an object type can name a property.
  const concepts = spec.concepts.filter((concept) => concept.mapsTo?.kind === "object_type");
  const change = (index: number, patch: Partial<QuestionInput>) =>
    onChange(inputs.map((input, at) => (at === index ? { ...input, ...patch } : input)));

  return (
    <div className={styles.stack}>
      <span className={styles.muted}>{t(`${PREFIX}.hint`)}</span>
      {inputs.map((input, index) => {
        const properties = objectTypeOf(spec, drafted, input.conceptId)?.properties ?? [];
        return (
          <div className={styles.side} key={index}>
            <div className={styles.row}>
              <Input
                aria-label={t(`${PREFIX}.name`)}
                className={styles.inputName}
                maxLength={64}
                onChange={(event) => change(index, { name: event.target.value })}
                placeholder={t(`${PREFIX}.name`)}
                value={input.name}
              />
              <Select
                aria-label={t(`${PREFIX}.concept`)}
                className={styles.inputSelect}
                notFoundContent={t(`${PREFIX}.noConcepts`)}
                onChange={(conceptId: string) => change(index, { conceptId, property: "" })}
                optionFilterProp="label"
                options={concepts.map((concept) => ({ label: concept.term, value: concept.id }))}
                placeholder={t(`${PREFIX}.concept`)}
                showSearch
                value={input.conceptId || undefined}
              />
              <Select
                aria-label={t(`${PREFIX}.property`)}
                className={styles.inputSelect}
                disabled={!properties.length}
                onChange={(property: string) => change(index, { property })}
                optionFilterProp="label"
                options={properties.map((property) => ({
                  label: `${property.displayName || property.name} · ${t(propertyTypeKey(property.type))}`,
                  value: property.name,
                }))}
                placeholder={t(`${PREFIX}.property`)}
                showSearch
                value={input.property || undefined}
              />
              <Select
                aria-label={t(`${PREFIX}.role`)}
                onChange={(role: string) => change(index, { role })}
                options={ROLES.map((role) => ({
                  label: t(`bknProject.requirements.questions.role.${role}`),
                  value: role,
                }))}
                value={input.role}
              />
              <AppButton
                aria-label={t(`${PREFIX}.removeOne`, { name: input.name || index + 1 })}
                danger
                onClick={() => onChange(inputs.filter((_, at) => at !== index))}
                size="small"
                type="link"
              >
                {t(`${PREFIX}.remove`)}
              </AppButton>
            </div>
            {/* The server names an input as it was sent: trimmed. */}
            {input.name.trim() && errors[input.name.trim()] ? (
              <span className={styles.warning}>
                {inputReasonText(t, errors[input.name.trim()])}
              </span>
            ) : null}
          </div>
        );
      })}
      <div className={styles.row}>
        <AppButton
          onClick={() =>
            onChange([...inputs, { conceptId: "", name: "", property: "", role: "record" }])
          }
          size="small"
        >
          {t(`${PREFIX}.add`)}
        </AppButton>
        {inputs.length ? null : <span className={styles.muted}>{t(`${PREFIX}.none`)}</span>}
      </div>
      <Checkbox checked={relativeWindow} onChange={(event) => onWindowChange(event.target.checked)}>
        {t(`${PREFIX}.relativeWindow`)}
      </Checkbox>
    </div>
  );
}
