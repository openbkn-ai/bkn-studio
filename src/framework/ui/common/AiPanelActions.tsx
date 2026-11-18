/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { HistoryOutlined, MenuFoldOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Popover, Tooltip } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * The buttons at the right of an AI conversation's header, the same in every one: a new
 * conversation, the earlier ones where a panel keeps them, and hiding the panel. A panel's own
 * buttons, such as refreshing what it reads, come first.
 *
 * Hiding keeps the conversation: the panel stays mounted while hidden, see `useOpenedOnce`.
 */
export function AiPanelActions({
  children,
  collapse,
  history,
  newChat,
}: {
  /** The panel's own buttons, before these. */
  children?: ReactNode;
  /** Hides the panel; left out on a page that is the conversation itself. */
  collapse?: { label: string; onClick: () => void };
  /** The earlier conversations, opened under the button; left out where none are kept. */
  history?: {
    content: ReactNode;
    disabled?: boolean;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
  newChat: { disabled?: boolean; onClick: () => void };
}) {
  const { t } = useTranslation();
  return (
    <>
      {children}
      <Tooltip title={t("common.aiPanel.newChat")}>
        <Button
          aria-label={t("common.aiPanel.newChat")}
          disabled={newChat.disabled}
          icon={<PlusOutlined />}
          onClick={newChat.onClick}
          size="small"
          type="text"
        />
      </Tooltip>
      {history ? (
        <Popover
          content={history.content}
          onOpenChange={(open) => history.onOpenChange(open && !history.disabled)}
          open={history.open}
          placement="bottomRight"
          title={t("common.aiPanel.history")}
          trigger="click"
        >
          <Tooltip title={t("common.aiPanel.history")}>
            <Button
              aria-expanded={history.open}
              aria-label={t("common.aiPanel.history")}
              disabled={history.disabled}
              icon={<HistoryOutlined />}
              size="small"
              type="text"
            />
          </Tooltip>
        </Popover>
      ) : null}
      {collapse ? (
        <Tooltip title={collapse.label}>
          <Button
            aria-label={collapse.label}
            icon={<MenuFoldOutlined />}
            onClick={collapse.onClick}
            size="small"
            type="text"
          />
        </Tooltip>
      ) : null}
    </>
  );
}
