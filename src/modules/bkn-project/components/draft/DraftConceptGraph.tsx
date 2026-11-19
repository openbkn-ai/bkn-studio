/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ExistingMark } from "@/modules/bkn-project/components/draft/ExistingMark";
import {
  draftGraphRecords,
  existingGraphRecords,
} from "@/modules/bkn-project/components/draft/graph";
import type { Draft, ExistingDefinitions } from "@/modules/bkn-project/types/draft";
import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";
import type { KnowledgeNetworkPreviewEdge } from "@/modules/knowledge-network/types/knowledge-network";

/**
 * The draft's concept model, drawn as the knowledge network draws its ontology: one colour per
 * object type, arrows for relations and the types listed beside it. What the draft would not
 * publish (not adopted, or waiting on a decision) is drawn faint and dashed. Clicking an object
 * type opens it where the page can.
 */
export function DraftConceptGraph({
  action,
  draft,
  highlightedIds,
  networkId,
  onOpen,
  onOpenRelation,
  previewEdges,
  title,
}: {
  /** Shown after the key in the header, such as a link to the modeling page. */
  action?: ReactNode;
  /** The draft, or else the model the network already has. */
  draft: Draft | ExistingDefinitions;
  /** Object types ringed for attention, such as those the network diagnosis finds cut off. */
  highlightedIds?: ReadonlySet<string>;
  /** The project's network: the graph is drawn as its ontology. */
  networkId: string;
  onOpen?: (objectTypeId: string) => void;
  /** Opens a relation type where the page can; relations take no clicks without it. */
  onOpenRelation?: (relationTypeId: string) => void;
  /** Relations a suggestion would make or adopt, drawn dashed while it is looked at. */
  previewEdges?: readonly KnowledgeNetworkPreviewEdge[];
  title: string;
}) {
  const { t } = useTranslation();
  const records = useMemo(
    () => ("items" in draft ? draftGraphRecords(draft) : existingGraphRecords(draft)),
    [draft],
  );
  // What the network already has is drawn with a dot, as the lists mark it.
  const existing = useMemo(
    () =>
      new Set(
        "items" in draft
          ? draft.items.objectTypes.filter((item) => item.existing).map((item) => item.id)
          : draft.objectTypes.map((item) => item.id),
      ),
    [draft],
  );

  return (
    <OntologyGraphCard
      emptyDescription={t("bknProject.model.graph.emptyDescription")}
      fadedIds={records.faded}
      highlightedIds={highlightedIds}
      // A click may open an editing panel over the page, which a maximized graph would cover.
      leaveMaximizedOnSelect
      legend={
        <>
          {/* Every drafted type and relation the graph draws, adopted or not. */}
          <span>
            {t("bknProject.model.graph.counts", {
              objects: records.objectTypes.length,
              relations: records.relationTypes.length,
            })}
          </span>
          {/* Only a draft has what is not adopted, drawn faint. */}
          {"items" in draft ? <span>{t("bknProject.model.graph.legend")}</span> : null}
          {existing.size ? (
            <span>
              <ExistingMark />
              {t("bknProject.model.existing.mark")}
            </span>
          ) : null}
          {highlightedIds?.size ? (
            <span>{t("bknProject.diagnosis.graph.islands", { count: highlightedIds.size })}</span>
          ) : null}
          {previewEdges?.length ? <span>{t("bknProject.diagnosis.graph.preview")}</span> : null}
          {action}
        </>
      }
      loadConceptGroups={false}
      logicalGrouping={false}
      markedIds={existing}
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
      previewEdges={previewEdges}
      relationTypes={records.relationTypes}
      selectedId={null}
      title={title}
    />
  );
}
