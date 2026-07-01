/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Empty, Input, Segmented } from "antd";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";

import styles from "./ConnectorTypePicker.module.css";

type ConnectorTypePickerProps = {
  onChange: (value: string) => void;
  value?: string;
  options: DataConnectConnectorType[];
};

export function ConnectorTypePicker({
  onChange,
  value,
  options,
}: ConnectorTypePickerProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(options.map((item) => item.category))).map((item) => ({
        label: t(`dataConnect.categories.${item}`),
        value: item,
      })),
    [options, t],
  );

  const filtered = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return options.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.type.toLowerCase().includes(normalizedKeyword) ||
        item.description.toLowerCase().includes(normalizedKeyword);

      return matchesCategory && matchesKeyword;
    });
  }, [category, keyword, options]);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{t("dataConnect.connectorTypeStepTitle")}</h3>
          <p className={styles.description}>{t("dataConnect.connectorTypeStepDescription")}</p>
        </div>
        <Input.Search
          allowClear
          className={styles.search}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("dataConnect.connectorTypeSearchPlaceholder")}
          value={keyword}
        />
      </div>
      <Segmented
        className={styles.segmented}
        onChange={(nextValue) => setCategory(String(nextValue))}
        options={[
          { label: t("dataConnect.categoryAll"), value: "all" },
          ...categories,
        ]}
        value={category}
      />
      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((item) => {
            const active = item.type === value;

            return (
              <button
                className={[styles.card, active ? styles.cardActive : ""].filter(Boolean).join(" ")}
                key={item.type}
                onClick={() => onChange(item.type)}
                type="button"
              >
                <div className={styles.cardHeader}>
                  <strong>{item.name}</strong>
                  <span className={styles.badge}>{t(`dataConnect.categories.${item.category}`)}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>{item.type}</span>
                  <span>{t(`dataConnect.modes.${item.mode}`)}</span>
                </div>
                <p className={styles.cardDescription}>{item.description || "-"}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <Empty description={t("dataConnect.connectorTypeEmpty")} />
      )}
    </div>
  );
}
