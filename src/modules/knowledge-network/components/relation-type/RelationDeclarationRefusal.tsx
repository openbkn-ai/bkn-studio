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
  type DeclarationRefusal,
  relationTypesInDetails,
} from "@/modules/knowledge-network/services/shared/declaration-errors";

import styles from "./RelationDeclarationsSection.module.css";

const PREFIX = "knowledgeNetwork.relationDeclarations";

type RelationDeclarationRefusalProps = {
  networkId: string;
  refusal: DeclarationRefusal;
  /**
   * The relation type saved, which the links leave out: while creating, the ID entered, as the
   * relation does not exist yet.
   */
  relationTypeId?: string;
};

/**
 * A save the backend refused for its relation declarations: its description, its details (English
 * until openbkn-ai/bkn-foundry#2991), and a link to each other relation type they name, opened
 * beside the form so it keeps what was entered.
 */
export function RelationDeclarationRefusal({
  networkId,
  refusal,
  relationTypeId,
}: RelationDeclarationRefusalProps) {
  const { t } = useTranslation();
  const named = relationTypesInDetails(refusal.details).filter((id) => id !== relationTypeId);

  return (
    <Alert
      className={styles.refusal}
      description={
        refusal.details || named.length ? (
          <>
            {refusal.details ? <p className={styles.refusalDetails}>{refusal.details}</p> : null}
            {named.length ? (
              <span className={styles.refusalLinks}>
                {named.map((id) => (
                  <Link
                    key={id}
                    rel="noreferrer"
                    target="_blank"
                    to={`/knowledge-network/workspace/${networkId}/relation-types/${id}/detail`}
                  >
                    {t(`${PREFIX}.refusalOpen`, { name: id })}
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
