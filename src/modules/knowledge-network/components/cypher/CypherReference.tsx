/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button, Drawer, Typography } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cypherReference } from "@/modules/knowledge-network/cypher/cypher-reference";

import styles from "./CypherReference.module.css";

/** The Cypher the page runs, section by section, each example one click from the editor. */
export function CypherReference({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  /** Puts an example in the editor; the reader renames its placeholders before running it. */
  onUse: (query: string) => void;
}) {
  const { t, i18n } = useTranslation();
  // Test doubles of useTranslation may leave i18n out.
  const language = (i18n as { language?: string } | undefined)?.language ?? "zh-CN";
  const sections = useMemo(() => cypherReference(language), [language]);

  return (
    <Drawer
      data-testid="cypher-reference"
      onClose={onClose}
      open={open}
      title={t("knowledgeNetwork.cypherQuery.reference.title")}
      width={560}
    >
      <Typography.Paragraph className={styles.intro} type="secondary">
        {t("knowledgeNetwork.cypherQuery.reference.intro")}
      </Typography.Paragraph>
      {sections.map((section) => (
        <section className={styles.section} key={section.title}>
          <Typography.Title className={styles.title} level={5}>
            {section.title}
          </Typography.Title>
          <ul className={styles.rules}>
            {section.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {section.examples?.map((example) => (
            <div className={styles.example} key={example.query}>
              {example.note ? <div className={styles.note}>{example.note}</div> : null}
              <pre className={styles.code}>{example.query}</pre>
              <Button
                className={styles.use}
                data-testid="cypher-reference-use"
                onClick={() => {
                  onUse(example.query);
                  onClose();
                }}
                size="small"
                type="link"
              >
                {t("knowledgeNetwork.cypherQuery.reference.use")}
              </Button>
            </div>
          ))}
        </section>
      ))}
    </Drawer>
  );
}
