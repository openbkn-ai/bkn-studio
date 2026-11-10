/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type {
  DeclarationDefinitionKind,
  DefinitionDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";

import { definitionDetailPath } from "./definition-path";
import { useDefinitionName } from "./use-definition-name";
import styles from "./DefinitionDeclarations.module.css";

const PREFIX = "knowledgeNetwork.definitionDeclarations";

type DeprecatedBannerProps = {
  declarations: DefinitionDeclarations | undefined;
  kind: DeclarationDefinitionKind;
  networkId: string;
};

/** The top of a deprecated definition's detail page: why, and what to use instead. */
export function DeprecatedBanner({ declarations, kind, networkId }: DeprecatedBannerProps) {
  const { t } = useTranslation();
  const lifecycle = declarations?.lifecycle;
  const replacedBy = lifecycle?.status === "deprecated" ? lifecycle.replacedBy : undefined;
  const replacementName = useDefinitionName(
    networkId,
    replacedBy ? { id: replacedBy, kind } : undefined,
  );
  if (lifecycle?.status !== "deprecated") {
    return null;
  }

  return (
    <Alert
      className={styles.banner}
      description={
        replacedBy ? (
          <span className={styles.bannerReplacement}>
            {t(`${PREFIX}.bannerReplacedBy`)}
            <Link to={definitionDetailPath(networkId, { id: replacedBy, kind })}>
              {replacementName || replacedBy}
            </Link>
          </span>
        ) : undefined
      }
      message={t(`${PREFIX}.banner.${kind}`, { reason: lifecycle.reason })}
      showIcon
      type="warning"
    />
  );
}
