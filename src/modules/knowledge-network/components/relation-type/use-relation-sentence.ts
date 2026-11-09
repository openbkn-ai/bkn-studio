/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";

import type { RelationDeclarations } from "@/modules/knowledge-network/types/knowledge-network";
import { relationSentenceParts } from "@/modules/knowledge-network/utils/relation-declarations";

const PREFIX = "knowledgeNetwork.relationDeclarations";

/** Says what the cardinality and the required ends mean, from source to target. */
export function useRelationSentence(
  value: RelationDeclarations | undefined,
  names: { source: string; target: string },
) {
  const { t } = useTranslation();
  const parts = relationSentenceParts(value).map((part) =>
    t(`${PREFIX}.count.${part.count}`, {
      from: names[part.from],
      to: names[part.from === "source" ? "target" : "source"],
    }),
  );
  if (!parts.length) {
    return undefined;
  }
  const sentence =
    parts.length === 2
      ? t(`${PREFIX}.sentence`, { first: parts[0], second: parts[1] })
      : t(`${PREFIX}.sentenceOne`, { first: parts[0] });
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
