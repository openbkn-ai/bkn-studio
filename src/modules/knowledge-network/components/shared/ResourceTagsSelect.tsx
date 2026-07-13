/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { Select } from "antd";
import type { RuleObject } from "antd/es/form";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listKnowledgeNetworkTags } from "@/modules/knowledge-network/services/knowledge-network.service";
import { logServiceFallback } from "@/modules/knowledge-network/services/shared/runtime";

const TAG_INVALID_CHARACTERS = [
  "/",
  ":",
  "?",
  "\\",
  '"',
  "<",
  ">",
  "|",
  "：",
  "？",
  "‘",
  "’",
  "“",
  "”",
  "！",
  "《",
  "》",
  ",",
  "#",
  "[",
  "]",
  "{",
  "}",
  "%",
  "&",
  "*",
  "$",
  "^",
  "!",
  "=",
  ".",
  "'",
] as const;

function hasInvalidTagCharacter(tag: string) {
  return tag.split("").some((character) =>
    TAG_INVALID_CHARACTERS.includes(character as (typeof TAG_INVALID_CHARACTERS)[number]),
  );
}

type ResourceTagsSelectProps = {
  onChange?: (value: string[]) => void;
  placeholder?: string;
  value?: string[];
};

export function ResourceTagsSelect({
  onChange,
  placeholder,
  value,
}: ResourceTagsSelectProps) {
  const { t } = useTranslation();
  const [tagOptions, setTagOptions] = useState<string[]>([]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await listKnowledgeNetworkTags();
        setTagOptions(tags);
      } catch (error) {
        logServiceFallback("ResourceTagsSelect.loadTags", error);
        setTagOptions([]);
      }
    };

    void loadTags();
  }, []);

  return (
    <Select
      allowClear
      mode="tags"
      onChange={(nextValue) => {
        const normalized = nextValue
          .map((item) => item.trim())
          .filter(Boolean)
          .sort();

        onChange?.(normalized);
      }}
      placeholder={placeholder ?? t("knowledgeNetwork.tagsPlaceholder")}
      style={{ width: "100%" }}
      value={value}
    >
      {tagOptions.map((tag) => (
        <Select.Option key={tag} value={tag}>
          {tag}
        </Select.Option>
      ))}
    </Select>
  );
}

export function validateKnowledgeNetworkTags(
  t: (key: string) => string,
  _rule: RuleObject,
  value?: unknown,
) {
  const tags = Array.isArray(value) ? (value as string[]) : undefined;
  if (tags && tags.length > 5) {
    return Promise.reject(new Error(t("knowledgeNetwork.tagQuantityLimit")));
  }

  if (tags?.length) {
    for (const tag of tags) {
      if (tag.length > 40) {
        return Promise.reject(new Error(t("knowledgeNetwork.tagLengthLimit")));
      }

      if (hasInvalidTagCharacter(tag)) {
        return Promise.reject(new Error(t("knowledgeNetwork.tagInvalidCharacter")));
      }
    }
  }

  return Promise.resolve();
}
