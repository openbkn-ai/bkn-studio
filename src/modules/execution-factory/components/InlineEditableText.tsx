/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EditOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useEffect, useRef, useState } from "react";

import styles from "./InlineEditableText.module.css";

type InlineEditableTextProps = {
  /** Enter editing mode on mount for required fields that are empty immediately after creation. */
  autoEdit?: boolean;
  block?: boolean;
  className?: string;
  /** Guidance shown for an empty value; clicking it turns it into an input. */
  emptyLabel: string;
  multiline?: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
};

/**
 * Click to edit. A row of blank form fields gives users no clear starting point, especially for
 * names and descriptions that determine whether a tool is usable. A lightweight entry is friendlier than a blank input.
 */
export function InlineEditableText({
  autoEdit = false,
  block = false,
  className,
  emptyLabel,
  multiline = false,
  onChange,
  placeholder,
  rows = 3,
  value,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<{ focus: () => void } | null>(null);
  // After Escape cancels, unmounting a focused Input triggers another onBlur -> commit. Its closure
  // still holds the edited draft and would restore the cancelled content, so this flag makes the following blur a no-op.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      cancelledRef.current = false;
      inputRef.current?.focus();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      return;
    }
    if (draft !== value) {
      onChange(draft);
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      // Editing mode needs the same width constraint, or the input expands across the row and crowds adjacent content.
      className,
      onBlur: commit,
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
      placeholder,
      value: draft,
    };

    return multiline ? (
      <Input.TextArea
        {...shared}
        autoSize={{ minRows: rows, maxRows: 8 }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancel();
          }
        }}
        ref={inputRef as never}
      />
    ) : (
      <Input
        {...shared}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            cancel();
          }
        }}
        onPressEnter={commit}
        ref={inputRef as never}
      />
    );
  }

  return (
    <button
      className={`${styles.display} ${block ? styles.displayBlock : ""} ${className ?? ""}`}
      onClick={() => setEditing(true)}
      type="button"
    >
      <span
        className={`${styles.text} ${multiline ? styles.textMultiline : ""} ${
          value ? "" : styles.placeholder
        }`}
      >
        {value || emptyLabel}
      </span>
      <EditOutlined className={styles.editIcon} />
    </button>
  );
}
