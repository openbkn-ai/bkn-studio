/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import type { SelectProps } from "antd";

import { FieldTypeIcon } from "@/modules/knowledge-network/components/object-type/data-attribute/FieldTypeIcon";

import styles from "./RelationTypePropertySelect.module.css";

export type RelationTypePropertyOption = {
  comment?: string;
  displayName: string;
  label: string;
  name: string;
  type: string;
  value: string;
};

type RelationTypePropertySelectProps = Omit<
  SelectProps<string, RelationTypePropertyOption>,
  "options" | "optionRender"
> & {
  fields: RelationTypePropertyOption[];
};

export function RelationTypePropertySelect({
  fields,
  ...props
}: RelationTypePropertySelectProps) {
  return (
    <Select<string, RelationTypePropertyOption>
      allowClear
      optionFilterProp="label"
      optionRender={(option) => (
        <div className={styles.option} title={option.data?.displayName || option.data?.name}>
          <FieldTypeIcon type={option.data?.type} />
          <span className={styles.optionLabel}>{option.label}</span>
        </div>
      )}
      options={fields}
      showSearch
      style={{ width: "100%" }}
      {...props}
    />
  );
}
