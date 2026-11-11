/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  definitionsInDetails,
  type NamedDefinition,
} from "@/modules/knowledge-network/services/shared/definition-refusals";
import type { DeclarationRefusal } from "@/modules/knowledge-network/services/shared/declaration-errors";

import { definitionDetailPath } from "./definition-path";
import styles from "./DefinitionDeclarations.module.css";

const PREFIX = "knowledgeNetwork.definitionDeclarations";

type DefinitionRefusalProps = {
  networkId: string;
  refusal: DeclarationRefusal;
  /** The definition saved, which the links leave out: while creating, the ID entered. */
  saved: { id?: string; kind: NamedDefinition["kind"] };
};

/**
 * A save the backend refused for the aliases or lifecycle: its description, its details (English
 * until openbkn-ai/bkn-foundry#2991), and a link to each other definition they name, opened beside
 * the form so it keeps what was entered.
 */
export function DefinitionRefusal({ networkId, refusal, saved }: DefinitionRefusalProps) {
  const { t } = useTranslation();
  const named = definitionsInDetails(
    refusal.details,
    saved.id ? { id: saved.id, kind: saved.kind } : undefined,
  );

  return (
    <Alert
      className={styles.refusal}
      description={
        refusal.details || named.length ? (
          <>
            {refusal.details ? <p className={styles.refusalDetails}>{refusal.details}</p> : null}
            {named.length ? (
              <span className={styles.refusalLinks}>
                {named.map((item) => (
                  <Link
                    key={`${item.kind}:${item.id}`}
                    rel="noreferrer"
                    target="_blank"
                    to={definitionDetailPath(networkId, item)}
                  >
                    {t(`${PREFIX}.refusalOpen`, {
                      id: item.id,
                      kind: t(`${PREFIX}.kind.${item.kind}`),
                    })}
                  </Link>
                ))}
              </span>
            ) : null}
          </>
        ) : undefined
      }
      message={t(`${PREFIX}.refusalTitle`, { description: refusal.description })}
      showIcon
      type="error"
    />
  );
}
