/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseOutlined, DownOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Checkbox, Input, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import type { FunctionParameterDef } from "@/modules/execution-factory/types/function-input";
import { ARRAY_ITEM_NAME } from "@/modules/execution-factory/utils/function-parameter-schema";

import styles from "./FunctionParameterTree.module.css";

const TYPE_OPTIONS = ["string", "integer", "number", "boolean", "object", "array"];

function isNestable(type?: string) {
  return type === "object" || type === "array";
}

/** 后端校验要求 array 恰好 1 个子项；不给的话它会自作主张塞一个 string 子项。 */
function normalizeAfterTypeChange(parameter: FunctionParameterDef): FunctionParameterDef {
  if (parameter.type === "array") {
    const existing = parameter.sub_parameters?.[0];
    return {
      ...parameter,
      sub_parameters: [
        existing ?? { name: ARRAY_ITEM_NAME, type: "string", required: true },
      ],
    };
  }

  if (parameter.type === "object") {
    return { ...parameter, sub_parameters: parameter.sub_parameters ?? [] };
  }

  const rest = { ...parameter };
  delete rest.sub_parameters;
  return rest;
}

type ParameterNodeProps = {
  depth: number;
  onChange: (next: FunctionParameterDef) => void;
  onRemove: () => void;
  parameter: FunctionParameterDef;
  /** array 的唯一子项由结构决定，名字和增删都不该交给用户。 */
  fixedSlot?: boolean;
};

function ParameterNode({
  depth,
  fixedSlot = false,
  onChange,
  onRemove,
  parameter,
}: ParameterNodeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const nestable = isNestable(parameter.type);
  const children = parameter.sub_parameters ?? [];

  const patch = (partial: Partial<FunctionParameterDef>) => {
    onChange({ ...parameter, ...partial });
  };

  const replaceChild = (index: number, next: FunctionParameterDef) => {
    const nextChildren = [...children];
    nextChildren[index] = next;
    patch({ sub_parameters: nextChildren });
  };

  return (
    <div className={`${styles.node} ${depth > 0 ? styles.nodeChild : ""}`}>
      <div className={styles.row}>
        {nestable ? (
          <button
            aria-label={expanded ? t("common.collapse") : t("common.expand")}
            className={styles.caret}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </button>
        ) : (
          <span className={styles.caretPlaceholder} />
        )}
        <Input
          className={styles.name}
          disabled={fixedSlot}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={t("executionFactory.parameterName")}
          size="small"
          value={parameter.name}
        />
        <Select
          className={styles.type}
          onChange={(value) => onChange(normalizeAfterTypeChange({ ...parameter, type: value }))}
          options={TYPE_OPTIONS.map((value) => ({ label: value, value }))}
          size="small"
          value={parameter.type ?? "string"}
        />
        <label className={styles.required}>
          <Checkbox
            checked={Boolean(parameter.required)}
            disabled={fixedSlot}
            onChange={(event) => patch({ required: event.target.checked })}
          />
          {t("executionFactory.parameterRequired")}
        </label>
        {fixedSlot ? null : (
          <button
            aria-label={t("common.delete")}
            className={styles.remove}
            onClick={onRemove}
            type="button"
          >
            <CloseOutlined />
          </button>
        )}
      </div>
      <div className={styles.descRow}>
        <Input
          onChange={(event) => patch({ description: event.target.value })}
          placeholder={t("executionFactory.parameterDescriptionPlaceholder")}
          size="small"
          value={parameter.description}
        />
      </div>
      {nestable && expanded ? (
        <>
          {parameter.type === "array" ? (
            <div className={styles.arrayHint}>{t("executionFactory.parameterArrayItemHint")}</div>
          ) : null}
          <div className={styles.children}>
            {children.map((child, index) => (
              <ParameterNode
                depth={depth + 1}
                fixedSlot={parameter.type === "array"}
                key={index}
                onChange={(next) => replaceChild(index, next)}
                onRemove={() =>
                  patch({ sub_parameters: children.filter((_, at) => at !== index) })
                }
                parameter={child}
              />
            ))}
            {parameter.type === "object" ? (
              <AppButton
                className={styles.addSubButton}
                icon={<PlusOutlined />}
                onClick={() =>
                  patch({
                    sub_parameters: [...children, { name: "", type: "string", required: false }],
                  })
                }
                size="small"
                type="link"
              >
                {t("executionFactory.addSubParameter")}
              </AppButton>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

type FunctionParameterTreeProps = {
  addLabel: string;
  emptyText: string;
  onChange: (next: FunctionParameterDef[]) => void;
  value?: FunctionParameterDef[];
};

export function FunctionParameterTree({
  addLabel,
  emptyText,
  onChange,
  value,
}: FunctionParameterTreeProps) {
  const parameters = value ?? [];

  return (
    <div className={styles.tree}>
      {parameters.length === 0 ? <div className={styles.empty}>{emptyText}</div> : null}
      {parameters.map((parameter, index) => (
        <ParameterNode
          depth={0}
          key={index}
          onChange={(next) => {
            const nextParameters = [...parameters];
            nextParameters[index] = next;
            onChange(nextParameters);
          }}
          onRemove={() => onChange(parameters.filter((_, at) => at !== index))}
          parameter={parameter}
        />
      ))}
      <AppButton
        className={styles.addButton}
        icon={<PlusOutlined />}
        onClick={() => onChange([...parameters, { name: "", type: "string", required: false }])}
        size="small"
      >
        {addLabel}
      </AppButton>
    </div>
  );
}
