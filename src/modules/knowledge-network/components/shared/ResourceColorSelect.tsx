/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, DownOutlined } from "@ant-design/icons";
import { Popover } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./ResourceColorSelect.module.css";

const COLOR_OPTIONS = [
  "#08979C",
  "#0e5fc5",
  "#323232",
  "#36CFC9",
  "#3A93FF",
  "#52C41A",
  "#8C8C8C",
  "#9254DE",
  "#a0d911",
  "#EB2F96",
  "#FAAD14",
  "#FADB14",
  "#FF4D4F",
  "#FF7A45",
];

export const DEFAULT_RESOURCE_COLOR = COLOR_OPTIONS[1];

type ResourceColorSelectProps = {
  inModal?: boolean;
  onChange?: (value: string) => void;
  value?: string;
};

export function ResourceColorSelect({
  inModal = true,
  onChange,
  value,
}: ResourceColorSelectProps) {
  const [open, setOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedColor = value || DEFAULT_RESOURCE_COLOR;

  const emitColorChange = useCallback(
    (nextColor: string) => {
      if (nextColor === value) {
        return;
      }
      onChangeRef.current?.(nextColor);
    },
    [value],
  );

  // Form.Item 的 onChange 引用不稳定；不要放进依赖，避免空值回填更新环（React #185）。
  useEffect(() => {
    if (!value && selectedColor !== value) {
      onChangeRef.current?.(selectedColor);
    }
  }, [selectedColor, value]);

  const panel = useMemo(
    () => (
      <div className={styles.colorGrid}>
        {COLOR_OPTIONS.map((color) => (
          <button
            className={styles.colorItem}
            key={color}
            onClick={() => {
              emitColorChange(color);
              setOpen(false);
            }}
            style={{ backgroundColor: color }}
            type="button"
          >
            {selectedColor === color ? <CheckOutlined className={styles.checkIcon} /> : null}
          </button>
        ))}
      </div>
    ),
    [emitColorChange, selectedColor],
  );

  return (
    <Popover
      content={open ? panel : null}
      destroyOnHidden
      getPopupContainer={
        inModal
          ? () =>
              (document.querySelector(".ant-modal-wrap") as HTMLElement) ??
              document.body
          : undefined
      }
      onOpenChange={setOpen}
      open={open}
      trigger="click"
    >
      <button className={styles.trigger} type="button">
        <span
          className={styles.prefixSwatch}
          style={{ backgroundColor: selectedColor }}
        />
        <DownOutlined className={styles.triggerIcon} />
      </button>
    </Popover>
  );
}
