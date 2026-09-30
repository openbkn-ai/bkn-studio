/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Select, Typography } from "antd";
import type { SelectProps } from "antd";
import { useState } from "react";

import styles from "./LimitedTagsSelect.module.css";

type LimitedTagsSelectProps = Omit<SelectProps<string[]>, "mode" | "onChange"> & {
  limit: number;
  limitMessage: string;
  normalizeTag?: (tag: string) => string;
  onChange?: (tags: string[]) => void;
  validateTag?: (tag: string) => string | null;
};

export function LimitedTagsSelect({
  limit,
  limitMessage,
  normalizeTag,
  onChange,
  onInputKeyDown,
  validateTag,
  value,
  ...selectProps
}: LimitedTagsSelectProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (nextTags: string[]) => {
    if (nextTags.length > limit) {
      setErrorMessage(limitMessage);
      return;
    }
    const addedTags = nextTags.filter((tag) => !value?.includes(tag));
    for (const tag of addedTags) {
      const error = validateTag?.(tag);
      if (error) {
        setErrorMessage(error);
        return;
      }
    }
    setErrorMessage(null);
    onChange?.(normalizeTag ? nextTags.map(normalizeTag) : nextTags);
  };

  return (
    <div className={styles.root}>
      <Select
        {...selectProps}
        mode="tags"
        onChange={handleChange}
        onInputKeyDown={(event) => {
          onInputKeyDown?.(event);
          if (
            event.key === "Enter" &&
            event.currentTarget.value?.trim() === "" &&
            event.currentTarget.value
          ) {
            setErrorMessage(validateTag?.(event.currentTarget.value) ?? null);
          }
        }}
        value={value ?? []}
      />
      {errorMessage ? (
        <Typography.Text role="alert" type="danger">
          {errorMessage}
        </Typography.Text>
      ) : null}
    </div>
  );
}
