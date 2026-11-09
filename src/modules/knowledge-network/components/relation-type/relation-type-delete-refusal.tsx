/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { RelationTypeStillReferencedError } from "@/modules/knowledge-network/services/shared/declaration-errors";

import styles from "./RelationDeclarationsSection.module.css";

const PREFIX = "knowledgeNetwork.relationDeclarations.deleteRefused";

/**
 * Says why a relation type delete failed: the definitions that still refer to it (as fallback path
 * or replacement), or the backend's message for any other failure.
 */
export function useRelationTypeDeleteRefusal() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();

  return useCallback(
    (error: unknown, records: Array<{ id: string; name: string }>) => {
      if (!(error instanceof RelationTypeStillReferencedError)) {
        void message.error(extractRequestErrorMessage(error));
        return;
      }
      const { references, description } = error.refusal;
      const name =
        records.find((record) => record.id === error.relationTypeId)?.name ?? error.relationTypeId;
      void modal.error({
        centered: true,
        content: (
          <div className={styles.deleteRefusal}>
            <p>{description}</p>
            {references.length ? (
              <>
                <p className={styles.deleteRefusalHeading}>{t(`${PREFIX}.references`)}</p>
                <ul>
                  {references.map((reference) => (
                    <li key={reference}>{reference}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ),
        title: t(`${PREFIX}.title`, { name }),
        width: 560,
      });
    },
    [message, modal, t],
  );
}
