import { Select } from "antd";

import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";

import { listCategories } from "@/modules/execution-factory-lab/services/capabilities-lab.service";

type CategorySelectProps = {
  value?: string;
  onChange?: (value: string) => void;
};

export function CategorySelect({ value, onChange }: CategorySelectProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "other_category", label: "Other" },
  ]);

  useEffect(() => {
    void listCategories()
      .then((items) => {
        if (items.length === 0) {
          return;
        }
        setOptions(
          items.map((item) => ({
            value: item.categoryType,
            label: item.name,
          })),
        );
      })
      .catch(() => {
        // Keep default option when categories API is unavailable.
      });
  }, []);

  return (
    <Select
      onChange={onChange}
      options={options}
      placeholder={t("executionFactoryLab.categoryPlaceholder")}
      value={value ?? "other_category"}
    />
  );
}
