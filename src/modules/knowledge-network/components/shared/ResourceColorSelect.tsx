/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CheckOutlined, DownOutlined } from "@ant-design/icons";
import { Popover } from "antd";
import { useEffect, useState } from "react";

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
  const selectedColor = value || DEFAULT_RESOURCE_COLOR;

  useEffect(() => {
    if (!value) {
      onChange?.(DEFAULT_RESOURCE_COLOR);
    }
  }, [onChange, value]);

  const panel = (
    <div className={styles.colorGrid}>
      {COLOR_OPTIONS.map((color) => (
        <button
          className={styles.colorItem}
          key={color}
          onClick={() => {
            onChange?.(color);
            setOpen(false);
          }}
          style={{ backgroundColor: color }}
          type="button"
        >
          {selectedColor === color ? <CheckOutlined className={styles.checkIcon} /> : null}
        </button>
      ))}
    </div>
  );

  return (
    <Popover
      content={panel}
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
