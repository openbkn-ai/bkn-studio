/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select } from "antd";
import type { SelectProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import {
  getKnowledgeNetworkObjectType,
  listKnowledgeNetworkObjectTypePage,
} from "@/modules/knowledge-network/services/knowledge-network.service";
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
  filterResolvedOptions?: (
    objectTypes: KnowledgeNetworkObjectTypeRecord[],
  ) => KnowledgeNetworkObjectTypeRecord[];
  networkId?: string;
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onResolvedOptionsChange?: (objectTypes: KnowledgeNetworkObjectTypeRecord[]) => void;
};

const REMOTE_OPTION_LIMIT = 20;

function mergeObjectTypes(
  current: KnowledgeNetworkObjectTypeRecord[],
  incoming: KnowledgeNetworkObjectTypeRecord[],
) {
  const merged = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

export function RelationTypeObjectTypeSelect({
  filterResolvedOptions,
  networkId,
  objectTypes,
  onResolvedOptionsChange,
  onSearch,
  value,
  ...props
}: RelationTypeObjectTypeSelectProps) {
  const [remoteObjectTypes, setRemoteObjectTypes] = useState(objectTypes);
  const [searching, setSearching] = useState(false);
  const searchSequence = useRef(0);
  const searchTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      searchSequence.current += 1;
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    setRemoteObjectTypes((current) => mergeObjectTypes(objectTypes, current));
  }, [objectTypes]);

  useEffect(() => {
    if (!networkId || !value || remoteObjectTypes.some((item) => item.id === value)) {
      return;
    }

    let active = true;
    void getKnowledgeNetworkObjectType(networkId, value)
      .then((record) => {
        if (!active || !record) {
          return;
        }
        const resolved = filterResolvedOptions?.([record]) ?? [record];
        if (resolved.length === 0) {
          return;
        }
        setRemoteObjectTypes((current) => mergeObjectTypes(current, resolved));
        onResolvedOptionsChange?.(resolved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [filterResolvedOptions, networkId, onResolvedOptionsChange, remoteObjectTypes, value]);

  const handleSearch = (keyword: string) => {
    onSearch?.(keyword);
    if (!networkId) {
      return;
    }

    const sequence = ++searchSequence.current;
    setSearching(true);
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
    }
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null;
      if (sequence !== searchSequence.current) {
        return;
      }
      void listKnowledgeNetworkObjectTypePage(networkId, {
        direction: "asc",
        limit: REMOTE_OPTION_LIMIT,
        namePattern: keyword,
        offset: 0,
        sort: "name",
      })
        .then((page) => {
          if (sequence !== searchSequence.current) {
            return;
          }
          const resolved = filterResolvedOptions?.(page.entries) ?? page.entries;
          setRemoteObjectTypes((current) => {
            const selectedObjectType = value
              ? current.find((item) => item.id === value)
              : undefined;
            return selectedObjectType ? mergeObjectTypes(resolved, [selectedObjectType]) : resolved;
          });
          onResolvedOptionsChange?.(resolved);
        })
        .catch(() => {
          if (sequence !== searchSequence.current) {
            return;
          }
          setRemoteObjectTypes((current) => {
            const selectedObjectType = value
              ? current.find((item) => item.id === value)
              : undefined;
            return selectedObjectType ? [selectedObjectType] : [];
          });
        })
        .finally(() => {
          if (sequence === searchSequence.current) {
            setSearching(false);
          }
        });
    }, 250);
  };

  const options = useMemo(
    () =>
      remoteObjectTypes.map((item) => ({
        color: item.color,
        icon: item.icon,
        label: item.name,
        name: item.name,
        value: item.id,
      })),
    [remoteObjectTypes],
  );

  return (
    <Select<string, ObjectTypeSelectOption>
      allowClear
      filterOption={
        networkId
          ? false
          : (input, option) => (option?.name ?? "").toLowerCase().includes(input.toLowerCase())
      }
      loading={searching}
      onSearch={handleSearch}
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
      value={value}
      {...props}
    />
  );
}
