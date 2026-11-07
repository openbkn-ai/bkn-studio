/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Typography } from "antd";
import { useTranslation } from "react-i18next";

import type { PropertyDeclarationIssue } from "@/modules/knowledge-network/utils/property-declarations";

import styles from "./PropertyDeclarationIssues.module.css";

const PREFIX = "knowledgeNetwork.propertyDeclarations";

/** A backend refusal of the declarations of a save, and the property it names, if any. */
export type PropertyDeclarationRefusal = {
  description: string;
  details?: string;
  property?: string;
};

/**
 * Above the data property canvas: the rules across properties the declarations break, and a
 * backend refusal of them. Each names the property to fix, which opens it.
 */
export function PropertyDeclarationIssues({
  issues,
  onEditProperty,
  refusal,
}: {
  issues: readonly PropertyDeclarationIssue[];
  onEditProperty: (property: string) => void;
  refusal?: PropertyDeclarationRefusal | null;
}) {
  const { t } = useTranslation();

  const editLink = (property: string) => (
    <Typography.Link className={styles.edit} onClick={() => onEditProperty(property)}>
      {t(`${PREFIX}.editProperty`, { property })}
    </Typography.Link>
  );

  return (
    <>
      {issues.length ? (
        <Alert
          banner
          className={styles.alert}
          description={
            <ul className={styles.list}>
              {issues.map((issue) => (
                <li key={`${issue.key}/${issue.properties.join("/")}`}>
                  {t(`${PREFIX}.issue.${issue.key}`, {
                    ...issue.params,
                    other: issue.properties[1] ?? "",
                    property: issue.properties[0],
                  })}
                  {editLink(issue.properties[0])}
                </li>
              ))}
            </ul>
          }
          message={t(`${PREFIX}.issuesTitle`)}
          type="error"
        />
      ) : null}
      {refusal ? (
        <Alert
          banner
          className={styles.alert}
          description={
            <>
              {refusal.details ? <div className={styles.details}>{refusal.details}</div> : null}
              {refusal.property ? (
                <div>
                  {t(`${PREFIX}.refusalProperty`, { property: refusal.property })}
                  {editLink(refusal.property)}
                </div>
              ) : null}
            </>
          }
          message={t(`${PREFIX}.refusalTitle`, { description: refusal.description })}
          type="error"
        />
      ) : null}
    </>
  );
}
