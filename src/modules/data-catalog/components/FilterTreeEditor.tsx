/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Input, Select } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { FieldIdentity } from "@/modules/data-catalog/components/FieldIdentity";
import {
  filterOperationsForField,
  type FilterGroup,
  type FilterNode,
  type FilterOperation,
  type FilterQueryPath,
} from "@/modules/data-catalog/lib/filter-tree";
import type { ResourceSchemaField } from "@/modules/data-catalog/types/data-catalog";

import styles from "./FilterTreeEditor.module.css";

type Props = {
  value: FilterGroup;
  fields: ResourceSchemaField[];
  queryPath?: FilterQueryPath;
} & (
  | { readOnly: true; onChange?: never }
  | { readOnly?: false; onChange: (value: FilterGroup) => void }
);

export function FilterTreeEditor({
  value,
  onChange,
  fields,
  queryPath = "source",
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const fieldOptions = fields
    .filter((field) => filterOperationsForField(field, queryPath).length > 0)
    .map((field) => ({
      label: <FieldIdentity field={field} layout="inline" name={field.name} showNameWhenSame />,
      searchText: `${field.displayName ?? ""} ${field.name} ${field.type}`,
      value: field.name,
    }));

  const updateAt = (path: number[], update: (node: FilterNode) => FilterNode | null) => {
    const replace = (group: FilterGroup, depth: number): FilterGroup => {
      const index = path[depth];
      return {
        ...group,
        children: group.children.flatMap((child, position) => {
          if (position !== index) return [child];
          const next =
            depth === path.length - 1
              ? update(child)
              : child.kind === "group"
                ? replace(child, depth + 1)
                : child;
          return next ? [next] : [];
        }),
      };
    };
    onChange?.(replace(value, 0));
  };

  const renderGroup = (group: FilterGroup, path: number[]) => {
    const setGroup = (next: FilterGroup) => {
      if (!path.length) onChange?.(next);
      else updateAt(path, () => next);
    };
    const add = (node: FilterNode) => {
      if (group.children.length >= 100) return;
      setGroup({ ...group, children: [...group.children, node] });
    };
    return (
      <div className={styles.group} key={path.join("-") || "root"}>
        <div className={styles.toolbar}>
          <span>{t("dataCatalog.filter.match")}</span>
          {readOnly ? (
            <strong className={styles.readOnlyLogic}>
              {t(`dataCatalog.filter.${group.operation}`)}
            </strong>
          ) : (
            <Select
              aria-label={t("dataCatalog.filter.groupLogic")}
              onChange={(operation: "and" | "or") => setGroup({ ...group, operation })}
              options={[
                { label: t("dataCatalog.filter.and"), value: "and" },
                { label: t("dataCatalog.filter.or"), value: "or" },
              ]}
              value={group.operation}
            />
          )}
          <span>{t("dataCatalog.filter.conditions")}</span>
          {!readOnly && path.length ? (
            <AppButton onClick={() => updateAt(path, () => null)} type="link">
              {t("dataCatalog.filter.removeGroup")}
            </AppButton>
          ) : null}
        </div>
        {group.children.map((child, index) => {
          const childPath = [...path, index];
          if (child.kind === "group") return renderGroup(child, childPath);
          const selectedField = fields.find((field) => field.name === child.field);
          return (
            <div className={styles.rule} key={childPath.join("-")}>
              {readOnly ? (
                <>
                  <span className={styles.readOnlyCell}>
                    <FieldIdentity
                      field={selectedField}
                      layout="inline"
                      name={child.field}
                      showNameWhenSame
                    />
                  </span>
                  <span className={styles.readOnlyCell}>{child.operation}</span>
                  <span className={styles.readOnlyCell}>{child.value}</span>
                </>
              ) : (
                <>
                  <Select
                    aria-label={t("dataCatalog.filter.field")}
                    className={styles.fieldSelect}
                    onChange={(field: string) => {
                      const nextField = fields.find((item) => item.name === field);
                      if (!nextField) return;
                      const operations = filterOperationsForField(nextField, queryPath);
                      updateAt(childPath, () => ({
                        ...child,
                        field,
                        operation: operations.includes(child.operation)
                          ? child.operation
                          : (operations[0] ?? "=="),
                      }));
                    }}
                    options={fieldOptions}
                    placeholder={t("dataCatalog.filter.field")}
                    showSearch
                    optionFilterProp="searchText"
                    value={child.field || undefined}
                  />
                  <Select
                    aria-label={t("dataCatalog.filter.operator")}
                    onChange={(operation: FilterOperation) =>
                      updateAt(childPath, () => ({ ...child, operation }))
                    }
                    options={(selectedField
                      ? filterOperationsForField(selectedField, queryPath)
                      : []
                    ).map((operation) => ({ label: operation, value: operation }))}
                    value={child.operation}
                  />
                  <Input
                    aria-label={t("dataCatalog.filter.value")}
                    onChange={(event) =>
                      updateAt(childPath, () => ({ ...child, value: event.target.value }))
                    }
                    placeholder={t("dataCatalog.filter.value")}
                    value={child.value}
                  />
                  <AppButton onClick={() => updateAt(childPath, () => null)} type="link">
                    {t("dataCatalog.filter.removeRule")}
                  </AppButton>
                </>
              )}
            </div>
          );
        })}
        {!readOnly ? (
          <div className={styles.actions}>
            <AppButton
              disabled={group.children.length >= 100 || !fieldOptions.length}
              onClick={() => add({ kind: "rule", field: "", operation: "==", value: "" })}
            >
              {t("dataCatalog.filter.addRule")}
            </AppButton>
            <AppButton
              disabled={group.children.length >= 100}
              onClick={() => add({ kind: "group", operation: "and", children: [] })}
            >
              {t("dataCatalog.filter.addGroup")}
            </AppButton>
          </div>
        ) : null}
      </div>
    );
  };

  return renderGroup(value, []);
}
