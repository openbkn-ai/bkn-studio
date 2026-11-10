/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkRelationTypeRecord,
  RelationDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";
import {
  fallbackPathsFor,
  hasSameEnds,
  normalizeRelationDeclarations,
  type RelationEnds,
} from "@/modules/knowledge-network/utils/relation-declarations";

import { RelationCardinalityBadge } from "./RelationCardinalityBadge";
import styles from "./RelationDeclarationsSummary.module.css";

const PREFIX = "knowledgeNetwork.relationDeclarations";

type RelationDeclarationsSummaryProps = {
  declarations: RelationDeclarations | undefined;
  ends: RelationEnds;
  onOpenRelationType: (relationTypeId: string) => void;
  relationTypeId: string;
  /** The relation types with the same source and target, for names and fallback paths. */
  sameEndRelationTypes: KnowledgeNetworkRelationTypeRecord[];
  sourceName: string;
  targetName: string;
};

/**
 * The declarations of a relation type, as its detail page shows them. An item the relation does
 * not declare reads "not declared", never a default that would look confirmed.
 */
export function RelationDeclarationsSummary({
  declarations: value,
  ends,
  onOpenRelationType,
  relationTypeId,
  sameEndRelationTypes,
  sourceName,
  targetName,
}: RelationDeclarationsSummaryProps) {
  const { t } = useTranslation();
  const declarations = normalizeRelationDeclarations(value);
  const fallbackPaths = fallbackPathsFor(relationTypeId, sameEndRelationTypes);
  const separator = t(`${PREFIX}.separator`);

  const notDeclared = <strong className={styles.muted}>{t(`${PREFIX}.notDeclared`)}</strong>;
  const link = (id: string) => (
    <button className={styles.link} key={id} onClick={() => onOpenRelationType(id)} type="button">
      {sameEndRelationTypes.find((item) => item.id === id)?.name ?? id}
    </button>
  );
  const item = (label: string, content: ReactNode) => (
    <div key={label}>
      <span>{label}</span>
      {content}
    </div>
  );

  return (
    <div className={styles.grid}>
      {item(
        t(`${PREFIX}.reverseName`),
        declarations?.reverseName ? <strong>{declarations.reverseName}</strong> : notDeclared,
      )}
      {item(
        t(`${PREFIX}.cardinality`),
        declarations?.cardinality ? (
          // What it means is on the badge's hover.
          <strong>
            <RelationCardinalityBadge
              declarations={declarations}
              showLabel
              sourceName={sourceName}
              targetName={targetName}
            />
          </strong>
        ) : (
          notDeclared
        ),
      )}
      {item(
        t(`${PREFIX}.requiredEnds`),
        declarations?.requiredEnds ? (
          <strong>
            {declarations.requiredEnds
              .map((end) =>
                t(`${PREFIX}.requiredEnd.${end}`, { source: sourceName, target: targetName }),
              )
              .join(separator)}
          </strong>
        ) : (
          notDeclared
        ),
      )}
      {declarations?.characteristics || hasSameEnds(ends)
        ? item(
            t(`${PREFIX}.characteristics`),
            declarations?.characteristics ? (
              <strong>
                {declarations.characteristics
                  .map((characteristic) => t(`${PREFIX}.characteristic.${characteristic}`))
                  .join(separator)}
              </strong>
            ) : (
              notDeclared
            ),
          )
        : null}
      {item(
        t(`${PREFIX}.importance`),
        <strong>{t(`${PREFIX}.importanceOption.${declarations?.importance ?? "primary"}`)}</strong>,
      )}
      {declarations?.importance === "secondary"
        ? item(
            t(`${PREFIX}.fallbackFor`),
            declarations.fallbackFor ? (
              <strong>{link(declarations.fallbackFor)}</strong>
            ) : (
              <strong className={styles.muted}>{t(`${PREFIX}.fallbackForNone`)}</strong>
            ),
          )
        : null}
      {item(
        t(`${PREFIX}.verification`),
        declarations?.verification ? (
          <strong>{t(`${PREFIX}.verificationShort.${declarations.verification}`)}</strong>
        ) : (
          notDeclared
        ),
      )}
      {fallbackPaths.length
        ? item(
            t(`${PREFIX}.fallbackPaths`),
            <strong className={styles.links}>{fallbackPaths.map((path) => link(path.id))}</strong>,
          )
        : null}
    </div>
  );
}
