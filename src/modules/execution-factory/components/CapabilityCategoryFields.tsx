/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Select } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listOperatorCategories } from "@/modules/execution-factory/services/category.service";

type CapabilityCategoryFieldsProps = {
  name?: string;
  required?: boolean;
  initialValue?: string;
};

export function CapabilityCategoryFields({
  name = "category",
  required = true,
  initialValue = "other_category",
}: CapabilityCategoryFieldsProps) {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    void (async () => {
      const items = await listOperatorCategories();
      const options = items.map((item) => ({
        value: item.categoryType,
        label: item.name,
      }));
      setCategories(options);

      const current = form.getFieldValue(name) as string | undefined;
      if (!current?.trim()) {
        const preferred =
          options.find((item) => item.value === initialValue)?.value ??
          options.find((item) => item.label.includes("未分类"))?.value ??
          options[0]?.value ??
          initialValue;
        form.setFieldValue(name, preferred);
      }
    })();
  }, [form, initialValue, name]);

  return (
    <Form.Item
      initialValue={initialValue}
      label={t("executionFactory.category")}
      name={name}
      rules={
        required && categories.length > 0
          ? [{ required: true, message: t("common.required") }]
          : undefined
      }
    >
      <Select
        loading={categories.length === 0}
        options={categories}
        showSearch
        optionFilterProp="label"
      />
    </Form.Item>
  );
}
