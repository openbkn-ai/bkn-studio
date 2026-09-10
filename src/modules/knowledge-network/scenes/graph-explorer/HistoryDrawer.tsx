/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined, RedoOutlined } from "@ant-design/icons";
import { Button, Collapse, Drawer, Empty, Tag, Typography } from "antd";
import { useTranslation } from "react-i18next";

import { truncateForDisplay, type HistoryEntry } from "@/modules/knowledge-network/utils/graph-explorer-history";

import styles from "./HistoryDrawer.module.css";

export type HistoryDrawerProps = {
  open: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onCopy: (text: string) => void;
  onRerun: (entry: HistoryEntry) => void;
  onClear: () => void;
};

function formatTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function HistoryDrawer({ open, entries, onClose, onCopy, onRerun, onClear }: HistoryDrawerProps) {
  const { t } = useTranslation();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      mask={false}
      title={t("knowledgeNetwork.graphExplorer.history.title", { count: entries.length })}
      extra={
        <Button size="small" disabled={entries.length === 0} onClick={onClear}>
          {t("knowledgeNetwork.graphExplorer.history.clear")}
        </Button>
      }
    >
      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("knowledgeNetwork.graphExplorer.history.empty")} />
      ) : (
        <Collapse
          size="small"
          items={entries.map((entry) => ({
            key: entry.id,
            label: (
              <div className={styles.head}>
                <span className={styles.time}>{formatTime(entry.at)}</span>
                <Tag color={entry.ok ? "blue" : "red"} className={styles.kind}>
                  {t(`knowledgeNetwork.graphExplorer.history.kinds.${entry.kind}`)}
                </Tag>
                <span className={styles.title} title={entry.title}>
                  {entry.title}
                </span>
                <span className={styles.summary}>
                  {entry.summary} · {entry.ms} ms
                </span>
              </div>
            ),
            children: (
              <div className={styles.body}>
                <div className={styles.sectionHead}>
                  <Typography.Text strong>{t("knowledgeNetwork.graphExplorer.history.input")}</Typography.Text>
                  <span className={styles.actions}>
                    {entry.rerun ? (
                      <Button size="small" icon={<RedoOutlined />} onClick={() => onRerun(entry)}>
                        {t("knowledgeNetwork.graphExplorer.history.rerun")}
                      </Button>
                    ) : null}
                    <Button size="small" icon={<CopyOutlined />} onClick={() => onCopy(truncateForDisplay(entry.input, Number.MAX_SAFE_INTEGER))}>
                      {t("knowledgeNetwork.graphExplorer.history.copy")}
                    </Button>
                  </span>
                </div>
                <pre className={styles.pre}>{truncateForDisplay(entry.input, 4000)}</pre>
                <div className={styles.sectionHead}>
                  <Typography.Text strong type={entry.ok ? undefined : "danger"}>
                    {t("knowledgeNetwork.graphExplorer.history.output")}
                  </Typography.Text>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => onCopy(truncateForDisplay(entry.output))}>
                    {t("knowledgeNetwork.graphExplorer.history.copy")}
                  </Button>
                </div>
                <pre className={styles.pre}>{truncateForDisplay(entry.output, 8000)}</pre>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
