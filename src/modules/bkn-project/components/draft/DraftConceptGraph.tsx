/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EmptyStatePanel } from "@/framework/ui/common/EmptyStatePanel";
import { draftGraph } from "@/modules/bkn-project/components/draft/graph";
import type { Draft } from "@/modules/bkn-project/types/draft";
import { OntologyGraphView } from "@/modules/knowledge-network/components/preview/OntologyGraphView";

import styles from "./DraftTables.module.css";

const NO_INDEX = new Set<string>();

/**
 * The draft's concept model: what is adopted, drawn as object types and the relations between
 * them. Clicking an object type opens it when the page can.
 */
export function DraftConceptGraph({
  draft,
  onOpen,
  title,
}: {
  draft: Draft;
  onOpen?: (objectTypeId: string) => void;
  /** Shown above the graph when the page around it has no heading for it. */
  title?: string;
}) {
  const { t } = useTranslation();
  const graph = useMemo(() => draftGraph(draft), [draft]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  let body: ReactNode;
  if (!graph.nodes.length) {
    body = (
      <EmptyStatePanel
        description={t("bknProject.model.graph.emptyDescription")}
        title={t("bknProject.model.graph.empty")}
      />
    );
  } else {
    body = (
      <div className={styles.graph} data-testid="draft-concept-graph">
        <OntologyGraphView
          graph={graph}
          indexedIds={NO_INDEX}
          onSelect={(id) => {
            setSelectedId(id);
            if (id) {
              onOpen?.(id);
            }
          }}
          selectedId={selectedId}
        />
      </div>
    );
  }
  return title ? (
    <section>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {body}
    </section>
  ) : (
    body
  );
}
