/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Tag } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./RelationDeclarationTags.module.css";

const PREFIX = "knowledgeNetwork.relationDeclarations.listTag";

type RelationDeclarationTagsProps = {
  declarations: RelationDeclarations | undefined;
  /** Relation types whose names a fallback path may use; an absent one shows by its ID. */
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
};

/**
 * A relation type's name with the tags of a secondary relation, of a fallback path and of an
 * inferred join, which name prefixes used to stand in for.
 */
export function RelationDeclarationName({
  children,
  declarations,
  relationTypes,
}: RelationDeclarationTagsProps & { children: ReactNode }) {
  const { t } = useTranslation();
  const tags = [
    declarations?.importance === "secondary" ? (
      <Tag key="secondary">{t(`${PREFIX}.secondary`)}</Tag>
    ) : null,
    declarations?.fallbackFor ? (
      <Tag color="blue" key="fallback">
        {t(`${PREFIX}.fallbackFor`, {
          name:
            relationTypes.find((item) => item.id === declarations.fallbackFor)?.name ??
            declarations.fallbackFor,
        })}
      </Tag>
    ) : null,
    declarations?.verification === "unconfirmed" ? (
      <Tag color="orange" key="unconfirmed">
        {t(`${PREFIX}.unconfirmed`)}
      </Tag>
    ) : null,
  ].filter(Boolean);

  if (!tags.length) {
    return children;
  }
  return (
    <span className={styles.stack}>
      {children}
      <span className={styles.tags}>{tags}</span>
    </span>
  );
}
