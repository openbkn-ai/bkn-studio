/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DefinitionDeclarations } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./DefinitionDeclarations.module.css";

/**
 * A definition's name as a list shows it, tagged when the definition is deprecated. A definition
 * in use shows only its name.
 */
export function DeprecatedName({
  children,
  declarations,
}: {
  children: ReactNode;
  declarations: DefinitionDeclarations | undefined;
}) {
  const { t } = useTranslation();
  if (declarations?.lifecycle?.status !== "deprecated") {
    return <>{children}</>;
  }
  return (
    <span className={styles.nameWithTag}>
      {children}
      <Tag title={declarations.lifecycle.reason}>
        {t("knowledgeNetwork.definitionDeclarations.deprecatedTag")}
      </Tag>
    </span>
  );
}
