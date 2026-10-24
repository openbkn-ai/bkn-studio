/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import type { EvidenceChainView } from "./evidence-chain.types";
import styles from "./EvidenceChainPanels.module.css";

export function EvidenceScopeNotices({ notices }: Pick<EvidenceChainView, "notices">) {
  const { t } = useTranslation();
  return (
    <>
      {notices?.[0] && <p className={styles.notice}>{notices[0]}</p>}
      {(notices?.length ?? 0) > 1 && (
        <details className={styles.scopeDetails}>
          <summary>{t("bknTrace.evidenceChain.scopeDetails")}</summary>
          {notices?.slice(1).map((notice, i) => (
            <p className={styles.notice} key={i}>
              {notice}
            </p>
          ))}
        </details>
      )}
    </>
  );
}
