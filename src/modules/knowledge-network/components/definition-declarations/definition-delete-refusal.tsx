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
import { DefinitionStillReferencedError } from "@/modules/knowledge-network/services/shared/definition-refusals";

import styles from "./DefinitionDeclarations.module.css";

const PREFIX = "knowledgeNetwork.definitionDeclarations.deleteRefused";

/**
 * Says why a delete failed: the definitions that still name the deleted one as their replacement,
 * or the backend's message for any other failure.
 */
export function useDefinitionDeleteRefusal() {
  const { t } = useTranslation();
  const { message, modal } = useAppServices();

  return useCallback(
    (error: unknown, records: ReadonlyArray<{ id: string; name: string }>) => {
      if (!(error instanceof DefinitionStillReferencedError)) {
        void message.error(extractRequestErrorMessage(error));
        return;
      }
      const { definition, message: description, references } = error;
      const name = records.find((record) => record.id === definition.id)?.name ?? definition.id;
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
