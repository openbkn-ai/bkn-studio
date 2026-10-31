/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { draftGraphRecords } from "@/modules/bkn-project/components/draft/graph";
import type { Draft } from "@/modules/bkn-project/types/draft";
import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";

/**
 * The draft's concept model, drawn as the knowledge network draws its ontology: one colour per
 * object type, arrows for relations and the types listed beside it. What the draft would not
 * publish (not adopted, or waiting on a decision) is drawn faint and dashed. Clicking an object
 * type opens it where the page can.
 */
export function DraftConceptGraph({
  action,
  draft,
  networkId,
  onOpen,
  onOpenRelation,
  title,
}: {
  /** Shown after the key in the header, such as a link to the modeling page. */
  action?: ReactNode;
  draft: Draft;
  /** The project's network: the graph is drawn as its ontology. */
  networkId: string;
  onOpen?: (objectTypeId: string) => void;
  /** Opens a relation type where the page can; relations take no clicks without it. */
  onOpenRelation?: (relationTypeId: string) => void;
  title: string;
}) {
  const { t } = useTranslation();
  const records = useMemo(() => draftGraphRecords(draft), [draft]);

  return (
    <OntologyGraphCard
      emptyDescription={t("bknProject.model.graph.emptyDescription")}
      fadedIds={records.faded}
      legend={
        <>
          {/* Every drafted type and relation the graph draws, adopted or not. */}
          <span>
            {t("bknProject.model.graph.counts", {
              objects: records.objectTypes.length,
              relations: records.relationTypes.length,
            })}
          </span>
          <span>{t("bknProject.model.graph.legend")}</span>
          {action}
        </>
      }
      loadConceptGroups={false}
      logicalGrouping={false}
      networkId={networkId}
      objectTypes={records.objectTypes}
      // Nothing stays selected: the types beside the graph stay listed, and a click opens the
      // object type where the page can, so clicking it again after closing it opens it again.
      onSelectedIdChange={(id) => {
        if (id) {
          onOpen?.(id);
        }
      }}
      onSelectEdge={onOpenRelation}
      parallelEdges
      relationTypes={records.relationTypes}
      selectedId={null}
      title={title}
    />
  );
}
