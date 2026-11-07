/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Select } from "antd";
import { useTranslation } from "react-i18next";

import {
  ALIAS_MAX_LENGTH,
  ALIASES_MAX,
  ALIASES_PREFIX as PREFIX,
  aliasProblem,
} from "@/modules/bkn-project/components/draft/aliases";

/**
 * The aliases field of an item's form, under `name`: one tag per alias, typed and confirmed with
 * Enter; a comma separates two, as an alias holds none. `ownNames` are the item's own names,
 * which an alias may not repeat.
 */
export function AliasesField({
  disabled,
  ownNames,
}: {
  disabled?: boolean;
  ownNames: readonly string[];
}) {
  const { t } = useTranslation();
  return (
    <Form.Item
      extra={t(`${PREFIX}.help`, { max: ALIASES_MAX, length: ALIAS_MAX_LENGTH })}
      label={t(`${PREFIX}.label`)}
      name="aliases"
      rules={[
        {
          validator: (_, value: string[] | undefined) => {
            const problem = aliasProblem(t, value, ownNames);
            return problem ? Promise.reject(new Error(problem)) : Promise.resolve();
          },
        },
      ]}
    >
      <Select
        aria-label={t(`${PREFIX}.label`)}
        disabled={disabled}
        mode="tags"
        notFoundContent={null}
        open={false}
        placeholder={t(`${PREFIX}.placeholder`)}
        suffixIcon={null}
        tokenSeparators={[",", "，"]}
      />
    </Form.Item>
  );
}
