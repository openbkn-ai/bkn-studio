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
  /** 挂载时直接进入编辑态，用于「刚新建、名字还空着」这种必填项。 */
  autoEdit?: boolean;
  block?: boolean;
  className?: string;
  /** 空值时展示的引导文案，点一下才变成输入框。 */
  emptyLabel: string;
  multiline?: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
};

/**
 * 点击即编辑。空表单一字排开会让人不知从何下笔，尤其名称/描述这种
 * 「不写清楚整个工具就废掉」的字段，先给个轻量入口比先给个空框友好。
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
  // Escape 取消后，卸载聚焦中的 Input 会再触发一次 onBlur→commit，闭包里仍是改过的
  // draft，会把 Esc 掉的内容写回。用这个标志让紧随其后的 blur 提交空转。
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
      // 编辑态也要吃同一套宽度约束，否则输入框会撑满整行把旁边的东西挤走。
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
