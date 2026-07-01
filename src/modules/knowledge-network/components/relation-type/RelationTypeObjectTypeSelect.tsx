/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import type { SelectProps } from "antd";
import { useMemo } from "react";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationTypeObjectTypeSelect.module.css";

type ObjectTypeSelectOption = {
  color: string;
  icon?: string;
  label: string;
  name: string;
  value: string;
};

type RelationTypeObjectTypeSelectProps = Omit<
  SelectProps<string, ObjectTypeSelectOption>,
  "options" | "optionRender" | "filterOption"
> & {
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
};

export function RelationTypeObjectTypeSelect({
  objectTypes,
  ...props
}: RelationTypeObjectTypeSelectProps) {
  const options = useMemo(
    () =>
      objectTypes.map((item) => ({
        color: item.color,
        icon: item.icon,
        label: item.name,
        name: item.name,
        value: item.id,
      })),
    [objectTypes],
  );

  return (
    <Select<string, ObjectTypeSelectOption>
      allowClear
      filterOption={(input, option) =>
        (option?.name ?? "").toLowerCase().includes(input.toLowerCase())
      }
      optionRender={(option) => (
        <div className={styles.option} title={option.data?.name}>
          <span
            className={styles.optionIcon}
            style={{ backgroundColor: option.data?.color ?? "#3A93FF" }}
          >
            {renderResourceIcon(option.data?.icon)}
          </span>
          <span className={styles.optionLabel}>{option.label}</span>
        </div>
      )}
      options={options}
      showSearch
      style={{ width: "100%" }}
      {...props}
    />
  );
}
