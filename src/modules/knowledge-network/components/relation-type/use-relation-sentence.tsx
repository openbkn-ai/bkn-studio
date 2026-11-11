/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { RelationDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import { relationSentenceParts } from "@/modules/knowledge-network/utils/relation-declarations";

const PREFIX = "knowledgeNetwork.relationDeclarations";
const END_TAG = /(<from\/>|<to\/>)/;

/**
 * Puts the names in bold where the message has `<from/>` and `<to/>`. They are filled in as text,
 * so a name is never read as markup.
 */
function fillEnds(message: string, names: { from: string; to: string }) {
  return message
    .split(END_TAG)
    .map((piece, index) =>
      piece === "<from/>" || piece === "<to/>" ? (
        <strong key={index}>{piece === "<from/>" ? names.from : names.to}</strong>
      ) : (
        piece
      ),
    );
}

/**
 * Says what the cardinality and the required ends mean, from source to target, with the names of
 * the ends in bold. A relation from an object type to itself that reads the same from either end
 * is said once.
 */
export function useRelationSentence(
  value: RelationDeclarations | undefined,
  names: { source: string; target: string },
): ReactNode {
  const { t } = useTranslation();
  let parts = relationSentenceParts(value);
  if (parts.length === 2 && names.source === names.target && parts[0].count === parts[1].count) {
    parts = [parts[0]];
  }
  if (!parts.length) {
    return undefined;
  }
  return (
    <>
      {parts.map((part, index) => (
        <span key={part.from}>
          {index > 0 ? t(`${PREFIX}.sentenceSeparator`) : null}
          {fillEnds(t(`${PREFIX}.count.${part.count}`), {
            from: names[part.from],
            to: names[part.from === "source" ? "target" : "source"],
          })}
        </span>
      ))}
      {t(`${PREFIX}.sentenceEnd`)}
    </>
  );
}
