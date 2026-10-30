/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Drawer, Spin } from "antd";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { Citing } from "@/modules/bkn-project/components/requirements/citing";
import { getDocument } from "@/modules/bkn-project/services/requirements.service";
import type {
  RequirementCitation,
  RequirementDocumentContent,
} from "@/modules/bkn-project/types/requirements";

import styles from "./Requirements.module.css";

const PREFIX = "bknProject.requirements";

/** The passages an item quotes, each with its document and a link to it. */
export function Citations({
  citations,
  supplementReason = "",
}: {
  citations: RequirementCitation[];
  supplementReason?: string;
}) {
  const { t } = useTranslation();
  const { documentName, openDocument } = useContext(Citing);
  if (!citations.length) {
    return supplementReason ? (
      <p className={styles.muted}>{t(`${PREFIX}.supplement`, { reason: supplementReason })}</p>
    ) : null;
  }
  return (
    <div className={styles.stack}>
      {citations.map((citation, index) => (
        <blockquote className={styles.quote} key={`${citation.documentId}-${index}`}>
          {citation.quote}
          <span className={styles.quoteSource}>
            {t(`${PREFIX}.from`, { name: documentName(citation.documentId) })}
            <AppButton
              onClick={() =>
                openDocument(citation.documentId, { end: citation.end, start: citation.start })
              }
              size="small"
              type="link"
            >
              {t(`${PREFIX}.viewSource`)}
            </AppButton>
          </span>
        </blockquote>
      ))}
    </div>
  );
}

/** A document's text, with the quoted passage marked and scrolled to. */
export function DocumentViewer({
  documentId,
  onClose,
  projectId,
  range,
}: {
  documentId: string;
  onClose: () => void;
  projectId: string;
  range?: { end: number; start: number };
}) {
  const { t } = useTranslation();
  const [document, setDocument] = useState<RequirementDocumentContent | null>(null);
  const [failed, setFailed] = useState(false);
  const marked = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setDocument(null);
    setFailed(false);
    getDocument(projectId, documentId)
      .then((next) => active && setDocument(next))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [documentId, projectId]);

  useEffect(() => {
    marked.current?.scrollIntoView?.({ block: "center" });
  }, [document]);

  const content = document?.content ?? "";
  const quoted = range && range.end > range.start && range.end <= content.length ? range : null;
  return (
    <Drawer
      destroyOnHidden
      onClose={onClose}
      open
      title={document?.name ?? t(`${PREFIX}.document`)}
      width={640}
    >
      {failed ? (
        <Alert message={t(`${PREFIX}.documentLoadFailed`)} showIcon type="error" />
      ) : !document ? (
        <Spin />
      ) : (
        <p className={styles.content}>
          {quoted ? (
            <>
              {content.slice(0, quoted.start)}
              <mark className={styles.highlight} ref={marked}>
                {content.slice(quoted.start, quoted.end)}
              </mark>
              {content.slice(quoted.end)}
            </>
          ) : (
            content
          )}
        </p>
      )}
    </Drawer>
  );
}
