/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getKnowledgeNetworkObjectType,
  listKnowledgeNetworkObjectTypePage,
} from "@/modules/knowledge-network/services/object-type.service";

import styles from "@/modules/knowledge-network/components/shared/ResourceListPanel.module.css";

type ObjectTypeRemoteFilterProps = {
  label: string;
  networkId: string;
  onChange: (value: string) => void;
  value: string;
};

export function ObjectTypeRemoteFilter({
  label,
  networkId,
  onChange,
  value,
}: ObjectTypeRemoteFilterProps) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const optionsRef = useRef(options);
  const [selectedOption, setSelectedOption] = useState<{ label: string; value: string }>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listKnowledgeNetworkObjectTypePage(networkId, {
      direction: "asc",
      limit: 20,
      namePattern: debouncedKeyword,
      offset: 0,
      sort: "name",
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        const next = result.entries.map((item) => ({ label: item.name, value: item.id }));
        optionsRef.current = next;
        setOptions(next);
      })
      .catch(() => {
        if (!cancelled) {
          optionsRef.current = [];
          setOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword, networkId]);

  useEffect(() => {
    let cancelled = false;
    if (value === "all") {
      setSelectedOption(undefined);
      return () => {
        cancelled = true;
      };
    }
    const existing = optionsRef.current.find((item) => item.value === value);
    if (existing) {
      setSelectedOption(existing);
      return () => {
        cancelled = true;
      };
    }
    setSelectedOption(undefined);
    void getKnowledgeNetworkObjectType(networkId, value)
      .then((item) => {
        if (!cancelled && item) {
          setSelectedOption({ label: item.name, value: item.id });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [networkId, value]);

  const displayedOptions = useMemo(() => {
    if (
      !selectedOption ||
      selectedOption.value !== value ||
      options.some((item) => item.value === selectedOption.value)
    ) {
      return options;
    }
    return [...options, selectedOption];
  }, [options, selectedOption, value]);

  return (
    <div className={styles.filterGroup}>
      <span className={styles.filterLabel}>{label}</span>
      <Select
        allowClear
        className={styles.filterSelect}
        filterOption={false}
        loading={loading}
        onChange={(nextValue) => onChange(nextValue || "all")}
        onSearch={setKeyword}
        options={displayedOptions}
        placeholder={t("common.all")}
        showSearch
        value={value === "all" ? undefined : value}
      />
    </div>
  );
}
