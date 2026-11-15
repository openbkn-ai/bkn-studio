/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

import styles from "./NoticeList.module.css";

export type Notice = {
  /** Something to do about it, shown at the end of its line. */
  action?: { disabled?: boolean; label: string; onClick: () => void };
  /** More about it, such as a long list of names, shown only when opened. */
  detail?: ReactNode;
  key: string;
  text: ReactNode;
  tone: "info" | "warning";
};

/**
 * What a page wants the reader to know or settle, one quiet line each with its icon and its own
 * action, in place of a stack of colored alerts.
 */
export function NoticeList({ items }: { items: Notice[] }) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<string[]>([]);
  if (!items.length) {
    return null;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const open = opened.includes(item.key);
        return (
          <li className={styles.item} key={item.key}>
            <span
              aria-hidden="true"
              className={item.tone === "warning" ? styles.warning : styles.info}
            >
              {item.tone === "warning" ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
            </span>
            <span className={styles.body}>
              <span className={styles.line}>
                <span>{item.text}</span>
                {item.detail ? (
                  <AppButton
                    aria-expanded={open}
                    className={styles.action}
                    onClick={() =>
                      setOpened(
                        open ? opened.filter((key) => key !== item.key) : [...opened, item.key],
                      )
                    }
                    size="small"
                    type="link"
                  >
                    {t(`bknProject.notices.${open ? "collapse" : "expand"}`)}
                  </AppButton>
                ) : null}
                {item.action ? (
                  <AppButton
                    className={styles.action}
                    disabled={item.action.disabled}
                    onClick={item.action.onClick}
                    size="small"
                    type="link"
                  >
                    {item.action.label}
                  </AppButton>
                ) : null}
              </span>
              {open ? <span className={styles.detail}>{item.detail}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
