/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowRightOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useState, type ReactNode } from "react";

import { NetworkSelect } from "@/modules/knowledge-network/scenes/NetworkSelect";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./NetworkPickerGuide.module.css";

/**
 * A guide on the left and a knowledge network picker on the right, for pages that need a network
 * before they can show anything. The picker loads networks lazily (see `NetworkSelect`) and hands
 * the chosen one to `onOpen`.
 */
export function NetworkPickerGuide({
  guideTitle,
  guideDescription,
  steps,
  eyebrow,
  title,
  actionLabel,
  notice,
  onOpen,
}: {
  guideTitle: string;
  guideDescription: string;
  steps: string[];
  eyebrow: string;
  title: string;
  actionLabel: string;
  /** Shown under the picker, e.g. why an earlier choice is gone. */
  notice?: ReactNode;
  onOpen: (network: KnowledgeNetworkRecord) => void;
}) {
  const [selected, setSelected] = useState<KnowledgeNetworkRecord | null>(null);

  return (
    <section className={styles.page}>
      <aside className={styles.guide}>
        <h2 className={styles.title}>{guideTitle}</h2>
        <p className={styles.description}>{guideDescription}</p>
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>

      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 className={styles.contentTitle}>{title}</h2>
        </div>

        <div className={styles.picker}>
          <NetworkSelect value={selected} onChange={setSelected} ariaLabel={title} />
          <Button
            type="primary"
            disabled={!selected}
            onClick={() => {
              if (selected) onOpen(selected);
            }}
          >
            {actionLabel} <ArrowRightOutlined />
          </Button>
        </div>

        {notice ? <p className={styles.note}>{notice}</p> : null}
      </div>
    </section>
  );
}
